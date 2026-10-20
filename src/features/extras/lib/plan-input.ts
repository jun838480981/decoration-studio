/**
 * 把 **store 切片** 组装成对比/报价/校验所需的输入（组件因此可以很薄）。
 *
 * 为什么单独一层：`features/extras` 需要"当前方案（实时状态）"与"其它方案（存档状态）"两种读数，
 * 而 store 的契约是唯一的读取通道（SPEC §F.1 单一事实来源）：
 * - 当前层 → `layout` 的实时状态（`liveState()`）
 * - 其它层 → `plan.readState(id, lv, multi)`（t3 为 t6 预留的只读出口）
 * - 其它方案 → 同样走 `plan.readState`（⛔ 组件不直读 `localStorage`，B6）
 */
import { liveState, planLevelInputs, type LevelInput, type LiveLayoutSlice } from './metrics';
import type { PlanDiffSummary } from '@/types/extras';
import type { Plan } from '@/types/plan';
import type { PlanState } from '@/types/state';
import type { MaterialKey } from '@/types/material';
import { comparePlanSources, type PlanSource } from './compare';

/** `usePlanStore()` 满足这个接口（结构性类型，避免 extras 依赖 store 实例） */
export interface PlanStateReader {
  readState(planId: string, level: number, multi: boolean): PlanState;
}

export interface CurrentPlanSlices {
  plan: Plan;
  /** 当前楼层 */
  level: number;
  isMulti: boolean;
  /** `layout` 的实时切片 */
  live: LiveLayoutSlice;
  reader: PlanStateReader;
}

/** 当前方案各层状态：当前层实时，其它层存档 */
export function currentLevelStates(slices: CurrentPlanSlices): PlanState[] {
  const live = liveState(slices.live);
  const levels = slices.plan.multilevel && slices.plan.levels ? slices.plan.levels : null;
  if (!slices.isMulti || !levels || levels.length === 0) return [live];
  return levels.map((_level, index) => (index === slices.level ? live : slices.reader.readState(slices.plan.id, index, true)));
}

/** 其它方案的各层状态（全部走存档） */
export function storedLevelStates(plan: Plan, reader: PlanStateReader): PlanState[] {
  const levels = plan.multilevel && plan.levels ? plan.levels : null;
  if (!levels || levels.length === 0) return [reader.readState(plan.id, 0, false)];
  return levels.map((_level, index) => reader.readState(plan.id, index, true));
}

export interface CompareContext {
  /** 当前方案 id（用实时状态） */
  currentPlanId: string;
  reader: PlanStateReader;
  live: LiveLayoutSlice;
  currentPlan: Plan;
  level: number;
  isMulti: boolean;
  priceOf: (key: MaterialKey) => number;
}

/** 组装多方案对比的输入（当前方案用实时状态，其余用存档） */
export function buildCompareSources(selected: readonly Plan[], ctx: CompareContext): PlanSource[] {
  return selected.map((plan) => {
    if (plan.id === ctx.currentPlanId) {
      return {
        plan,
        states: currentLevelStates({
          plan,
          level: ctx.level,
          isMulti: ctx.isMulti,
          live: ctx.live,
          reader: ctx.reader,
        }),
      };
    }
    return { plan, states: storedLevelStates(plan, ctx.reader) };
  });
}

export function compareSelectedPlans(selected: readonly Plan[], ctx: CompareContext): PlanDiffSummary[] {
  return comparePlanSources(buildCompareSources(selected, ctx), { priceOf: ctx.priceOf });
}

/** 当前方案的层级输入（报价 / 图册 / 校验共用） */
export function currentLevelInputs(slices: CurrentPlanSlices): LevelInput[] {
  return planLevelInputs(slices.plan, currentLevelStates(slices));
}