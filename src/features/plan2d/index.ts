/**
 * 2D 平面模块出口与契约常量（SPEC §F.2 / §C.1）。
 *
 * ⚠️ 本目录由 **t4（plan2d-dev）** 独占实现；t3 只在此固化**图层顺序**与**重建触发矩阵**，
 * 让「依赖变更 → 只重算该层」成为可核对、可写单测的契约（RISK-03：原实现每次拖动走 `renderAll()`）。
 */
import type { LayerKey } from '@/types/plan2d';

/** 渲染顺序（= SPEC §F.2 表格顺序；⛔ 调整顺序会影响叠压关系，需 reviewer 确认） */
export const PLAN_LAYER_ORDER = [
  'GridLayer',
  'RoomLayer',
  'FurnitureLayer',
  'WallLayer',
  'OpeningLayer',
  'LabelLayer',
  'DimLayer',
  'MeasureLayer',
  'SelectionLayer',
  'EditLayer',
] as const satisfies readonly LayerKey[];

/**
 * 每个图层的 watch 源（SPEC §F.2 🔒）。
 * 硬约束：拖动家具时**只有** `FurnitureLayer` 与 `SelectionLayer` 允许重算。
 */
export const LAYER_WATCH_SOURCES: Record<LayerKey, readonly string[]> = {
  GridLayer: ['ui.flags.grid'],
  RoomLayer: ['plan.rooms', 'layout.rooms', 'plan.stairs', 'plan.voids', 'ui.edit.on'],
  FurnitureLayer: ['layout.furniture', 'ui.flags.furn'],
  WallLayer: ['plan.walls', 'layout.demolished', 'ui.flags.bearing'],
  OpeningLayer: ['plan.wins', 'plan.doors', 'plan.slides', 'plan.bounds', 'plan.doors(entry)'],
  LabelLayer: ['plan.rooms', 'layout.rooms', 'ui.flags.labels'],
  DimLayer: ['plan.dims', 'plan.walls', 'ui.flags.dims'],
  MeasureLayer: ['layout.measures', 'ui.measureA', 'ui.measureCur', 'ui.view.s'],
  SelectionLayer: ['ui.selection', 'layout.furniture', 'ui.view.s'],
  EditLayer: ['ui.edit.*', 'ui.view', 'plan.walls', 'plan.rooms'],
};

/** 唯一允许重算的图层（家具拖动期间） */
export const DRAG_REBUILD_LAYERS: readonly LayerKey[] = ['FurnitureLayer', 'SelectionLayer'];

/**
 * t4 待实现的文件清单（SPEC §C.1）：
 * `PlanCanvas.vue`、`layers/*.vue`（10 个）、`editing.ts`、`dims.ts`、`auto-furnish.ts`、`export-svg.ts`。
 * 已建占位：`furniture-svg.ts`（`furnSVG(t,w,d,c)`）、`patterns.ts`（`buildDefs()`）、`room-detect.ts`（P2-5）。
 */
export const PLAN2D_PENDING_MODULES = [
  'PlanCanvas.vue',
  'layers/GridLayer.vue',
  'layers/RoomLayer.vue',
  'layers/FurnitureLayer.vue',
  'layers/WallLayer.vue',
  'layers/OpeningLayer.vue',
  'layers/LabelLayer.vue',
  'layers/DimLayer.vue',
  'layers/MeasureLayer.vue',
  'layers/SelectionLayer.vue',
  'layers/EditLayer.vue',
  'editing.ts',
  'dims.ts',
  'auto-furnish.ts',
  'export-svg.ts',
] as const;