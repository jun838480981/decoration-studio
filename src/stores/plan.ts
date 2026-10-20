/**
 * 户型 store（SPEC §D.5 🔒 冻结）。
 *
 * 状态与 action 签名逐字对齐 SPEC §D.5（RISK-01：改名即触发契约漂移）。
 * 原实现（`装修设计.html`）用 6 个全局可变数组 + `usePlan()` 就地覆写全局结构（L882-888，X2 不保留项），
 * 这里改成 `computed` 结构视图，⛔ 任何组件都不得持有结构副本（SPEC §F.1）。
 *
 * t4 已按 OF §1.11 / §4.3 补全：7 个内置户型（`data/presets/**`）、复式按层存档、4 种导入形态、
 * 结构撤销栈（80 步）与 `demolished` 下标重映射（RISK-05）。跨 store 调用一律放在函数体内。
 */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { BLANK_PLAN, PRESETS } from '@/data/presets';
import { stageSize } from '@/composables/useResizeFit';
import { autoFurnishFurniture } from '@/utils/auto-furnish';
import { boundsOf, snapRects as buildSnapRects } from '@/utils/geometry';
import { fixStateWith, normalizePlan, stripPlan } from '@/utils/normalize';
import {
  migrateLegacy,
  readPlanLibrary,
  readPlanState,
  removeKey,
  stateKeyOf,
  writePlanLibrary,
  writePlanState,
} from '@/utils/persistence';
import { newPlanId } from '@/utils/id';
import { useLayoutStore } from './layout';
import { useToastStore } from './toast';
import { useUiStore } from './ui';
import type { Bounds } from '@/types/geometry';
import type {
  DimChain,
  Door,
  Lintel,
  Plan,
  PlanLevel,
  PlanStructure,
  Room,
  Slide,
  Stair,
  VoidShape,
  Wall,
  Win,
} from '@/types/plan';
import type { PlanFile, PlanSetFile } from '@/types/persistence';
import type { PlanState, RoomOverride } from '@/types/state';

/** 内置户型顺序（原 L854；SPEC §D.5 冻结） */
export const PRESET_ORDER = ['h3b', 'h2b', 'h3c', 'h4d', 'h1a', 'hloft', 'hblank'] as const;

/** 结构撤销栈上限（原 L2155） */
export const UNDO_STRUCT_LIMIT = 80;

/** 单户型导出格式（原 L607） */
export const PLAN_FMT = 'huxing-plan-v1';
/** 全部户型打包格式 */
export const PLAN_SET_FMT = 'huxing-plan-v1-set';
/** 户型库持久化键（原 L608） */
export const PLAN_STORE_KEY = 'huxing-plans-v1';

