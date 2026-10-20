/**
 * 户型结构编辑状态机（SPEC §A11 / §1.12；原 `装修设计.html` L2137-2545）。
 *
 * 分层：
 * 1. **纯函数**（可 Node 单测）：`cutWall` / `remapDemolished` / `eraseWall` / 门窗开洞几何 / 房间多边形清洗；
 * 2. **预览渲染**：`editPreviewSvg()` 生成 `#gEdit` 的内容（原 `renderEditPreview`，L2312-2352）；
 * 3. **组合式** `usePlanEditor()`：把纯函数绑到 store（`plan.planEdit` 进**结构撤销栈**、`ui.edit` 状态）。
 *
 * 交互口径（⛔ 不要"顺手优化"，这些都是保真项）：
 * - 画墙：按住拖动，`>80mm` 才成墙；起笔 `alignToFace()` 对齐墙轴，避免错半个墙厚；
 * - 画房间：逐点，点回起点（`16px` 内）或回车 / 双击闭合；末点拉回起点轴线；去重点；面积 <0.5m² 拒绝；
 * - 加门：沿墙居中钳制，洞长 <300 拒绝；开向由 `inAnyRoom()` 判断；加窗：厚度 <200 拒绝；
 * - 删除：按 `[data-op]` → `[data-wall]` → `[data-room]` 的顺序探测；
 * - 吸附：`grid`（默认 100mm）/ `corner`（墙轴端点与房间角点，容差 `14/view.s`）/ `off`；
 * - 正交：默认开，按住 **Alt** 临时自由角度。
 */
import { usePlanStore } from '@/stores/plan';
import { useLayoutStore } from '@/stores/layout';
import { useToastStore } from '@/stores/toast';
import { useUiStore } from '@/stores/ui';
import {
  alignToFace as alignToFaceGeometry,
  dist,
  gridLines,
  nearestEnd,
  orthoDelta,
  roundTo,
  snapEnds,
  wallAtIndex,
  wallIsHorizontal,
} from '@/utils/geometry';
import { uid } from '@/utils/id';
import type { Rect, Vec2 } from '@/types/geometry';
import type { Door, PlanStructure, Room, Slide, Wall, WallKind, Win } from '@/types/plan';
import type { EditState, ViewTransform } from '@/types/state';
import type { TokenResolver } from '@/types/theme';

/** 成墙的最小长度（mm，原 L2466） */
export const MIN_WALL_LENGTH = 80;
/** 房间闭合的点击容差（屏幕 px，原 L2427） */
export const ROOM_CLOSE_TAP_PX = 16;
/** 房间最小面积（m²，原 L2367） */
export const MIN_ROOM_AREA = 0.5;
/** 门洞最小长度（mm，原 L2388） */
export const MIN_DOOR_LENGTH = 300;
/** 窗洞最小厚度（mm，原 L2398） */
export const MIN_WINDOW_DEPTH = 200;
/** 墙角吸附容差（屏幕 px，原 L2213） */
export const CORNER_SNAP_PX = 14;

// ---------------------------------------------------------------------------
// 1. 纯函数
// ---------------------------------------------------------------------------

/**
 * 墙体索引重映射（原 `remapDemolished`，L2161-2164）。
 *
 * ⚠️ **与原实现逐字等价**：`i` 处的墙被替换为 `added` 段后，
 * `n < i` 保持不变、`n > i` 偏移 `added - 1`、`n === i` 丢弃；
 * 当 `added === 0`（删除墙体）时，原实现会把 `n > i` 的标记**一并丢弃**——本版保持该行为（不静默改语义）。
 */
export function remapDemolished(demolished: readonly string[], i: number, added: number): string[] {
  const shift = added - 1;
  return demolished
    .map((id) => {
      const n = Number.parseInt(id.slice(1), 10);
      if (n < i) return id;
      if (n > i && added) return `w${n + shift}`;
      return null;
    })
    .filter((id): id is string => id !== null);
}

export interface WallCutResult {
  walls: Wall[];
  demolished: string[];
}

