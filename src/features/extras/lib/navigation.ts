/**
 * 告警点击 → 视口定位 / 选中（P0-4 的「可点击告警列表」后半段）。
 *
 * 契约（SPEC §F.1 单一事实来源）：2D 视口变换的唯一归属是 `stores/ui.view`，
 * 所以这里**只写 store 的状态**，⛔ 不做任何命令式 DOM 操作（原实现直接改 DOM，是 X4 同类问题）。
 * 2D 图层按 SPEC §F.2 的依赖矩阵 `watch(ui.view)`，写入后画面自然跟随。
 */
import type { Vec2 } from '@/types/geometry';
import type { Selection, ViewTransform } from '@/types/state';

export interface StageSize {
  w: number;
  h: number;
}

/** 把世界坐标点移到舞台中心（⛔ 不改缩放，避免打断用户当前比例） */
export function centerViewOn(view: ViewTransform, stage: StageSize, p: Vec2): boolean {
  if (stage.w <= 0 || stage.h <= 0 || view.s <= 0) return false;
  view.x0 = p.x - stage.w / (2 * view.s);
  view.y0 = p.y - stage.h / (2 * view.s);
  return true;
}

export interface SelectionContext {
  furnitureIds: ReadonlySet<string>;
  roomIds: ReadonlySet<string>;
}

/**
 * 告警 → 选中对象。
 * 目标 id 的语义由规则决定（`types/extras.ts` 的 `ValidationIssue.targets` 注释）：家具规则取家具 id，
 * 房间规则取房间 id；`dimension-anomaly` 两种都可能，因此用 id 集合判定。
 */
export function selectionForTargets(targets: readonly string[], ctx: SelectionContext): Selection {
  const first = targets[0];
  if (!first) return null;
  if (ctx.furnitureIds.has(first)) return { kind: 'furn', id: first };
  if (ctx.roomIds.has(first)) return { kind: 'room', id: first };
  return null;
}