export const usePlanStore = defineStore('plan', () => {
  const layout = useLayoutStore();

  // ---- state ----
  const presets = ref<Plan[]>(PRESETS);
  const custom = ref<Plan[]>([]);
  const currentId = ref<string>(PRESET_ORDER[0]);
  const level = ref<number>(0);
  /** 结构撤销栈（替代原 `planHist`，L866） */
  const structHistory = ref<string[]>([]);

  // ---- getters ----
  const allPlans = computed<Plan[]>(() => [...presets.value, ...custom.value]);

  const plan = computed<Plan>(() => findPlan(currentId.value) ?? presets.value[0] ?? BLANK_PLAN);

  const isMulti = computed<boolean>(() => Boolean(plan.value.multilevel && (plan.value.levels?.length ?? 0) > 0));

  /** 单层返回 plan 自身，复式返回 `levels[level]`（替代 `levelOf` + `usePlan`，L878-888） */
  const levelData = computed<PlanStructure & Partial<PlanLevel>>(() => {
    const p = plan.value;
    if (isMulti.value && p.levels && p.levels.length > 0) {
      const index = Math.min(Math.max(level.value, 0), p.levels.length - 1);
      return p.levels[index] as PlanStructure & Partial<PlanLevel>;
    }
    return p;
  });

  const levelName = computed<string>(() => {
    if (!isMulti.value) return plan.value.name;
    return levelData.value.name ?? `F${level.value + 1}`;
  });

  const walls = computed<Wall[]>(() => levelData.value.walls ?? []);
  const wins = computed<Win[]>(() => levelData.value.wins ?? []);
  const doors = computed<Door[]>(() => levelData.value.doors ?? []);
  const slides = computed<Slide[]>(() => levelData.value.slides ?? []);
  const rooms = computed<Room[]>(() => levelData.value.rooms ?? []);
  const dims = computed<DimChain[]>(() => levelData.value.dims ?? []);
  const lintels = computed<Lintel[]>(() => levelData.value.lintels ?? []);
  const stairs = computed<Stair[]>(() => levelData.value.stairs ?? []);
  const voids = computed<VoidShape[]>(() => levelData.value.voids ?? []);

  /** 已含复式其它层（切换后显示的是当前层），替代 `levelOf(p,0)` 的缩略图语义 */
  const bounds = computed<Bounds>(() => levelData.value.bounds ?? plan.value.bounds ?? boundsOf(levelData.value));

  function findPlan(id: string): Plan | null {
    return allPlans.value.find((p) => p.id === id) ?? null;
  }

  // ---- actions ----

  /**
   * 启动装载（原 L1012-1013：`loadPlans()` → `migrateLegacy()` → `usePlan(...)`）。
   * 读 `huxing-plans-v1` → 迁移旧键（不删旧键，ADR-05）→ 载入当前户型的布置存档。
   */
  function loadFromStorage(): void {
    const library = readPlanLibrary();
    custom.value = Array.isArray(library.custom)
      ? library.custom.map((raw) => normalizePlan(raw)).filter((p): p is Plan => p !== null)
      : [];
    if (library.current && findPlan(library.current)) currentId.value = library.current;
    migrateLegacy();
    // 载入当前层的布置（原 `state = load() || defaultState()`）
    layout.loadFor(currentId.value, level.value, isMulti.value);
  }

  /** 写 `{custom, current}`（原 L1908） */
  function saveLibrary(): void {
    writePlanLibrary({ custom: custom.value, current: currentId.value });
  }

  /**
   * 切换户型（原 L1962-1976）。契约（SPEC §D.5）：
   * `endEdit()` → 落盘 → 若在 3D 先回 2D → 重置撤销/选中 → `fitView` → toast。
   */
  async function switchTo(id: string, lv?: number): Promise<void> {
    const target = findPlan(id);
    if (!target) return;
    const ui = useUiStore();
    const toast = useToastStore();
    if (ui.edit.on) ui.endEdit();
    await layout.save();
    if (ui.is3D) await ui.setViewMode('2d');
    currentId.value = id;
    level.value = typeof lv === 'number' ? lv : 0;
    structHistory.value = [];
    layout.loadFor(id, level.value, isMulti.value);
    ui.select(null);
    ui.measureA = null;
    ui.measureCur = null;
    saveLibrary();
    ui.fitView(stageSize.w, stageSize.h);
    toast.push(`已切换到「${target.name}」`);
  }

  /** 切换楼层（原 L1787 / L2626：`switchPlan(PLAN.id, lv)`） */
  function switchLevel(i: number): void {
    const levels = plan.value.levels?.length ?? 0;
    if (i < 0 || i >= levels) return;
    const ui = useUiStore();
    if (ui.edit.on) ui.endEdit();
    level.value = i;
    layout.loadFor(plan.value.id, i, true);
    ui.select(null);
    saveLibrary();
    ui.fitView(stageSize.w, stageSize.h);
  }

  /** 内置户型 → 自定义副本（原 `ensureCustom`，L1991-1999：连当前布置一起搬过去） */
  function ensureCustom(): Plan {
    const current = plan.value;
    if (!current.builtin) return current;
    const copy: Plan = { ...stripPlan(current), id: newPlanId(), builtin: false, name: current.name, tag: '自定义' };
    custom.value = [...custom.value, copy];
    // 原实现 `saveStateTo(np.id, 0, state)`：把当前布置一起搬给副本
    writePlanState(copy.id, 0, false, currentLayoutState());
    if (isMulti.value && current.levels) {
      current.levels.forEach((_, i) => {
        const state = readPlanState(current.id, i, true);
        if (state) writePlanState(copy.id, i, true, state);
      });
    }
    currentId.value = copy.id;
    saveLibrary();
    return copy;
  }

  /** 新建空白户型（原 L2000-2007） */
  function newBlankPlan(): Plan {
    const blank: Plan = { ...BLANK_PLAN, id: newPlanId(), builtin: false, name: '新户型' };
    custom.value = [...custom.value, blank];
    currentId.value = blank.id;
    level.value = 0;
    structHistory.value = [];
    layout.loadFor(blank.id, 0, false);
    saveLibrary();
    return blank;
  }

  /** 复制户型（逐层复制存档，原 `dupPlan` L2008-2025） */
  function duplicatePlan(id: string): Plan | null {
    const source = findPlan(id);
    if (!source) return null;
    const copy: Plan = {
      ...stripPlan(source),
      id: newPlanId(),
      builtin: false,
      name: `${source.name} 副本`,
      tag: '自定义',
    };
    custom.value = [...custom.value, copy];
    const levelCount = source.multilevel && source.levels ? source.levels.length : 1;
    for (let i = 0; i < levelCount; i += 1) {
      const multi = levelCount > 1;
      // 当前正在编辑的那一层用内存态（未落盘的最新改动），其余层读存档
      const state =
        source.id === currentId.value && i === level.value ? currentLayoutState() : readPlanState(source.id, i, multi);
      if (state) writePlanState(copy.id, i, multi, state);
    }
    saveLibrary();
    useToastStore().push('已复制户型');
    return copy;
  }

  /** 删除户型（原 L2026-2040 / `delPlan` L2026-2031：连各层布置存档一起删） */
  function deletePlan(id: string): void {
    const target = findPlan(id);
    if (!target || target.builtin) return;
    const levelCount = target.multilevel && target.levels ? target.levels.length : 1;
    const multi = levelCount > 1;
    for (let i = 0; i < levelCount; i += 1) removeKey(stateKeyOf(id, i, multi));
    custom.value = custom.value.filter((p) => p.id !== id);
    if (currentId.value === id) {
      currentId.value = presets.value[0]?.id ?? BLANK_PLAN.id;
      level.value = 0;
      structHistory.value = [];
      layout.loadFor(currentId.value, 0, isMulti.value);
    }
    saveLibrary();
  }

  /** 改名（原 L2041-2046） */
  function renamePlan(id: string, name: string): void {
    const target = allPlans.value.find((p) => p.id === id);
    if (!target) return;
    const next = name.trim();
    if (!next) return;
    target.name = next;
    saveLibrary();
  }

  function structureSnapshot(): string {
    const data = levelData.value;
    return JSON.stringify([data.walls, data.wins, data.doors, data.slides, data.rooms, data.dims, data.lintels, data.stairs, data.voids]);
  }

  /** 当前布置存档的原始值（供复制户型/内部搬运使用；⛔ 组件不要用它绕过 `layout.*`） */
  function currentLayoutState(): PlanState {
    return {
      furniture: layout.furniture,
      rooms: layout.rooms,
      demolished: layout.demolished,
      measures: layout.measures,
    };
  }

  /** 结构修改后统一收口：重算 bounds → 同步房间覆盖 → 落盘 → 重新适应窗口（原 L2154-2160） */
  function afterStructureChange(): void {
    const data = levelData.value;
    data.bounds = null; // 让 `bounds` computed 回落到 boundsOf(levelData)（原 `curLevel().bounds = null`）
    layout.syncRoomState();
    saveLibrary();
    void layout.save();
    useUiStore().fitView(stageSize.w, stageSize.h);
  }

  /**
   * 结构修改（原 L2154-2160）：压结构栈 → 改结构 → 重算 bounds → `layout.syncRoomState()` → 持久化。
   * 上限 `UNDO_STRUCT_LIMIT`（80）。
   */
  function planEdit(mutator: () => void): void {
    structHistory.value = [...structHistory.value, structureSnapshot()].slice(-UNDO_STRUCT_LIMIT);
    mutator();
    afterStructureChange();
  }

  /** 结构撤销（原 L2141-2153）：还原 9 组数组 → 重算 bounds → 按新墙体数过滤 `demolished`（RISK-05） */
  function planUndo(): boolean {
    const before = structHistory.value[structHistory.value.length - 1];
    if (!before) return false;
    structHistory.value = structHistory.value.slice(0, -1);
    const restored = JSON.parse(before) as [
      Wall[],
      Win[],
      Door[],
      Slide[],
      Room[],
      DimChain[],
      Lintel[],
      Stair[],
      VoidShape[],
    ];
    const data = levelData.value;
    data.walls = restored[0] ?? [];
    data.wins = restored[1] ?? [];
    data.doors = restored[2] ?? [];
    data.slides = restored[3] ?? [];
    data.rooms = restored[4] ?? [];
    data.dims = restored[5] ?? [];
    data.lintels = restored[6] ?? [];
    data.stairs = restored[7] ?? [];
    data.voids = restored[8] ?? [];
    layout.demolished = layout.demolished.filter((id) => Number.parseInt(id.slice(1), 10) < data.walls.length);
    afterStructureChange();
    useToastStore().push('已撤销一步户型修改');
    return true;
  }

  /**
   * 导出单个户型（原 `exportPlan`，L2055-2063）。
   * `fmt` 用 SPEC §D.5 冻结的 `huxing-plan-v1`；同时带上**各层布置**（`state` / `states`，OF §7.3），
   * 这两个字段是 SPEC 类型上的**可选补充**（见 `types/persistence.ts`），不影响导入端兼容性。
   */
  function exportPlan(id: string): PlanFile {
    const target = findPlan(id) ?? plan.value;
    const levelCount = target.multilevel && target.levels ? target.levels.length : 1;
    const multi = levelCount > 1;
    const states = Array.from({ length: levelCount }, (_, i) =>
      target.id === currentId.value && i === level.value ? currentLayoutState() : readPlanState(target.id, i, multi),
    );
    return {
      fmt: PLAN_FMT,
      at: new Date().toISOString(),
      plan: stripPlan(target),
      state: states[0] ?? null,
      ...(multi ? { states } : {}),
    };
  }

  /** 导出全部户型（原 `exportAllPlans`，L2064-2072）：内置 + 自定义，含每层布置 */
  function exportAll(): PlanSetFile {
    const entries = allPlans.value.map((p) => {
      const levelCount = p.multilevel && p.levels ? p.levels.length : 1;
      const multi = levelCount > 1;
      const states = Array.from({ length: levelCount }, (_, i) =>
        p.id === currentId.value && i === level.value ? currentLayoutState() : readPlanState(p.id, i, multi),
      );
      return { plan: stripPlan(p), state: states[0] ?? null, ...(multi ? { states } : {}) };
    });
    return {
      fmt: PLAN_SET_FMT,
      at: new Date().toISOString(),
      plans: entries.map((entry) => entry.plan),
      current: currentId.value,
      entries,
    };
  }

  /**
   * 导入文本（原 `importPlanText`，L2073-2096，4 种形态）。
   * 兼容旧键名 `format`（原实现的导出字段）与 `state` / `states`（逐层布置）。
   * @returns 成功导入的户型条数；`0` 表示失败（调用方负责提示原因）
   */
  function importText(txt: string): number {
    let raw: unknown;
    try {
      raw = JSON.parse(txt);
    } catch {
      return 0;
    }
    if (!raw || typeof raw !== 'object') return 0;
    const value = raw as Record<string, unknown>;
    // `{furniture:[...]}` = 布置文件，不是户型文件（原 L2075）
    if (Array.isArray(value.furniture)) return 0;

    interface Entry {
      plan: unknown;
      state?: unknown;
      states?: unknown;
    }
    let list: Entry[] = [];
    if (Array.isArray(raw)) {
      list = (raw as unknown[]).map((item) => ({ plan: item }));
    } else if (Array.isArray(value.plans)) {
      list = (value.plans as unknown[]).map((item) => ({ plan: item }));
    } else if (Array.isArray(value.entries)) {
      list = (value.entries as Entry[]).map((entry) => ({
        plan: (entry as { plan?: unknown }).plan ?? entry,
        state: (entry as { state?: unknown }).state,
        states: (entry as { states?: unknown }).states,
      }));
    } else if (value.plan) {
      list = [{ plan: value.plan, state: value.state, states: value.states }];
    } else if (Array.isArray(value.walls)) {
      list = [{ plan: raw }];
    }
    if (list.length === 0) return 0;

    const imported: Plan[] = [];
    for (const entry of list) {
      const normalized = normalizePlan(entry.plan);
      if (!normalized) continue;
      const plan: Plan = { ...normalized, id: newPlanId(), builtin: false };
      imported.push(plan);
      // 逐层布置：`states` 优先，其次 `state`（原 L2087-2089）
      const states = Array.isArray(entry.states) ? entry.states : null;
      const single = entry.state ?? null;
      const multi = Boolean(plan.multilevel && plan.levels && plan.levels.length > 1);
      const perLevel = states && states.length > 0 ? states : [single];
      perLevel.forEach((state, i) => {
        if (state && typeof state === 'object' && Array.isArray((state as PlanState).furniture)) {
          writePlanState(plan.id, i, multi, fixStateWith(state, { furniture: [], rooms: {}, demolished: [], measures: [] }));
        }
      });
    }
    if (imported.length === 0) return 0;
    custom.value = [...custom.value, ...imported];
    saveLibrary();
    // 原实现导入完成后打开最后一个（L2094）
    const last = imported[imported.length - 1];
    currentId.value = last.id;
    level.value = 0;
    structHistory.value = [];
    layout.loadFor(last.id, 0, isMulti.value);
    return imported.length;
  }

  /**
   * 某户型某层的**初始布置**（等价 `layout.defaultState()` 的规则，用于「无存档」时给出真实默认值）。
   * 供 `readState()`（t6 的方案对比/历史面板）使用：⛔ 组件不得直读 localStorage。
   */
  function planDefaultState(target: Plan, lv: number): PlanState {
    const multi = Boolean(target.multilevel && target.levels && target.levels.length > 0);
    const index = multi && target.levels ? Math.min(Math.max(lv, 0), target.levels.length - 1) : 0;
    const level = (multi && target.levels ? target.levels[index] : target) as Partial<PlanLevel> & PlanStructure;
    const overrides: Record<string, RoomOverride> = {};
    for (const room of level.rooms ?? []) overrides[room.id] = { name: room.name, mat: room.mat };
    const factory = level.furniture ?? target.furn ?? null;
    const furniture =
      typeof factory === 'function'
        ? factory()
        : autoFurnishFurniture(level.rooms ?? [], buildSnapRects(level.walls ?? [], level.wins ?? [], []));
    return { furniture, rooms: overrides, demolished: [], measures: [] };
  }

  /** 当前户型某层的布置存档（归档优先，无归档时给出该户型的初始布置） */
  function readState(planId: string, lv: number, multi: boolean): PlanState {
    const target = findPlan(planId) ?? plan.value;
    const fallback = planDefaultState(target, lv);
    const raw = readPlanState(planId, lv, multi);
    if (raw && typeof raw === 'object' && Array.isArray((raw as PlanState).furniture)) {
      return fixStateWith(raw, fallback);
    }
    return fallback;
  }

  return {
    presets,
    custom,
    currentId,
    level,
    structHistory,
    allPlans,
    plan,
    isMulti,
    levelData,
    levelName,
    walls,
    wins,
    doors,
    slides,
    rooms,
    dims,
    lintels,
    stairs,
    voids,
    bounds,
    findPlan,
    loadFromStorage,
    saveLibrary,
    switchTo,
    switchLevel,
    ensureCustom,
    newBlankPlan,
    duplicatePlan,
    deletePlan,
    renamePlan,
    planEdit,
    planUndo,
    exportPlan,
    exportAll,
    importText,
    readState,
  };
});

export type PlanStore = ReturnType<typeof usePlanStore>;
