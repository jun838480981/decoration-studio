/**
 * 内置名称术语表（`data/names-en.ts`）的回归断言。
 *
 * 依据：OF §1.10（原 `装修设计.html` L418-438）。
 * 这里断言的是**行为**而不是"数字对齐文档"：
 * - 表内每条都能被 `nameIn()` 翻成英文；
 * - 表外名称（= 用户自定义）**原样返回**（这是特性，不是漏翻）；
 * - 中文界面下不做任何翻译。
 */
import { describe, expect, it } from 'vitest';
import { NAMES_EN, NAMES_EN_COUNT, hasEnglishName, nameIn } from './names-en';

describe('内置名称术语表（OF §1.10）', () => {
  it('条数与源码逐条提取的结果一致（91 条；OF 文档记作 86 条属手工计数偏差）', () => {
    expect(NAMES_EN_COUNT).toBe(91);
    expect(Object.keys(NAMES_EN)).toHaveLength(NAMES_EN_COUNT);
  });

  it('键唯一、值非空（防止复制粘贴时出现重复键吞掉条目）', () => {
    const keys = Object.keys(NAMES_EN);
    expect(new Set(keys).size).toBe(keys.length);
    for (const [key, value] of Object.entries(NAMES_EN)) {
      expect(key.trim().length, `空键：${key}`).toBeGreaterThan(0);
      expect(value.trim().length, `空译名：${key}`).toBeGreaterThan(0);
    }
  });

  it('房间 / 材料 / 家具三类关键条目齐全（原实现的三套名称域）', () => {
    // 房间
    expect(NAMES_EN['主卧室']).toBe('Master Bedroom');
    expect(NAMES_EN['厨房']).toBe('Kitchen');
    // 材料
    expect(NAMES_EN['橡木地板']).toBe('Oak Flooring');
    expect(NAMES_EN['满铺地毯']).toBe('Wall-to-wall Carpet');
    // 家具 + 带引号的译名（JSON 转义正确性）
    expect(NAMES_EN['双人床 1.8m']).toBe('Double Bed 1.8m');
    expect(NAMES_EN['小孩房']).toBe("Kids' Room");
    expect(NAMES_EN['子女房']).toBe("Children's Room");
  });

  it('nameIn：英文界面查表、中文界面原样', () => {
    expect(nameIn('客厅', 'en')).toBe('Living Room');
    expect(nameIn('客厅', 'zh')).toBe('客厅');
  });

  it('nameIn：表外名称（用户自定义）在英文界面下也原样返回', () => {
    expect(nameIn('我的工作室', 'en')).toBe('我的工作室');
    expect(nameIn('My Studio', 'en')).toBe('My Studio');
    expect(hasEnglishName('我的工作室')).toBe(false);
    expect(hasEnglishName('客厅')).toBe(true);
  });
});
