<script setup lang="ts">
/**
 * 导出菜单（SPEC §A.1 A29 + §B.1 P0-3/P0-6/P0-7 + §B.2 P1-1/P1-4）。
 *
 * 覆盖原 HTML 的**全部导出能力**（OF §7）并新增亮点导出：
 * PNG（2D 3200px / 3D 截图保真）· SVG（P0-6）· DXF（P0-7）· CSV/XLSX（P0-3）
 * · 布置 JSON · 户型 JSON · 全部户型打包 · 主题预设切换 · 打印/图册（P1-4）。
 *
 * 跨特性解耦（SPEC §C.2 B1/B2）：本组件 ⛔ 不 import `features/plan2d` / `features/scene3d`：
 * - 2D 画布经 `getSvg` 回调或 `svg[data-plan-canvas]` 约定取节点（t4 在 PlanCanvas 上写该属性）；
 * - 3D 截图经 `utils/scenePort` 的 `Scene3DApi.shot()`（SPEC §F.4）。
 */
import { computed, ref } from 'vue';
import { useLayoutStore } from '@/stores/layout';
import { usePlanStore } from '@/stores/plan';
import { useToastStore } from '@/stores/toast';
import { useUiStore } from '@/stores/ui';
import { useTheme } from '@/theme/useTheme';
import { getScene3DApi } from '@/utils/scenePort';
import { costReportFromLevels, priceResolverWithFallback, usageFromLevels } from './lib/cost';
import { currentLevelInputs, compareSelectedPlans } from './lib/plan-input';
import { liveState } from './lib/metrics';
import { validatePlan } from './lib/validate';
import { currentLang, createTranslator, type Lang } from './lib/i18n';
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
  readFileText,
} from './lib/export-json';
import { buildPrintAlbum, requestPrint, suggestDayTheme } from './lib/print';
import { PDF_EXPORT_AVAILABLE, buildPdfAlbum, pdfFileName } from './lib/export-pdf';
import type { ExportKind } from '@/types/extras';

const props = defineProps<{
  lang?: Lang;
  /** 2D 画布节点取用器（推荐由 PlanCanvas 传入；缺省时按 `svg[data-plan-canvas]` 约定查找） */
  getSvg?: () => SVGSVGElement | null;
  /** 文件名基名（默认「户型装修方案」，与 OF §7.1 一致） */
  baseName?: string;
}>();

const emit = defineEmits<{ (event: 'exported', kind: ExportKind): void }>();

const plan = usePlanStore();
const layout = useLayoutStore();
const ui = useUiStore();
const toast = useToastStore();
const { presetId, presets, setPreset, resolve } = useTheme();

const layoutInput = ref<HTMLInputElement | null>(null);
const planInput = ref<HTMLInputElement | null>(null);
const busy = ref(false);

const lang = computed<Lang>(() => props.lang ?? currentLang());
const t = computed(() => createTranslator(lang.value));
const is3d = computed(() => ui.is3D);
const baseName = computed(() => props.baseName ?? (lang.value === 'en' ? 'decoration-plan' : '户型装修方案'));

const levels = computed(() =>
  currentLevelInputs({ plan: plan.plan, level: plan.level, isMulti: plan.isMulti, live: layout, reader: plan }),
);
const priceOf = computed(() => priceResolverWithFallback(layout.materialBreakdown));
const usage = computed(() => usageFromLevels(levels.value));
const costModel = computed(() => costReportFromLevels({ levels: levels.value, priceOf: priceOf.value, lang: lang.value }));
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

function notify(name: string, kind: ExportKind): void {
  toast.push(t.value('export.done', { name }), 'info');
  emit('exported', kind);
}

function fail(reason: string): void {
  toast.push(t.value('export.failed', { reason }), 'danger');
}

function resolveSvgNode(): SVGSVGElement | null {
  const provided = props.getSvg?.() ?? null;
  if (provided) return provided;
  if (typeof document === 'undefined') return null;
  return document.querySelector('svg[data-plan-canvas]') as SVGSVGElement | null;
}

