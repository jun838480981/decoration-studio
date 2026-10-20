<script setup lang="ts">
/**
 * 平面图自动校验 + 可点击告警列表（P0-4，SPEC §B.1）。
 *
 * 规则引擎在 `lib/validate.ts`（5 条规则，阈值是业务资产）；
 * 几何事实判断复用 three 自带的 `OBB`（SAT 相交）与 `ShapeUtils`（面积），⛔ 不自研。
 *
 * 「可点击」的语义（SPEC §F.1 单一事实来源）：
 * 点击告警 → 写 `ui.select({kind,id})` 选中对象 + 把视口中心移到告警坐标（`ui.view`）。
 * ⛔ 不做任何命令式 DOM 操作：2D 图层按 §F.2 的依赖矩阵 `watch` 这些状态，画面自然跟随。
 */
import { computed } from 'vue';
import { useLayoutStore } from '@/stores/layout';
import { usePlanStore } from '@/stores/plan';
import { useUiStore } from '@/stores/ui';
import { stageSize } from '@/composables/useResizeFit';
import { centerViewOn, selectionForTargets } from './lib/navigation';
import { VALIDATION_RULE_IDS, issueRuleLabel, issueSeverityLabel, summarizeIssues, validatePlan } from './lib/validate';
import { issuesCsv } from './lib/export-csv';
import { downloadText } from './lib/download';
import { useLang } from './lib/i18n';
import { useToastStore } from '@/stores/toast';
import type { ValidationIssue } from '@/types/extras';

const props = withDefaults(
  defineProps<{
    /** 是否允许导出告警 CSV */
    allowExport?: boolean;
    /** 单次最多渲染的告警条数（大户型防卡顿；导出不受限） */
    maxVisible?: number;
  }>(),
  { allowExport: true, maxVisible: 200 },
);

const plan = usePlanStore();
const layout = useLayoutStore();
const ui = useUiStore();
const toast = useToastStore();
const { t, lang } = useLang();

const issues = computed<ValidationIssue[]>(() =>
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

const summary = computed(() => summarizeIssues(issues.value));
const visible = computed(() => issues.value.slice(0, props.maxVisible));
const noRooms = computed(() => plan.rooms.length === 0);

function focus(issue: ValidationIssue): void {
  const selection = selectionForTargets(issue.targets, {
    furnitureIds: new Set(layout.furniture.map((item) => item.id)),
    roomIds: new Set(plan.rooms.map((room) => room.id)),
  });
  if (selection) ui.select(selection);
  if (issue.focus) centerViewOn(ui.view, { w: stageSize.w, h: stageSize.h }, issue.focus);
}

function exportIssues(): void {
  const result = downloadText(
    lang.value === 'en' ? 'validation-issues.csv' : '校验告警.csv',
    issuesCsv(issues.value, lang.value),
    'text/csv;charset=utf-8',
  );
  if (result.ok) toast.push(t.value('export.done', { name: result.name }), 'info');
  else toast.push(t.value('export.failed', { reason: result.reason ?? 'unknown' }), 'danger');
}
</script>

<template>
  <section class="dsx-panel" data-print-section>
    <header class="dsx-panel__head">
      <h3 class="dsx-panel__title">{{ t('validation.title') }}</h3>
      <span class="dsx-spacer" />
      <span class="dsx-summary">
        {{ t('validation.count', { error: summary.error, warn: summary.warn, info: summary.info }) }}
      </span>
      <button
        v-if="props.allowExport"
        type="button"
        class="dsx-btn"
        data-print-hide
        :disabled="issues.length === 0"
        @click="exportIssues"
      >
        {{ t('common.export') }}
      </button>
    </header>

    <p class="dsx-panel__hint">{{ t('validation.clickHint') }}</p>

    <p v-if="noRooms" class="dsx-panel__hint">{{ t('validation.empty') }}</p>
    <p v-else-if="issues.length === 0" class="dsx-panel__hint">
      {{ t('validation.allPass', { n: VALIDATION_RULE_IDS.length }) }}
    </p>

    <ul v-else class="dsx-issues">
      <li v-for="issue in visible" :key="issue.id">
        <button type="button" class="dsx-issue" @click="focus(issue)">
          <span class="dsx-issue__sev" :class="`dsx-issue__sev--${issue.severity}`">
            {{ issueSeverityLabel(issue, lang) }}
          </span>
          <span class="dsx-issue__rule">{{ issueRuleLabel(issue, lang) }}</span>
          <span class="dsx-issue__msg">{{ issue.message }}</span>
        </button>
      </li>
    </ul>

    <p v-if="issues.length > props.maxVisible" class="dsx-panel__hint">
      …共 {{ issues.length }} 条，仅显示前 {{ props.maxVisible }} 条（导出 CSV 可得全量）
    </p>
  </section>
</template>
