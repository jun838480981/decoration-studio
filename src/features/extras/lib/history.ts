/**
 * 历史面板 + 命名快照（P0-8）。
 *
 * 语义边界（SPEC §B.1 P0-8 / OF §1.8）：
 * - 撤销/重做语义是业务资产：**布置栈 150**（`stores/layout`）与**结构栈 80**（`stores/plan`）双栈隔离，
 *   ⛔ 不引入第三方历史库（无法表达"结构修改要重算 bounds + 重映射 demolished"）。
 * - 本模块只做**投影**与**跳转**：时间线来自 store 的 `undoStack` / `redoStack` 原始快照字符串，
 *   跳转只调用既有 `undo()` / `redo()`（⛔ 不直接改 store 内部状态，保证栈语义不被绕过）。
 * - 命名快照**仅存在于当前会话内存**：SPEC §D.8 规定 ⛔ 不得新增任何 `localStorage` 键，
 *   因此不做持久化（`docs/EXTRAS.md` 已登记；将来若允许新键，只改本文件即可）。
 */
import { diffMetricRows, type MetricDiffRow } from './compare';
import type { PlanDiffSummary } from '@/types/extras';

/** 时间线上的一步（`depth` = 需要撤销几次才能到达；0 = 当前状态） */
export interface HistoryStep {
  /** 栈内下标（0 = 最早） */
  index: number;
  depth: number;
  labelKey: string;
  /** 快照字符串（与 `layout.snapshot()` 逐字比较，用来匹配命名快照） */
  snapshot: string;
  /** 命名快照标签（若该步被命名过） */
  named?: string;
  /** 命名快照 id（点击"对比"时用） */
  namedId?: string;
  isCurrent: boolean;
}

export interface NamedSnapshot {
  id: string;
  label: string;
  /** 捕获时间（ms） */
  at: number;
  snapshot: string;
  /** 捕获时的深度（= 当时 `undoStack.length`） */
  depth: number;
  metrics: PlanDiffSummary;
}

export interface HistoryIo {
  undo(): boolean;
  redo(): boolean;
}

/** 快照字符串在 undoStack 中的位置 → 深度（找不到则返回当前深度） */
export function depthOf(snapshot: string, stack: readonly string[], currentDepth: number): number {
  const index = stack.indexOf(snapshot);
  return index < 0 ? currentDepth : stack.length - index;
}

/**
 * 时间线：过去每一步 + 当前状态。
 * `undoStack` 里的是"过去的状态快照"，`currentSnapshot` 是正在编辑的状态。
 */
export function historyTimeline(
  undoStack: readonly string[],
  currentSnapshot: string,
  named: readonly NamedSnapshot[],
): HistoryStep[] {
  const steps: HistoryStep[] = undoStack.map((snapshot, index) => {
    const matched = named.find((item) => item.snapshot === snapshot);
    return {
      index,
      depth: undoStack.length - index,
      labelKey: 'history.step',
      snapshot,
      named: matched?.label,
      namedId: matched?.id,
      isCurrent: false,
    };
  });
  steps.push({
    index: undoStack.length,
    depth: 0,
    labelKey: 'history.current',
    snapshot: currentSnapshot,
    isCurrent: true,
  });
  return steps;
}

/**
 * 跳转到指定深度（0 = 最新）。只走 store 的 `undo()` / `redo()`，⛔ 不越权改栈。
 * @returns 实际到达的深度（受栈长度限制时可能达不到目标）
 */
export function jumpToDepth(currentDepth: number, targetDepth: number, io: HistoryIo): number {
  let depth = Math.max(0, currentDepth);
  const target = Math.max(0, targetDepth);
  if (target < depth) {
    while (depth > target) {
      if (!io.undo()) break;
      depth -= 1;
    }
    return depth;
  }
  while (depth < target) {
    if (!io.redo()) break;
    depth += 1;
  }
  return depth;
}

export interface NamedSnapshotInput {
  id: string;
  label: string;
  snapshot: string;
  depth: number;
  metrics: PlanDiffSummary;
  at?: number;
}

export function createNamedSnapshot(input: NamedSnapshotInput): NamedSnapshot {
  return {
    id: input.id,
    label: input.label.trim() || input.id,
    at: input.at ?? Date.now(),
    snapshot: input.snapshot,
    depth: input.depth,
    metrics: input.metrics,
  };
}

/** 命名快照 vs 当前状态的逐指标差量（复用对比口径） */
export function diffNamedWithCurrent(snapshot: NamedSnapshot, current: PlanDiffSummary): MetricDiffRow[] {
  return diffMetricRows(snapshot.metrics, current);
}

/** 只保留有差异的指标行 */
export function changedNamedDiff(snapshot: NamedSnapshot, current: PlanDiffSummary): MetricDiffRow[] {
  return diffNamedWithCurrent(snapshot, current).filter((row) => Math.abs(row.delta) > 0.005);
}

/** 快照是否与当前栈已不同步（用户已经 undo 到别处） */
export function isStale(snapshot: NamedSnapshot, stack: readonly string[]): boolean {
  return stack.indexOf(snapshot.snapshot) < 0;
}