<script setup lang="ts">
/**
 * 多方案并排对比 + 差异摘要（P0-5，SPEC §B.1）。
 *
 * 数据来源（全部经 store 契约，⛔ 不直读 `localStorage`，B6）：
 * - 当前方案 → `layout` 的**实时**状态（含未落盘的编辑）；
 * - 其它方案 → `plan.readState(id, lv, multi)`（§D.5 为亮点层预留的只读出口）；
 * - 单价 → `data/materials.ts` 的 `MATS[].price`（单一来源，见 `lib/cost.ts`）。
 *
 * 为什么自研（OSS §6 #10）：对比维度（使用面积 / 材料金额 / 家具数 / 拆除长度）全是本项目专有口径。
 *
 * 交互：勾选 2 个以上方案 → 表格并排；第 1 个勾选的是**基准**，其余显示差量（「本方案 − 基准」）。
 */
import { computed, ref } from 'vue';
import { useLayoutStore } from '@/stores/layout';
import { usePlanStore } from '@/stores/plan';
import { useToastStore } from '@/stores/toast';
import { priceResolver } from './lib/cost';
import { METRIC_FIELDS } from './lib/metrics';
import { compareSelectedPlans } from './lib/plan-input';
import { changedFields } from './lib/compare';
import { compareCsv } from './lib/export-csv';
import { downloadText } from './lib/download';
import { useLang } from './lib/i18n';
import type { PlanDiffSummary } from '@/types/extras';
import type { Plan } from '@/types/plan';

const props = withDefaults(
  defineProps<{
    /** 初始勾选的方案 id（缺省 = 当前方案 + 下一个方案） */
    initialIds?: readonly string[];
    /** 是否显示导出 CSV 按钮 */
    allowExport?: boolean;
  }>(),
  { initialIds: undefined, allowExport: true },
);

const emit = defineEmits<{ (event: 'select', ids: string[]): void }>();

const plan = usePlanStore();
const layout = useLayoutStore();
const toast = useToastStore();
const { t, lang } = useLang();

/** 已勾选的方案 id（顺序 = 勾选顺序，第 1 个是基准） */
const selected = ref<string[]>([...defaultSelection()]);

function defaultSelection(): string[] {
  if (props.initialIds && props.initialIds.length > 0) return [...props.initialIds];
  const ids = plan.allPlans.map((item) => item.id);
  const current = plan.currentId;
  const rest = ids.filter((id) => id !== current);
  // 默认：当前方案（基准）+ 紧随其后的一个方案（用户能立刻看到对比效果）
  return rest.length > 0 ? [current, rest[0]] : [current];
}

const chosenPlans = computed<Plan[]>(() =>
  selected.value.map((id) => plan.findPlan(id)).filter((item): item is Plan => item !== null),
);

const rows = computed<PlanDiffSummary[]>(() => {
  if (chosenPlans.value.length < 2) return [];
  return compareSelectedPlans(chosenPlans.value, {
    currentPlanId: plan.currentId,
    reader: plan,
    live: layout,
    currentPlan: plan.plan as Plan,
    level: plan.level,
    isMulti: plan.isMulti,
    priceOf: priceResolver(),
  });
});

/** 差异摘要：只列有差异的指标（`lib/compare.ts` 的 `changedFields`） */
const diffRows = computed(() => {
  const changed = new Set<string>();
  for (const row of rows.value) for (const key of changedFields(row)) changed.add(key);
  return METRIC_FIELDS.filter((field) => changed.has(field.key));
});

const hasDiff = computed(() => diffRows.value.length > 0);

function toggle(id: string): void {
  const index = selected.value.indexOf(id);
  if (index >= 0) selected.value = selected.value.filter((item) => item !== id);
  else selected.value = [...selected.value, id];
  emit('select', [...selected.value]);
}

function selectAll(): void {
  selected.value = plan.allPlans.map((item) => item.id);
  emit('select', [...selected.value]);
}

function clearSelection(): void {
  selected.value = [];
  emit('select', []);
}

/** 当前方案排在基准位（勾选顺序决定基准，这里给个显式的"设基准"入口） */
function makeBaseline(id: string): void {
  if (!selected.value.includes(id)) return;
  selected.value = [id, ...selected.value.filter((item) => item !== id)];
  emit('select', [...selected.value]);
}

function formatValue(value: number, digits: number): string {
  return value.toFixed(digits);
}

