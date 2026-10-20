/**
 * 多方案并排对比 + 差异摘要（P0-5）。
 *
 * 为什么自研（SPEC §B.1 P0-5 / OSS §6 #10）：对比维度（使用面积 / 材料金额 / 家具数量 / 拆除长度）
 * 全部是本项目专有口径（OF §6.2），没有任何第三方库能表达；这里只做"把同一份口径跑遍多个方案"。
 *
 * 数据来源（全部经 store 契约，⛔ 不直读 `localStorage`）：
 * - 结构：`plan.findPlan(id)` → `Plan`（含 `levels`）
 * - 布置：当前方案用**实时** store 状态（`lib/metrics.liveState()`），其它方案用
 *   `plan.readState(id, lv, multi)`（t3 已为 t6 预留的只读出口）
 * - 单价：`data/materials.ts`（t4）经 `priceOf` 注入；当前由 `cost.priceResolverFromBreakdown()` 桥接
 */
import { diffAgainstBaseline, metricsOf, planLevelInputs, METRIC_FIELDS, type MetricField } from './metrics';
import type { PlanDiffSummary } from '@/types/extras';
import type { MaterialKey } from '@/types/material';
import type { Plan } from '@/types/plan';
import type { PlanState } from '@/types/state';

export interface PlanSource {
  plan: Plan;
  /** 逐层存档：单层 1 个；复式按 `levels` 顺序（当前方案传实时状态） */
  states: readonly PlanState[];
}

export interface CompareOptions {
  priceOf: (key: MaterialKey) => number;
}

/** 同一套口径跑遍多个方案，并相对第 1 个（基准）填 `delta` */
export function comparePlanSources(sources: readonly PlanSource[], options: CompareOptions): PlanDiffSummary[] {
  const rows = sources.map((source) =>
    metricsOf({
      planId: source.plan.id,
      planName: source.plan.name,
      levels: planLevelInputs(source.plan, source.states),
      priceOf: options.priceOf,
    }),
  );
  return diffAgainstBaseline(rows);
}

/** 差值非 0 的指标（「差异摘要」只列这些行） */
export function changedFields(row: PlanDiffSummary): MetricField['key'][] {
  if (!row.delta) return [];
  return METRIC_FIELDS.filter((field) => Math.abs(row.delta?.[field.key] ?? 0) > 0.005).map((field) => field.key);
}

/** 任意两个摘要的逐指标差量（历史快照对比 / 方案对比共用） */
export interface MetricDiffRow {
  key: MetricField['key'];
  labelKey: string;
  before: number;
  after: number;
  delta: number;
  digits: number;
}

export function diffMetricRows(before: PlanDiffSummary, after: PlanDiffSummary): MetricDiffRow[] {
  return METRIC_FIELDS.map((field) => ({
    key: field.key,
    labelKey: field.labelKey,
    before: before[field.key],
    after: after[field.key],
    delta: Math.round((after[field.key] - before[field.key]) * 100) / 100,
    digits: field.digits,
  }));
}

/** 仅保留有差异的指标（空数组 = 两个方案完全一致） */
export function changedMetricRows(before: PlanDiffSummary, after: PlanDiffSummary): MetricDiffRow[] {
  return diffMetricRows(before, after).filter((row) => Math.abs(row.delta) > 0.005);
}