/**
 * 令牌 → CSS 变量 应用层（SPEC §D.7 `applyCssVars` / §F.6）。
 *
 * 关键契约：
 * - **唯一色值来源**是 `theme/tokens.ts`；本文件只做「名字映射 + 写入」。
 * - CSS 变量名 = `--ds-` + 令牌名（SPEC §E.3 的 `--ds-*` 命名）。
 * - 导出图片 / 3D / canvas 必须用 `resolveToken()` 取**字面值**（R-EXP-1）：
 *   SVG 呈现属性不支持 `var()`，写变量会导致导出丢色（RISK-06）。
 * - ⛔ 本文件不 import `theme/contrast.ts`（ADR-04：colorjs.io 只用于断言）。
 */
import { DEFAULT_THEME_PRESET_ID, THEMES, THEME_TOKEN_NAMES } from './tokens';
import type { ThemePresetId, ThemeTokenName, ThemeTokens } from '@/types/theme';

export const CSS_VAR_PREFIX = '--ds-';

/** 令牌 → CSS 变量名（`text-muted` → `--ds-text-muted`） */
export function tokenToCssVar(name: ThemeTokenName): string {
  return `${CSS_VAR_PREFIX}${name}`;
}

/** 整表 → CSS 变量字典 */
export function tokensToCssVars(tokens: ThemeTokens): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of THEME_TOKEN_NAMES) out[tokenToCssVar(name)] = tokens[name];
  return out;
}

/**
 * 把整套令牌写到 `:root`（或指定元素）的 CSS 变量上。
 * SSR/单测（无 DOM）下安全降级：返回令牌本身，不抛错。
 */
export function applyCssVars(presetId: ThemePresetId, el?: HTMLElement): ThemeTokens {
  const tokens = THEMES[presetId] ?? THEMES[DEFAULT_THEME_PRESET_ID];
  const target = el ?? (typeof document === 'undefined' ? null : document.documentElement);
  if (target) {
    for (const name of THEME_TOKEN_NAMES) target.style.setProperty(tokenToCssVar(name), tokens[name]);
    target.dataset.theme = presetId;
    target.style.colorScheme = tokens['color-scheme'] === 'dark' ? 'dark' : 'light';
    syncThemeColorMeta(tokens.surface);
  }
  return tokens;
}

/** 取单个令牌的**字面值**（SVG 呈现属性 / 3D / canvas 导出用，R-EXP-1） */
export function resolveToken(presetId: ThemePresetId, name: ThemeTokenName): string {
  return THEMES[presetId][name];
}

/** 取整套字面值 */
export function resolveTokens(presetId: ThemePresetId): ThemeTokens {
  return THEMES[presetId];
}

/** 同步 `<meta name="theme-color">`（原实现是写死的 `#fffdf9`，现在跟随主题；index.html 里不放 hex） */
export function syncThemeColorMeta(color: string): void {
  if (typeof document === 'undefined') return;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', color);
}

/**
 * 读 CSS 变量当前解析值（需要「实际渲染出来的颜色」时用，例如 canvas 混合/渐变）。
 * 未设置时返回 `fallback`；⛔ 不要用它替代 `resolveToken()` 做导出（字体/绘制时机不可控）。
 */
export function readCssVar(name: ThemeTokenName, el?: HTMLElement, fallback = ''): string {
  const target = el ?? (typeof document === 'undefined' ? null : document.documentElement);
  if (!target) return fallback;
  const value = getComputedStyle(target).getPropertyValue(tokenToCssVar(name)).trim();
  return value || fallback;
}
