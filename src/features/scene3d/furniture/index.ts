/**
 * 家具 3D 模型注册表（原 `buildFurniture()` 的 46 个 case，OF §3.3）。
 *
 * 拆分方式（SPEC §C.1 的 `furniture/*`）：
 * - `bedroom.ts`    卧室 / 书房 11 类型（原 L2957-3109、L3279-3292）
 * - `living.ts`     客厅 / 休闲 10 类型（原 L2973-3000、L3111-3149、L3294-3312）
 * - `tables.ts`     餐厅 / 厨房  8 类型（原 L3150-3217、L3313-3330）
 * - `bath.ts`       卫浴         7 类型（原 L3219-3277、L3332-3339）
 * - `appliances.ts` 家电 / 设备  9 类型（原 L3340-3431）
 *
 * 合计 45 个唯一类型（`types/furniture.ts` 的 `FurnitureType` 联合类型必须与 `Object.keys` 完全一致，
 * 由 `furniture.spec.ts` 断言）+ 1 个 `default` 兜底（原 L3433 `g.add(box(w, .8, d, c))`）。
 */
import { Group, type Object3D } from 'three';
import type { Furniture } from '@/types/furniture';
import { box } from '../primitives';
import { APPLIANCE_BUILDERS } from './appliances';
import { BATH_BUILDERS } from './bath';
import { BEDROOM_BUILDERS } from './bedroom';
import { LIVING_BUILDERS } from './living';
import { KITCHEN_BUILDERS } from './tables';
import { makeSpec, placeFurniture, createFurnitureDeps, type FurnitureBuildDeps, type FurnSpec } from './shared';

/** 全部类型 → 构建函数（45 个类型） */
export const FURNITURE_BUILDERS: Record<string, (spec: FurnSpec) => void> = {
  ...BEDROOM_BUILDERS,
  ...LIVING_BUILDERS,
  ...KITCHEN_BUILDERS,
  ...BATH_BUILDERS,
  ...APPLIANCE_BUILDERS,
};

/** 已实现的类型清单（用于与 `FurnitureType` 做一致性断言） */
export const FURNITURE_BUILD_TYPES = Object.keys(FURNITURE_BUILDERS);

/**
 * 构建一个家具模型（原 `buildFurniture(f)`，L2954-3439）。
 * 未知类型走 `default` 兜底；返回的 group 已带 `userData.fid` 与位置/旋转。
 */
export function buildFurniture(f: Furniture, deps: FurnitureBuildDeps): Group {
  const spec = makeSpec(f, deps);
  const builder = FURNITURE_BUILDERS[f.type];
  if (builder) builder(spec);
  else spec.group.add(box(spec.w, 0.8, spec.d, spec.c));
  placeFurniture(spec.group, f, deps);
  return spec.group;
}

export { createFurnitureDeps, makeSpec, placeFurniture };
export type { FurnitureBuildDeps, FurnSpec } from './shared';

/** 便于类型标注（构建结果一定是 `Group`） */
export type FurnitureObject = Object3D;