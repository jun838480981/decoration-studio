/**
 * 对比度守门测试（SPEC §E.7 / 验收清单第 14 条）。
 * 裁决者是 `colorjs.io`（ADR-03），断言表见 `theme/contrast.ts`。
 */
import { describe, expect, it } from 'vitest';
import { CONTRAST_ASSERTIONS, evaluateAllContrast } from './contrast';
import { DECORATIVE_TOKEN_NAMES, THEMES, THEME_PRESET_IDS } from './tokens';

const results = evaluateAllContrast(THEMES);

describe('主题对比度断言（SPEC §E.7）', () => {
  it('三套预设都有断言，且断言集非空', () => {
    expect(THEME_PRESET_IDS).toHaveLength(3);
    for (const presetId of THEME_PRESET_IDS) {
      expect(CONTRAST_ASSERTIONS[presetId].length).toBeGreaterThan(30);
    }
  });

  // RISK-17 / C-2：断言集**不含**装饰豁免项（尤其 `wall-low` 填充），但**必须含** `wall-low-stroke`
  it('断言集排除装饰豁免项，但保留矮墙描边（ADR-17 / C-2）', () => {
    const ids = CONTRAST_ASSERTIONS.day.map((p) => p.id);
    for (const name of DECORATIVE_TOKEN_NAMES) {
      expect(ids, `装饰豁免项 ${name} 不应被断言`).not.toContain(`plan:${name}`);
    }
    expect(ids).not.toContain('plan:wall-low');
    expect(ids).toContain('plan:wall-low-stroke');
  });

  it('断言覆盖 SPEC §E.7 的 13 组最低要求', () => {
    const ids = new Set(CONTRAST_ASSERTIONS.day.map((p) => p.id));
    for (const required of [
      'text-on-surface',
      'text-on-bg',
      'text-secondary-on-surface',
      'text-muted-on-surface',
      'text-muted-on-bg',
      'on-accent-on-accent',
      'accent-on-surface',
      'accent-on-accent-soft',
      'border-strong-on-surface',
      'border-strong-on-bg',
      'focus-ring-on-surface',
      'success-on-surface',
      'warning-on-surface',
      'danger-on-surface',
      'info-on-surface',
      'plan:wall-bearing',
    ]) {
      expect(ids.has(required), `缺少断言：${required}`).toBe(true);
    }
  });

  it('无失败项', () => {
    const failures = results.filter((r) => !r.pass).map((r) => `${r.presetId}/${r.pair.id}=${r.ratio.toFixed(2)}<${r.pair.min}`);
    expect(failures).toEqual([]);
  });

  // 逐条断言：失败时能直接看到是哪一套预设的哪一对组合、实测比值是多少
  for (const result of results) {
    it(`${result.presetId} · ${result.pair.id} ≥ ${result.pair.min}（${result.ratio.toFixed(2)}:1）`, () => {
      expect(result.ratio).toBeGreaterThanOrEqual(result.pair.min);
    });
  }
});