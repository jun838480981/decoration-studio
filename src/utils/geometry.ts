/**
 * 几何工具（SPEC §C.1；口径逐条对齐 OF §6.2 与 `装修设计.html` L900-908 / L1619-1640 / L2155-2225）。
 *
 * 设计约束：
 * - **纯函数**：所有函数只依赖入参，⛔ 不 import store / 组件（B5 的同源要求：便于 Node 下单测）。
 * - 数组口径与原实现一致：`Pt` 是 `[x,y]`、`Rect` 是 `[x0,y0,x1,y1]`、`Wall` 是 `[x0,y0,x1,y1,kind]`。
 * - 单位统一 mm（面积换算 m² 时各自 `/1e6`）。
 *
 * 与 SPEC §D.1 的对应：本文件额外实现 `area/perim/bbox/boundsOf/aabb/snapRects/snapMove/snapPoint/
 * inAnyRoom/pushOut`（SPEC §C.1 列在 `utils/geometry.ts`）以及户型构造 helper（原 L612-625）。
 */
import type { Bounds, Pt, Rect, Vec2 } from '@/types/geometry';
import type { Furniture } from '@/types/furniture';
import type { Door, PlanStructure, Room, Slide, Wall, WallKind, Win } from '@/types/plan';

/** 只读点（`Pt` 的只读视图）：多边形工具只读入参，便于传 `readonly` 数组 */
export type PointLike = readonly [number, number];

/** 紧凑元组 → 具名对象（SPEC §D.1） */
export function pt2vec(p: PointLike): Vec2 {
  return { x: p[0], y: p[1] };
}

/** 具名对象 → 紧凑元组（SPEC §D.1） */
export function vec2pt(v: Vec2): Pt {
  return [v.x, v.y];
}

// ---------------------------------------------------------------------------
// 基础数学
// ---------------------------------------------------------------------------

/** 角度规范到 0..359（原 `norm`，L906） */
export function norm(angle: number): number {
  return ((Math.round(angle) % 360) + 360) % 360;
}

/** 两位小数的面积/长度显示（原 `fmt`，L905） */
export function fmt(n: number, digits = 2): string {
  return Number.isFinite(n) ? n.toFixed(digits) : (0).toFixed(digits);
}

/** 取整到 step 的倍数（网格吸附用） */
export function roundTo(value: number, step: number): number {
  if (!Number.isFinite(step) || step <= 0) return value;
  return Math.round(value / step) * step;
}

/** 两点距离 */
export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** 多边形面积（m²，鞋带公式；原 `area`，L902） */
export function area(poly: readonly PointLike[]): number {
  if (poly.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    sum += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(sum) / 2 / 1e6;
}

/** 多边形周长（m；原 `perim`，L903） */
export function perim(poly: readonly PointLike[]): number {
  if (poly.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    sum += Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  return sum / 1000;
}

/** 多边形包围盒 `[x0,y0,x1,y1]`（原 `bbox`，L904） */
export function bbox(poly: readonly PointLike[]): Rect {
  if (poly.length === 0) return [0, 0, 0, 0];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of poly) {
    x0 = Math.min(x0, p[0]);
    y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]);
    y1 = Math.max(y1, p[1]);
  }
  return [x0, y0, x1, y1];
}

/** 结构包围盒（原 `boundsOf`，L869-876）：无几何时回落空白户型视口，其余外扩 1400mm */
export function boundsOf(structure: Partial<PlanStructure>): Bounds {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const w of structure.walls ?? []) {
    x0 = Math.min(x0, w[0], w[2]);
    y0 = Math.min(y0, w[1], w[3]);
    x1 = Math.max(x1, w[0], w[2]);
    y1 = Math.max(y1, w[1], w[3]);
  }
  for (const room of structure.rooms ?? []) {
    for (const q of room.poly ?? []) {
      x0 = Math.min(x0, q[0]);
      y0 = Math.min(y0, q[1]);
      x1 = Math.max(x1, q[0]);
      y1 = Math.max(y1, q[1]);
    }
  }
  if (!Number.isFinite(x0)) return { x: -2000, y: -1800, w: 18000, h: 13000 };
  const pad = 1400;
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}

