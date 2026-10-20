/**
 * 户型缩略图（原 `planThumb()`，L2099-2106）+ 户型卡片统计口径。
 *
 * 放在 `components/` 而不是 `features/plan2d/` 的原因：户型库弹窗是**跨特性共享 UI**
 * （SPEC §C.1 的 `components/PlanLibraryModal.vue`），若它反过来 import `features/plan2d`，
 * 就形成 components → features 的反向依赖（B1/B2 的精神）。本文件只依赖
 * `data/materials`（内容色）+ `utils/geometry`（包围盒）+ `theme` 令牌，零特性依赖。
 *
 * 与原实现一致的三条口径：
 * 1. 缩略图里**用纯色代替 `<pattern>`**（材质图案只存在于主 SVG 的 `<defs>` 里，L2102）；
 * 2. 房间色 = `MATS[mat].sw`（内容色，ADR-10：不随主题变）；
 * 3. 墙体四类各自填色，`viewBox` 取该户型包围盒，`preserveAspectRatio="xMidYMid meet"`。
 *
 * ⚠️ 本文件不出现十六进制字面值（颜色来自 `data/materials.ts` 与主题令牌）。
 */
import { MATS } from '@/data/materials';
import { area, boundsOf } from '@/utils/geometry';
import type { Plan, PlanLevel, PlanStructure } from '@/types/plan';
import type { TokenResolver } from '@/types/theme';

/** 取第 1 层结构（复式取 `levels[0]`，原 `levelOf(p, 0)`） */
export function firstLevelOf(plan: Plan): PlanLevel | Plan {
  if (plan.multilevel && plan.levels && plan.levels.length > 0) return plan.levels[0];
  return plan;
}

/** 楼层数（单层 = 1） */
export function planLevelCount(plan: Plan): number {
  return plan.multilevel && plan.levels && plan.levels.length > 0 ? plan.levels.length : 1;
}

/** 所有楼层结构（单层返回自身） */
export function planLevels(plan: Plan): readonly PlanStructure[] {
  return plan.multilevel && plan.levels && plan.levels.length > 0 ? plan.levels : [plan];
}

/** 户型总使用面积（m²；排除 `counted === false`，含所有楼层，原 L2113） */
export function planTotalArea(plan: Plan): number {
  let sum = 0;
  for (const level of planLevels(plan)) {
    for (const room of level.rooms ?? []) {
      if (room.counted === false) continue;
      sum += area(room.poly);
    }
  }
  return sum;
}

/** 户型总房间数（复式累加，原 L2114） */
export function planRoomCount(plan: Plan): number {
  return planLevels(plan).reduce((sum, level) => sum + (level.rooms ?? []).length, 0);
}

/**
 * 缩略图 SVG 字符串。
 * @param resolve 主题令牌解析（墙色必须走令牌，B3/B9）
 */
export function planThumbSvg(plan: Plan, resolve: TokenResolver): string {
  const level = firstLevelOf(plan);
  const bounds = level.bounds ?? plan.bounds ?? boundsOf(level);
  const fillOf = (mat: string): string => {
    const entry = MATS[mat as keyof typeof MATS];
    return entry ? entry.sw : resolve('surface-2');
  };
  const rooms = (level.rooms ?? [])
    .map((room) => `<polygon points="${room.poly.map((q) => q.join(',')).join(' ')}" fill="${fillOf(room.mat)}"/>`)
    .join('');
  const walls = (level.walls ?? [])
    .map((w) => {
      const fill =
        w[4] === 'b'
          ? resolve('wall-bearing')
          : w[4] === 'low'
            ? resolve('wall-low')
            : w[4] === 'e'
              ? resolve('wall-exterior')
              : resolve('wall-partition');
      return `<rect x="${w[0]}" y="${w[1]}" width="${Math.max(1, w[2] - w[0])}" height="${Math.max(
        1,
        w[3] - w[1],
      )}" fill="${fill}"/>`;
    })
    .join('');
  return `<svg viewBox="${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}" preserveAspectRatio="xMidYMid meet">${rooms}${walls}</svg>`;
}
