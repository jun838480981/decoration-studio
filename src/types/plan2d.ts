/**
 * 2D 契约类型（SPEC §F.2 🔒 冻结）。
 *
 * 重建触发矩阵在这里以类型 + 常量形式定稿（运行时常量在 `features/plan2d/index.ts`），
 * 目的是让「依赖变更 → 只重算该层」成为可核对、可写单测的契约（RISK-03）。
 */

/** 2D 的 10 个图层（顺序即渲染顺序，SPEC §F.2） */
export type LayerKey =
  | 'GridLayer'
  | 'RoomLayer'
  | 'FurnitureLayer'
  | 'WallLayer'
  | 'OpeningLayer'
  | 'LabelLayer'
  | 'DimLayer'
  | 'MeasureLayer'
  | 'SelectionLayer'
  | 'EditLayer';
