/**
 * 令牌表结构测试：保证三套预设的**键集合完全一致**（下游只写一份类型安全的取色代码），
 * 且每个颜色令牌都是合法 hex、`color-scheme` 取值合法。
 */
import { describe, expect, it } from 'vitest';
import {
  DECORATIVE_TOKEN_NAMES,
  DEFAULT_THEME_PRESET_ID,
  isThemePresetId,
  PLAN_TOKEN_NAMES,
  THEME_PRESETS,
  THEME_TOKEN_NAMES,
  THEMES,
  UI_TOKEN_NAMES,
  THEME_PRESET_IDS,
} from './tokens';
import { PALETTE_KEY_PATHS, flattenPalette, MATERIAL_PALETTES, resolveSceneTheme } from './material-palette';
import { tokenToCssVar, tokensToCssVars } from './applyTheme';

const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

describe('主题令牌表', () => {
  it('默认预设定为 day', () => {
    expect(DEFAULT_THEME_PRESET_ID).toBe('day');
    expect(isThemePresetId('night')).toBe(true);
    expect(isThemePresetId('nope')).toBe(false);
  });

  it('三套预设的键集合完全一致', () => {
    const reference = [...THEME_TOKEN_NAMES].sort();
    for (const id of THEME_PRESET_IDS) {
      expect(Object.keys(THEMES[id]).sort(), `预设 ${id} 的键集合与 THEME_TOKEN_NAMES 不一致`).toEqual(reference);
    }
  });

  it('没有空值，且颜色令牌都是合法 hex', () => {
    for (const id of THEME_PRESET_IDS) {
      for (const name of THEME_TOKEN_NAMES) {
        const value = THEMES[id][name];
        expect(value, `${id}/${name} 为空`).toBeTruthy();
        if (name === 'color-scheme') {
          expect(['light', 'dark']).toContain(value);
        } else {
          expect(HEX.test(value), `${id}/${name} 不是合法 hex：${value}`).toBe(true);
        }
      }
    }
  });

  it('UI 与 2D 令牌分类互补且无重叠', () => {
    expect(UI_TOKEN_NAMES.length + PLAN_TOKEN_NAMES.length).toBe(THEME_TOKEN_NAMES.length);
    for (const name of PLAN_TOKEN_NAMES) expect(UI_TOKEN_NAMES.includes(name)).toBe(false);
  });

  it('装饰性豁免令牌都在令牌表里', () => {
    for (const name of DECORATIVE_TOKEN_NAMES) expect(THEME_TOKEN_NAMES.includes(name)).toBe(true);
  });

  it('预设元信息与 CSS 变量映射正确', () => {
    expect(THEME_PRESETS).toHaveLength(3);
    expect(tokenToCssVar('text-muted')).toBe('--ds-text-muted');
    const vars = tokensToCssVars(THEMES.day);
    expect(Object.keys(vars)).toHaveLength(THEME_TOKEN_NAMES.length);
    expect(vars['--ds-surface']).toBe(THEMES.day.surface);
  });
});

describe('3D 材质基色表（SPEC §E.8）', () => {
  it('三套预设的调色板路径完全一致且都是合法 hex', () => {
    for (const id of THEME_PRESET_IDS) {
      const flat = flattenPalette(id);
      expect(Object.keys(flat).sort()).toEqual([...PALETTE_KEY_PATHS].sort());
      for (const path of PALETTE_KEY_PATHS) {
        expect(HEX.test(flat[path]), `${id}/${path} 不是合法 hex：${flat[path]}`).toBe(true);
      }
    }
  });

  it('切主题会改变背景/地面/曝光，夜景只覆盖光照不覆盖材质（ADR-08）', () => {
    const dayScene = resolveSceneTheme('day', false);
    const nightScene = resolveSceneTheme('night', false);
    expect(dayScene.binding.background).not.toBe(nightScene.binding.background);
    expect(dayScene.binding.groundColor).not.toBe(nightScene.binding.groundColor);
    expect(dayScene.binding.toneMappingExposure).not.toBe(nightScene.binding.toneMappingExposure);

    const dayNightMode = resolveSceneTheme('day', true);
    expect(dayNightMode.palette).toBe(MATERIAL_PALETTES.day);
    expect(dayNightMode.binding.background).not.toBe(dayScene.binding.background);
  });
});