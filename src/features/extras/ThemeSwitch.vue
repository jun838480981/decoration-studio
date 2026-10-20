<script setup lang="ts">
/**
 * 主题预设切换（P0-1 / P1-2 / P0-9 的 UI 入口）。
 *
 * 为什么要有这个组件（而不是让每个面板自己写三个按钮）：
 * 「切主题」必须**一次做全**，漏一步就会出现"UI 变了、2D 没变、3D 没变、导出还是旧色"。
 * 正确顺序在这里收口：
 * 1. `theme.setPreset(id)` → 写 `--ds-*` CSS 变量 + 持久化 `huxing-theme-v1`（`stores/theme`）；
 * 2. 2D 图层与导出**自动**跟随（它们读 `theme.resolve()` 的字面值，R-EXP-1）；
 * 3. 3D 需要显式推送 → `syncSceneWithTheme()`（`lib/scene-theme.ts`，经 `utils/scenePort`，
 *    ⛔ 不 import `features/scene3d`，SPEC §C.2 B1/B2）。
 *
 * 令牌单一来源：色块颜色取自 `theme/tokens.ts` 的**字面值**（经 `resolveThemeToken()`），
 * ⛔ 本组件不写任何 hex（B3/B9）。
 */
import { computed } from 'vue';
import { resolveThemeToken, useTheme } from '@/theme/useTheme';
import { useLang } from './lib/i18n';
import { hasSceneThemeHook, syncSceneWithTheme } from './lib/scene-theme';
import type { ThemePresetId, ThemePresetMeta } from '@/types/theme';

const props = withDefaults(
  defineProps<{
    /** 是否显示每个预设的色板（小屏可关） */
    showSwatches?: boolean;
    /** 是否显示「3D 联动」状态提示 */
    showSceneHint?: boolean;
  }>(),
  { showSwatches: true, showSceneHint: true },
);

const emit = defineEmits<{ (event: 'change', id: ThemePresetId): void }>();

const { presetId, presets, setPreset, resolve } = useTheme();
const { t, lang } = useLang();

/** 3D 是否具备主题联动入口（t5 落地后为 true；未落地时提示"待联调"，⛔ 不谎报） */
const sceneReady = computed(() => hasSceneThemeHook());

/** 当前预设的三个示意色（`resolve()` 是当前预设的字面值） */
const currentSwatches = computed(() => [resolve('accent'), resolve('accent-2'), resolve('canvas')]);

/** 任意预设的示意色：借 `THEMES` 静态表取字面值（`theme/tokens.ts` 是唯一来源） */
function swatchesOf(id: ThemePresetId): string[] {
  if (id === presetId.value) return currentSwatches.value;
  return [resolveThemeToken(id, 'accent'), resolveThemeToken(id, 'accent-2'), resolveThemeToken(id, 'canvas')];
}

function choose(id: ThemePresetId): void {
  if (id === presetId.value) return;
  setPreset(id);
  // 3D 联动（E.8 T4：只更新材质/光照/曝光，不重建几何）
  syncSceneWithTheme(id, false);
  emit('change', id);
}

function labelOf(preset: ThemePresetMeta): string {
  return lang.value === 'en' ? preset.en : preset.zh;
}
</script>

<template>
  <div class="dsx-panel" data-print-hide>
    <div class="dsx-panel__head">
      <h3 class="dsx-panel__title">{{ t('theme.title') }}</h3>
      <span class="dsx-spacer" />
      <span v-if="props.showSceneHint" class="dsx-muted">
        {{ sceneReady ? '3D 联动就绪' : '3D 联动待联调' }}
      </span>
    </div>

    <div class="dsx-themes" role="group" :aria-label="t('theme.title')">
      <button
        v-for="preset in presets"
        :key="preset.id"
        type="button"
        class="dsx-chip"
        :aria-pressed="preset.id === presetId"
        :title="`${preset.zh} / ${preset.en}`"
        @click="choose(preset.id)"
      >
        {{ labelOf(preset) }}
        <span v-if="props.showSwatches" class="dsx-swatch" aria-hidden="true">
          <span v-for="(color, index) in swatchesOf(preset.id)" :key="index" :style="{ background: color }" />
        </span>
      </button>
    </div>

    <p class="dsx-panel__hint">{{ t('theme.hint') }}</p>
  </div>
</template>
