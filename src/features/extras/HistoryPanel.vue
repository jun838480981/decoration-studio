<script setup lang="ts">
/**
 * 历史面板 + 命名快照（P0-8，SPEC §B.1）。
 *
 * 语义边界（⛔ 别越界，这是业务资产）：
 * - **布置栈 150**（`stores/layout`）与**结构栈 80**（`stores/plan`）双栈隔离；
 *   本面板只展示**布置栈**（结构栈的 UI 归 2D 侧的结构编辑面板）。
 * - 跳转只调用既有 `layout.undo()/redo()`（`lib/history.ts` 的 `jumpToDepth`），
 *   ⛔ 不直接改 store 内部数组 —— 否则栈语义会被绕过（redo 清空、落盘时机全乱）。
 * - 命名快照**仅存在于当前会话内存**：SPEC §D.8 禁止新增 localStorage 键，故不持久化。
 *   组件卸载即丢失（UI 上明确告知，⛔ 不让用户误以为存住了）。
 */
import { computed, ref } from 'vue';
import { useLayoutStore } from '@/stores/layout';
import { usePlanStore } from '@/stores/plan';
import { useToastStore } from '@/stores/toast';
import { priceResolver } from './lib/cost';
import { currentLevelInputs } from './lib/plan-input';
import { metricsOf } from './lib/metrics';
import { changedNamedDiff, createNamedSnapshot, historyTimeline, jumpToDepth, type NamedSnapshot } from './lib/history';
import { useLang } from './lib/i18n';

const plan = usePlanStore();
const layout = useLayoutStore();
const toast = useToastStore();
const { t } = useLang();

/** 命名快照（会话内存；⛔ 不落盘，SPEC §D.8） */
const named = ref<NamedSnapshot[]>([]);
const draftLabel = ref('');
/** 当前"深度"= 已撤销步数（0 = 最新状态） */
const depth = ref(0);
let snapshotSeq = 0;

/** 时间线（过去每一步 + 当前状态） */
const timeline = computed(() => historyTimeline(layout.undoStack, layout.snapshot(), named.value));

/** 当前状态的指标（用于"命名快照 vs 当前"的差量） */
const currentMetrics = computed(() => {
  const levels = currentLevelInputs({
    plan: plan.plan,
    level: plan.level,
    isMulti: plan.isMulti,
    live: layout,
    reader: plan,
  });
  return metricsOf({
    planId: plan.currentId,
    planName: plan.plan.name,
    levels,
    priceOf: priceResolver(),
  });
});

/** 命名快照的差量（只列有变化的指标） */
const namedDiffs = computed(() =>
  named.value.map((snapshot) => ({ snapshot, rows: changedNamedDiff(snapshot, currentMetrics.value) })),
);

function jump(target: number): void {
  const reached = jumpToDepth(depth.value, target, { undo: () => layout.undo(), redo: () => layout.redo() });
  depth.value = reached;
}

function capture(): void {
  snapshotSeq += 1;
  const snapshot = createNamedSnapshot({
    id: `snap-${Date.now()}-${snapshotSeq}`,
    label: draftLabel.value,
    snapshot: layout.snapshot(),
    depth: depth.value,
    metrics: currentMetrics.value,
  });
  named.value = [...named.value, snapshot];
  draftLabel.value = '';
  toast.push(t.value('history.captured', { name: snapshot.label }), 'info');
}

function removeSnapshot(id: string): void {
  named.value = named.value.filter((item) => item.id !== id);
}

function labelOf(step: { depth: number; isCurrent: boolean; named?: string }): string {
  if (step.isCurrent) return t.value('history.current');
  if (step.named) return step.named;
  return t.value('history.step', { n: step.depth });
}
</script>

<template>
  <section class="dsx-panel" data-print-hide>
    <header class="dsx-panel__head">
      <h3 class="dsx-panel__title">{{ t('history.title') }}</h3>
      <span class="dsx-spacer" />
      <span class="dsx-muted">{{ t('history.steps') }}：{{ layout.undoStack.length }}/150</span>
    </header>

    <p class="dsx-panel__hint">{{ t('history.hint') }}</p>

    <div class="dsx-panel__section">
      <p v-if="layout.undoStack.length === 0" class="dsx-panel__hint">{{ t('history.empty') }}</p>
      <ol v-else class="dsx-timeline">
        <li v-for="step in [...timeline].reverse()" :key="`${step.index}-${step.depth}`">
          <button
            type="button"
            class="dsx-timeline__item"
            :aria-current="step.isCurrent"
            @click="jump(step.depth)"
          >
            <span class="dsx-timeline__depth">#{{ step.depth }}</span>
            <span>{{ labelOf(step) }}</span>
          </button>
        </li>
      </ol>
    </div>

    <div class="dsx-panel__section">
      <h4 class="dsx-subtitle">{{ t('history.capture') }}</h4>
      <div class="dsx-row">
        <input
          v-model="draftLabel"
          class="dsx-palette__input"
          type="text"
          :placeholder="t('history.capturePlaceholder')"
          @keydown.enter="capture"
        />
        <button type="button" class="dsx-btn dsx-btn--primary" @click="capture">
          {{ t('history.capture') }}
        </button>
      </div>
    </div>

    <div class="dsx-panel__section">
      <h4 class="dsx-subtitle">{{ t('history.named') }}</h4>
      <p v-if="named.length === 0" class="dsx-panel__hint">{{ t('history.namedEmpty') }}</p>
      <ul v-else class="dsx-issues">
        <li v-for="entry in namedDiffs" :key="entry.snapshot.id">
          <div class="dsx-row">
            <strong>{{ entry.snapshot.label }}</strong>
            <span class="dsx-muted">#{{ entry.snapshot.depth }}</span>
            <span class="dsx-spacer" />
            <button type="button" class="dsx-btn" @click="jump(entry.snapshot.depth)">
              {{ t('history.jump') }}
            </button>
            <button type="button" class="dsx-btn dsx-btn--danger" @click="removeSnapshot(entry.snapshot.id)">
              {{ t('common.remove') }}
            </button>
          </div>
          <table v-if="entry.rows.length > 0" class="dsx-table">
            <thead>
              <tr>
                <th scope="col">{{ t('common.metric') }}</th>
                <th scope="col" class="dsx-num">{{ t('common.base') }}</th>
                <th scope="col" class="dsx-num">{{ t('history.current') }}</th>
                <th scope="col" class="dsx-num">{{ t('common.delta') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in entry.rows" :key="row.key">
                <th scope="row">{{ t(row.labelKey) }}</th>
                <td class="dsx-num">{{ row.before.toFixed(row.digits) }}</td>
                <td class="dsx-num">{{ row.after.toFixed(row.digits) }}</td>
                <td class="dsx-num">
                  <span :class="row.delta > 0 ? 'dsx-delta--up' : 'dsx-delta--down'">
                    {{ row.delta > 0 ? '+' : '' }}{{ row.delta.toFixed(row.digits) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-else class="dsx-panel__hint">{{ t('compare.noDiff') }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>
