<script setup lang="ts">
/**
 * 亮点层**工具栏入口**（挂载到 `AppHeader` 的 `#extras` 插槽）。
 *
 * 为什么需要这个壳：`ExportMenu` / `ValidationPanel` / `PlanCompare` / `HistoryPanel` /
 * `CommandPalette` 都是独立组件，但 `App.vue` 由 2D 侧装配、不能 import `features/extras/**`
 * （SPEC §C.2 B2 边界）。因此本组件负责把「入口按钮」渲染到工具栏，
 * 再由 `ExtrasOverlay.vue` 渲染对应的浮层，两者通过 `extras-shell` 的共享状态联动。
 *
 * ⚠️ 历史问题：这些组件此前**从未被注册到挂载位**，导致页面上找不到任何亮点功能入口
 * （实测命令面板 Ctrl+K、导出菜单、校验、历史全部不可达）。本文件 + `index.ts` 的自注册
 * 修复了该装配缺口。
 *
 * 边界：只做「按钮 + 状态」，不实现业务逻辑（导出/校验/对比都在各自组件与 `lib/` 里）。
 */
import { computed } from 'vue';
import { useAppLang } from '@/composables/useAppLang';
import { useExtrasShell } from './lib/shell-state';
import { useTheme } from '@/theme/useTheme';

const lang = useAppLang();
const shell = useExtrasShell();
const { resolve } = useTheme();

/** 按钮文案（中英双语；与亮点层其他文案保持同一套 key 风格） */
const labels = computed(() => {
  const en = lang.value === 'en';
  return {
    export: en ? 'Export' : '导出',
    validate: en ? 'Check' : '校验',
    compare: en ? 'Compare' : '对比',
    history: en ? 'History' : '历史',
    palette: en ? 'Commands' : '命令',
    issues: en ? 'issues' : '项问题',
  };
});

/** 问题数徽标（校验面板的实时摘要） */
const issueCount = computed(() => shell.issueCount.value);

function open(kind: 'export' | 'validate' | 'compare' | 'history' | 'palette'): void {
  shell.toggle(kind);
}
</script>

<template>
  <div class="dsx-entry" :style="{ '--dsx-entry-fg': resolve('text') }">
    <button type="button" class="btn dsx-entry__btn" :title="labels.palette" @click="open('palette')">
      {{ labels.palette }}
    </button>
    <button type="button" class="btn dsx-entry__btn" :title="labels.export" @click="open('export')">
      {{ labels.export }}
    </button>
    <button
      type="button"
      class="btn dsx-entry__btn"
      :class="{ 'dsx-entry__btn--warn': issueCount > 0 }"
      :title="labels.validate"
      @click="open('validate')"
    >
      {{ labels.validate }}
      <span v-if="issueCount > 0" class="dsx-entry__badge">{{ issueCount }}</span>
    </button>
    <button type="button" class="btn dsx-entry__btn" :title="labels.compare" @click="open('compare')">
      {{ labels.compare }}
    </button>
    <button type="button" class="btn dsx-entry__btn" :title="labels.history" @click="open('history')">
      {{ labels.history }}
    </button>
  </div>
</template>

<style scoped>
.dsx-entry {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--ds-border);
  border-radius: 8px;
  background: var(--ds-surface);
}
.dsx-entry__btn {
  position: relative;
  border: 0;
  background: transparent;
  padding: 5px 9px;
  border-radius: 6px;
  white-space: nowrap;
  cursor: pointer;
  color: var(--ds-text);
}
.dsx-entry__btn:hover {
  background: var(--ds-accent-soft);
}
.dsx-entry__btn--warn {
  color: var(--ds-warning);
}
.dsx-entry__badge {
  display: inline-block;
  min-width: 15px;
  margin-left: 3px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--ds-warning);
  color: var(--ds-surface);
  font-size: 11px;
  line-height: 15px;
  text-align: center;
}
</style>
