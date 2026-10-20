<script setup lang="ts">
/**
 * 报价单 / 工程量清单（P0-3 的 UI 侧；口径见 `lib/cost.ts` + `lib/metrics.ts`）。
 *
 * 原 HTML 的「材料报价与面积统计」（OF §6.2）在新工程里的落点就是这里：
 * - 面积口径：`Σ area(room)` 排除飘窗；材料用量含 5% 损耗；墙面 = 周长 × 2.8；拆除 = `Σ max(dx,dy)`；
 * - 单价来源：`data/materials.ts` 的 `MATS[].price`（**单一来源**，⛔ 不在此复制价格表）；
 * - 导出：CSV 走 `papaparse`（`lib/export-csv.ts`），XLSX 走 `exceljs` 动态 import（`lib/export-xlsx.ts`）。
 *
 * ⛔ 本组件不写 hex（B3）；表格样式全部来自 `extras.css` 的 `--ds-*` 令牌。
 */
import { computed } from 'vue';
import { useLayoutStore } from '@/stores/layout';
import { usePlanStore } from '@/stores/plan';
import { useToastStore } from '@/stores/toast';
import { costReportFromLevels, costTableHeader, costTableRows, priceResolver, usageFromLevels } from './lib/cost';
import { currentLevelInputs } from './lib/plan-input';
import { costCsv, issuesCsv } from './lib/export-csv';
import { buildXlsx, costXlsxSheets, xlsxFileName } from './lib/export-xlsx';
import { downloadBlob, downloadText } from './lib/download';
import { requestPrint } from './lib/print';
import { materialLabel, useLang } from './lib/i18n';
import { VALIDATION_RULE_IDS, issueRuleLabel, issueSeverityLabel, validatePlan } from './lib/validate';

const props = withDefaults(
  defineProps<{
    /** 是否显示校验告警小节（与 `ValidationPanel` 不重复时可关） */
    showIssues?: boolean;
    /** 是否显示导出按钮 */
    allowExport?: boolean;
  }>(),
  { showIssues: true, allowExport: true },
);

const plan = usePlanStore();
const layout = useLayoutStore();
const toast = useToastStore();
const { t, lang } = useLang();

