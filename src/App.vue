<script setup lang="ts">
/**
 * 应用外壳（**t3 骨架，不是业务视图**）。
 *
 * 作用只有三个：
 * 1. 证明主题令牌链路可用：切换预设 → 写 `--ds-*` → 页面即时换肤（并显示 `resolve()` 的字面值）；
 * 2. 把三路下游的**入口占位**摆在台面上（2D / 3D / 亮点），方便 reviewer 核对契约是否就位；
 * 3. 演示 2D↔3D 切换的端口契约（3D 未实现时给出明确提示，而不是静默失败）。
 *
 * ⛔ 业务视图（画布、图例、面板、弹窗）属于 t4/t5/t6，不要写在这里。
 */
import { computed } from 'vue';
import { EXTRAS_ENTRYPOINTS } from '@/features/extras';
import { PLAN_LAYER_ORDER } from '@/features/plan2d';
import { SCENE_THEME_REACTIVE_FIELDS } from '@/features/scene3d';
import { useUiStore } from '@/stores/ui';
import { PLAN_TOKEN_NAMES, THEME_TOKEN_NAMES, UI_TOKEN_NAMES } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const { presetId, presets, setPreset, resolve, currentPreset } = useTheme();
const ui = useUiStore();

const uiTokens = computed(() => [...UI_TOKEN_NAMES]);
const planTokens = computed(() => [...PLAN_TOKEN_NAMES]);
const totalTokens = computed(() => THEME_TOKEN_NAMES.length);

async function toggleView(): Promise<void> {
  await ui.setViewMode(ui.is3D ? '2d' : '3d');
}
</script>

<template>
  <div class="shell">
    <header class="shell__header">
      <div class="brand">
        <b>装修设计工作台</b>
        <span>decoration-studio · Vue3 + Vite + TS 骨架（t3）</span>
      </div>

      <div class="chips" role="group" aria-label="主题预设">
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
      </div>

      <button type="button" class="chip" :aria-pressed="ui.is3D" @click="toggleView">
        {{ ui.is3D ? '返回 2D' : '切到 3D' }}
      </button>

      <span class="spacer" />
      <span class="muted">当前预设：{{ currentPreset.zh }}（<code>{{ presetId }}</code>）</span>
    </header>

    <main class="shell__main">
      <section class="card">
        <h2>2D 平面 · 契约就位</h2>
        <p class="muted">
          图层顺序与重建矩阵已冻结（SPEC §F.2）；实现归
          <code>features/plan2d/**</code>（t4）。
        </p>
        <ol class="list">
          <li v-for="layer in PLAN_LAYER_ORDER" :key="layer">
            <code>{{ layer }}</code>
          </li>
        </ol>
      </section>

      <section class="card">
        <h2>3D 场景 · 主题联动</h2>
        <p class="muted">
          材质基色唯一来源：<code>theme/material-palette.ts</code>；以下项必须随主题变化（SPEC §E.8
          T3），实现归 <code>features/scene3d/**</code>（t5）。
        </p>
        <ul class="list list--inline">
          <li v-for="field in SCENE_THEME_REACTIVE_FIELDS" :key="field">
            <code>{{ field }}</code>
          </li>
        </ul>
      </section>

      <section class="card">
        <h2>亮点功能 · 入口预留</h2>
        <p class="muted">P0/P1 的实现归 <code>features/extras/**</code>（t6）；依赖已按 SPEC §H.1 收敛。</p>
        <ul class="list list--inline">
          <li v-for="entry in EXTRAS_ENTRYPOINTS.components" :key="entry">
            <code>{{ entry }}</code>
          </li>
        </ul>
      </section>

      <section class="card card--wide">
        <h2>主题令牌（{{ totalTokens }} 项 × 3 套预设）</h2>
        <p class="muted">
          色值唯一来源：<code>src/theme/tokens.ts</code>。下排展示的是
          <code>theme.resolve()</code> 的**字面值**（SVG/导出/3D 用的就是这个）。
        </p>

        <h3>UI 语义层（{{ uiTokens.length }}）</h3>
        <div class="swatches">
          <div v-for="name in uiTokens" :key="name" class="swatch">
            <span class="swatch__dot" :style="{ background: resolve(name) }" />
            <span class="swatch__name">{{ name }}</span>
            <span class="swatch__hex">{{ resolve(name) }}</span>
          </div>
        </div>

        <h3>2D 图纸层（{{ planTokens.length }}）</h3>
        <div class="swatches">
          <div v-for="name in planTokens" :key="name" class="swatch">
            <span class="swatch__dot" :style="{ background: resolve(name) }" />
            <span class="swatch__name">{{ name }}</span>
            <span class="swatch__hex">{{ resolve(name) }}</span>
          </div>
        </div>
      </section>
    </main>

    <footer class="shell__footer">
      <span class="muted"
        >骨架与主题层由 t3 交付；2D/3D/亮点分别由 t4/t5/t6 实现。命令见 README（含 pwsh 不可用时的替代路径）。</span
      >
    </footer>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  height: 100vh;
  height: 100dvh;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)
    env(safe-area-inset-left);
}

.shell__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 10px 16px;
  background: var(--ds-surface);
  border-bottom: 1px solid var(--ds-border);
}

.brand {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.brand b {
  font-size: 15px;
  letter-spacing: 0.5px;
}

.brand span {
  color: var(--ds-text-muted);
  font-size: 12px;
}

.chips {
  display: flex;
  gap: 4px;
  padding: 2px;
  border: 1px solid var(--ds-border-strong);
  border-radius: 8px;
}

.chip {
  border: 1px solid transparent;
  background: transparent;
}

.chip--on {
  background: var(--ds-accent-soft);
  color: var(--ds-accent);
  border-color: var(--ds-accent);
}

.spacer {
  flex: 1;
}

.shell__main {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
  padding: 12px 16px;
  overflow: auto;
  background: var(--ds-bg);
}

.card {
  background: var(--ds-surface);
  border: 1px solid var(--ds-border-strong);
  border-radius: 10px;
  padding: 12px 14px;
}

.card--wide {
  grid-column: 1 / -1;
}

.card h2 {
  margin: 0 0 6px;
  font-size: 14px;
}

.card h3 {
  margin: 12px 0 6px;
  font-size: 12px;
  color: var(--ds-text-secondary);
  letter-spacing: 0.5px;
}

.muted {
  color: var(--ds-text-muted);
  font-size: 12px;
}

.list {
  margin: 8px 0 0;
  padding-left: 18px;
  columns: 2;
  font-size: 12px;
}

.list--inline {
  list-style: none;
  padding-left: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  columns: auto;
}

.swatches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 6px;
}

.swatch {
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  background: var(--ds-surface-2);
  border: 1px solid var(--ds-border);
  border-radius: 6px;
  font-size: 11px;
}

.swatch__dot {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid var(--ds-border-strong);
}

.swatch__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.swatch__hex {
  color: var(--ds-text-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.shell__footer {
  padding: 8px 16px;
  background: var(--ds-surface);
  border-top: 1px solid var(--ds-border);
}
</style>