/**
 * 亮点功能模块出口（SPEC §B：P0-1…P0-9 + P1-2/P1-3/P1-4）。
 *
 * ⚠️ 本目录由 **features-dev（t4/t6）** 独占实现。t3 只固化入口清单与共享类型，
 * 保证 2D/3D 两条线不会去重复实现导出/校验逻辑（ADR-14：依赖收敛，下游不得自行装备选包）。
 *
 * 宿主（`App.vue` / `components/**`，归 t-2d）从这里按需取用：
 * ```ts
 * import { ExportMenu, ValidationPanel, CommandPalette } from '@/features/extras';
 * ```
 * ⛔ `features/extras/**` 不 import `features/plan2d/**` / `features/scene3d/**`（SPEC §C.2 B1/B2）：
 * 2D 画布经 `getSvg` 回调或 `svg[data-plan-canvas]` 约定，3D 经 `utils/scenePort`。
 */
export type { CostRow, ExportKind, Lang, PlanDiffSummary, ValidationIssue } from '@/types/extras';

// ---- 视图挂载位自注册（SPEC §C.1 / composables/useViewMounts） ----
import { registerViewMount } from '@/composables/useViewMounts';
import ExtrasToolbarComponent from './ExtrasToolbar.vue';
import ExtrasOverlayComponent from './ExtrasOverlay.vue';

/**
 * 把亮点层注册到 `App.vue` 的两个挂载位。
 *
 * ⚠️ 这是真实缺陷修复：此前**从未调用** `registerViewMount('extras-toolbar' | 'extras-overlay', …)`，
 * 于是 `App.vue` 里的 `<component :is="ExtrasToolbar" v-if="ExtrasToolbar">` 永远是空，
 * 页面上找不到任何亮点功能入口——命令面板（Ctrl+K）、导出菜单、平面图校验、方案对比、
 * 历史面板全部不可达（浏览器实测 5/10 项失败）。
 *
 * 为什么放在 `index.ts` 而不是 `App.vue`：`App.vue` 归 2D 侧装配，
 * 不能 import `features/extras/**`（SPEC §C.2 B2 边界）；由模块出口自注册可保持边界干净。
 */
export const ExtrasToolbar = ExtrasToolbarComponent;
export const ExtrasOverlay = ExtrasOverlayComponent;

registerViewMount('extras-toolbar', ExtrasToolbarComponent);
registerViewMount('extras-overlay', ExtrasOverlayComponent);

// ---- 组件（SPEC §C.1 的 6 个入口；全部按需引入，⛔ 不做全局注册） ----
export { default as PlanCompare } from './PlanCompare.vue';
export { default as CostReport } from './CostReport.vue';
export { default as ValidationPanel } from './ValidationPanel.vue';
export { default as CommandPalette } from './CommandPalette.vue';
export { default as HistoryPanel } from './HistoryPanel.vue';
export { default as ExportMenu } from './ExportMenu.vue';
export { default as ThemeSwitch } from './ThemeSwitch.vue';

// ---- composable（导出/导入/打印的统一动作集合，组件与命令面板共用） ----
export { useExtrasActions } from './useExtrasActions';
export type { ExtrasActions, ExtrasActionsOptions } from './useExtrasActions';

// ---- i18n 接线（P0-2 / C-4：`huxing-lang` 读+写、`createI18n` 实例化） ----
export {
  APP_TITLES,
  DEFAULT_LANG,
  HTML_LANG,
  LANGS,
  applyDocumentLang,
  createExtrasI18n,
  currentLang,
  currentUiLang,
  extrasMessagesForI18n,
  getI18n,
  installI18n,
  langButtonLabel,
  langOf,
  materialLabel,
  normalizeLang,
  persistLang,
  registerI18n,
  setI18nLocale,
  setLang,
  toggleLang,
  translate,
  useLang,
} from './lib/i18n';
export type { AppI18n, MessageTree, SetLangOptions, Translate, UseLangReturn } from './lib/i18n';