/**
 * 在墙体 `i` 上开洞（原 `cutWall`，L2165-2171）：保留洞口两侧的墙段，并重映射 `demolished` 下标。
 * @param a 洞口起点（沿墙轴向，mm）
 * @param b 洞口终点（沿墙轴向，mm）
 * @param hz 该墙是否横放
 */
export function cutWall(walls: readonly Wall[], demolished: readonly string[], i: number, a: number, b: number, hz: boolean): WallCutResult {
  const wall = walls[i];
  if (!wall) return { walls: [...walls], demolished: [...demolished] };
  const kind = wall[4];
  const out: Wall[] = [];
  if (hz) {
    if (a > wall[0] + 1) out.push([wall[0], wall[1], a, wall[3], kind]);
    if (b < wall[2] - 1) out.push([b, wall[1], wall[2], wall[3], kind]);
  } else {
    if (a > wall[1] + 1) out.push([wall[0], wall[1], wall[2], a, kind]);
    if (b < wall[3] - 1) out.push([wall[0], b, wall[2], wall[3], kind]);
  }
  const next = [...walls];
  next.splice(i, 1, ...out);
  return { walls: next, demolished: remapDemolished(demolished, i, out.length) };
}

/** 删除整段墙（原 `eraseWall`，L2402） */
export function eraseWall(walls: readonly Wall[], demolished: readonly string[], i: number): WallCutResult {
  const next = [...walls];
  next.splice(i, 1);
  return { walls: next, demolished: remapDemolished(demolished, i, 0) };
}

export interface OpeningEraseResult {
  wins: Win[];
  doors: Door[];
  slides: Slide[];
}

/** 删除门窗（原 `eraseOp`，L2403-2407）：`key` 形如 `w3` / `d2` / `s0` */
export function eraseOpening(
  wins: readonly Win[],
  doors: readonly Door[],
  slides: readonly Slide[],
  key: string,
): OpeningEraseResult {
  const type = key[0];
  const index = Number.parseInt(key.slice(1), 10);
  const nextWins = [...wins];
  const nextDoors = [...doors];
  const nextSlides = [...slides];
  if (type === 'd') nextDoors.splice(index, 1);
  else if (type === 'w') nextWins.splice(index, 1);
  else if (type === 's') nextSlides.splice(index, 1);
  return { wins: nextWins, doors: nextDoors, slides: nextSlides };
}

/**
 * 由拖拽的两个端点生成墙段（原 `editUp` 的成墙公式，L2466-2471）。
 * 返回 `null` 表示位移不足（< `MIN_WALL_LENGTH`）。
 */
export function wallSegment(a: Vec2, b: Vec2, thick: number, kind: WallKind): Wall | null {
  if (Math.abs(b.x - a.x) <= MIN_WALL_LENGTH && Math.abs(b.y - a.y) <= MIN_WALL_LENGTH) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const rect: Rect =
    Math.abs(dx) >= Math.abs(dy)
      ? [Math.min(a.x, b.x), Math.round((a.y + b.y) / 2 - thick / 2), Math.max(a.x, b.x), Math.round((a.y + b.y) / 2 + thick / 2)]
      : [Math.round((a.x + b.x) / 2 - thick / 2), Math.min(a.y, b.y), Math.round((a.x + b.x) / 2 + thick / 2), Math.max(a.y, b.y)];
  return [Math.round(rect[0]), Math.round(rect[1]), Math.round(rect[2]), Math.round(rect[3]), kind];
}

export interface DoorPlacement {
  door: Door;
  /** 需要在墙上开的洞（轴向区间 + 是否横墙） */
  cut: { a: number; b: number; hz: boolean };
}

/**
 * 在墙上放门（原 `addDoorAt`，L2375-2391）：沿墙居中钳制、开向由「洞口外侧是否在房间内」判定。
 * 返回 `null` 表示这段墙太短（原 toast「这段墙太短，放不下门」）。
 */
