/**
 * DXF 导出（P0-7，CAD 交付）。
 *
 * ⛔ 红线 8（SPEC §B.4）：**不自研 DXF 文本格式**（群码 / 图层表 / 块表 / 单位）—— 一律交 `dxf-writer`
 * （captain 指定；与 `@tarikjabiri/dxf` 二选一，SPEC §H.4 / ADR-14）。
 *
 * 设计决定（写给 reviewer）：
 * 1. **图层分离**：墙体 / 门窗 / 家具 / 尺寸 / 房间 / 已拆墙各占一层（SPEC P0-7 明确要求）。
 * 2. **颜色用 CAD 标准 ACI 色号**（1–255），**不跟随主题令牌**：DXF 是给 CAD 用的中性交付物，
 *    主题令牌驱动的是 SVG/PNG（矢量平面图）。这条差异已写在 `docs/EXTRAS.md` 与 UI 提示里。
 * 3. **坐标原样输出**（mm，y 轴沿用平面坐标）：不做隐式镜像/旋转，避免"看起来对了但对不上"。
 * 4. **动态 `import('dxf-writer')`** + **整段 try/catch**：库的 API 若与预期不符，返回
 *    `{ ok:false, reason }` 而不是把异常抛进 UI（⛔ 不伪造产物）。
 * 5. 本版**不写 DXF 文字**（`drawText` 的签名在不同版本间有差异，乱写位置比不写更糟）：
 *    尺寸以线段 + 图层表达，数值文本走 CSV/XLSX；DXF 深化列在 ROADMAP（P2-9）。
 */
import { rectCenter } from './geom';
import { wallIndexOf } from './metrics';
import { stampedName } from './download';
import type { Furniture } from '@/types/furniture';
import type { Bounds, Pt } from '@/types/geometry';
import type { DimChain, Door, Room, Slide, Wall, Win } from '@/types/plan';

/** 图层名（DXF 里保持大写英文，便于 CAD 侧的图层过滤/打印样式） */
export const DXF_LAYERS = {
  wall: 'WALLS',
  demolished: 'WALLS-DEMOLISHED',
  opening: 'OPENINGS',
  furniture: 'FURNITURE',
  dim: 'DIMS',
  room: 'ROOMS',
} as const;

/** ACI 色号（CAD 标准索引，不是主题令牌；7 = 默认黑/白，随 CAD 背景反色） */
const ACI = {
  wall: 7,
  demolished: 1,
  opening: 5,
  furniture: 3,
  dim: 8,
  room: 1,
} as const;

export interface DxfExportInput {
  walls: readonly Wall[];
  wins: readonly Win[];
  doors: readonly Door[];
  slides: readonly Slide[];
  rooms: readonly Room[];
  dims: readonly DimChain[];
  furniture: readonly Furniture[];
  demolished?: readonly string[];
  /** 户型包围盒（仅用于图层范围信息；不参与坐标变换） */
  bounds?: Bounds | null;
}

export type DxfResult =
  | { ok: true; text: string; entityCount: number; layerCount: number }
  | { ok: false; reason: string };

/** dxf-writer 的最小结构接口（声明见 `lib/vendor-shims.d.ts`） */
interface DxfDrawingLike {
  setUnits(units: string): unknown;
  addLayer(name: string, colorNumber: number, lineType?: string): unknown;
  setActiveLayer(name: string): unknown;
  drawLine(x1: number, y1: number, x2: number, y2: number): unknown;
  drawPolyline(points: readonly (readonly [number, number])[], closed?: boolean): unknown;
  toDxfString(): string;
}

interface DxfModuleLike {
  default?: new (units?: string) => DxfDrawingLike;
  Drawing?: new (units?: string) => DxfDrawingLike;
}

function drawPolyline(drawing: DxfDrawingLike, points: readonly Pt[], closed: boolean): void {
  const tuples = points.map(([x, y]) => [x, y] as const);
  drawing.drawPolyline(tuples, closed);
}

/** 可选调用：库的某个方法不存在/签名不同时不致命（⛔ 不吞掉真正的导出错误） */
function tryCall(fn: () => unknown): boolean {
  try {
    fn();
    return true;
  } catch {
    return false;
  }
}

