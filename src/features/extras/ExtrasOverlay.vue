<script setup lang="ts">
/**
 * 亮点层**浮层容器**（挂载到 `<main>` 之后、`ToastHost` 之前）。
 *
 * 负责按 `shell-state` 的 `active` 渲染对应浮层：
 * 导出菜单 / 校验面板 / 方案对比 / 历史面板 / 命令面板。
 *
 * ⚠️ 历史问题：这些组件此前从未被挂载，页面上找不到任何入口
 * （实测命令面板 Ctrl+K、导出菜单、校验、历史全部不可达）。
 * 本文件 + `ExtrasToolbar.vue` + `index.ts` 的自注册共同修复该装配缺口。
 *
 * 设计说明：
 * - `ValidationPanel` / `PlanCompare` / `HistoryPanel` 是**内嵌面板**（没有 `close` 事件），
 *   因此由本容器提供统一的「面板外框 + 关闭按钮 + Esc 关闭」，而不是要求它们改接口；
 * - `ExportMenu` 是自带下拉的组件，直接渲染；
 * - `CommandPalette` 用受控 `v-model`（它自身也监听 Ctrl+K）。
 */
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { useEventListener } from '@vueuse/core';
import { useExtrasShell } from './lib/shell-state';
import { useExtrasActions } from './useExtrasActions';
import { summarizeIssues } from './lib/validate';
import { useAppLang } from '@/composables/useAppLang';
import ExportMenu from './ExportMenu.vue';
import ValidationPanel from './ValidationPanel.vue';
import PlanCompare from './PlanCompare.vue';
import HistoryPanel from './HistoryPanel.vue';
import CommandPalette from './CommandPalette.vue';

const shell = useExtrasShell();
const actions = useExtrasActions();
const lang = useAppLang();

/** 校验摘要 → 回写工具栏徽标（`issues` 是 ComputedRef，随 store 变化） */
watch(
  () => actions.issues.value,
  (list) => {
    shell.issueCount.value = summarizeIssues(list).total;
  },
  { immediate: true },
);

/** 命令面板用受控开合（它自带 Ctrl+K 快捷键，这里只同步浮层状态） */
const paletteOpen = computed({
  get: () => shell.isOpen('palette'),
  set: (v: boolean) => (v ? shell.open('palette') : shell.close()),
});

/** 2D 画布取用器（导出 SVG/PNG 需要真实 DOM 节点） */
function getSvg(): SVGSVGElement | null {
  return document.querySelector<SVGSVGElement>('svg[data-plan-canvas]');
}

/** 面板标题（内嵌面板的容器外框用） */
const panelTitle = computed(() => {
  const en = lang.value === 'en';
  const kind = shell.active.value;
  if (kind === 'validate') return en ? 'Plan check' : '平面图校验';
  if (kind === 'compare') return en ? 'Compare plans' : '方案对比';
  if (kind === 'history') return en ? 'History' : '历史';
  return '';
});

/** 是否渲染内嵌面板外框（导出菜单与命令面板自带浮层样式） */
const framed = computed(() => {
  const k = shell.active.value;
  return k === 'validate' || k === 'compare' || k === 'history';
});

// Esc 关闭当前浮层（命令面板自身也处理 Esc，这里兜底其余面板）
useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  if (event.key !== 'Escape') return;
  if (shell.active.value === null) return;
  // 命令面板自己会关；这里只处理内嵌面板，避免双重处理
  if (shell.active.value === 'palette') return;
  shell.close();
});

onMounted(() => {
  // 首次挂载即校验一次，让工具栏徽标有初始值（不必等用户点开校验面板）
  shell.issueCount.value = summarizeIssues(actions.issues.value).total;
});

onBeforeUnmount(() => {
  shell.close();
});
</script>

<template>
  <!-- 导出菜单（自带下拉浮层） -->
  <ExportMenu v-if="shell.isOpen('export')" :get-svg="getSvg" @exported="shell.close()" />

  <!-- 内嵌面板统一外框（校验 / 对比 / 历史） -->
  <div v-if="framed" class="dsx-panel-host" role="presentation" @pointerdown.self="shell.close()">
    <section class="dsx-panel-host__box" role="dialog" aria-modal="true" :aria-label="panelTitle">
      <header class="dsx-panel-host__head">
        <h3>{{ panelTitle }}</h3>
        <button type="button" class="dsx-panel-host__close" :title="lang === 'en' ? 'Close' : '关闭'" @click="shell.close()">
          ✕
        </button>
      </header>
      <div class="dsx-panel-host__body">
        <ValidationPanel v-if="shell.isOpen('validate')" :allow-export="true" />
        <PlanCompare v-else-if="shell.isOpen('compare')" :allow-export="true" />
        <HistoryPanel v-else-if="shell.isOpen('history')" />
      </div>
    </section>
  </div>

  <!-- 命令面板（受控） -->
  <CommandPalette v-model="paletteOpen" :get-svg="getSvg" />
</template>

<style scoped>
.dsx-panel-host {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: color-mix(in srgb, var(--ds-text) 32%, transparent);
}
.dsx-panel-host__box {
  display: flex;
  flex-direction: column;
  width: min(920px, 94vw);
  max-height: min(78vh, 720px);
  border: 1px solid var(--ds-border);
  border-radius: 14px;
  background: var(--ds-surface);
  box-shadow: 0 18px 50px color-mix(in srgb, var(--ds-text) 24%, transparent);
  overflow: hidden;
}
.dsx-panel-host__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--ds-border);
}
.dsx-panel-host__head h3 {
  margin: 0;
  font-size: 14px;
}
.dsx-panel-host__close {
  border: 1px solid var(--ds-border);
  border-radius: 6px;
  background: var(--ds-surface);
  color: var(--ds-text);
  padding: 3px 9px;
  cursor: pointer;
}
.dsx-panel-host__close:hover {
  background: var(--ds-accent-soft);
}
.dsx-panel-host__body {
  padding: 12px 14px 16px;
  overflow: auto;
}
</style>