export function doorAt(
  wall: Wall,
  p: Vec2,
  doorW: number,
  insideRoom: (x: number, y: number) => boolean,
): DoorPlacement | null {
  const hz = wallIsHorizontal(wall);
  const L = doorW;
  let a: number;
  let b: number;
  let rect: Rect;
  let h: Vec2;
  let c: Vec2;
  let o: Vec2;
  if (hz) {
    a = Math.max(wall[0], Math.min(wall[2] - L, p.x - L / 2));
    b = Math.min(wall[2], a + L);
    rect = [a, wall[1], b, wall[3]];
    h = { x: a, y: wall[1] };
    c = { x: 1, y: 0 };
    o = insideRoom((a + b) / 2, wall[1] - 450) ? { x: 0, y: -1 } : { x: 0, y: 1 };
  } else {
    a = Math.max(wall[1], Math.min(wall[3] - L, p.y - L / 2));
    b = Math.min(wall[3], a + L);
    rect = [wall[0], a, wall[2], b];
    h = { x: wall[0], y: a };
    c = { x: 0, y: 1 };
    o = insideRoom(wall[0] - 450, (a + b) / 2) ? { x: -1, y: 0 } : { x: 1, y: 0 };
  }
  if (b - a < MIN_DOOR_LENGTH) return null;
  return {
    door: {
      name: '门',
      rect,
      h: [h.x, h.y],
      c: [c.x, c.y],
      o: [o.x, o.y],
      len: Math.round(b - a),
      entry: false,
    },
    cut: { a, b, hz },
  };
}

export interface WinPlacement {
  rect: Rect;
  cut: { a: number; b: number; hz: boolean };
}

/** 在墙上放窗（原 `addWinAt`，L2392-2401）：`null` = 这段墙太短（或厚度不足 200） */
export function winAt(wall: Wall, p: Vec2, winW: number): WinPlacement | null {
  const hz = wallIsHorizontal(wall);
  const L = winW;
  let rect: Rect;
  if (hz) {
    const a = Math.max(wall[0], Math.min(wall[2] - L, p.x - L / 2));
    const b = Math.min(wall[2], a + L);
    rect = [a, wall[1], b, wall[3]];
  } else {
    const a = Math.max(wall[1], Math.min(wall[3] - L, p.y - L / 2));
    const b = Math.min(wall[3], a + L);
    rect = [wall[0], a, wall[2], b];
  }
  if (Math.min(rect[2] - rect[0], rect[3] - rect[1]) < MIN_WINDOW_DEPTH) return null;
  return { rect, cut: { a: hz ? rect[0] : rect[1], b: hz ? rect[2] : rect[3], hz } };
}

/**
 * 房间多边形清洗（原 `closeRoomPoly`，L2353-2369）：
 * 末点拉回起点轴线 → 去重合点（>1mm）→ 至少 3 点 → 面积 ≥ `MIN_ROOM_AREA`。
 * @returns `null` = 不合法（调用方给提示）
 */
export function cleanRoomPolygon(points: readonly Vec2[], orthoOn: boolean): { poly: [number, number][]; at: [number, number]; error?: 'too-few' | 'too-small' } {
  const p = points.slice();
  if (p.length >= 3) {
    const last = p[p.length - 1];
    const first = p[0];
    const o = orthoDelta(last, first, orthoOn, false);
    if (o.axis === 'h') p[p.length - 1] = { x: last.x, y: first.y };
    else if (o.axis === 'v') p[p.length - 1] = { x: first.x, y: last.y };
  }
  const poly: [number, number][] = [];
  for (const q of p) {
    const previous = poly[poly.length - 1];
    if (!previous || Math.hypot(q.x - previous[0], q.y - previous[1]) > 1) poly.push([q.x, q.y]);
  }
  if (poly.length < 3) return { poly, at: [0, 0], error: 'too-few' };
  // 鞋带公式（与 utils/geometry.area 同口径，避免引入额外依赖方向）
  let sum = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const q = poly[i];
    const r = poly[(i + 1) % poly.length];
    sum += q[0] * r[1] - r[0] * q[1];
  }
  if (Math.abs(sum) / 2 / 1e6 < MIN_ROOM_AREA) return { poly, at: [0, 0], error: 'too-small' };
  let sx = 0;
  let sy = 0;
  for (const q of poly) {
    sx += q[0];
    sy += q[1];
  }
  return { poly, at: [Math.round(sx / poly.length), Math.round(sy / poly.length)] };
}

