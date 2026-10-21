/**
 * 2D 图层的 SVG 片段生成器（**纯函数**，零 DOM / 零 store）。
 *
 * 为什么用「字符串 + v-html」而不是模板里逐元素写：
 * 1. 原实现（`装修设计.html` L1171-1336）就是拼字符串，逐条口径（字号 `k=1/view.s`、
 *    `vector-effect="non-scaling-stroke"`、45° 尺寸短划…）在这里可以逐字保留，评审可对照行号；
 * 2. 每个图层组是**一个** computed 字符串 → 依赖不变就不会重算（SPEC §F.2 的硬约束：
 *    拖动家具时只允许 `FurnitureLayer` / `SelectionLayer` 重算）；
 * 3. 颜色全部走 `TokenResolver`（`theme.resolve()` 的**字面值**），⛔ 不写 `var(--ds-*)`（B9 / R-EXP-1）。
 *
 * ⚠️ 用户数据（房间名 / 家具名）一律经 `esc()` 转义后再进字符串：
 * 原实现有 `esc()`（L1202、L1259），Vue 里 `v-html` 会**原样**注入，不转义即 XSS。
 */
import { materialPatternId } from './patterns';
import { furnLabelSize, furnShowsLabel, furnSVG } from './furniture-svg';
import { HANDLE_HIT, HANDLE_ROT_OFFSET, HANDLE_SCALE } from '@/composables/usePointerPanZoom';
import { aabb, area, fmt } from '@/utils/geometry';
import type { Furniture } from '@/types/furniture';
import type { Bounds, Pt } from '@/types/geometry';
import type { Door, Room, Slide, Stair, VoidShape, Wall, Win } from '@/types/plan';
import type { Measure, RoomOverride, Selection } from '@/types/state';
import type { TokenResolver } from '@/types/theme';

/** HTML/SVG 文本转义（原 `esc`，L1199 附近；用户可编辑的房间名必须转义） */
export function esc(text: string): string {
  return String(text).replace(/[&<>"']/g, (ch) => {
    const table: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return table[ch] ?? ch;
  });
}

/** 多边形 → `points` 属性值 */
export function pointsOf(poly: readonly (Pt | readonly [number, number])[]): string {
  return poly.map((p) => `${p[0]},${p[1]}`).join(' ');
}

/** 非缩放描边（原实现全站统一 `vector-effect="non-scaling-stroke"`） */
const NSS = 'vector-effect="non-scaling-stroke"';

// ---------------------------------------------------------------------------
// 1. 网格背景（原 `renderGrid`，L1290-1292）
// ---------------------------------------------------------------------------

/** 55000×55000 的整页底（网格开 → `url(#grid)`，否则透明） */
export function gridSvg(gridOn: boolean): string {
  return `<rect x="-20000" y="-20000" width="55000" height="55000" fill="${
    gridOn ? 'url(#grid)' : 'transparent'
  }" data-bg="1"/>`;
}

// ---------------------------------------------------------------------------
// 2. 房间 / 门槛石 / 楼梯 / 挑空（原 `renderRooms`，L1171-1194）
// ---------------------------------------------------------------------------

export interface RoomPaintContext {
  /** 主题令牌字面值（B9） */
  resolve: TokenResolver;
  /** 编辑模式：额外渲染一层 `fill="transparent"` 的可点面（原 L1174） */
  editOn: boolean;
  /** 用户覆盖（`layout.rooms`）：名称/材质优先于结构自带值 */
  overrides: Record<string, RoomOverride>;
}

/** 房间有效材质（覆盖优先） */
export function effectiveMat(room: Room, overrides: Record<string, RoomOverride>): Room['mat'] {
  return overrides[room.id]?.mat ?? room.mat;
}

/** 房间有效名称（覆盖优先） */
export function effectiveName(room: Room, overrides: Record<string, RoomOverride>): string {
  return overrides[room.id]?.name ?? room.name;
}

function thresholdSvg(rect: readonly [number, number, number, number], resolve: TokenResolver): string {
  const [a, b, c, d] = rect;
  return `<rect x="${a}" y="${b}" width="${c - a}" height="${d - b}" fill="${resolve(
    'surface-2',
  )}" stroke="${resolve('border-strong')}" stroke-width="1" ${NSS} pointer-events="none"/>`;
}