/** 导出参数：包围盒来自 store，颜色来自**主题令牌的字面值**（R-EXP-1/R-EXP-3） */
function svgOptions(): SvgExportOptions {
  return { bounds: plan.bounds, resolve, background: resolve('canvas') };
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
  if (is3d.value) {
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
    const result = await buildDxf({
      walls: plan.walls,
      wins: plan.wins,
      doors: plan.doors,
      slides: plan.slides,
      rooms: plan.rooms,
      dims: plan.dims,
      furniture: layout.furniture,
      demolished: layout.demolished,
      bounds: plan.bounds,
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
  const result = downloadText(jsonFileName(`${plan.plan.name || baseName.value}-${suffix}`), layoutFileToText(file), 'application/json');
  if (result.ok) notify(result.name, 'json-layout');
  else fail(result.reason ?? 'unknown');
}

function exportCompareCsv(): void {
  const compare = compareSelectedPlans(plan.allPlans, {
    currentPlanId: plan.currentId,
    reader: plan,
    live: layout,
    currentPlan: plan.plan,
    level: plan.level,
    isMulti: plan.isMulti,
    priceOf: priceOf.value,
  });
  const result = downloadText(
    lang.value === 'en' ? 'plan-compare.csv' : '方案对比.csv',
    compareCsv(compare, lang.value),
    'text/csv;charset=utf-8',
  );
  if (result.ok) notify(result.name, 'csv');
  else fail(result.reason ?? 'unknown');
}

async function onLayoutFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const text = await readFileText(file);
  if (!importLayoutInto(layout, text)) {
    fail(lang.value === 'en' ? 'invalid layout file' : '布置文件格式不正确');
    return;
  }
  toast.push(t.value('export.done', { name: file.name }), 'info');
}

async function onPlanFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const count = plan.importText(await readFileText(file));
  if (count === 0) {
    fail(lang.value === 'en' ? 'invalid plan file' : '不是有效的户型文件');
    return;
  }
  toast.push(t.value('export.done', { name: `${file.name} ×${count}` }), 'info');
}

/** 打印图册：先建议切到日间主题（打印纸是白的），再调浏览器打印（可另存 PDF） */
function printAlbum(): void {
  const suggestion = suggestDayTheme(presetId.value);
  if (suggestion) setPreset(suggestion);
  if (!requestPrint()) fail('no-dom');
}

async function exportPdf(): Promise<void> {
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
</script>

<template>
  <section class="extras-panel" data-print-section>
    <header class="extras-panel__head">
      <h3>{{ t('export.title') }}</h3>
      <span v-if="busy" class="muted">{{ t('common.refresh') }}…</span>
    </header>

    <div class="group">
      <h4>{{ t('export.imageSection') }}</h4>
      <div class="row">
        <button type="button" class="btn" :disabled="busy" @click="exportPng">
          {{ is3d ? t('export.png3d') : t('export.png2d') }}
        </button>
        <button type="button" class="btn" :disabled="is3d" @click="exportSvg">{{ t('export.svg') }}</button>
      </div>
    </div>

    <div class="group">
      <h4>{{ t('export.cadSection') }}</h4>
      <div class="row">
        <button type="button" class="btn" :disabled="busy" @click="exportDxf">{{ t('export.dxf') }}</button>
      </div>
      <p class="muted">{{ t('export.dxfNote') }}</p>
    </div>

    <div class="group">
      <h4>{{ t('export.sheetSection') }}</h4>
      <div class="row">
        <button type="button" class="btn" @click="exportCsv">{{ t('export.csv') }}</button>
        <button type="button" class="btn" :disabled="busy" @click="exportXlsx">{{ t('export.xlsx') }}</button>
        <button type="button" class="btn" @click="exportCompareCsv">{{ t('compare.title') }}</button>
      </div>
    </div>

    <div class="group">
      <h4>{{ t('export.planSection') }}</h4>
      <div class="row">
        <button type="button" class="btn" @click="exportPlanJson">{{ t('export.jsonPlan') }}</button>
        <button type="button" class="btn" @click="exportAllJson">{{ t('export.jsonAll') }}</button>
        <button type="button" class="btn" @click="exportLayoutJson">{{ t('export.jsonLayout') }}</button>
      </div>
      <div class="row">
        <button type="button" class="btn" @click="layoutInput?.click()">{{ t('export.importJson') }}</button>
        <button type="button" class="btn" @click="planInput?.click()">{{ t('export.importPlan') }}</button>
      </div>
      <input
        ref="layoutInput"
        class="hidden-input"
        type="file"
        accept=".json,application/json"
        data-print-hide
        @change="onLayoutFile"
      />
      <input
        ref="planInput"
        class="hidden-input"
        type="file"
        accept=".json,application/json"
        data-print-hide
        @change="onPlanFile"
      />
    </div>

    <div class="group">
      <h4>{{ t('theme.title') }}</h4>
      <div class="row">
        <button
          v-for="preset in presets"
          :key="preset.id"
          type="button"
          class="chip"
          :class="{ 'chip--on': preset.id === presetId }"
          :aria-pressed="preset.id === presetId"
          @click="setPreset(preset.id)"
        >
          {{ lang === 'en' ? preset.en : preset.zh }}
        </button>
      </div>
      <p class="muted">{{ t('theme.hint') }}</p>
    </div>

    <div class="group">
      <h4>{{ t('export.printSection') }}</h4>
      <div class="row">
        <button type="button" class="btn" @click="printAlbum">{{ t('export.print') }}</button>
        <button type="button" class="btn" :disabled="!PDF_EXPORT_AVAILABLE" @click="exportPdf">
          {{ t('export.pdf') }}
        </button>
      </div>
      <p v-if="!PDF_EXPORT_AVAILABLE" class="muted">{{ t('export.pdfUnavailable') }}</p>
    </div>
  </section>
</template>

<style scoped>
.extras-panel {
  background: var(--ds-surface);
  border: 1px solid var(--ds-border-strong);
  border-radius: 10px;
  padding: 10px 12px;
  color: var(--ds-text);
}

.extras-panel__head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

h3 {
  margin: 0 0 6px;
  font-size: 14px;
}

h4 {
  margin: 0 0 4px;
  font-size: 12px;
  color: var(--ds-text-secondary);
}

.group {
  padding: 6px 0;
  border-top: 1px solid var(--ds-border);
}

.group:first-of-type {
  border-top: 0;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.btn {
  border: 1px solid var(--ds-border-strong);
  background: var(--ds-surface-2);
  color: var(--ds-text);
  min-height: 30px;
}

.btn:hover {
  background: var(--ds-accent-soft);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chip {
  border: 1px solid transparent;
  background: transparent;
  color: var(--ds-text-secondary);
}

.chip--on {
  background: var(--ds-accent-soft);
  border-color: var(--ds-accent);
  color: var(--ds-accent);
}

.muted {
  margin: 4px 0 0;
  color: var(--ds-text-muted);
  font-size: 11px;
  line-height: 1.4;
}

.hidden-input {
  display: none;
}
</style>