/** 旋转家具的半宽/半高（原 `aabb`，L907） */
export function aabb(f: Pick<Furniture, 'w' | 'd' | 'rot'>): { hw: number; hh: number } {
  const a = (f.rot * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  return { hw: (f.w / 2) * c + (f.d / 2) * s, hh: (f.w / 2) * s + (f.d / 2) * c };
}

/** 旋转家具的轴对齐外接矩形（选中框/命中测试用） */
export function furnitureRect(f: Pick<Furniture, 'cx' | 'cy' | 'w' | 'd' | 'rot'>): Rect {
  const { hw, hh } = aabb(f);
  return [f.cx - hw, f.cy - hh, f.cx + hw, f.cy + hh];
}

/** 世界坐标 → 家具局部坐标（原 `size` 手柄的反解，L1742-1743） */
export function toLocal(f: Pick<Furniture, 'cx' | 'cy' | 'rot'>, x: number, y: number): Vec2 {
  const a = (f.rot * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dx = x - f.cx;
  const dy = y - f.cy;
  return { x: dx * c + dy * s, y: -dx * s + dy * c };
}

/** 局部坐标 → 世界坐标 */
export function toWorld(f: Pick<Furniture, 'cx' | 'cy' | 'rot'>, lx: number, ly: number): Vec2 {
  const a = (f.rot * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: f.cx + lx * c - ly * s, y: f.cy + lx * s + ly * c };
}

/** 射线法：点是否在任一房间内（原 `inAnyRoom`，L2173-2178） */
export function inAnyRoom(rooms: readonly Pick<Room, 'poly'>[], x: number, y: number): boolean {
  return rooms.some((room) => {
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

/** 墙体是否横放（长边在 x；原 `hz` 判定，L2166 等） */
export function wallIsHorizontal(w: Wall): boolean {
  return w[2] - w[0] >= w[3] - w[1];
}

/** 命中墙体下标（自后向前，后画的优先；原 `wallAt`，L2172） */
export function wallAtIndex(walls: readonly Wall[], p: Vec2): number {
  for (let i = walls.length - 1; i >= 0; i -= 1) {
    const w = walls[i];
    if (p.x >= w[0] && p.x <= w[2] && p.y >= w[1] && p.y <= w[3]) return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// 吸附（原 L908 / L1619-1640 / L1543-1555）
// ---------------------------------------------------------------------------

/** 家具吸附用的**贴边矩形**：未拆墙体 + 窗（原 `snapRects`，L908） */
export function snapRects(walls: readonly Wall[], wins: readonly Win[], demolished: readonly string[]): Rect[] {
  const rects: Rect[] = [];
  walls.forEach((w, i) => {
    if (!demolished.includes(`w${i}`)) rects.push([w[0], w[1], w[2], w[3]]);
  });
  for (const win of wins) rects.push([win[0], win[1], win[2], win[3]]);
  return rects;
}

export interface SnapMoveOptions {
  /** 是否启用贴边吸附（`ui.flags.wallSnap`） */
  wallSnap: boolean;
  /** 屏幕像素 → 户型 mm 系数（`1 / view.s`） */
  k: number;
  /** 栅格步长，缺省 10mm（原 `grid()`，L1619） */
  grid?: number;
}

/**
 * 家具移动吸附（原 `snapMove`，L1620-1630）：
 * 先按 10mm 取整，再在容差 `10/view.s` 内贴到最近的一条墙/窗边线（x 与 y 各自独立取最近）。
 */
export function snapMove(
  f: Pick<Furniture, 'w' | 'd' | 'rot'>,
  cx: number,
  cy: number,
  rects: readonly Rect[],
  options: SnapMoveOptions,
): Vec2 {
  const grid = options.grid ?? 10;
  let nx = roundTo(cx, grid);
  let ny = roundTo(cy, grid);
  if (!options.wallSnap) return { x: nx, y: ny };
  const { hw, hh } = aabb(f);
  const tol = 10 * options.k;
  let bx = tol;
  let by = tol;
  for (const r of rects) {
    if (!(r[3] < cy - hh - tol || r[1] > cy + hh + tol)) {
      for (const ex of [r[0], r[2]]) {
        for (const c of [ex + hw, ex - hw]) {
          if (Math.abs(c - cx) < bx) {
            bx = Math.abs(c - cx);
            nx = c;
          }
        }
      }
    }
    if (!(r[2] < cx - hw - tol || r[0] > cx + hw + tol)) {
      for (const ey of [r[1], r[3]]) {
        for (const c of [ey + hh, ey - hh]) {
          if (Math.abs(c - cy) < by) {
            by = Math.abs(c - cy);
            ny = c;
          }
        }
      }
    }
  }
  return { x: nx, y: ny };
}

export interface SnapPointOptions {
  /** 容差（mm），调用方传 `8 / view.s`（原 L1633） */
  tol: number;
  /** Shift 正交锁（原 L1638） */
  shift?: boolean;
  /** 起点（正交锁的锚点，= `ui.measureA`） */
  anchor?: Vec2 | null;
  /** 栅格步长，缺省 10mm */
  grid?: number;
}

/** 测量端点吸附（原 `snapPoint`，L1631-1640）：10mm 取整 → 墙/窗边线吸附 → Shift 正交锁 */
export function snapPoint(p: Vec2, rects: readonly Rect[], options: SnapPointOptions): Vec2 {
  const grid = options.grid ?? 10;
  let x = roundTo(p.x, grid);
  let y = roundTo(p.y, grid);
  let bx = options.tol;
  let by = options.tol;
  for (const r of rects) {
    for (const ex of [r[0], r[2]]) {
      if (Math.abs(ex - p.x) < bx) {
        bx = Math.abs(ex - p.x);
        x = ex;
      }
    }
    for (const ey of [r[1], r[3]]) {
      if (Math.abs(ey - p.y) < by) {
        by = Math.abs(ey - p.y);
        y = ey;
      }
    }
  }
  const anchor = options.anchor;
  if (options.shift && anchor) {
    if (Math.abs(x - anchor.x) > Math.abs(y - anchor.y)) y = anchor.y;
    else x = anchor.x;
  }
  return { x, y };
}

/** 墙/窗端点表（原 `snapEnds`，L2185-2194）：横墙取两端中线点，竖墙同理，再加房间角点 */
export function snapEnds(walls: readonly Wall[], rooms: readonly Pick<Room, 'poly'>[]): Vec2[] {
  const out: Vec2[] = [];
  for (const w of walls) {
    if (wallIsHorizontal(w)) {
      out.push({ x: w[0], y: (w[1] + w[3]) / 2 }, { x: w[2], y: (w[1] + w[3]) / 2 });
    } else {
      out.push({ x: (w[0] + w[2]) / 2, y: w[1] }, { x: (w[0] + w[2]) / 2, y: w[3] });
    }
  }
  for (const room of rooms) {
    for (const q of room.poly ?? []) out.push({ x: q[0], y: q[1] });
  }
  return out;
}

/** 最近的墙端点（原 `nearestEnd`，L2195-2202） */
export function nearestEnd(points: readonly Vec2[], p: Vec2, tol: number): Vec2 | null {
  let best: Vec2 | null = null;
  let bd = tol;
  for (const q of points) {
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d <= bd) {
      bd = d;
      best = { x: q.x, y: q.y };
    }
  }
  return best;
}

export interface WallFace {
  axis: 'h' | 'v';
  v: number;
  a: number;
  b: number;
}

/** 找到点所在/邻近的墙轴线（原 `hitWallFace`，L2262-2275）：避免接墙时错半个墙厚 */
export function hitWallFace(walls: readonly Wall[], p: Vec2, tol: number): WallFace | null {
  let best: WallFace | null = null;
  let bd = tol;
  for (const w of walls) {
    if (wallIsHorizontal(w)) {
      const cy = (w[1] + w[3]) / 2;
      if (p.x >= w[0] - tol && p.x <= w[2] + tol && Math.abs(p.y - cy) <= bd) {
        bd = Math.abs(p.y - cy);
        best = { axis: 'h', v: cy, a: w[0], b: w[2] };
      }
    } else {
      const cx = (w[0] + w[2]) / 2;
      if (p.y >= w[1] - tol && p.y <= w[3] + tol && Math.abs(p.x - cx) <= bd) {
        bd = Math.abs(p.x - cx);
        best = { axis: 'v', v: cx, a: w[1], b: w[3] };
      }
    }
  }
  return best;
}

/** 起笔对齐到墙轴（原 `alignToFace`，L2204-2208） */
export function alignToFace(walls: readonly Wall[], p: Vec2, thick: number): Vec2 {
  const face = hitWallFace(walls, p, Math.max(1, thick) * 0.6);
  if (!face) return p;
  return face.axis === 'h' ? { x: p.x, y: face.v } : { x: face.v, y: p.y };
}

export interface OrthoResult {
  b: Vec2;
  axis: 'h' | 'v' | null;
}

/**
 * 正交（原 `orthoDelta`，L2220-2225）：从 `a` 出发只在水平/竖直里取更接近的一个。
 * `alt` 为真（按住 Alt）或正交关闭时原样返回。
 */
export function orthoDelta(a: Vec2 | null, b: Vec2, orthoOn: boolean, alt = false): OrthoResult {
  if (!orthoOn || alt || !a) return { b, axis: null };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (!dx && !dy) return { b, axis: null };
  return Math.abs(dx) >= Math.abs(dy) ? { b: { x: b.x, y: a.y }, axis: 'h' } : { b: { x: a.x, y: b.y }, axis: 'v' };
}

export interface GridLines {
  v: number[];
  h: number[];
}

/** 编辑网格线（原 `gridLines`，L2227-2235）：间距 <20mm 或线条 >400 条时跳过 */
export function gridLines(
  view: { x0: number; y0: number; s: number },
  stage: { w: number; h: number },
  grid: number,
  gridLayerOn: boolean,
): GridLines {
  const out: GridLines = { v: [], h: [] };
  const g = grid || 100;
  if (!gridLayerOn || g < 20) return out;
  const x0 = view.x0;
  const y0 = view.y0;
  const x1 = x0 + stage.w / view.s;
  const y1 = y0 + stage.h / view.s;
  if ((x1 - x0) / g > 400 || (y1 - y0) / g > 400) return out;
  for (let x = Math.ceil(x0 / g) * g; x <= x1; x += g) out.v.push(x);
  for (let y = Math.ceil(y0 / g) * g; y <= y1; y += g) out.h.push(y);
  return out;
}

/**
 * 推出重叠（原 `pushOut`，L1543-1555）：最多 4 轮，沿**穿透较浅**的轴向推离，使家具刚好贴边。
 * 返回是否发生过推动（便于调用方决定是否记入撤销栈）。
 */
export function pushOut(f: Furniture, rects: readonly Rect[], rounds = 4): boolean {
  let moved = false;
  for (let round = 0; round < rounds; round += 1) {
    const { hw, hh } = aabb(f);
    let pushed = false;
    for (const r of rects) {
      const ox = Math.min(f.cx + hw, r[2]) - Math.max(f.cx - hw, r[0]);
      const oy = Math.min(f.cy + hh, r[3]) - Math.max(f.cy - hh, r[1]);
      if (ox <= 0 || oy <= 0) continue;
      if (ox < oy) {
        f.cx += f.cx < (r[0] + r[2]) / 2 ? -ox : ox;
      } else {
        f.cy += f.cy < (r[1] + r[3]) / 2 ? -oy : oy;
      }
      moved = true;
      pushed = true;
    }
    if (!pushed) break;
  }
  return moved;
}

// ---------------------------------------------------------------------------
// 户型构造 helper（原 L612-625，供 `data/presets/**` 使用）
// ---------------------------------------------------------------------------

/** 矩形房间多边形（原 `R`，L506） */
export function rectPoly(x0: number, y0: number, x1: number, y1: number): Pt[] {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}

/** 沿一条直线切段、留出门窗洞（原 `segs`，L612-619） */
export function segments(from: number, to: number, holes?: readonly (readonly [number, number])[]): [number, number][] {
  const a0 = Math.min(from, to);
  const a1 = Math.max(from, to);
  const sorted = [...(holes ?? [])].slice().sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let cur = a0;
  for (const [a, b] of sorted) {
    if (a > cur) out.push([cur, Math.min(a, a1)]);
    cur = Math.max(cur, b);
  }
  if (cur < a1) out.push([cur, a1]);
  return out.filter((s) => s[1] - s[0] > 1);
}

/** 横墙（原 `hWall`，L620） */
export function hWall(
  x0: number,
  x1: number,
  y: number,
  t: number,
  holes?: readonly (readonly [number, number])[],
  type: WallKind = 'e',
): Wall[] {
  return segments(x0, x1, holes).map(([a, b]) => [a, y, b, y + t, type] as Wall);
}

/** 竖墙（原 `vWall`，L621） */
export function vWall(
  y0: number,
  y1: number,
  x: number,
  t: number,
  holes?: readonly (readonly [number, number])[],
  type: WallKind = 'e',
): Wall[] {
  return segments(y0, y1, holes).map(([a, b]) => [x, a, x + t, b, type] as Wall);
}

/** 内墙（原 `IW`，L622） */
export function innerWall(x0: number, y0: number, x1: number, y1: number, type: WallKind = 'n'): Wall {
  return [x0, y0, x1, y1, type];
}

/** 平开门（原 `DR`，L623） */
export function doorOf(
  name: string,
  rect: Rect,
  h: Pt,
  c: Pt,
  o: Pt,
  len: number,
  entry = false,
): Door {
  return { name, rect, h, c, o, len, entry };
}

/** 矩形房间（原 `RM`，L624）：`at` 缺省取矩形中心（带 texture 的 `at` 由调用方显式给） */
export function roomRect(
  id: string,
  name: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  mat: Room['mat'],
  at?: Pt,
): Room {
  return { id, name, poly: rectPoly(x0, y0, x1, y1), mat, at: at ?? [(x0 + x1) / 2, (y0 + y1) / 2] };
}

/** 推拉门（原 `SD`，L625） */
export function slideOf(x0: number, y0: number, x1: number, y1: number, v: boolean): Slide {
  return { rect: [x0, y0, x1, y1], v: Boolean(v) };
}