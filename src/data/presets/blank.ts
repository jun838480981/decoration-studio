/**
 * 内置 ⑦：空白户型（原 `P_BLANK`，`装修设计.html` L774-778）。
 * 保留一个足够大的视口（`bounds`），让「从零开始画」时网格与缩放有参照。
 */
import type { Plan } from '@/types/plan';

export const P_BLANK: Plan = {
  id: 'hblank',
  name: '空白户型',
  tag: '从零开始画 · 无墙体',
  builtin: true,
  bounds: { x: -2000, y: -1800, w: 18000, h: 13000 },
  walls: [],
  wins: [],
  doors: [],
  slides: [],
  rooms: [],
  dims: [],
  lintels: [],
  stairs: [],
  voids: [],
};