/** 房间 id 生成（原 L2371） */
export function newRoomId(): string {
  return uid('r');
}

// ---------------------------------------------------------------------------
// 2. 预览渲染（原 `renderEditPreview` L2312-2352）
// ---------------------------------------------------------------------------

export interface EditPreviewContext {
  edit: EditState;
  view: ViewTransform;
  stage: { w: number; h: number };
  walls: readonly Wall[];
  rooms: readonly Room[];
  /** 编辑网格图层是否开启（`ui.flags.grid`） */
  gridLayerOn: boolean;
  resolve: TokenResolver;
}

/** 吸附提示（原 `renderSnapGuides`，L2236-2248）：网格 → 圆环或贯穿虚线；墙角 → 圆环 */
export function snapGuidesSvg(p: Vec2 | null, ctx: EditPreviewContext): string {
  if (!p) return '';
  const { edit, view, stage, resolve } = ctx;
  const k = 1 / view.s;
  const g = edit.grid || 100;
  const gridColor = resolve('snap-grid');
  const cornerColor = resolve('snap-corner');
  const both = edit.snap === 'corner';
  if (!both && edit.snap !== 'grid') return '';
  if (edit.snap === 'grid' || both) {
    const onX = Math.abs(p.x / g - Math.round(p.x / g)) < 0.001;
    const onY = Math.abs(p.y / g - Math.round(p.y / g)) < 0.001;
    if (onX && onY) {
      return `<circle cx="${p.x}" cy="${p.y}" r="${4.5 * k}" fill="none" stroke="${gridColor}" stroke-width="${1.4 * k}"/>`;
    }
    return (
      (onX
        ? `<line x1="${p.x}" y1="${view.y0 - 4000}" x2="${p.x}" y2="${view.y0 + stage.h / view.s + 4000}" stroke="${gridColor}" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="4 4" opacity=".7"/>`
        : '') +
      (onY
        ? `<line x1="${view.x0 - 4000}" y1="${p.y}" x2="${view.x0 + stage.w / view.s + 4000}" y2="${p.y}" stroke="${gridColor}" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="4 4" opacity=".7"/>`
        : '')
    );
  }
  return `<circle cx="${p.x}" cy="${p.y}" r="${5 * k}" fill="none" stroke="${cornerColor}" stroke-width="${1.6 * k}"/>`;
}

/** 长度 + 角度提示（原 `lenTag`，L2250-2259） */
export function lenTagSvg(a: Vec2 | null, b: Vec2 | null, ctx: EditPreviewContext): string {
  if (!a || !b) return '';
  const k = 1 / ctx.view.s;
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  if (L < 1) return '';
  const ang = (Math.abs(Math.atan2(b.y - a.y, b.x - a.x)) * 180) / Math.PI;
  const deg = Math.round(Math.min(ang, 180 - ang));
  const text = Math.round(L) + (deg < 0.5 || Math.abs(deg - 90) < 0.5 ? '' : `  ${deg}°`);
  return `<text x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - 12 * k}" font-size="${12 * k}" fill="${ctx.resolve('accent')}" text-anchor="middle"
    stroke="${ctx.resolve('surface')}" stroke-width="${3.5 * k}" paint-order="stroke" font-weight="600">${text}</text>`;
}

/** 编辑网格线（原 `renderEditPreview` 的 `gl` 段，L2317-2319） */
export function editGridSvg(ctx: EditPreviewContext): string {
  const gl = gridLines(ctx.view, ctx.stage, ctx.edit.grid || 100, ctx.gridLayerOn);
  const color = ctx.resolve('plan-grid-major');
  const x1 = ctx.view.x0 + ctx.stage.w / ctx.view.s;
  const y1 = ctx.view.y0 + ctx.stage.h / ctx.view.s;
  let s = '';
  for (const x of gl.v) {
    s += `<line x1="${x}" y1="${ctx.view.y0}" x2="${x}" y2="${y1}" stroke="${color}" stroke-width="1" vector-effect="non-scaling-stroke" opacity=".55"/>`;
  }
  for (const y of gl.h) {
    s += `<line x1="${ctx.view.x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${color}" stroke-width="1" vector-effect="non-scaling-stroke" opacity=".55"/>`;
  }
  return s;
}

