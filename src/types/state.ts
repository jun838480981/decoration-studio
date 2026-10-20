/**
 * 运行状态类型（SPEC §D.4 🔒 冻结）。
 * 默认值在 `stores/ui.ts`（初值同样冻结，见 SPEC §D.7）。
 */
import type { Vec2 } from './geometry';
import type { Furniture } from './furniture';
import type { MaterialKey } from './material';
import type { WallKind } from './plan';

export interface RoomOverride {
  name: string;
  mat: MaterialKey;
}

export interface Measure {
  a: Vec2;
  b: Vec2;
}

/** = 一个户型（某层）的布置存档；localStorage 的 `huxing-state-v2-*` 值结构（OF §4.3） */
export interface PlanState {
  furniture: Furniture[];
  rooms: Record<string, RoomOverride>;
  demolished: string[];
  measures: Measure[];
}

export type Tool = 'select' | 'measure' | 'demolish';

export type EditMode = 'wall' | 'room' | 'door' | 'win' | 'erase';

export type SnapMode = 'grid' | 'corner' | 'off';

export interface LayerFlags {
  dims: boolean;
  labels: boolean;
  furn: boolean;
  grid: boolean;
  bearing: boolean;
  wallSnap: boolean;
}

export type Selection = { kind: 'furn'; id: string } | { kind: 'room'; id: string } | null;

export interface ViewTransform {
  x0: number;
  y0: number;
  s: number;
}

export interface EditDrag {
  a: Vec2;
  b: Vec2 | null;
  axis?: 'h' | 'v' | null;
}

export interface EditState {
  on: boolean;
  mode: EditMode;
  kind: WallKind;
  thick: number;
  doorW: number;
  winW: number;
  grid: number;
  snap: SnapMode;
  ortho: boolean;
  pts: Vec2[];
  drag: EditDrag | null;
  hover: Vec2 | null;
  rawHover: Vec2 | null;
  axis: 'h' | 'v' | null;
  /** 替代原 `edit._grid`（L2285 / L2297） */
  savedGridLayer: boolean | null;
}

export interface View3dOptions {
  /** 剖切高度（m）：2.8 / 1.2 两档（OF §3.4） */
  cut: number;
  furn: boolean;
  labels: boolean;
  /** 3D 独立夜景开关，与主题「夜间」解耦（ADR-08） */
  night: boolean;
  /** 日照时刻 7–18（OF §3.8） */
  hour: number;
  mode: 'orbit' | 'walk';
}
