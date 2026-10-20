/**
 * 对比度断言表（SPEC §E.7，P0-1 的验收条件）。
 *
 * ⛔ **不要**在这里自研色彩空间/对比度数学（SPEC §B.4 红线 5）：比值一律由 `colorjs.io`
 * （MIT，ADR-03/ADR-04 指定的**唯一裁决者**）计算；本文件只负责「哪些组合、最低多少」。
 * ⛔ 本文件**不得**被运行时样式代码 import（ADR-04：colorjs.io 只用于断言与测试）。
 *
 * 与 SPEC §E.1 的关系：SPEC 表格里的比值是 spec-lead 手算值，本文件的断言是**程序化复核**；
 * 两者不一致时以 `colorjs.io` 结果为准并回写 SPEC（RISK-14 / 待确认项 C7）。
 */
import Color from 'colorjs.io';
import { DECORATIVE_TOKEN_NAMES, PLAN_TOKEN_NAMES } from './tokens';
import type { ContrastPair, ThemePresetId, ThemeTokenName } from '@/types/theme';

/** WCAG 2.1 SC 1.4.3：正文 4.5:1；SC 1.4.11：图形/UI 边界 3:1 */
export const MIN_TEXT_CONTRAST = 4.5;
export const MIN_GRAPHIC_CONTRAST = 3;

/**
 * 计算 WCAG 2.1 对比度（1..21）。
 * `colorjs.io` 的 `contrast()` 在旧版本返回带符号值，取绝对值即可。
 */
export function contrastRatio(fg: string, bg: string): number {
  const fgColor = new Color(fg);
  const bgColor = new Color(bg);
  const impl = fgColor as unknown as { contrast(other: unknown, algorithm?: string): number };
  const value = impl.contrast(bgColor, 'WCAG21');
  if (!Number.isFinite(value)) {
    throw new Error(`colorjs.io contrast() 未返回数值：fg=${fg} bg=${bg}`);
  }
  return Math.abs(value);
}

type PairSpec = readonly [id: string, fg: ThemeTokenName, bg: ThemeTokenName, min: number, kind: ContrastPair['kind']];

/** 文字与 UI 边界（SPEC §E.7 第 1–12 条） */
const TEXT_UI_PAIRS: readonly PairSpec[] = [
  ['text-on-surface', 'text', 'surface', MIN_TEXT_CONTRAST, 'text'],
  ['text-on-bg', 'text', 'bg', MIN_TEXT_CONTRAST, 'text'],
  ['text-secondary-on-surface', 'text-secondary', 'surface', MIN_TEXT_CONTRAST, 'text'],
  ['text-secondary-on-bg', 'text-secondary', 'bg', MIN_TEXT_CONTRAST, 'text'],
  ['text-muted-on-surface', 'text-muted', 'surface', MIN_TEXT_CONTRAST, 'text'],
  ['text-muted-on-bg', 'text-muted', 'bg', MIN_TEXT_CONTRAST, 'text'],
  ['text-muted-on-canvas', 'text-muted', 'canvas', MIN_TEXT_CONTRAST, 'text'],
  ['on-accent-on-accent', 'on-accent', 'accent', MIN_TEXT_CONTRAST, 'text'],
  ['on-accent-on-accent-hover', 'on-accent', 'accent-hover', MIN_TEXT_CONTRAST, 'text'],
  ['accent-on-surface', 'accent', 'surface', MIN_TEXT_CONTRAST, 'text'],
  ['accent-on-bg', 'accent', 'bg', MIN_TEXT_CONTRAST, 'text'],
  ['accent-on-canvas', 'accent', 'canvas', MIN_TEXT_CONTRAST, 'text'],
  ['accent-on-accent-soft', 'accent', 'accent-soft', MIN_TEXT_CONTRAST, 'text'],
  ['border-strong-on-surface', 'border-strong', 'surface', MIN_GRAPHIC_CONTRAST, 'graphic'],
  ['border-strong-on-bg', 'border-strong', 'bg', MIN_GRAPHIC_CONTRAST, 'graphic'],
  ['border-strong-on-canvas', 'border-strong', 'canvas', MIN_GRAPHIC_CONTRAST, 'graphic'],
  ['focus-ring-on-surface', 'focus-ring', 'surface', MIN_GRAPHIC_CONTRAST, 'graphic'],
  ['success-on-surface', 'success', 'surface', MIN_TEXT_CONTRAST, 'text'],
  ['warning-on-surface', 'warning', 'surface', MIN_TEXT_CONTRAST, 'text'],
  ['danger-on-surface', 'danger', 'surface', MIN_TEXT_CONTRAST, 'text'],
  ['info-on-surface', 'info', 'surface', MIN_TEXT_CONTRAST, 'text'],
  ['success-on-success-soft', 'success', 'success-soft', MIN_TEXT_CONTRAST, 'text'],
  ['warning-on-warning-soft', 'warning', 'warning-soft', MIN_TEXT_CONTRAST, 'text'],
  ['danger-on-danger-soft', 'danger', 'danger-soft', MIN_TEXT_CONTRAST, 'text'],
  ['info-on-info-soft', 'info', 'info-soft', MIN_TEXT_CONTRAST, 'text'],
  ['accent-2-on-surface', 'accent-2', 'surface', MIN_TEXT_CONTRAST, 'text'],
  ['accent-2-on-accent-2-soft', 'accent-2', 'accent-2-soft', MIN_TEXT_CONTRAST, 'text'],
];