/** `#gEdit` 的完整内容（原 `renderEditPreview`，L2312-2352） */
export function editPreviewSvg(ctx: EditPreviewContext): string {
  const { edit, view, stage, resolve } = ctx;
  const k = 1 / view.s;
  const accent = resolve('accent');
  const corner = resolve('snap-corner');
  const x1 = view.x0 + stage.w / view.s;
  const y1 = view.y0 + stage.h / view.s;
  const dot = (x: number, y: number, color: string): string =>
    `<circle cx="${x}" cy="${y}" r="${5 * k}" fill="${color}" stroke="${resolve('surface')}" stroke-width="${1.5 * k}"/>`;
  let s = editGridSvg(ctx);

  if (edit.mode === 'wall' && edit.drag && edit.drag.a) {
    const a = edit.drag.a;
    const b = edit.drag.b ?? a;
    const t = edit.thick;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const r: Rect =
      Math.abs(dx) >= Math.abs(dy)
        ? [Math.min(a.x, b.x), Math.round(a.y - t / 2), Math.abs(dx), t]
        : [Math.round(a.x - t / 2), Math.min(a.y, b.y), t, Math.abs(dy)];
    s += `<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" fill="${accent}" fill-opacity=".28" stroke="${accent}" stroke-width="${1.5 * k}" vector-effect="non-scaling-stroke"/>`;
    s += dot(a.x, a.y, accent);
    s += snapGuidesSvg(edit.hover ?? b, ctx);
    s += lenTagSvg(a, b, ctx);
    if (edit.axis) {
      s +=
        edit.axis === 'h'
          ? `<line x1="${view.x0}" y1="${a.y}" x2="${x1}" y2="${a.y}" stroke="${corner}" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="7 5" opacity=".6"/>`
          : `<line x1="${a.x}" y1="${view.y0}" x2="${a.x}" y2="${y1}" stroke="${corner}" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="7 5" opacity=".6"/>`;
    }
  }

  if (edit.mode === 'room') {
    const pts = edit.hover ? [...edit.pts, edit.hover] : [...edit.pts];
    if (pts.length > 0) {
      s += `<polyline points="${pts.map((q) => `${q.x},${q.y}`).join(' ')}" fill="${pts.length > 2 ? accent : 'none'}" fill-opacity=".14" stroke="${accent}" stroke-width="${1.5 * k}" vector-effect="non-scaling-stroke"/>`;
      pts.forEach((q, i) => {
        s += dot(q.x, q.y, i === 0 ? corner : accent);
      });
      const n = edit.pts.length;
      const last = edit.pts[n - 1];
      if (last && edit.hover) s += lenTagSvg(last, edit.hover, ctx);
      if (last && edit.axis) {
        s +=
          edit.axis === 'h'
            ? `<line x1="${view.x0}" y1="${last.y}" x2="${x1}" y2="${last.y}" stroke="${corner}" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="7 5" opacity=".55"/>`
            : `<line x1="${last.x}" y1="${view.y0}" x2="${last.x}" y2="${y1}" stroke="${corner}" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="7 5" opacity=".55"/>`;
      }
      s += snapGuidesSvg(edit.rawHover ?? edit.hover, ctx);
      if (n >= 3) {
        s += `<circle cx="${edit.pts[0].x}" cy="${edit.pts[0].y}" r="${10 * k}" fill="none" stroke="${corner}" stroke-width="${1.6 * k}"/>`;
      }
    }
  }
  return s;
}

// ---------------------------------------------------------------------------
// 3. 组合式：把状态机绑到 store
// ---------------------------------------------------------------------------

