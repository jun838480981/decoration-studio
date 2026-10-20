/**
 * 主题 store（SPEC §D.7 🔒 冻结）。
 *
 * - `presetId` 持久化到 `huxing-theme-v1`（SPEC §D.8：唯一允许新增的键）。
 * - `tokens` 是 `theme/tokens.ts` 的只读投影（唯一色值来源）。
 * - `resolve()` 返回**字面值**，供 SVG 呈现属性 / 3D / canvas 导出（R-EXP-1）。
 */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { applyCssVars as applyTokens, resolveToken } from '@/theme/applyTheme';
import { DEFAULT_THEME_PRESET_ID, isThemePresetId, THEMES } from '@/theme/tokens';
import { readRaw, STORAGE_KEYS, writeRaw } from '@/utils/persistence';
import type { ThemePresetId, ThemeTokenName, ThemeTokens } from '@/types/theme';

export type { ThemePresetId } from '@/types/theme';

/** 主题预设持久化键（SPEC §D.8：`'huxing-theme-v1'`，字面值定义在 `utils/persistence.ts`） */
export const THEME_STORE_KEY = STORAGE_KEYS.theme;

function loadPresetId(): ThemePresetId {
  const raw = readRaw(THEME_STORE_KEY);
  return isThemePresetId(raw) ? raw : DEFAULT_THEME_PRESET_ID;
}

export const useThemeStore = defineStore('theme', () => {
  const presetId = ref<ThemePresetId>(loadPresetId());

  const tokens = computed<ThemeTokens>(() => THEMES[presetId.value]);

  function setPreset(id: ThemePresetId): void {
    if (!isThemePresetId(id)) return;
    presetId.value = id;
    applyCssVars();
    writeRaw(THEME_STORE_KEY, id);
  }

  /** 写 CSS 变量（SPEC §D.7）。`el` 默认 `document.documentElement`。 */
  function applyCssVars(el?: HTMLElement): void {
    applyTokens(presetId.value, el);
  }

  /** 解析后的字面值：SVG 呈现属性 / 3D / canvas 导出专用（⛔ 不返回 `var(--ds-*)`） */
  function resolve(name: ThemeTokenName): string {
    return resolveToken(presetId.value, name);
  }

  return { presetId, tokens, setPreset, applyCssVars, resolve };
});
