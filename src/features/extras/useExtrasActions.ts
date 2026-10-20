/**
 * 亮点层的**动作集合**（composable）：导出 / 导入 / 打印 / PDF / 对比导出。
 *
 * 为什么抽成 composable：`ExportMenu.vue`、`CostReport.vue`、`CommandPalette.vue`、
 * `PlanCompare.vue` 需要**同一批动作**（SPEC §B.2 P1-3 要求面板不抢既有快捷键且能执行导出）。
 * 如果各处各写一遍编排逻辑，就会出现"菜单能导出、面板导出的东西不同"的双份真相。
 * 动作只在这里定义一次，组件只负责 UI（按钮 / 命令项）。
 *
 * 约束：
 * - ⛔ 不 import `features/plan2d` / `features/scene3d`（B1/B2）：2D 节点经 `getSvg` 回调，
 *   3D 截图经 `utils/scenePort` 的 `Scene3DApi.shot()`（SPEC §F.4）；
 * - ⛔ 不直读 `localStorage`（B6）：其它方案的布置走 `plan.readState()`；
 * - 语言来自 `useLang()`（响应式，切换语言后导出文件名与表头立即跟着变）；
 * - 所有产物都返回/提示**真实结果**：失败给出原因，⛔ 不伪造成功。
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useLayoutStore } from '@/stores/layout';
import { usePlanStore } from '@/stores/plan';
import { useToastStore } from '@/stores/toast';
import { useUiStore } from '@/stores/ui';
import { useTheme } from '@/theme/useTheme';
import { getScene3DApi } from '@/utils/scenePort';
import { costReportFromLevels, priceResolver, usageFromLevels, type CostReportModel, type RoomUsage } from './lib/cost';
import { compareSelectedPlans, currentLevelInputs } from './lib/plan-input';
import { liveState, type LevelInput } from './lib/metrics';
import { validatePlan } from './lib/validate';
import { createTranslator, useLang, type Lang, type Translate } from './lib/i18n';
import { downloadBlob, downloadText } from './lib/download';
import { compareCsv, costCsv, issuesCsv } from './lib/export-csv';
import { buildXlsx, costXlsxSheets, xlsxFileName } from './lib/export-xlsx';
import { buildDxf, dxfFileName } from './lib/export-dxf';
import { buildPlanPng, pngFileName, serializeSvgDocument, svgFileName, type SvgExportOptions } from './lib/export-svg';
import {
  buildLayoutFile,
  importLayoutInto,
  jsonFileName,
  layoutFileToText,
  planFileToText,
  planSetToText,
} from './lib/export-json';
import { buildPrintAlbum, requestPrint, suggestDayTheme } from './lib/print';
import { PDF_EXPORT_AVAILABLE, buildPdfAlbum, pdfFileName } from './lib/export-pdf';
import type { ExportKind, PlanDiffSummary, ValidationIssue } from '@/types/extras';
import type { Plan, PlanStructure } from '@/types/plan';

export interface ExtrasActionsOptions {
  /** 语言（缺省用 `useLang()` 的响应式状态；只有单测/嵌入场景才需要显式传） */
  lang?: () => Lang;
  /** 2D 画布 `<svg>` 取用器（缺省时按 `svg[data-plan-canvas]` 约定查找） */
  getSvg?: () => SVGSVGElement | null;
  /** 文件名基名 */
  baseName?: () => string;
  /** 导出成功回调（组件用来 emit / 记录） */
  onExported?: (kind: ExportKind) => void;
}

export interface ExtrasActions {
  lang: ComputedRef<Lang>;
  t: ComputedRef<Translate>;
  baseName: ComputedRef<string>;
  busy: Ref<boolean>;
  levels: ComputedRef<LevelInput[]>;
  usage: ComputedRef<RoomUsage[]>;
  costModel: ComputedRef<CostReportModel>;
  issues: ComputedRef<ValidationIssue[]>;
  compareRows: ComputedRef<PlanDiffSummary[]>;
  notify: (name: string, kind: ExportKind) => void;
  fail: (reason: string) => void;
  exportSvg: () => void;
  exportPng: () => Promise<void>;
  exportDxf: () => Promise<void>;
  exportCsv: () => void;
  exportXlsx: () => Promise<void>;
  exportPlanJson: () => void;
  exportAllJson: () => void;
  exportLayoutJson: () => void;
  exportCompareCsv: () => void;
  importLayout: (text: string, label?: string) => boolean;
  importPlan: (text: string, label?: string) => number;
  printAlbum: () => void;
  exportPdf: () => Promise<void>;
}

