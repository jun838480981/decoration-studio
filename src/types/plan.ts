/**
 * 户型结构类型（SPEC §D.2 🔒 冻结）。
 * 与 `装修设计.html` §4.1 的数据模型逐字对齐；字段改名即触发 RISK-01（store 契约漂移）。
 */
import type { Bounds, Pt, Rect } from './geometry';
import type { Furniture } from './furniture';
import type { MaterialKey } from './material';

/**
 * `Furniture` 在此**转出**（re-export），因为下游（`data/presets/*`、2D 图例、3D 家具）
 * 惯于从 `@/types/plan` 一并取户型结构类型与家具类型。此前只有内部 `import`，
 * 导致 `three-bed.ts:11` 报 TS2459「declares 'Furniture' locally, but it is not exported」。
 */
export type { Furniture } from './furniture';

/** 承重 / 外墙 / 非承重 / 矮墙（原分类，OF §2.3） */
export type WallKind = 'b' | 'e' | 'n' | 'low';

export type Wall = [x0: number, y0: number, x1: number, y1: number, kind: WallKind];

/** [x0,y0,x1,y1, 窗台高m?, 窗顶高m?]，缺省 0.9 / 2.4（OF §2.4、§3.2） */
export type Win = [x0: number, y0: number, x1: number, y1: number, sill?: number, head?: number];

export interface Door {
  name: string;
  rect: Rect;
  /** 铰链点 */
  h: Pt;
  /** 门扇另一端 */
  c: Pt;
  /** 开启方向点 */
  o: Pt;
  /** 门洞长度（mm） */
  len: number;
  /** 入户门（决定「入户」标识方向，OF §2.4） */
  entry: boolean;
}

export interface Slide {
  rect: Rect;
  /** 竖向（原 `v` 标志） */
  v: boolean;
}

export interface Room {
  id: string;
  name: string;
  poly: Pt[];
  mat: MaterialKey;
  /** 标签锚点；缺省不画标签（OF §2.5） */
  at?: Pt;
  /** 飘窗：排除出使用面积（OF §6.2） */
  counted?: false;
}

export interface DimChain {
  h: boolean;
  at: number;
  segs: number[];
  start?: number;
}

export type Lintel = [x0: number, y0: number, x1: number, y1: number, height: number];

export interface Stair {
  x: number;
  y0: number;
  y1: number;
  dir: 1 | -1;
}

export interface VoidShape {
  poly: Pt[];
}

/** 单层结构：单层户型与复式某一层共用（OF §4.3 第 10 条） */
export interface PlanStructure {
  bounds?: Bounds | null;
  walls: Wall[];
  wins: Win[];
  doors: Door[];
  slides: Slide[];
  rooms: Room[];
  dims: DimChain[];
  lintels: Lintel[];
  stairs: Stair[];
  voids: VoidShape[];
}

export type FurnitureFactory = () => Furniture[];

export interface PlanLevel extends PlanStructure {
  name: string;
  elev: number;
  furniture?: FurnitureFactory | null;
}

export interface Plan extends PlanStructure {
  id: string;
  name: string;
  tag: string;
  builtin?: boolean;
  multilevel?: boolean;
  levels?: PlanLevel[];
  /** 仅内置户型的内存字段，不序列化（OF §7.3 stripPlan 白名单） */
  furn?: FurnitureFactory;
}