function stairsSvg(stairs: readonly Stair[], resolve: TokenResolver): string {
  let s = '';
  for (const st of stairs) {
    const n = Math.max(3, Math.round(Math.abs(st.y1 - st.y0) / 260));
    const dy = (st.y1 - st.y0) / n;
    const x1 = st.x + 1000;
    let t = `<rect x="${st.x}" y="${Math.min(st.y0, st.y1)}" width="1000" height="${Math.abs(
      st.y1 - st.y0,
    )}" fill="${resolve('surface-2')}" stroke="${resolve('border-strong')}" stroke-width="1" ${NSS}/>`;
    for (let i = 1; i < n; i += 1) {
      const y = st.y0 + dy * i;
      t += `<line x1="${st.x}" y1="${y}" x2="${x1}" y2="${y}" stroke="${resolve(
        'border-strong',
      )}" stroke-width="1" ${NSS}/>`;
    }
    const my = (st.y0 + st.y1) / 2;
    const dir = st.y1 > st.y0 ? 1 : -1;
    t += `<line x1="${st.x + 500}" y1="${my - dir * 700}" x2="${st.x + 500}" y2="${
      my + dir * 700
    }" stroke="${resolve('text-muted')}" stroke-width="1.6" ${NSS}/>
          <path d="M${st.x + 500} ${my + dir * 820} l-140 ${-dir * 200} l280 0 z" fill="${resolve('text-muted')}"/>`;
    s += `<g pointer-events="none">${t}</g>`;
  }
  return s;
}

function voidsSvg(voids: readonly VoidShape[], resolve: TokenResolver): string {
  return voids
    .map(
      (v) =>
        `<polygon points="${pointsOf(v.poly)}" fill="${resolve(
          'room-void',
        )}" fill-opacity=".06" stroke="${resolve('room-void')}" stroke-width="1.2" stroke-dasharray="7 4" ${NSS} pointer-events="none"/>`,
    )
    .join('');
}

/** `#gRooms` 的内容（原 `renderRooms`） */
export function roomsSvg(
  rooms: readonly Room[],
  doors: readonly Door[],
  slides: readonly Slide[],
  stairs: readonly Stair[],
  voids: readonly VoidShape[],
  ctx: RoomPaintContext,
): string {
  let s = '';
  if (ctx.editOn) {
    // 图案填充会让整块不可点 → 编辑模式单独补一层极淡可点面（只用于点选删除）
    for (const room of rooms) {
      s += `<polygon class="room" data-room="${esc(room.id)}" points="${pointsOf(
        room.poly,
      )}" fill="transparent"/>`;
    }
  }
  for (const room of rooms) {
    s += `<polygon class="room" data-room="${esc(room.id)}" points="${pointsOf(room.poly)}" fill="url(#${materialPatternId(
      effectiveMat(room, ctx.overrides),
    )})"/>`;
  }
  for (const door of doors) s += thresholdSvg(door.rect, ctx.resolve);
  for (const slide of slides) s += thresholdSvg(slide.rect, ctx.resolve);
  s += stairsSvg(stairs, ctx.resolve);
  s += voidsSvg(voids, ctx.resolve);
  return s;
}

// ---------------------------------------------------------------------------
// 3. 墙体（原 `renderWalls`，L1207-1215）
// ---------------------------------------------------------------------------

/**
 * `#gWalls` 的内容。四类墙 + 已拆：
 * - `b` 承重（`bearing` 图层开时高亮）/ `e` 外墙 / `n` 非承重 / `low` 矮墙（浅填充 + 深描边，ADR-17）
 * - 已拆：`wall-demolished` 低透明填充 + 虚线描边（原 L1212）
 */
export function wallsSvg(
  walls: readonly Wall[],
  demolished: readonly string[],
  bearingHighlight: boolean,
  resolve: TokenResolver,
): string {
  return walls
    .map((w, i) => {
      const [x0, y0, x1, y1, kind] = w;
      const id = `w${i}`;
      const dem = demolished.includes(id);
      let fill = resolve('wall-partition');
      let extra = '';
      if (kind === 'b') fill = resolve(bearingHighlight ? 'wall-bearing-hl' : 'wall-bearing');
      else if (kind === 'low') {
        fill = resolve('wall-low');
        extra = `stroke="${resolve('wall-low-stroke')}" stroke-width="1" ${NSS}`;
      } else if (kind === 'e') fill = resolve('wall-exterior');
      if (dem) {
        fill = resolve('wall-demolished');
        extra = `fill-opacity=".12" stroke="${resolve('wall-demolished')}" stroke-width="1.2" stroke-dasharray="5 3" ${NSS}`;
      }
      return `<rect class="wall" data-wall="${id}" x="${x0}" y="${y0}" width="${x1 - x0}" height="${
        y1 - y0
      }" fill="${fill}" ${extra}/>`;
    })
    .join('');
}

