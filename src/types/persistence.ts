/**
 * 持久化文件结构（SPEC §C.1 / §D.8）。
 *
 * ⛔ 键名字面值只在 `utils/persistence.ts` 定义一次；本文件里的 `fmt` 用**字面量类型**表示，
 *    运行时常量在 `stores/plan.ts`（`PLAN_FMT` / `PLAN_SET_FMT`）与持久化工具里。
 * ⛔ 禁止新增任何 localStorage 键（SPEC §D.8）。
 */
import type { Plan } from './plan';
import type { PlanState } from './state';

/** 单个户型导出文件（原 `exportPlan`，L2055-2063） */
export interface PlanFile {
  fmt: 'huxing-plan-v1';
  /** 导出时间（ISO） */
  at?: string;
  plan: Plan;
  /**
   * 第 1 层（单层户型的唯一一层）的布置存档（OF §7.3 的 `state` 字段，原 L2059）。
   * ⚠️ t4 补充的**可选**字段：SPEC §D.5 冻结的返回值类型保持兼容，但导出必须带上布置，
   * 否则「导出户型再导入」会丢家具（功能基线 OF §7.3 要求）。
   */
  state?: PlanState | null;
  /** 复式户型的逐层布置（原 L2060 的 `states`） */
  states?: (PlanState | null)[];
}

/** 全部户型打包导出（原 `exportAll`，L2064-2072） */
export interface PlanSetFile {
  fmt: 'huxing-plan-v1-set';
  at?: string;
  plans: Plan[];
  /** 当前打开的户型 id */
  current?: string;
  /** 逐户型 + 逐层布置（t4 补充；`plans` 保持为纯结构数组以兼容 SPEC §D.5 签名） */
  entries?: PlanSetEntry[];
}

/** `PlanSetFile.entries` 的元素（原 `exportAllPlans` 的 `{plan, state, states?}`） */
export interface PlanSetEntry {
  plan: Plan;
  state?: PlanState | null;
  states?: (PlanState | null)[];
}

/** 户型库持久化值：`huxing-plans-v1`（SPEC §D.8） */
export interface PlanLibraryFile {
  custom: Plan[];
  current: string;
}

/** 布置存档的独立导出结构（P0-8 历史面板/快照可复用） */
export interface LayoutFile {
  fmt: 'huxing-state-v2';
  planId: string;
  level?: number;
  at?: string;
  state: PlanState;
}

/**
 * 写入结果（SPEC §D.6 `save()` 的返回类型）。
 * `'quota'` = `QuotaExceededError`（localStorage 5MB 上限），UI 必须**可见提示**而不是静默吞掉（X11/ RISK-10）。
 */
export type SaveStatus = 'ok' | 'quota' | 'error';