export function useExtrasActions(options: ExtrasActionsOptions = {}): ExtrasActions {
  const plan = usePlanStore();
  const layout = useLayoutStore();
  const ui = useUiStore();
  const toast = useToastStore();
  const { presetId, setPreset, resolve } = useTheme();

  const busy = ref(false);
  // i18n 接线（C-4）：语言状态是响应式的，切换语言后 `t` / 文件名 / 表头一起变
  const { lang: uiLang } = useLang();
  const lang = computed<Lang>(() => options.lang?.() ?? uiLang.value);
  const t = computed(() => createTranslator(lang.value));
  const baseName = computed(
    () => options.baseName?.() ?? (lang.value === 'en' ? 'decoration-plan' : '户型装修方案'),
  );

  const levels = computed(() =>
    currentLevelInputs({ plan: plan.plan, level: plan.level, isMulti: plan.isMulti, live: layout, reader: plan }),
  );
  const usage = computed(() => usageFromLevels(levels.value, lang.value));
  // 单价单一来源 = `data/materials.ts` 的 `MATS[].price`（见 lib/cost.ts 的 priceResolver）
  const priceOf = computed(() => priceResolver());
  const costModel = computed(() =>
    costReportFromLevels({ levels: levels.value, priceOf: priceOf.value, lang: lang.value }),
  );
  const issues = computed(() =>
    validatePlan({
      walls: plan.walls,
      doors: plan.doors,
      rooms: plan.rooms,
      furniture: layout.furniture,
      wins: plan.wins,
      demolished: layout.demolished,
      roomOverrides: layout.rooms,
      lang: lang.value,
    }),
  );
  const compareRows = computed(() =>
    compareSelectedPlans(plan.allPlans, {
      currentPlanId: plan.currentId,
      reader: plan,
      live: layout,
      currentPlan: plan.plan as Plan,
      level: plan.level,
      isMulti: plan.isMulti,
      priceOf: priceOf.value,
    }),
  );

  function notify(name: string, kind: ExportKind): void {
    toast.push(t.value('export.done', { name }), 'info');
    options.onExported?.(kind);
  }

  function fail(reason: string): void {
    toast.push(t.value('export.failed', { reason }), 'danger');
  }

  function resolveSvgNode(): SVGSVGElement | null {
    const provided = options.getSvg?.() ?? null;
    if (provided) return provided;
    if (typeof document === 'undefined') return null;
    return document.querySelector('svg[data-plan-canvas]') as SVGSVGElement | null;
  }

  /** 导出参数：包围盒来自 store，颜色来自**主题令牌的字面值**（R-EXP-1/R-EXP-3） */
  function svgOptions(): SvgExportOptions {
    return { bounds: plan.bounds, resolve, background: resolve('canvas') };
  }

  function currentStructure(): PlanStructure {
    return {
      bounds: plan.bounds,
      walls: plan.walls,
      wins: plan.wins,
      doors: plan.doors,
      slides: plan.slides,
      rooms: plan.rooms,
      dims: plan.dims,
      lintels: plan.lintels,
      stairs: plan.stairs,
      voids: plan.voids,
    };
  }

  function exportSvg(): void {
    const node = resolveSvgNode();
    if (!node) {
      toast.push(t.value('export.no2dSvg'), 'warn');
      return;
    }
    const doc = serializeSvgDocument(node, svgOptions());
    const result = downloadText(svgFileName(baseName.value), doc.text, 'image/svg+xml;charset=utf-8');
    if (result.ok) notify(result.name, 'svg');
    else fail(result.reason ?? 'unknown');
  }

  async function exportPng(): Promise<void> {
    if (ui.is3D) {
      const scene = getScene3DApi();
      if (!scene) {
        toast.push(t.value('export.no3d'), 'warn');
        return;
      }
      // 3D 截图走既有通道（原 `View3D.shot()`，L3888；依赖 preserveDrawingBuffer，R-EXP-4）
      scene.shot();
      notify(lang.value === 'en' ? 'decoration-plan-3d.png' : '户型装修方案-3D.png', 'png');
      return;
    }
    const node = resolveSvgNode();
    if (!node) {
      toast.push(t.value('export.no2dSvg'), 'warn');
      return;
    }
    busy.value = true;
    try {
      const result = await buildPlanPng(node, svgOptions());
      if (!result.ok) {
        fail(result.reason);
        return;
      }
      const download = downloadBlob(pngFileName(baseName.value), result.blob);
      if (download.ok) notify(download.name, 'png');
      else fail(download.reason ?? 'unknown');
    } finally {
      busy.value = false;
    }
  }

  async function exportDxf(): Promise<void> {
    busy.value = true;
    try {
      const structure = currentStructure();
      const result = await buildDxf({
        walls: structure.walls,
        wins: structure.wins,
        doors: structure.doors,
        slides: structure.slides,
        rooms: structure.rooms,
        dims: structure.dims,
        furniture: layout.furniture,
        demolished: layout.demolished,
        bounds: structure.bounds,
      });
      if (!result.ok) {
        fail(result.reason);
        return;
      }
      const download = downloadText(dxfFileName(baseName.value), result.text, 'application/dxf');
      if (download.ok) notify(download.name, 'dxf');
      else fail(download.reason ?? 'unknown');
    } finally {
      busy.value = false;
    }
  }

  function exportCsv(): void {
    const combined = `${costCsv(costModel.value, lang.value)}\n\n${issuesCsv(issues.value, lang.value)}`;
    const result = downloadText(
      lang.value === 'en' ? 'cost-report.csv' : '报价单.csv',
      combined,
      'text/csv;charset=utf-8',
    );
    if (result.ok) notify(result.name, 'csv');
    else fail(result.reason ?? 'unknown');
  }

  async function exportXlsx(): Promise<void> {
    busy.value = true;
    try {
      const sheets = costXlsxSheets(costModel.value, lang.value, { usage: usage.value, issues: issues.value });
      const result = await buildXlsx(sheets);
      if (!result.ok) {
        // RISK-08 / 待确认项 C11：exceljs 不可用时退到 CSV，并明确告知原因
        toast.push(t.value('export.xlsxFallback', { reason: result.reason }), 'warn');
        exportCsv();
        return;
      }
      const download = downloadBlob(xlsxFileName(lang.value === 'en' ? 'cost-report' : '报价单'), result.blob);
      if (download.ok) notify(download.name, 'xlsx');
      else fail(download.reason ?? 'unknown');
    } finally {
      busy.value = false;
    }
  }

  function exportPlanJson(): void {
    const result = downloadText(
      jsonFileName(plan.plan.name || baseName.value),
      planFileToText(plan.exportPlan(plan.currentId)),
      'application/json',
    );
    if (result.ok) notify(result.name, 'json-plan');
    else fail(result.reason ?? 'unknown');
  }

  function exportAllJson(): void {
    const result = downloadText(
      jsonFileName(lang.value === 'en' ? 'all-plans' : '全部户型'),
      planSetToText(plan.exportAll()),
      'application/json',
    );
    if (result.ok) notify(result.name, 'json-plan');
    else fail(result.reason ?? 'unknown');
  }

  function exportLayoutJson(): void {
    const file = buildLayoutFile(liveState(layout), plan.currentId, plan.plan.name, plan.level);
    const suffix = lang.value === 'en' ? 'layout' : '布置';
    const result = downloadText(
      jsonFileName(`${plan.plan.name || baseName.value}-${suffix}`),
      layoutFileToText(file),
      'application/json',
    );
    if (result.ok) notify(result.name, 'json-layout');
    else fail(result.reason ?? 'unknown');
  }

  function exportCompareCsv(): void {
    const result = downloadText(
      lang.value === 'en' ? 'plan-compare.csv' : '方案对比.csv',
      compareCsv(compareRows.value, lang.value),
      'text/csv;charset=utf-8',
    );
    if (result.ok) notify(result.name, 'csv');
    else fail(result.reason ?? 'unknown');
  }

  /** 导入布置文本（原 OF §7.2：必须是带 `furniture` 数组的 JSON） */
  function importLayout(text: string, label?: string): boolean {
    if (!importLayoutInto(layout, text)) {
      fail(lang.value === 'en' ? 'invalid layout file' : '布置文件格式不正确');
      return false;
    }
    toast.push(t.value('export.done', { name: label ?? 'layout.json' }), 'info');
    return true;
  }

  /** 导入户型文本（OF §7.3 的 4 种形态由 store 的 `importText` 判定） */
  function importPlan(text: string, label?: string): number {
    const count = plan.importText(text);
    if (count === 0) {
      fail(lang.value === 'en' ? 'invalid plan file' : '不是有效的户型文件');
      return 0;
    }
    toast.push(t.value('export.done', { name: `${label ?? 'plan.json'} ×${count}` }), 'info');
    return count;
  }

  /** 打印图册：先建议切到日间主题（打印纸是白的），再调浏览器打印（可另存 PDF） */
  function printAlbum(): void {
    const suggestion = suggestDayTheme(presetId.value);
    if (suggestion) setPreset(suggestion);
    if (!requestPrint()) fail('no-dom');
  }

  async function exportPdf(): Promise<void> {
    if (!PDF_EXPORT_AVAILABLE) {
      // P1-1 未实现：明确告知并指向打印路径（⛔ 不伪造 PDF）
      toast.push(t.value('export.pdfUnavailable'), 'warn', 3600);
      return;
    }
    const album = buildPrintAlbum({
      planName: plan.plan.name,
      levelName: plan.isMulti ? plan.levelName : undefined,
      lang: lang.value,
      cost: costModel.value,
      usage: usage.value,
      furnitureNames: layout.furniture.map((item) => item.name),
      issues: issues.value,
    });
    const pdf = await buildPdfAlbum(album);
    if (!pdf.ok) {
      toast.push(t.value('export.pdfUnavailable'), 'warn', 3600);
      return;
    }
    const download = downloadBlob(pdfFileName(baseName.value), pdf.blob);
    if (download.ok) notify(download.name, 'pdf');
    else fail(download.reason ?? 'unknown');
  }

  return {
    lang,
    t,
    baseName,
    busy,
    levels,
    usage,
    costModel,
    issues,
    compareRows,
    notify,
    fail,
    exportSvg,
    exportPng,
    exportDxf,
    exportCsv,
    exportXlsx,
    exportPlanJson,
    exportAllJson,
    exportLayoutJson,
    exportCompareCsv,
    importLayout,
    importPlan,
    printAlbum,
    exportPdf,
  };
}