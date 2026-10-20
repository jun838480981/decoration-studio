/**
 * store 契约快照测试（RISK-01 的机器闸门）。
 *
 * 目的：SPEC §D 的**冻结初值**一旦被「顺手调参」，CI 立刻红。
 * 这里只断言初值与常量，不测业务逻辑（业务由 t4/t5/t6 各自测）。
 */
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLayoutStore, LEGACY_STORE_KEY, UNDO_LIMIT, stateKey, stateKeyOf } from '@/stores/layout';
import { usePlanStore, PLAN_FMT, PLAN_SET_FMT, PLAN_STORE_KEY, PRESET_ORDER, UNDO_STRUCT_LIMIT } from '@/stores/plan';
import { useThemeStore, THEME_STORE_KEY } from '@/stores/theme';
import { useUiStore, layers, MAX_SCALE, MIN_SCALE, PX_MM } from '@/stores/ui';
import { STORAGE_KEYS } from '@/utils/persistence';

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('持久化键（SPEC §D.8 🔒 逐字冻结）', () => {
  it('键名逐字一致，且只允许这 7 个', () => {
    expect(STORAGE_KEYS).toEqual({
      lang: 'huxing-lang',
      panes: 'huxing-panes',
      plans: 'huxing-plans-v1',
      statePrefix: 'huxing-state-v2-',
      legacyState: 'huxing-design-v1',
      theme: 'huxing-theme-v1',
    });
    expect(LEGACY_STORE_KEY).toBe('huxing-design-v1');
    expect(PLAN_STORE_KEY).toBe('huxing-plans-v1');
    expect(THEME_STORE_KEY).toBe('huxing-theme-v1');
    expect(stateKey('h3b')).toBe('huxing-state-v2-h3b');
    expect(stateKeyOf('hloft', 1, true)).toBe('huxing-state-v2-hloft-l1');
    expect(stateKeyOf('h3b', 0, false)).toBe('huxing-state-v2-h3b');
  });
});

describe('plan store（SPEC §D.5）', () => {
  it('常量与初值冻结', () => {
    expect(PRESET_ORDER).toEqual(['h3b', 'h2b', 'h3c', 'h4d', 'h1a', 'hloft', 'hblank']);
    expect(UNDO_STRUCT_LIMIT).toBe(80);
    expect(PLAN_FMT).toBe('huxing-plan-v1');
    expect(PLAN_SET_FMT).toBe('huxing-plan-v1-set');
    const plan = usePlanStore();
    expect(plan.currentId).toBe('h3b');
    expect(plan.level).toBe(0);
    expect(plan.structHistory).toEqual([]);
    expect(typeof plan.plan.id).toBe('string');
    expect(plan.isMulti).toBe(false);
  });
});

describe('layout store（SPEC §D.6）', () => {
  it('初值与撤销栈上限冻结，且四个 PlanState 字段齐全', () => {
    expect(UNDO_LIMIT).toBe(150);
    const layout = useLayoutStore();
    expect(layout.furniture).toEqual([]);
    expect(layout.rooms).toEqual({});
    expect(layout.demolished).toEqual([]);
    expect(layout.measures).toEqual([]);
    expect(layout.undoStack).toEqual([]);
    expect(layout.redoStack).toEqual([]);
    expect(layout.canUndo).toBe(false);
    expect(layout.canRedo).toBe(false);
    expect(layout.defaultState()).toEqual({ furniture: [], rooms: {}, demolished: [], measures: [] });
  });

  it('fixState 是纯函数：坏数据不抛错', () => {
    const layout = useLayoutStore();
    expect(layout.fixState(null)).toEqual({ furniture: [], rooms: {}, demolished: [], measures: [] });
    expect(layout.fixState({ furniture: 'x' }).furniture).toEqual([]);
  });
});

describe('ui store（SPEC §D.7）', () => {
  it('初值逐字冻结', () => {
    const ui = useUiStore();
    expect(ui.tool).toBe('select');
    expect(ui.selection).toBeNull();
    expect(ui.view).toEqual({ x0: 0, y0: 0, s: 0.06 });
    expect(ui.viewMode).toBe('2d');
    expect(ui.is3D).toBe(false);
    expect(ui.switching).toBe(false);
    expect(ui.panes).toEqual({ hideLib: false, hidePanel: false });
    expect(ui.view3d).toEqual({ cut: 2.8, furn: true, labels: true, night: false, hour: 10, mode: 'orbit' });
    expect(ui.edit).toEqual({
      on: false,
      mode: 'wall',
      kind: 'n',
      thick: 200,
      doorW: 900,
      winW: 1500,
      grid: 100,
      snap: 'grid',
      ortho: true,
      pts: [],
      drag: null,
      hover: null,
      rawHover: null,
      axis: null,
      savedGridLayer: null,
    });
    expect(ui.flags).toEqual({ dims: true, labels: true, furn: true, grid: false, bearing: false, wallSnap: true });
    expect(layers).toEqual({ dims: true, labels: true, furn: true, grid: false, bearing: false, wallSnap: true });
  });

  it('常量冻结：缩放钳制与 PX_MM', () => {
    expect(MIN_SCALE).toBe(0.012);
    expect(MAX_SCALE).toBe(2);
    expect(PX_MM).toBeCloseTo(25.4 / 96, 10);
  });

  it('图层开关与工具切换按契约更新', () => {
    const ui = useUiStore();
    ui.toggleLayer('grid');
    expect(ui.flags.grid).toBe(true);
    ui.setTool('measure');
    expect(ui.tool).toBe('measure');
  });
});

describe('theme store（SPEC §D.7）', () => {
  it('默认 day，切换后 tokens 跟随', () => {
    const theme = useThemeStore();
    expect(theme.presetId).toBe('day');
    expect(theme.resolve('accent')).toBe(theme.tokens.accent);
    theme.setPreset('night');
    expect(theme.presetId).toBe('night');
    expect(theme.tokens.canvas).not.toBe(undefined);
  });
});