// ---------------------------------------------------------------------------
// 4. 门窗（原 `renderOpenings`，L1217-1252）
// ---------------------------------------------------------------------------

/**
 * `#gOpen` 的内容：窗（含 1/3、2/3 分格线）、平开门（门扇 + 开启弧 + 入户配色）、推拉门、
 * 以及**自动推导方向**的入户标识（D7：不再硬编码坐标，依入户门与包围盒中心）。
 */
export function openingsSvg(
  wins: readonly Win[],
  doors: readonly Door[],
  slides: readonly Slide[],
  bounds: Bounds,
  resolve: TokenResolver,
  entryText: string,
): string {
  const WS = `stroke="${resolve('window')}" stroke-width="1" ${NSS}`;
  let s = '';
  wins.forEach(([x0, y0, x1, y1], i) => {
    const w = x1 - x0;
    const h = y1 - y0;
    s += `<rect data-op="w${i}" x="${x0}" y="${y0}" width="${w}" height="${h}" fill="${resolve(
      'surface',
    )}" ${WS}/>`;
    if (w >= h) {
      for (const t of [1 / 3, 2 / 3]) s += `<line x1="${x0}" y1="${y0 + h * t}" x2="${x1}" y2="${y0 + h * t}" ${WS}/>`;
    } else {
      for (const t of [1 / 3, 2 / 3]) s += `<line x1="${x0 + w * t}" y1="${y0}" x2="${x0 + w * t}" y2="${y1}" ${WS}/>`;
    }
  });

  const DS = `stroke="${resolve('door')}" stroke-width="1" ${NSS}`;
  doors.forEach((d, i) => {
    const [hx, hy] = d.h;
    const L = d.len;
    const T = 40;
    const ox = hx + d.o[0] * L;
    const oy = hy + d.o[1] * L;
    const cx = hx + d.c[0] * L;
    const cy = hy + d.c[1] * L;
    const sweep = d.o[0] * d.c[1] - d.o[1] * d.c[0] > 0 ? 1 : 0;
    const col = d.entry ? resolve('door-entry') : resolve('door');
    s += `<polygon data-op="d${i}" points="${hx},${hy} ${ox},${oy} ${ox + d.c[0] * T},${
      oy + d.c[1] * T
    } ${hx + d.c[0] * T},${hy + d.c[1] * T}" fill="${resolve('surface')}" stroke="${col}" stroke-width="${
      d.entry ? 1.8 : 1
    }" ${NSS}/>`;
    s += `<path data-op="d${i}" d="M${ox} ${oy}A${L} ${L} 0 0 ${sweep} ${cx} ${cy}" fill="none" ${DS} stroke-dasharray="5 3" opacity=".7"/>`;
  });

  slides.forEach(({ rect: [x0, y0, x1, y1], v }, i) => {
    if (v) {
      const L = y1 - y0;
      const m = (x0 + x1) / 2;
      s += `<g data-op="s${i}"><rect x="${m - 45}" y="${y0}" width="40" height="${L * 0.55}" fill="${resolve(
        'surface',
      )}" ${DS}/><rect x="${m + 5}" y="${y1 - L * 0.55}" width="40" height="${L * 0.55}" fill="${resolve('surface')}" ${DS}/></g>`;
    } else {
      const L = x1 - x0;
      const m = (y0 + y1) / 2;
      s += `<g data-op="s${i}"><rect x="${x0}" y="${m - 45}" width="${L * 0.55}" height="40" fill="${resolve(
        'surface',
      )}" ${DS}/><rect x="${x1 - L * 0.55}" y="${m + 5}" width="${L * 0.55}" height="40" fill="${resolve('surface')}" ${DS}/></g>`;
    }
  });

  const entry = doors.find((d) => d.entry);
  if (entry) {
    const [ax, ay, bx, by] = entry.rect;
    const cx = (ax + bx) / 2;
    const cy = (ay + by) / 2;
    const vertical = bx - ax < by - ay;
    const mx = bounds.x + bounds.w / 2;
    const my = bounds.y + bounds.h / 2;
    const k = vertical ? (cx < mx ? 1 : -1) : cy < my ? 1 : -1;
    const ux = vertical ? k : 0;
    const uy = vertical ? 0 : k;
    const px = -uy;
    const py = ux;
    const ex = cx - ux * 320;
    const ey = cy - uy * 320;
    const sx = cx - ux * 1450;
    const sy = cy - uy * 1450;
    const color = resolve('door-entry');
    s += `<path d="M${sx} ${sy}L${ex} ${ey}M${ex - ux * 210 + px * 160} ${ey - uy * 210 + py * 160}L${
      ex + ux * 60
    } ${ey + uy * 60}L${ex - ux * 210 - px * 160} ${ey - uy * 210 - py * 160}" fill="none" stroke="${color}" stroke-width="2" ${NSS}/>
          <text x="${sx + ux * 40 - px * 170}" y="${sy + uy * 40 - py * 170}" font-size="200" fill="${color}" text-anchor="middle">${esc(
            entryText,
          )}</text>`;
  }
  return s;
}