export interface PlanEditorApi {
  /** 吸附后的编辑落点（原 `snapP`，L2209-2218） */
  snapPoint(p: Vec2, free?: boolean): Vec2;
  /** 正交（原 `orthoDelta` + `edit.ortho`） */
  ortho(a: Vec2 | null, b: Vec2, alt?: boolean): { b: Vec2; axis: 'h' | 'v' | null };
  /** 起笔对齐（原 `alignToFace`） */
  align(a: Vec2): Vec2;
  /** 指针按下（编辑模式） */
  down(p: Vec2, targetKey: string | null, modifiers: { altKey?: boolean }): void;
  /** 指针移动（编辑模式） */
  move(p: Vec2, modifiers: { altKey?: boolean }): void;
  /** 指针抬起（编辑模式）：成墙 */
  up(): void;
  /** 闭合房间（回车 / 双击 / 点回起点） */
  closeRoom(): void;
  /** 删除（`[data-op]` → `[data-wall]` → `[data-room]`） */
  erase(targetKey: string | null): void;
}

/** 编辑内核：绑定 `plan` / `layout` / `ui` / `toast` 四个 store */
export function usePlanEditor(): PlanEditorApi {
  const plan = usePlanStore();
  const layout = useLayoutStore();
  const ui = useUiStore();
  const toast = useToastStore();

  function levelData(): PlanStructure & Partial<{ name: string; elev: number }> {
    return plan.levelData;
  }

  function snapPoint(p: Vec2, free = false): Vec2 {
    const edit = ui.edit;
    if (free || edit.snap === 'off') return { x: p.x, y: p.y };
    if (edit.snap === 'corner') {
      const q = nearestEnd(snapEnds(plan.walls, plan.rooms), p, CORNER_SNAP_PX / ui.view.s);
      if (q) return q;
    }
    const grid = edit.grid || 100;
    return { x: roundTo(p.x, grid), y: roundTo(p.y, grid) };
  }

  function ortho(a: Vec2 | null, b: Vec2, alt = false): { b: Vec2; axis: 'h' | 'v' | null } {
    return orthoDelta(a, b, ui.edit.ortho, alt);
  }

  function align(p: Vec2): Vec2 {
    return alignToFaceGeometry(plan.walls, p, ui.edit.thick || 200);
  }

  function erase(targetKey: string | null): void {
    if (!targetKey) return;
    const [scope, key] = targetKey.split(':');
    if (scope === 'op') {
      plan.planEdit(() => {
        const result = eraseOpening(levelData().wins, levelData().doors, levelData().slides, key);
        const data = levelData();
        data.wins = result.wins;
        data.doors = result.doors;
        data.slides = result.slides;
      });
      toast.push('已删除');
      return;
    }
    if (scope === 'wall') {
      const index = Number.parseInt(key.slice(1), 10);
      plan.planEdit(() => {
        const result = eraseWall(levelData().walls, layout.demolished, index);
        const data = levelData();
        data.walls = result.walls;
        layout.demolished = result.demolished;
      });
      toast.push('已删除一段墙');
      return;
    }
    if (scope === 'room') {
      plan.planEdit(() => {
        const data = levelData();
        data.rooms = data.rooms.filter((room) => room.id !== key);
      });
      ui.select(null);
      toast.push('已删除房间');
    }
  }

  function addDoorAt(index: number, p: Vec2): void {
    const wall = plan.walls[index];
    if (!wall) return;
    const placement = doorAt(wall, p, ui.edit.doorW || 900, (x, y) => isInsideAnyRoom(x, y));
    if (!placement) {
      toast.push('这段墙太短，放不下门', 'warn');
      return;
    }
    plan.planEdit(() => {
      const cut = cutWall(levelData().walls, layout.demolished, index, placement.cut.a, placement.cut.b, placement.cut.hz);
      const data = levelData();
      data.walls = cut.walls;
      data.doors = [...data.doors, placement.door];
      layout.demolished = cut.demolished;
    });
    toast.push('已添加门');
  }

  function addWinAt(index: number, p: Vec2): void {
    const wall = plan.walls[index];
    if (!wall) return;
    const placement = winAt(wall, p, ui.edit.winW || 1500);
    if (!placement) {
      toast.push('这段墙太短，放不下窗', 'warn');
      return;
    }
    plan.planEdit(() => {
      const cut = cutWall(levelData().walls, layout.demolished, index, placement.cut.a, placement.cut.b, placement.cut.hz);
      const data = levelData();
      data.walls = cut.walls;
      data.wins = [...data.wins, [placement.rect[0], placement.rect[1], placement.rect[2], placement.rect[3]]];
      layout.demolished = cut.demolished;
    });
    toast.push('已添加窗');
  }

  function isInsideAnyRoom(x: number, y: number): boolean {
    return plan.rooms.some((room) => {
      const poly = room.poly;
      let hit = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
        const [xi, yi] = poly[i];
        const [xj, yj] = poly[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
      }
      return hit;
    });
  }

  function closeRoom(): void {
    const edit = ui.edit;
    const result = cleanRoomPolygon(edit.pts, edit.ortho);
    edit.pts = [];
    edit.hover = null;
    edit.axis = null;
    edit.drag = null;
    if (result.error === 'too-few') {
      toast.push('至少要有三个不重合的点', 'warn');
      return;
    }
    if (result.error === 'too-small') {
      toast.push('房间太小了，再画大一点', 'warn');
      return;
    }
    const room: Room = {
      id: newRoomId(),
      name: `房间${plan.rooms.length + 1}`,
      poly: result.poly,
      mat: 'tile800',
      at: result.at,
    };
    plan.planEdit(() => {
      const data = levelData();
      data.rooms = [...data.rooms, room];
    });
    toast.push(`已添加「${room.name}」`);
  }

  function down(p: Vec2, targetKey: string | null, modifiers: { altKey?: boolean }): void {
    const edit = ui.edit;
    if (edit.mode === 'wall') {
      edit.drag = { a: align(snapPoint(p)), b: null };
      edit.axis = null;
      return;
    }
    if (edit.mode === 'room') {
      const last = edit.pts[edit.pts.length - 1];
      let q = snapPoint(p);
      if (last) {
        q = ortho(last, q, modifiers.altKey).b;
        q = align(q);
      }
      if (edit.pts.length >= 3 && dist(q, edit.pts[0]) * ui.view.s < ROOM_CLOSE_TAP_PX) {
        closeRoom();
        return;
      }
      edit.pts = [...edit.pts, q];
      return;
    }
    if (edit.mode === 'door' || edit.mode === 'win') {
      const index = wallAtIndex(plan.walls, p);
      if (index < 0) {
        toast.push('请点在一段墙上', 'warn');
        return;
      }
      if (edit.mode === 'door') addDoorAt(index, p);
      else addWinAt(index, p);
      return;
    }
    if (edit.mode === 'erase') erase(targetKey);
  }

  function move(p: Vec2, modifiers: { altKey?: boolean }): void {
    const edit = ui.edit;
    if (edit.mode === 'wall' && edit.drag) {
      const a = edit.drag.a;
      const b = snapPoint(p);
      const o = ortho(a, b, modifiers.altKey);
      edit.drag = { a, b: o.b, axis: o.axis };
      edit.hover = b;
      return;
    }
    if (edit.mode === 'room' && edit.pts.length > 0) {
      const last = edit.pts[edit.pts.length - 1];
      const raw = snapPoint(p);
      const o = ortho(last, raw, modifiers.altKey);
      edit.hover = o.b;
      edit.axis = o.axis;
      edit.rawHover = raw;
    }
  }

  function up(): void {
    const edit = ui.edit;
    if (edit.mode === 'wall' && edit.drag) {
      const a = edit.drag.a;
      const raw = edit.drag.b;
      const b = raw ? ortho(a, raw, false).b : null;
      edit.drag = null;
      edit.axis = null;
      edit.hover = null;
      if (b) {
        const wall = wallSegment(a, b, edit.thick, edit.kind);
        if (wall) {
          plan.planEdit(() => {
            const data = levelData();
            data.walls = [...data.walls, wall];
          });
          toast.push('已添加一段墙');
        }
      }
    }
  }

  return { snapPoint, ortho, align, down, move, up, closeRoom, erase };
}