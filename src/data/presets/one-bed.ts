/**
 * 内置 ②：一室一厅一卫（原 `P_1A`，`装修设计.html` L641-667）。
 * 全部几何由构造 helper 生成（`hWall` / `vWall` / `innerWall` / `roomRect` / `doorOf`），
 * 与原实现的写法一致。尺寸单位 mm，原点 = 左侧外墙内皮 / 顶部外墙内皮。
 */
import { doorOf, hWall, innerWall, roomRect, vWall } from '@/utils/geometry';
import type { DimChain, Plan } from '@/types/plan';

const W = 7200;
const H = 6200;

export const P_1A: Plan = {
  id: 'h1a',
  name: '一室一厅一卫',
  tag: '单身 / 二人世界 · 建面约 52㎡',
  builtin: true,
  bounds: null,
  walls: [
    ...hWall(-240, W + 240, -240, 240, [
      [700, 2300],
      [3600, 4400],
      [5400, 7000],
    ]),
    ...hWall(-240, W + 240, H, 240, [
      [600, 2000],
      [4800, 5700],
      [5800, 7000],
    ]),
    ...vWall(0, H, -240, 240, [
      [600, 2200],
      [4600, 6000],
    ]),
    ...vWall(0, H, W, 240, [[400, 3000]]),
    innerWall(3000, 0, 3200, 2800),
    innerWall(4600, 0, 4800, 3000),
    innerWall(2400, 4000, 2600, H),
    innerWall(0, 2800, 1800, 3000),
    innerWall(2700, 2800, 3000, 3000),
    innerWall(3200, 2800, 3400, 3000),
    innerWall(4200, 2800, 4600, 3000),
    innerWall(0, 3800, 600, 4000),
    innerWall(1500, 3800, 3000, 4000),
    innerWall(4800, 3800, 5000, 4000),
  ],
  wins: [
    [700, -240, 2300, 0],
    [3600, -240, 4400, 0],
    [5400, -240, 7000, 0],
    [W, 400, W + 240, 3000],
    [600, H, 2000, H + 240],
    [5800, H, 7000, H + 240],
    [-240, 600, 0, 2200],
    [-240, 4600, 0, 6000],
  ],
  doors: [
    doorOf('卧室门', [1800, 2800, 2700, 3000], [1800, 3000], [1, 0], [0, -1], 900),
    doorOf('卫生间门', [3400, 2800, 4200, 3000], [3400, 3000], [1, 0], [0, 1], 800),
    doorOf('厨房门', [600, 3800, 1500, 4000], [600, 4000], [1, 0], [0, 1], 900),
    doorOf('入户门', [4800, H, 5700, H + 240], [4800, H + 240], [1, 0], [0, -1], 900, true),
  ],
  slides: [],
  rooms: [
    roomRect('r1', '卧室', 0, 0, 3000, 2800, 'wood'),
    roomRect('r2', '卫生间', 3200, 0, 4600, 2800, 'antislip'),
    roomRect('r3', '客厅', 4800, 0, W, 3800, 'tile800'),
    roomRect('r4', '过道', 0, 3000, 4600, 3800, 'tile800'),
    roomRect('r5', '厨房', 0, 4000, 2400, H, 'tile600'),
    roomRect('r6', '餐厅', 2600, 4000, W, H, 'tile800'),
  ],
  dims: [
    { h: true, at: -750, segs: [3000, 200, 1400, 200, 2600] },
    { h: true, at: -1250, segs: [W] },
    { h: true, at: H + 650, segs: [2400, 200, 4600] },
    { h: true, at: H + 1150, segs: [W] },
    { h: false, at: -800, segs: [2800, 200, 800, 200, 2200] },
    { h: false, at: -1300, segs: [H] },
    { h: false, at: W + 740, segs: [3800, 200, 2200] },
    { h: false, at: W + 1240, segs: [H] },
  ] as DimChain[],
  lintels: [],
  stairs: [],
  voids: [],
};