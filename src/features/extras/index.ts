/**
 * 亮点功能模块出口（SPEC §B：P0-1…P0-9 + P1-2/P1-3/P1-4）。
 *
 * ⚠️ 本目录由 **t6（features-dev）** 独占实现。t3 只固化入口清单与共享类型，
 * 保证 2D/3D 两条线不会去重复实现导出/校验逻辑（ADR-14：依赖收敛，下游不得自行装备选包）。
 */
export type { CostRow, ExportKind, PlanDiffSummary, ValidationIssue } from '@/types/extras';

/** 入口清单（SPEC §C.1 的 `features/extras/**`） */
export const EXTRAS_ENTRYPOINTS = {
  components: [
    'PlanCompare.vue',
    'CostReport.vue',
    'ValidationPanel.vue',
    'CommandPalette.vue',
    'HistoryPanel.vue',
    'ExportMenu.vue',
  ],
  lib: [
    'export-csv.ts',
    'export-xlsx.ts',
    'export-pdf.ts',
    'validate.ts',
    'export-dxf.ts',
    'export-svg.ts',
    'compare.ts',
    'history.ts',
  ],
} as const;

/** 允许的导出产物（SPEC §B.1/§B.2；P1-1 的 PDF 为可选项，接口先留） */
export const EXPORT_KINDS = ['png', 'svg', 'dxf', 'csv', 'xlsx', 'pdf', 'json-plan', 'json-layout'] as const;

/** 平面图校验的 5 条规则（P0-4，阈值是业务资产，由 t6 定稿） */
export const VALIDATION_RULES = [
  'furniture-through-wall',
  'furniture-blocking-door',
  'blocked-passage',
  'empty-room',
  'dimension-anomaly',
] as const;