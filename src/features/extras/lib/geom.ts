/**
 * 校验 / 对比 / 图册共用的**二维几何原语**（纯函数，无依赖）。
 *
 * 边界（SPEC §B.4 红线 6 + ADR-15，重要）：
 * - **旋转矩形相交** ⛔ 不在这里实现：走 three 自带 `OBB`（`lib/validate.ts` 里用）。
 * - **多边形布尔 / 三角化** ⛔ 不在这里实现：确需时用 `polygon-clipping`（精确锁 0.15.7）/ `earcut`。
 * - **多边形面积** ⛔ 不在这里实现：走 three 的 `ShapeUtils.area()`（`lib/metrics.ts`）。
 * - 本文件只放「库不提供、也不值得为它装包」的初等判定：旋转取角、区间并集、射线法点内判定、
 *   点到线段距离、质心。这些是十行以内的通用初等数学，⛔ 不是「装修规范校验」业务规则（那部分在
 *   `lib/validate.ts` 里，才是本项目自己的资产）。
 */
import type { Pt, Rect, Vec2 } from '@/types/geometry';

/**
 * 旋转矩形四角（mm）。
 * 旋转约定与 2D 渲染一致：SVG 的 `rotate(rot, cx, cy)`（y 轴向下时正角 = 顺时针），
 * 即 `x' = cx + x·cosθ − y·sinθ`、`y' = cy + x·sinθ + y·cosθ`。
 */
export function rotatedCorners(
  cx: number,
  cy: number,
  w: number,
  d: number,
  rotDeg: number,
): [Vec2, Vec2, Vec2, Vec2] {
  const rad = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = w / 2;
  const hd = d / 2;
  const local: readonly Vec2[] = [
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd },
  ];
  const pts = local.map((p) => ({ x: cx + p.x * cos - p.y * sin, y: cy + p.x * sin + p.y * cos }));
  return [pts[0], pts[1], pts[2], pts[3]];
}

/** 以线段为中线、给定厚度生成**轴对齐**占位矩形（墙/门/窗的占用区） */
export function rectOfSegment(x0: number, y0: number, x1: number, y1: number, thick: number): Rect {
  const half = thick / 2;
  return [
    Math.min(x0, x1) - half,
    Math.min(y0, y1) - half,
    Math.max(x0, x1) + half,
    Math.max(y0, y1) + half,
  ];
}

export function rectCenter(rect: Rect): Vec2 {
  return { x: (rect[0] + rect[2]) / 2, y: (rect[1] + rect[3]) / 2 };
}

export function rectHalfSize(rect: Rect): Vec2 {
  return { x: Math.abs(rect[2] - rect[0]) / 2, y: Math.abs(rect[3] - rect[1]) / 2 };
}

export function rectWidth(rect: Rect): number {
  return Math.abs(rect[2] - rect[0]);
}

export function rectDepth(rect: Rect): number {
  return Math.abs(rect[3] - rect[1]);
}

/** 矩形中心向某方向外扩 `depth` 形成的净空带（门洞前净空 / 通道探测用） */
export function clearanceBand(rect: Rect, toward: Vec2, depth: number): Rect {
  const center = rectCenter(rect);
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  // 取主导轴（数据模型里的门窗都是轴对齐的，取 |dx| ≥ |dy| 决定往哪一侧扩）
  if (Math.abs(dx) >= Math.abs(dy)) {
    const sign = dx >= 0 ? 1 : -1;
    return sign >= 0
      ? [rect[0], rect[1], rect[2] + depth, rect[3]]
      : [rect[0] - depth, rect[1], rect[2], rect[3]];
  }
  const sign = dy >= 0 ? 1 : -1;
  return sign >= 0 ? [rect[0], rect[1], rect[2], rect[3] + depth] : [rect[0], rect[1] - depth, rect[2], rect[3]];
}

/** 射线法：点是否在多边形内（房间归属判定用；⛔ 不做多边形布尔） */
export function pointInPolygon(p: Vec2, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const crosses = yi > p.y !== yj > p.y;
    if (!crosses) continue;
    const xAt = ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (p.x < xAt) inside = !inside;
  }
  return inside;
}

/** 多边形顶点均值（原 `closeRoomPoly` 的 `at` 取顶点均值，L2368-2369） */
export function polygonCentroid(poly: readonly Pt[]): Vec2 {
  if (poly.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const [x, y] of poly) {
    sx += x;
    sy += y;
  }
  return { x: sx / poly.length, y: sy / poly.length };
}

/** 区间并集长度（净宽分析的核心：把家具投影并起来，再与可用带宽相减） */
export function intervalUnionLength(intervals: readonly (readonly [number, number])[]): number {
  if (intervals.length === 0) return 0;
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let curStart = sorted[0][0];
  let curEnd = sorted[0][1];
  for (let i = 1; i < sorted.length; i += 1) {
    const [start, end] = sorted[i];
    if (start > curEnd) {
      total += Math.max(0, curEnd - curStart);
      curStart = start;
      curEnd = end;
      continue;
    }
    if (end > curEnd) curEnd = end;
  }
  total += Math.max(0, curEnd - curStart);
  return total;
}

/** 区间并集（保留合并后的区间列表，净宽分析里需要知道剩余的空隙位置） */
export function intervalUnion(intervals: readonly (readonly [number, number])[]): [number, number][] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [[sorted[0][0], sorted[0][1]]];
  for (let i = 1; i < sorted.length; i += 1) {
    const last = out[out.length - 1];
    const [start, end] = sorted[i];
    if (start > last[1]) {
      out.push([start, end]);
      continue;
    }
    if (end > last[1]) last[1] = end;
  }
  return out;
}

export function normalizeVec(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 点到线段的距离（mm） */
export function distancePointToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/** 点在「以 origin 为原点、axis 为单位轴」的投影坐标（净宽分析的标量投影） */
export function projectOnAxis(p: Vec2, origin: Vec2, axis: Vec2): number {
  return (p.x - origin.x) * axis.x + (p.y - origin.y) * axis.y;
}