/**
 * 房间标签：底衬是**内容色地板图案**（`MATS[].sw`，ADR-10 不随主题变），
 * 原实现用浅色描边光晕（`#fbf9f4` stroke + paint-order，装修设计.html L1258）保证可读，
 * 因此这三枚令牌在主题间保持不变，断言针对**光晕**而非 canvas。
 */
const ROOM_LABEL_PAIRS: readonly PairSpec[] = [
  ['room-label-on-halo', 'room-label', 'room-label-halo', MIN_TEXT_CONTRAST, 'text'],
  ['room-label-sub-on-halo', 'room-label-sub', 'room-label-halo', MIN_TEXT_CONTRAST, 'text'],
];

/** SPEC §E.7 第 13 条：全套 2D 图纸令牌 on `canvas` ≥ 3（装饰性令牌除外，见 tokens.ts 的说明） */
const PLAN_GRAPHIC_PAIRS: readonly PairSpec[] = PLAN_TOKEN_NAMES.filter(
  (name) =>
    !DECORATIVE_TOKEN_NAMES.includes(name) &&
    name !== 'room-label' &&
    name !== 'room-label-sub' &&
    name !== 'room-label-halo',
).map((name) => [`plan:${name}`, name, 'canvas', MIN_GRAPHIC_CONTRAST, 'graphic'] as const);

/** 完整断言集（三套预设共用同一组组合，因为 `ThemeTokens` 的键集合对三套预设完全一致） */
export const ASSERTION_PAIRS: readonly PairSpec[] = [
  ...TEXT_UI_PAIRS,
  ...ROOM_LABEL_PAIRS,
  ...PLAN_GRAPHIC_PAIRS,
];

function toContrastPairs(): ContrastPair[] {
  return ASSERTION_PAIRS.map(([id, fg, bg, min, kind]) => ({ id, fg, bg, min, kind }));
}

export const CONTRAST_ASSERTIONS: Record<ThemePresetId, ContrastPair[]> = {
  day: toContrastPairs(),
  night: toContrastPairs(),
  contrast: toContrastPairs(),
};

export interface ContrastResult {
  presetId: ThemePresetId;
  pair: ContrastPair;
  ratio: number;
  pass: boolean;
}

/** 跑一套预设的断言，返回逐条结果（vitest 与人工排查共用） */
export function evaluateContrastPreset(
  presetId: ThemePresetId,
  tokens: Record<ThemeTokenName, string>,
  pairs: ContrastPair[] = CONTRAST_ASSERTIONS[presetId],
): ContrastResult[] {
  return pairs.map((pair) => {
    const ratio = contrastRatio(tokens[pair.fg], tokens[pair.bg]);
    return { presetId, pair, ratio, pass: ratio >= pair.min };
  });
}

/** 三套预设全量结果 */
export function evaluateAllContrast(
  themes: Record<ThemePresetId, Record<ThemeTokenName, string>>,
): ContrastResult[] {
  return (Object.keys(CONTRAST_ASSERTIONS) as ThemePresetId[]).flatMap((presetId) =>
    evaluateContrastPreset(presetId, themes[presetId]),
  );
}

/** 失败项（便于在 CI 日志里一眼看到问题在哪里） */
export function failedContrast(
  themes: Record<ThemePresetId, Record<ThemeTokenName, string>>,
): ContrastResult[] {
  return evaluateAllContrast(themes).filter((r) => !r.pass);
}