// ---- 3D 主题联动入口（P0-9 / §E.8；经 scenePort，⛔ 不 import scene3d） ----
export {
  THEMED_SCENE_METHOD,
  hasSceneThemeHook,
  syncSceneLanguage,
  syncSceneWithTheme,
  useSceneThemeSync,
} from './lib/scene-theme';
export type { SceneSyncAction, SceneSyncSource, ThemedSceneApi } from './lib/scene-theme';

// ---- 纯函数库（宿主做自定义 UI 时可直接用） ----
export { comparePlanSources, changedFields, diffMetricRows, changedMetricRows } from './lib/compare';
export type { MetricDiffRow, PlanSource } from './lib/compare';
export {
  buildCostReport,
  costReportFromLevels,
  costTableHeader,
  costTableRows,
  priceResolver,
  usageFromLevels,
  usageFromStructure,
  wallAreaFromLevels,
} from './lib/cost';
export type { CostReportModel, RoomUsage } from './lib/cost';
export { buildDxf, DXF_LAYERS, dxfFileName } from './lib/export-dxf';
export { buildPlanPng, prepareSvgCopy, serializeSvgDocument, SVG_HEADER_COMMENT, svgFileName } from './lib/export-svg';
export { buildXlsx, costXlsxSheets, xlsxFileName } from './lib/export-xlsx';
export { CSV_BOM, compareCsv, costCsv, diffSummaryCsv, issuesCsv, toCsv } from './lib/export-csv';
export { PDF_EXPORT_AVAILABLE, buildPdfAlbum, pdfFileName } from './lib/export-pdf';
export { buildPrintAlbum, requestPrint, suggestDayTheme } from './lib/print';
export { buildLayoutFile, importLayoutInto, parseLayoutText, readFileText } from './lib/export-json';
export { downloadBlob, downloadText, safeFileName, stampedName } from './lib/download';
export { METRIC_FIELDS, metricsOf, liveState, planLevelInputs, polygonAreaM2 } from './lib/metrics';
export type { LevelInput, MetricField } from './lib/metrics';
export { VALIDATION_RULE_IDS, VALIDATION_THRESHOLDS, issueRuleLabel, issueSeverityLabel, sortIssues, summarizeIssues, validatePlan } from './lib/validate';
export type { ValidationInput, ValidationRuleId, ValidationSummary } from './lib/validate';
export { COMMAND_SPECS, PALETTE_SHORTCUTS, RESERVED_SINGLE_KEYS, filterCommands, paletteConflicts } from './lib/commands';
export type { CommandGroup, CommandSpec } from './lib/commands';
export { createNamedSnapshot, historyTimeline, jumpToDepth } from './lib/history';
export type { HistoryStep, NamedSnapshot } from './lib/history';
export { centerViewOn, selectionForTargets } from './lib/navigation';

/** 入口清单（SPEC §C.1 的 `features/extras/**`；`verify.mjs` 可据此核对文件齐备） */
export const EXTRAS_ENTRYPOINTS = {
  components: [
    'PlanCompare.vue',
    'CostReport.vue',
    'ValidationPanel.vue',
    'CommandPalette.vue',
    'HistoryPanel.vue',
    'ExportMenu.vue',
    'ThemeSwitch.vue',
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
    'cost.ts',
    'metrics.ts',
    'geom.ts',
    'i18n.ts',
    'scene-theme.ts',
    'commands.ts',
    'navigation.ts',
    'plan-input.ts',
    'download.ts',
    'export-json.ts',
    'print.ts',
  ],
} as const;

/** 允许的导出产物（SPEC §B.1/§B.2；P1-1 的 PDF 为可选项，接口先留） */
export const EXPORT_KINDS = ['png', 'svg', 'dxf', 'csv', 'xlsx', 'pdf', 'json-plan', 'json-layout'] as const;

/** 平面图校验的 5 条规则（P0-4，阈值是业务资产，见 `lib/validate.ts`） */
export const VALIDATION_RULES = [
  'furniture-through-wall',
  'furniture-blocking-door',
  'blocked-passage',
  'empty-room',
  'dimension-anomaly',
] as const;
