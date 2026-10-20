/**
 * 家具模型构建的共享依赖与类型（OF §3.3「家具模型局部坐标：背面朝 -z」）。
 *
 * 原实现是一个 486 行的 `buildFurniture()` 大 `switch`（L2954-3439，46 个 case）。
 * SPEC §C.1 要求拆成 `furniture/*` 多个文件，这里定义分组文件共用的 `FurnSpec`：
 * 分组文件只写几何（与原 case 逐句对应），材质 / 内容色 / 随机源一律从 `deps` 取。
 */
import { Group, type Object3D } from 'three';
import type { Furniture } from '@/types/furniture';
import type { MaterialPalette } from '@/types/theme';
import { createFurnitureMaterials, darker, lighter, type FurnitureMaterials, type PrimitiveDeps } from '../primitives';
import { furnitureSeed, m, rng, wx, wz, type WorldConfig } from '../scene';

/** 内容色 / 令牌别名的集中取用点（把「哪块该用什么色」写在一处，便于评审逐条核对） */
export interface FurnitureColors {
  /** 调色板本体（需要非常规令牌时用） */
  readonly palette: MaterialPalette;
  /** 比内容色暗（原 `darker(c, k)`） */
  dark(content: string, k?: number): string;
  /** 比内容色亮（原 `lighter(c, k)`） */
  light(content: string, k?: number): string;
}

/** 分组构建函数的入参（原 `buildFurniture(f)` 的 `f` 展开后的形态） */
export interface FurnSpec {
  /** 挂载点（原 `g`） */
  readonly group: Group;
  /** 宽（m） */
  readonly w: number;
  /** 深（m） */
  readonly d: number;
  /** 家具**内容色**（家具库默认色或用户改色；ADR-10：永不随主题变） */
  readonly c: string;
  /** 局部坐标：背面朝 -z（`-d/2`） */
  readonly bz: number;
  /** 确定性随机源（种子 = 尺寸 + 位置，原 L2955） */
  readonly R: () => number;
  /** 材质工厂 */
  readonly fm: FurnitureMaterials;
  /** 内容色 / 令牌取色 */
  readonly colors: FurnitureColors;
}

export interface FurnitureBuildDeps {
  ml: PrimitiveDeps['ml'];
  palette: MaterialPalette;
  world: WorldConfig;
  fm: FurnitureMaterials;
  colors: FurnitureColors;
}

/** 构建 `buildFurniture()` 需要的全部依赖 */
export function createFurnitureDeps(
  ml: PrimitiveDeps['ml'],
  palette: MaterialPalette,
  world: WorldConfig,
): FurnitureBuildDeps {
  const fm = createFurnitureMaterials({ ml, palette });
  const colors: FurnitureColors = {
    palette,
    dark: (content: string, k = 0.8) => darker(content, k),
    light: (content: string, k = 0.2) => lighter(content, k),
  };
  return { ml, palette, world, fm, colors };
}

/** 单个家具的构建上下文 */
export function makeSpec(f: Furniture, deps: FurnitureBuildDeps): FurnSpec {
  const group = new Group();
  const d = m(f.d);
  return {
    group,
    w: m(f.w),
    d,
    c: f.color,
    bz: -d / 2,
    R: rng(furnitureSeed(f.w, f.d, f.cx, f.cy)),
    fm: deps.fm,
    colors: deps.colors,
  };
}

/** 世界坐标写入（原 L3435-3436：`wx/wz` + 平面顺时针角度取负） */
export function placeFurniture(group: Object3D, f: Furniture, deps: FurnitureBuildDeps): void {
  group.position.set(wx(deps.world, f.cx), 0, wz(deps.world, f.cy));
  group.rotation.y = (-f.rot * Math.PI) / 180;
  group.userData.fid = f.id;
}