// ---------------------------------------------------------------------------
// 5. 房间标签（原 `renderLabels`，L1254-1262）
// ---------------------------------------------------------------------------

/** `#gLabels` 的内容：名称（250/600）+ 面积（175），带浅色光晕描边 */
export function labelsSvg(
  rooms: readonly Room[],
  overrides: Record<string, RoomOverride>,
  resolve: TokenResolver,
  nameOf: (name: string) => string = (name) => name,
): string {
  const halo = `stroke="${resolve('room-label-halo')}" stroke-width="45" paint-order="stroke" stroke-linejoin="round"`;
  return rooms
    .filter((room) => room.at)
    .map((room) => {
      const [x, y] = room.at as Pt;
      return `<text x="${x}" y="${y}" font-size="250" font-weight="600" text-anchor="middle" fill="${resolve(
        'room-label',
      )}" ${halo}>${esc(nameOf(effectiveName(room, overrides)))}</text>
      <text x="${x}" y="${y + 260}" font-size="175" text-anchor="middle" fill="${resolve(
        'room-label-sub',
      )}" ${halo}>${fmt(area(room.poly))} m²</text>`;
    })
    .join('');
}

// ---------------------------------------------------------------------------
// 6. 测量（原 `renderMeasure`，L1294-1310）
// ---------------------------------------------------------------------------

/**
 * `#gMeasure` 的内容：已落库线 + 进行中线 + 起点圆点。
 * `k = 1/view.s`（屏幕 px → 户型 mm），描边/字号据此换算以保持视觉恒定。
 */