const levels = computed(() =>
  currentLevelInputs({ plan: plan.plan, level: plan.level, isMulti: plan.isMulti, live: layout, reader: plan }),
);
const usage = computed(() => usageFromLevels(levels.value, lang.value));
const model = computed(() =>
  costReportFromLevels({ levels: levels.value, priceOf: priceResolver(), lang: lang.value }),
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

const header = computed(() => costTableHeader(lang.value));
const bodyRows = computed(() => costTableRows(model.value, lang.value));
const isEmpty = computed(() => model.value.rows.length === 0);

function exportCsv(): void {
  const text = `${costCsv(model.value, lang.value)}\n\n${issuesCsv(issues.value, lang.value)}`;
  const result = downloadText(
    lang.value === 'en' ? 'cost-report.csv' : '报价单.csv',
    text,
    'text/csv;charset=utf-8',
  );
  if (result.ok) toast.push(t.value('export.done', { name: result.name }), 'info');
  else toast.push(t.value('export.failed', { reason: result.reason ?? 'unknown' }), 'danger');
}

/** 打印（P1-4）：用户可"另存为 PDF"，替代未实现的 P1-1（⛔ 不伪造 PDF） */
function printReport(): void {
  if (!requestPrint()) toast.push(t.value('export.failed', { reason: 'no-dom' }), 'danger');
}

async function exportXlsx(): Promise<void> {
  const sheets = costXlsxSheets(model.value, lang.value, { usage: usage.value, issues: issues.value });
  const result = await buildXlsx(sheets);
  if (!result.ok) {
    // RISK-08：exceljs 不可用时**明确告知**并退到 CSV，⛔ 不静默失败
    toast.push(t.value('export.xlsxFallback', { reason: result.reason }), 'warn', 3200);
    exportCsv();
    return;
  }
  const download = downloadBlob(xlsxFileName(lang.value === 'en' ? 'cost-report' : '报价单'), result.blob);
  if (download.ok) toast.push(t.value('export.done', { name: download.name }), 'info');
  else toast.push(t.value('export.failed', { reason: download.reason ?? 'unknown' }), 'danger');
}
</script>

<template>
  <section class="dsx-panel" data-print-section>
    <header class="dsx-panel__head">
      <h3 class="dsx-panel__title">{{ t('cost.title') }}</h3>
      <span class="dsx-spacer" />
      <button v-if="props.allowExport" type="button" class="dsx-btn" data-print-hide @click="exportCsv">
        CSV
      </button>
      <button v-if="props.allowExport" type="button" class="dsx-btn" data-print-hide @click="exportXlsx">
        XLSX
      </button>
      <button type="button" class="dsx-btn" data-print-hide @click="printReport">
        {{ t('common.print') }}
      </button>
    </header>

    <div class="dsx-summary">
      <span>{{ t('cost.netArea') }}：{{ model.totalArea.toFixed(2) }} m²</span>
      <span>{{ t('cost.wallArea') }}：{{ model.wallAreaM2.toFixed(2) }} m²</span>
      <span>{{ t('cost.demolition') }}：{{ model.demolishedLength.toFixed(2) }} m</span>
      <span>{{ t('cost.roomCount') }}：{{ model.roomCount }}</span>
      <span>{{ t('cost.furnitureCount') }}：{{ layout.furniture.length }}</span>
    </div>

    <div class="dsx-panel__section">
      <h4 class="dsx-subtitle">{{ t('cost.materialTable') }}</h4>
      <p v-if="isEmpty" class="dsx-panel__hint">{{ t('common.empty') }}</p>
      <table v-else class="dsx-table">
        <thead>
          <tr>
            <th v-for="cell in header" :key="cell" scope="col">{{ cell }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in bodyRows.slice(0, -1)" :key="index">
            <th scope="row">{{ row[0] }}</th>
            <td class="dsx-num">{{ row[1] }}</td>
            <td>{{ row[2] }}</td>
            <td class="dsx-num">{{ row[3] }}</td>
            <td class="dsx-num">{{ row[4] }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{{ bodyRows[bodyRows.length - 1]?.[0] ?? t('common.total') }}</th>
            <td class="dsx-num">{{ bodyRows[bodyRows.length - 1]?.[1] }}</td>
            <td>{{ bodyRows[bodyRows.length - 1]?.[2] }}</td>
            <td class="dsx-num">{{ bodyRows[bodyRows.length - 1]?.[3] }}</td>
            <td class="dsx-num">{{ bodyRows[bodyRows.length - 1]?.[4] }}</td>
          </tr>
        </tfoot>
      </table>
      <p class="dsx-panel__hint">{{ t('cost.wasteNote') }}</p>
    </div>

    <div class="dsx-panel__section">
      <h4 class="dsx-subtitle">{{ t('cost.roomTable') }}</h4>
      <table class="dsx-table">
        <thead>
          <tr>
            <th scope="col">{{ t('common.name') }}</th>
            <th scope="col">{{ t('cost.material') }}</th>
            <th scope="col" class="dsx-num">{{ t('cost.roomArea') }}</th>
            <th scope="col">{{ t('common.counted') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="room in usage" :key="room.id">
            <th scope="row">{{ room.name }}</th>
            <td>{{ materialLabel(room.mat, lang) }}</td>
            <td class="dsx-num">{{ room.area.toFixed(2) }}</td>
            <td>{{ room.counted ? '✓' : '*' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="props.showIssues" class="dsx-panel__section">
      <h4 class="dsx-subtitle">{{ t('validation.title') }}</h4>
      <p v-if="issues.length === 0" class="dsx-panel__hint">
        {{ t('validation.allPass', { n: VALIDATION_RULE_IDS.length }) }}
      </p>
      <table v-else class="dsx-table">
        <thead>
          <tr>
            <th scope="col">{{ t('common.severity') }}</th>
            <th scope="col">{{ t('common.rule') }}</th>
            <th scope="col">{{ t('common.detail') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="issue in issues" :key="issue.id">
            <td>{{ issueSeverityLabel(issue, lang) }}</td>
            <td>{{ issueRuleLabel(issue, lang) }}</td>
            <td>{{ issue.message }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="dsx-panel__hint">{{ t('cost.generatedAt') }}：{{ model.generatedAt }}</p>
  </section>
</template>
