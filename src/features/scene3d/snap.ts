/**
 * 3D 摆放吸附（t5 内部几何，**归口说明见文件末**）。
 *
 * ⚠️ 归口：SPEC §C.1 把 `snapRects / snapMove / snapPoint` 归 `src/utils/geometry.ts`（t4）。
 * 该口径 t5 依赖但当时尚未落地，为不阻塞 3D 拖拽（SPEC §F.5「3D 内拖动已选中家具」），
 * 这里提供一份**语义等价、零依赖**的实现，并已在交付说明里向 captain / spec-lead 报备归口。
 * ⛔ 本文件不写 store、不碰 DOM，纯函数，可单测。
 */
import type { Furniture } from '@/types/furniture';

/** 网格吸附步长（mm）——与原实现 2D/3D 共用的 `ui.edit.grid` 同源，默认 100 */
export const SNAP_GRID = 100;

/** 家具的轴对齐包围盒（mm）：`[x0, y0, x1, y1]`（旋转按 90° 步进近似，与原 2D 口径一致） */
export function furnitureRect(f: Furniture): [number, number, number, number] {
  const rot = ((Math.round(f.rot / 90) % 4) + 4) % 4;
  const swapped = rot === 1 || rot === 3;
  const w = swapped ? f.d : f.w;
  const d = swapped ? f.w : f.d;
  return [f.cx - w / 2, f.cy - d / 2, f.cx + w / 2, f.cy + d / 2];
}

function overlaps(a: [number, number, number, number], b: [number, number, number, number], slack = 1): boolean {
  return a[2] - slack > b[0] && b[2] - slack > a[0] && a[3] - slack > b[1] && b[3] - slack > a[1];
}

/** 吸附到网格（mm） */
export const snapToGrid = (value: number, grid = SNAP_GRID): number => Math.round(value / grid) * grid;

/**
 * 3D 拖动中的落点吸附：先网格吸附，再避开与其它家具的重叠（相互推开，最多 8 轮）。
 * @returns 吸附后的中心点（mm）
 */
export function snapMove(
  f: Furniture,
  x: number,
  y: number,
  others: readonly Furniture[] = [],
  grid = SNAP_GRID,
): { x: number; y: number } {
  let cx = snapToGrid(x, grid);
  let cy = snapToGrid(y, grid);
  const active = others.filter((o) => o.id !== f.id);
  for (let round = 0; round < 8; round++) {
    const rect = furnitureRect({ ...f, cx, cy });
    const hit = active.find((o) => overlaps(rect, furnitureRect(o)));
    if (!hit) break;
    const other = furnitureRect(hit);
    // 往重叠最少的方向推（原 `pushOut` 语义的最小实现）
    const left = rect[0] - other[2];
    const right = other[0] - rect[2];
    const up = rect[1] - other[3];
    const down = other[1] - rect[3];
    const pushX = Math.abs(left) < Math.abs(right) ? -(left + grid) : right + grid;
    const pushY = Math.abs(up) < Math.abs(down) ? -(up + grid) : down + grid;
    if (Math.abs(pushX) <= Math.abs(pushY)) cx += pushX;
    else cy += pushY;
    cx = snapToGrid(cx, grid);
    cy = snapToGrid(cy, grid);
  }
  return { x: cx, y: cy };
}

/** 点是否落在任一房间多边形内（射线法；3D 落点合法性提示用） */
export function pointInPoly(poly: readonly (readonly [number, number])[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}