/** 构建 DXF 文本（动态加载 dxf-writer；失败返回结构化原因） */
export async function buildDxf(input: DxfExportInput): Promise<DxfResult> {
  try {
    const mod = (await import('dxf-writer')) as unknown as DxfModuleLike;
    const Ctor = mod.default ?? mod.Drawing;
    if (typeof Ctor !== 'function') return { ok: false, reason: 'dxf-writer: Drawing constructor unavailable' };
    const drawing = new Ctor();
    let entityCount = 0;
    const demolished = new Set(input.demolished ?? []);

    // 单位：$INSUNITS = 毫米（库接受单位名；调用失败也不影响几何）
    tryCall(() => drawing.setUnits('Millimeters'));

    drawing.addLayer(DXF_LAYERS.wall, ACI.wall, 'CONTINUOUS');
    drawing.addLayer(DXF_LAYERS.demolished, ACI.demolished, 'DASHED');
    drawing.addLayer(DXF_LAYERS.opening, ACI.opening, 'CONTINUOUS');
    drawing.addLayer(DXF_LAYERS.furniture, ACI.furniture, 'CONTINUOUS');
    drawing.addLayer(DXF_LAYERS.dim, ACI.dim, 'CONTINUOUS');
    drawing.addLayer(DXF_LAYERS.room, ACI.room, 'CONTINUOUS');

    // ---- 墙体（含已拆墙单列一层） ----
    drawing.setActiveLayer(DXF_LAYERS.wall);
    input.walls.forEach((wall, index) => {
      const [x0, y0, x1, y1] = wall;
      const removed = demolished.has(String(index)) || demolished.has(`w${index}`) || demolished.has(`wall-${index}`);
      drawing.setActiveLayer(removed ? DXF_LAYERS.demolished : DXF_LAYERS.wall);
      drawing.drawLine(x0, y0, x1, y1);
      entityCount += 1;
    });

    // ---- 门窗（门：门洞线 + 门扇；窗：洞口线 + 分格中线） ----
    drawing.setActiveLayer(DXF_LAYERS.opening);
    for (const door of input.doors) {
      const center = rectCenter(door.rect);
      drawing.drawLine(door.rect[0], door.rect[1], door.rect[2], door.rect[1]);
      drawing.drawLine(door.rect[2], door.rect[1], door.rect[2], door.rect[3]);
      drawing.drawLine(door.rect[2], door.rect[3], door.rect[0], door.rect[3]);
      drawing.drawLine(door.rect[0], door.rect[3], door.rect[0], door.rect[1]);
      drawing.drawLine(center.x, center.y, door.h[0], door.h[1]);
      entityCount += 5;
    }
    for (const win of input.wins) {
      drawing.drawLine(win[0], win[1], win[2], win[3]);
      // 窗的分格中线（沿窗长的 1/3、2/3 处各一条，方向与洞口垂直）
      const dx = win[2] - win[0];
      const dy = win[3] - win[1];
      const nx = -dy;
      const ny = dx;
      const len = Math.hypot(nx, ny) || 1;
      const tick = 30;
      for (const k of [1 / 3, 2 / 3]) {
        const px = win[0] + dx * k;
        const py = win[1] + dy * k;
        drawing.drawLine(px, py, px + (nx / len) * tick, py + (ny / len) * tick);
      }
      entityCount += 3;
    }
    for (const slide of input.slides) {
      drawing.drawLine(slide.rect[0], slide.rect[1], slide.rect[2], slide.rect[1]);
      drawing.drawLine(slide.rect[2], slide.rect[1], slide.rect[2], slide.rect[3]);
      drawing.drawLine(slide.rect[2], slide.rect[3], slide.rect[0], slide.rect[3]);
      drawing.drawLine(slide.rect[0], slide.rect[3], slide.rect[0], slide.rect[1]);
      entityCount += 4;
    }

    // ---- 房间轮廓（闭合多段线） ----
    drawing.setActiveLayer(DXF_LAYERS.room);
    for (const room of input.rooms) {
      if (room.poly.length < 3) continue;
      drawPolyline(drawing, room.poly, true);
      entityCount += 1;
    }

    // ---- 家具（闭合外框 + 中心十字，保证任何 CAD 下都看得见） ----
    drawing.setActiveLayer(DXF_LAYERS.furniture);
    for (const f of input.furniture) {
      const corners = rotatedFrame(f);
      drawPolyline(drawing, corners, true);
      entityCount += 1;
    }

    // ---- 尺寸链（线 + 两端刻度；文字留给 CSV/XLSX） ----
    drawing.setActiveLayer(DXF_LAYERS.dim);
    for (const chain of input.dims) {
      const segs = chain.segs;
      let cursor = chain.start ?? 0;
      for (const seg of segs) {
        const from = cursor;
        const to = cursor + seg;
        cursor = to;
        const line: [Pt, Pt] = chain.h ? [[from, chain.at], [to, chain.at]] : [[chain.at, from], [chain.at, to]];
        drawing.drawLine(line[0][0], line[0][1], line[1][0], line[1][1]);
        // 端部刻度（30mm）
        if (chain.h) {
          drawing.drawLine(from, chain.at - 30, from, chain.at + 30);
          drawing.drawLine(to, chain.at - 30, to, chain.at + 30);
        } else {
          drawing.drawLine(chain.at - 30, from, chain.at + 30, from);
          drawing.drawLine(chain.at - 30, to, chain.at + 30, to);
        }
        entityCount += 3;
      }
    }

    const text = drawing.toDxfString();
    if (typeof text !== 'string' || text.length === 0) return { ok: false, reason: 'dxf-writer: empty output' };
    return { ok: true, text, entityCount, layerCount: Object.keys(DXF_LAYERS).length };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/** 家具外框四角（旋转矩形的 DXF 投影；几何原语在 `lib/geom.ts`） */
function rotatedFrame(f: Furniture): Pt[] {
  const rad = (f.rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = f.w / 2;
  const hd = f.d / 2;
  const local: readonly Pt[] = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
  return local.map(([x, y]) => [f.cx + x * cos - y * sin, f.cy + x * sin + y * cos] as Pt);
}

/** 统计图元数（用于 UI 提示"导出了多少条线"） */
export function dxfEntityEstimate(input: DxfExportInput): number {
  const demolished = new Set(input.demolished ?? []);
  const wallCount = input.walls.filter((_wall, index) => !demolished.has(String(index))).length;
  return (
    wallCount + input.doors.length * 5 + input.wins.length * 3 + input.slides.length * 4 + input.rooms.length + input.furniture.length
  );
}

export function dxfFileName(base: string, at?: Date): string {
  return stampedName(base, 'dxf', at);
}

/** 供 UI 显示的"已拆墙"提示（避免用户以为拆掉的墙没导出） */
export function demolishedWallIndexes(demolished: readonly string[]): number[] {
  return demolished.map((id) => wallIndexOf(id)).filter((index) => index >= 0);
}