/**
 * `useTheme()` —— 主题层对下游（2D / 3D / 亮点三路）的**唯一入口**。
 *
 * 用法：
 * ```ts
 * const { tokens, presetId, setPreset, resolve, cssVar } = useTheme();
 * // 2D 写 SVG 呈现属性（字面值，不能用 var()，SPEC §C.2 B9）
 * const stroke = resolve('wall-bearing');
 * // 样式里用 CSS 变量
 * const bg = cssVar('surface');
 * ```
 * 令牌来源恒为 `theme/tokens.ts`（唯一色值来源），读写状态在 `stores/theme.ts`（SPEC §D.7）。
 */
import { storeToRefs } from 'pinia';
import { computed, type ComputedRef } from 'vue';
import { applyCssVars as applyTokens, resolveToken, tokenToCssVar } from './applyTheme';
import { DEFAULT_THEME_PRESET_ID, isThemePresetId, THEME_PRESETS, THEMES, THEME_PRESET_IDS } from './tokens';
import { useThemeStore } from '@/stores/theme';
import type { ThemePresetId, ThemePresetMeta, ThemeTokenName, ThemeTokens } from '@/types/theme';

export interface UseThemeReturn {
  presetId: ComputedRef<ThemePresetId>;
  tokens: ComputedRef<ThemeTokens>;
  presets: readonly ThemePresetMeta[];
  /** 当前预设的元信息（中英文名） */
  currentPreset: ComputedRef<ThemePresetMeta>;
  setPreset: (id: ThemePresetId) => void;
  /** 三套预设轮换（UI 上的「主题」按钮） */
  cyclePreset: () => void;
  applyCssVars: (el?: HTMLElement) => void;
  /** 字面值取色（SVG 属性 / 3D / canvas 导出） */
  resolve: (name: ThemeTokenName) => string;
  /** CSS 变量名（样式里用） */
  cssVar: (name: ThemeTokenName) => string;
}

export function useTheme(): UseThemeReturn {
  const store = useThemeStore();
  const { presetId, tokens } = storeToRefs(store);

  const currentPreset = computed<ThemePresetMeta>(
    () => THEME_PRESETS.find((p) => p.id === presetId.value) ?? THEME_PRESETS[0],
  );

  return {
    presetId,
    tokens,
    presets: THEME_PRESETS,
    currentPreset,
    setPreset: (id: ThemePresetId) => store.setPreset(id),
    cyclePreset: () => {
      const index = THEME_PRESET_IDS.indexOf(presetId.value);
      store.setPreset(THEME_PRESET_IDS[(index + 1) % THEME_PRESET_IDS.length]);
    },
    applyCssVars: (el?: HTMLElement) => store.applyCssVars(el),
    resolve: (name: ThemeTokenName) => store.resolve(name),
    cssVar: (name: ThemeTokenName) => tokenToCssVar(name),
  };
}

/**
 * 启动时调用（`main.ts`）：先把令牌写进 CSS 变量再挂载，避免首帧无主题（FOUC）。
 * 存储读取与校验在 `stores/theme.ts` 内完成。
 */
export function initTheme(): ThemePresetId {
  const store = useThemeStore();
  if (!isThemePresetId(store.presetId)) {
    store.presetId = DEFAULT_THEME_PRESET_ID;
  }
  applyTokens(store.presetId);
  return store.presetId;
}

/** 供非组件环境（导出模块 / 3D 引擎）取字面值，不依赖 Pinia 实例 */
export function resolveThemeToken(presetId: ThemePresetId, name: ThemeTokenName): string {
  return resolveToken(presetId, name);
}

/** 供 3D 引擎直接拿整表（等价于 `THEMES[presetId]`，此处再导出一次便于下游只 import 一处） */
export function themeTokensOf(presetId: ThemePresetId): ThemeTokens {
  return THEMES[presetId];
}
