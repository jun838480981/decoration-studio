<script setup lang="ts">
/**
 * 顶部栏（原 `<header>` 的左段 + 右段，L258-345；不含工具栏本体，那在 `ToolBar.vue`）。
 *
 * 内容：
 * - 左：抽屉开关（家具库 / 属性面板）、品牌（户型名 + 层名 + 面积）、户型按钮、编辑户型按钮；
 * - 中：`ToolBar`（插槽，由 `App.vue` 传入）；
 * - 右：撤销 / 重做 / 清空布置、主题预设、语言、全屏、亮点入口挂载位（slot `extras`）。
 *
 * 语言：`useAppLang()`（中立层单点）——2D 图层与 3D 标签都跟着它重渲染；
 * 亮点层的文案表在 `features/extras/lib/i18n.ts`，两者通过 `huxing-lang` 同一键同步（B6）。
 */
import { computed } from 'vue';
import { useLayoutStore } from '@/stores/layout';
import { usePlanStore } from '@/stores/plan';
import { useToastStore } from '@/stores/toast';
import { useUiStore } from '@/stores/ui';
import { useTheme } from '@/theme/useTheme';
import { useFullscreen } from '@vueuse/core';
import { useAppLang, toggleAppLang } from '@/composables/useAppLang';
import { openPlanLibrary } from '@/composables/useOverlays';
import { askConfirm } from './dialogs/confirm';
import { fmt } from '@/utils/geometry';

const plan = usePlanStore();
const layout = useLayoutStore();
const ui = useUiStore();
const toast = useToastStore();
const { presetId, presets, setPreset, currentPreset } = useTheme();
const lang = useAppLang();
const { isFullscreen, toggle: toggleFullscreen, isSupported: fullscreenSupported } = useFullscreen();

const title = computed(() => plan.plan.name);
const subtitle = computed(() => {
  const name = plan.isMulti ? `${plan.plan.name} · ${plan.levelName}` : plan.plan.name;
  return `${name} · 套内 ${fmt(layout.totalArea)} m²`;
});

const langLabel = computed(() => (lang.value === 'en' ? '中文' : 'EN'));

async function clearAll(): Promise<void> {
  const count = layout.furniture.length;
  if (count === 0) {
    toast.push('当前没有布置任何家具');
    return;
  }
  const ok = await askConfirm({
    title: '清空布置',
    message: `确定清空全部 ${count} 件家具 / 家电吗？\n墙体、地面材料和测量线会保留，可点「撤销」恢复。`,
    confirmText: '清空',
    danger: true,
  });
  if (!ok) return;
  if (layout.clearLayout()) toast.push('已清空布置，可点「撤销」恢复');
}

function toggleEdit(): void {
  if (ui.edit.on) ui.endEdit();
  else ui.startEdit();
}
</script>

<template>
  <header class="header">
    <div class="header__group">
      <button
        type="button"
        class="btn"
        :class="{ 'btn--on': !ui.panes.hideLib }"
        :aria-pressed="!ui.panes.hideLib"
        :title="ui.panes.hideLib ? '展开家具库 ( [ )' : '收起家具库 ( [ )'"
        @click="ui.openDrawer('lib')"
      >
        ◧ 家具库
      </button>
      <button
        type="button"
        class="btn"
        :class="{ 'btn--on': !ui.panes.hidePanel }"
        :aria-pressed="!ui.panes.hidePanel"
        :title="ui.panes.hidePanel ? '展开属性面板 ( ] )' : '收起属性面板 ( ] )'"
        @click="ui.openDrawer('panel')"
      >
        属性 ◨
      </button>
    </div>

    <div class="brand">
      <b class="brand__name">{{ title }}</b>
      <span class="brand__sub">{{ subtitle }}</span>
    </div>

    <div class="header__group">
      <button type="button" class="btn btn--strong" title="切换 / 管理户型 (P)" @click="openPlanLibrary()">
        户型 ▾
      </button>
      <button
        type="button"
        class="btn"
        :class="{ 'btn--on': ui.edit.on }"
        :aria-pressed="ui.edit.on"
        title="编辑户型结构：画墙、画房间、加门窗 (E)"
        @click="toggleEdit"
      >
        编辑户型
      </button>
    </div>

    <div class="header__toolbar">
      <slot name="toolbar" />
    </div>

    <div class="header__group">
      <button type="button" class="btn" title="撤销 (Ctrl+Z)" :disabled="ui.edit.on ? false : !layout.canUndo" @click="layout.undo()">
        撤销
      </button>
      <button type="button" class="btn" title="重做 (Ctrl+Shift+Z)" :disabled="!layout.canRedo" @click="layout.redo()">
        重做
      </button>
      <button type="button" class="btn btn--danger" title="清空所有家具家电（可撤销）" @click="clearAll">
        清空布置
      </button>
    </div>

    <div class="header__group" role="group" aria-label="主题预设">
      <button
        v-for="preset in presets"
        :key="preset.id"
        type="button"
        class="chip"
        :class="{ 'chip--on': preset.id === presetId }"
        :aria-pressed="preset.id === presetId"
        :title="`${preset.zh} / ${preset.en}`"
        @click="setPreset(preset.id)"
      >
        {{ preset.zh }}
      </button>
      <span class="muted">{{ currentPreset.zh }}</span>
    </div>

    <div class="header__group">
      <slot name="extras" />
      <button type="button" class="btn" title="Switch language / 切换语言" @click="toggleAppLang()">
        {{ langLabel }}
      </button>
      <button
        v-if="fullscreenSupported"
        type="button"
        class="btn"
        :title="isFullscreen ? '退出全屏 (Shift+F)' : '全屏 (Shift+F)'"
        @click="toggleFullscreen()"
      >
        ⛶ {{ isFullscreen ? '退出全屏' : '全屏' }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 8px 14px;
  background: var(--ds-surface);
  border-bottom: 1px solid var(--ds-border);
}

.header__group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.header__toolbar {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
}

.brand {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  min-width: 0;
}

.brand__name {
  font-size: 15px;
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.brand__sub {
  font-size: 12px;
  color: var(--ds-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn {
  border: 1px solid var(--ds-border);
  padding: 4px 10px;
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn--on {
  background: var(--ds-accent-soft);
  color: var(--ds-accent);
  border-color: var(--ds-accent);
}

.btn--strong {
  font-weight: 600;
}

.btn--danger {
  color: var(--ds-danger);
  border-color: var(--ds-danger);
}

.chip {
  border: 1px solid var(--ds-border);
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 12px;
  color: var(--ds-text-secondary);
}

.chip--on {
  background: var(--ds-accent-soft);
  color: var(--ds-accent);
  border-color: var(--ds-accent);
}

.muted {
  font-size: 12px;
  color: var(--ds-text-muted);
}
</style>