export function measureSvg(
  measures: readonly Measure[],
  pending: { a: { x: number; y: number } | null; b: { x: number; y: number } | null },
  k: number,
  resolve: TokenResolver,
): string {
  const fs = 12 * k;
  const one = (a: { x: number; y: number }, b: { x: number; y: number }, temp: boolean): string => {
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    if (L < 1) return '';
    let ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    if (ang > 90 || ang < -90) ang += 180;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const nx = (-(b.y - a.y) / L) * 5 * k;
    const ny = ((b.x - a.x) / L) * 5 * k;
    const col = temp ? resolve('measure-pending') : resolve('measure');
    const S = `stroke="${col}" stroke-width="1.5" ${NSS}`;
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" ${S}/>
      <line x1="${a.x - nx}" y1="${a.y - ny}" x2="${a.x + nx}" y2="${a.y + ny}" ${S}/><line x1="${
        b.x - nx
      }" y1="${b.y - ny}" x2="${b.x + nx}" y2="${b.y + ny}" ${S}/>
      <text x="${mx}" y="${my - 5 * k}" font-size="${fs}" text-anchor="middle" fill="${col}" font-weight="600" transform="rotate(${ang} ${mx} ${my})"
        stroke="${resolve('surface')}" stroke-width="${3.5 * k}" paint-order="stroke">${Math.round(L)} mm</text>`;
  };
  let s = measures.map((m) => one(m.a, m.b, false)).join('');
  if (pending.a && pending.b) s += one(pending.a, pending.b, true);
  if (pending.a) {
    s += `<circle cx="${pending.a.x}" cy="${pending.a.y}" r="${3 * k}" fill="${resolve('measure-pending')}"/>`;
  }
  return s;
}

// ---------------------------------------------------------------------------
// 7. 选中框（原 `renderSel`，L1312-1336）
// ---------------------------------------------------------------------------

/**
 * `#gSel` 的内容：
 * - 家具：虚线外框 + 顶部旋转手柄 + 右下尺寸手柄（各带一圈透明大热区 `data-handle`）+ 尺寸文字；
 * - 房间：低透明填充 + 描边。
 */
export function selectionSvg(
  selection: Selection,
  furniture: readonly Furniture[],
  rooms: readonly Room[],
  k: number,
  resolve: TokenResolver,
): string {
  const accent = resolve('accent');
  const A = `stroke="${accent}" ${NSS}`;
  let s = '';
  if (selection?.kind === 'furn') {
    const f = furniture.find((item) => item.id === selection.id);
    if (f) {
      const p = 5 * k;
      const hs = HANDLE_SCALE;
      const ro = HANDLE_ROT_OFFSET * k;
      const hit = HANDLE_HIT * k;
      const sx = f.w / 2 + p;
      const sy = f.d / 2 + p;
      s += `<g transform="translate(${f.cx} ${f.cy}) rotate(${f.rot})">
        <rect x="${-f.w / 2 - p}" y="${-f.d / 2 - p}" width="${f.w + 2 * p}" height="${f.d + 2 * p}" fill="none" ${A} stroke-width="1.5" stroke-dasharray="5 3" pointer-events="none"/>
        <line x1="0" y1="${-f.d / 2 - p}" x2="0" y2="${-f.d / 2 - ro}" ${A} stroke-width="1" pointer-events="none"/>
        <circle data-handle="rot" cx="0" cy="${-f.d / 2 - ro}" r="${hit}" fill="transparent"/>
        <circle data-handle="rot" cx="0" cy="${-f.d / 2 - ro}" r="${
          6 * hs * k
        }" fill="${resolve('surface')}" ${A} stroke-width="1.5"><title>拖动旋转（Shift 自由角度）</title></circle>
        <circle data-handle="size" cx="${sx}" cy="${sy}" r="${hit}" fill="transparent"/>
        <rect data-handle="size" x="${sx - 5 * hs * k}" y="${sy - 5 * hs * k}" width="${10 * hs * k}" height="${
          10 * hs * k
        }" fill="${accent}"><title>拖动调整尺寸</title></rect></g>`;
      const hh = aabb(f).hh;
      s += `<text x="${f.cx}" y="${f.cy + hh + 24 * k}" font-size="${12 * k}" text-anchor="middle" fill="${accent}" font-weight="600" pointer-events="none"
        stroke="${resolve('surface')}" stroke-width="${3 * k}" paint-order="stroke">${f.w} × ${f.d}</text>`;
    }
  } else if (selection?.kind === 'room') {
    const room = rooms.find((item) => item.id === selection.id);
    if (room) {
      s += `<polygon points="${pointsOf(room.poly)}" fill="${accent}" fill-opacity=".08" stroke="${accent}" stroke-width="2" ${NSS} pointer-events="none"/>`;
    }
  }
  return s;
}

// ---------------------------------------------------------------------------
// 8. 家具层（原 `renderFurn`，L1196-1205）
// ---------------------------------------------------------------------------

export interface FurniturePaintContext {
  resolve: TokenResolver;
  /** 名称翻译（内置名走 `NAMES_EN`，用户改名原样显示；OF §1.10） */
  nameOf: (name: string) => string;
}

/**
 * `#gFurn` 的内容：每个家具 = `translate(cx cy) rotate(rot)` 组，
 * 内含 `furnSVG()` 图例 + 可选名称标签（`min(w,d) >= 380` 且类型不在 `NOLABEL` 内）。
 * ⚠️ 家具色是**用户数据色**（ADR-10），⛔ 不随主题变。
 */
export function furnitureSvg(furniture: readonly Furniture[], ctx: FurniturePaintContext): string {
  return furniture
    .map((f) => {
      const label = furnShowsLabel(f.type, f.w, f.d)
        ? `<text transform="rotate(${-f.rot})" font-size="${furnLabelSize(
            f.w,
            f.d,
          )}" text-anchor="middle" dominant-baseline="central" fill="${ctx.resolve(
            'text-secondary',
          )}" opacity=".8" pointer-events="none">${esc(ctx.nameOf(f.name))}</text>`
        : '';
      return `<g class="furn" data-fid="${esc(f.id)}" tabindex="0" role="button" aria-label="${esc(
        ctx.nameOf(f.name),
      )}" transform="translate(${f.cx} ${f.cy}) rotate(${f.rot})">${furnSVG(
        f.type,
        f.w,
        f.d,
        f.color,
      )}${label}</g>`;
    })
    .join('');
}