function formatDelta(row: PlanDiffSummary, key: (typeof METRIC_FIELDS)[number]['key'], digits: number): string {
  const delta = row.delta?.[key];
  if (delta === undefined) return '—';
  if (Math.abs(delta) < 0.005) return '0';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(digits)}`;
}

function deltaClass(row: PlanDiffSummary, key: (typeof METRIC_FIELDS)[number]['key']): string {
  const delta = row.delta?.[key];
  if (delta === undefined || Math.abs(delta) < 0.005) return 'dsx-delta--flat';
  return delta > 0 ? 'dsx-delta--up' : 'dsx-delta--down';
}

function exportCsv(): void {
  if (rows.value.length === 0) return;
  const result = downloadText(
    lang.value === 'en' ? 'plan-compare.csv' : '方案对比.csv',
    compareCsv(rows.value, lang.value),
    'text/csv;charset=utf-8',
  );
  if (result.ok) toast.push(t.value('export.done', { name: result.name }), 'info');
  else toast.push(t.value('export.failed', { reason: result.reason ?? 'unknown' }), 'danger');
}

function tagOf(item: Plan): string {
  return item.builtin ? t.value('compare.builtin') : t.value('compare.custom');
}
</script>

<template>
  <section class="dsx-panel" data-print-section>
    <header class="dsx-panel__head">
      <h3 class="dsx-panel__title">{{ t('compare.title') }}</h3>
      <span class="dsx-spacer" />
      <button type="button" class="dsx-btn" data-print-hide @click="selectAll">
        {{ t('compare.selectAll') }}
      </button>
      <button type="button" class="dsx-btn" data-print-hide @click="clearSelection">
        {{ t('compare.clear') }}
      </button>
      <button v-if="props.allowExport" type="button" class="dsx-btn" data-print-hide @click="exportCsv">
        {{ t('common.export') }}
      </button>
    </header>

    <p class="dsx-panel__hint">{{ t('compare.hint') }}</p>

    <div class="dsx-panel__section" data-print-hide>
      <h4 class="dsx-subtitle">{{ t('compare.selectPlans') }}</h4>
      <div class="dsx-planlist">
        <label v-for="item in plan.allPlans" :key="item.id">
          <input
            type="checkbox"
            :checked="selected.includes(item.id)"
            :value="item.id"
            @change="toggle(item.id)"
          />
          <span>{{ item.name }}</span>
          <span class="dsx-badge">{{ tagOf(item) }}</span>
          <span v-if="selected[0] === item.id" class="dsx-badge">基准</span>
        </label>
      </div>
    </div>

    <p v-if="chosenPlans.length < 2" class="dsx-panel__hint">{{ t('compare.needTwo') }}</p>

    <template v-else>
      <div class="dsx-panel__section">
        <h4 class="dsx-subtitle">{{ t('compare.title') }}</h4>
        <table class="dsx-table">
          <caption>
            {{
              lang === 'en'
                ? 'Delta = this plan − baseline (' + rows[0].planName + ')'
                : '差量 = 本方案 − 基准（' + rows[0].planName + '）'
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">{{ t('common.name') }}</th>
              <th v-for="field in METRIC_FIELDS" :key="field.key" scope="col" class="dsx-num">
                {{ t(field.labelKey) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in rows" :key="row.planId">
              <th scope="row">
                {{ row.planName }}
                <span v-if="index === 0" class="dsx-badge">基准</span>
                <button
                  v-else
                  type="button"
                  class="dsx-chip"
                  data-print-hide
                  :title="`把「${row.planName}」设为基准`"
                  @click="makeBaseline(row.planId)"
                >
                  ⇤
                </button>
              </th>
              <td v-for="field in METRIC_FIELDS" :key="field.key" class="dsx-num">
                {{ formatValue(row[field.key], field.digits) }}
                <template v-if="index > 0">
                  <br />
                  <span :class="deltaClass(row, field.key)">
                    {{ formatDelta(row, field.key, field.digits) }}
                  </span>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="dsx-panel__section">
        <h4 class="dsx-subtitle">{{ t('compare.diffSummary') }}</h4>
        <p v-if="!hasDiff" class="dsx-panel__hint">{{ t('compare.noDiff') }}</p>
        <table v-else class="dsx-table">
          <thead>
            <tr>
              <th scope="col">{{ t('common.metric') }}</th>
              <th v-for="row in rows.slice(1)" :key="row.planId" scope="col" class="dsx-num">
                {{ row.planName }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="field in diffRows" :key="field.key">
              <th scope="row">{{ t(field.labelKey) }}</th>
              <td v-for="row in rows.slice(1)" :key="row.planId" class="dsx-num">
                <span :class="deltaClass(row, field.key)">
                  {{ formatDelta(row, field.key, field.digits) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
