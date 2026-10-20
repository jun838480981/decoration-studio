/**
 * 布置 store（SPEC §D.6 🔒 冻结）。
 *
 * = 原实现的 `state`（furniture / rooms 覆盖 / demolished / measures）+ 布置撤销栈（原 L1021-1028）。
 * 双栈隔离是硬约束：本文件只有**布置栈 150**，结构栈 80 在 `stores/plan.ts`（OF §1.8、RISK-02 的姊妹风险）。
 *
 * 几何口径（`snapRects` / `totalArea` / `roomRows` / `materialBreakdown` / `flooringCost` /
 * `demolishedLength`）与 `autoFurnish` / `pushOut` / `toggleWall` 已由 **t4** 按 OF §6.2 落地；
 * 纯函数部分在 `utils/measure.ts` / `utils/geometry.ts` / `utils/auto-furnish.ts`，本文件只做 store 绑定。
 */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { autoFurnishFurniture } from '@/utils/auto-furnish';
import { snapRects as buildSnapRects, pushOut as pushOutFurniture } from '@/utils/geometry';
import { demolishedLength as lengthOfDemolished, flooringCost as sumCost, materialBreakdown as breakdownOf, roomRows as rowsOf, totalArea as sumArea } from '@/utils/measure';
import { fixState as normalizeState, fixStateWith } from '@/utils/normalize';
import { readPlanState, stateKey, stateKeyOf, STORAGE_KEYS, writeJson } from '@/utils/persistence';
import { uid } from '@/utils/id';
import { usePlanStore } from './plan';
import { useToastStore } from './toast';
import { useUiStore } from './ui';
import type { Rect } from '@/types/geometry';
import type { Furniture, LibItem } from '@/types/furniture';
import type { MaterialKey } from '@/types/material';
import type { PlanLevel } from '@/types/plan';
import type { SaveStatus } from '@/types/persistence';
import type { PlanState, Measure, RoomOverride } from '@/types/state';
import type { Vec2 } from '@/types/geometry';
import type { RoomRow } from '@/utils/measure';

export type { RoomRow };

/** 布置撤销栈上限（原 L1025） */
export const UNDO_LIMIT = 150;

/** 旧键（原 L983）：**必须继续写入**以兼容回退（OF §9.5 风险 5 / ADR-05） */
export const LEGACY_STORE_KEY = STORAGE_KEYS.legacyState;

/** 单层布置存档键（原 `stateKey`，L609） */
export { stateKey, stateKeyOf };

export const useLayoutStore = defineStore('layout', () => {
  // ⚠️ ⛔ 不得在 setup 顶层调用 `usePlanStore()`：`stores/plan.ts` 已在 setup 顶层 `useLayoutStore()`，
  // 双向 setup 调用会无限递归（t3 留下的 store 依赖方向）。所有跨 store 访问一律**放进函数体内**（惰性）。
  // ---- state（= PlanState） ----
  const furniture = ref<Furniture[]>([]);
  const rooms = ref<Record<string, RoomOverride>>({});
  const demolished = ref<string[]>([]);
  const measures = ref<Measure[]>([]);
  const undoStack = ref<string[]>([]);
  const redoStack = ref<string[]>([]);

  // 非冻结的内部记账：save()/loadFor() 需要知道「当前是哪个户型哪一层」
  // （原实现在全局 `PLAN.id` / `lv` 上读，X2 之后不再有全局，故显式记录）
  const currentPlanId = ref<string>('');
  const currentLevel = ref<number>(0);
  const currentMulti = ref<boolean>(false);

  // ---- getters ----
  function getF(id: string): Furniture | undefined {
    return furniture.value.find((f) => f.id === id);
  }

  /** 未拆墙 + 窗（原 L908）：家具贴边吸附与测量端点的吸附源 */
  const snapRects = computed<Rect[]>(() => {
    const plan = usePlanStore();
    return buildSnapRects(plan.walls, plan.wins, demolished.value);
  });

  /** Σ area(room)，排除 `counted === false`（原 L1368 / L1344） */
  const totalArea = computed<number>(() => sumArea(usePlanStore().rooms));

  /** 房间清单（名称/材质/面积/是否计入；用户覆盖优先） */
  const roomRows = computed<RoomRow[]>(() => rowsOf(usePlanStore().rooms, rooms.value));

  /** 材料用量与金额（×1.05 损耗，原 L1369-1373；**含飘窗**） */
  const materialBreakdown = computed<{ key: MaterialKey; area: number; cost: number }[]>(() =>
    breakdownOf(usePlanStore().rooms, rooms.value).map(({ key, area, cost }) => ({ key, area, cost })),
  );

  /** 地面材料合计（元，原 L1372-1373 的累加值） */
  const flooringCost = computed<number>(() => sumCost(materialBreakdown.value));

  /** Σ max(dx,dy)/1000 米（原 L1375） */
  const demolishedLength = computed<number>(() => lengthOfDemolished(usePlanStore().walls, demolished.value));

  const canUndo = computed<boolean>(() => undoStack.value.length > 0);
  const canRedo = computed<boolean>(() => redoStack.value.length > 0);

  // ---- actions ----

  function stateSnapshot(): PlanState {
    return {
      furniture: furniture.value,
      rooms: rooms.value,
      demolished: demolished.value,
      measures: measures.value,
    };
  }

  /** `JSON.stringify(state)`（原 L1024） */
  function snapshot(): string {
    return JSON.stringify(stateSnapshot());
  }

  function applyState(state: PlanState): void {
    furniture.value = state.furniture;
    rooms.value = state.rooms;
    demolished.value = state.demolished;
    measures.value = state.measures;
  }

  /** 压栈 + 清 redo + 落盘（原 L1025） */
  function commit(before: string): void {
    undoStack.value = [...undoStack.value, before].slice(-UNDO_LIMIT);
    redoStack.value = [];
    void save();
  }

  /** snapshot → fn → commit（原 L1026） */
  function mutate(fn: () => void): void {
    const before = snapshot();
    fn();
    commit(before);
  }

  function undo(): boolean {
    const previous = undoStack.value[undoStack.value.length - 1];
    if (!previous) return false;
    redoStack.value = [...redoStack.value, snapshot()];
    undoStack.value = undoStack.value.slice(0, -1);
    applyState(JSON.parse(previous) as PlanState);
    validateSel();
    void save();
    return true;
  }

  function redo(): boolean {
    const next = redoStack.value[redoStack.value.length - 1];
    if (!next) return false;
    undoStack.value = [...undoStack.value, snapshot()];
    redoStack.value = redoStack.value.slice(0, -1);
    applyState(JSON.parse(next) as PlanState);
    validateSel();
    void save();
    return true;
  }

  /** 撤销/重做后清理失效选中（原 `validateSel`，L1029） */
  function validateSel(): void {
    const ui = useUiStore();
    if (ui.selection?.kind === 'furn' && !getF(ui.selection.id)) ui.selection = null;
  }

  /**
   * 落盘：**同时**写 `stateKeyOf(...)` 与旧键（原 L1023 语义）。
   * ⛔ 不再静默吞错：配额超限时返回 `'quota'` 供 UI 提示（X11 / RISK-10）。
   */
  async function save(): Promise<SaveStatus> {
    const payload = stateSnapshot();
    const primary = writeJson(stateKeyOf(currentPlanId.value, currentLevel.value, currentMulti.value), payload);
    const legacy = writeJson(LEGACY_STORE_KEY, payload);
    if (primary === 'quota' || legacy === 'quota') return 'quota';
    if (primary === 'error' && legacy === 'error') return 'error';
    return 'ok';
  }

  /**
   * 切户型/切层时装载（原 `switchPlan` L1968 的 `state = load() || defaultState()`）。
   * - 存档存在且 `furniture` 是数组 → `fixStateWith(存档, defaultState())`（默认房间表打底、存档覆盖）；
   * - 否则用 `defaultState()`（含内置户型的手工布置 / 自动布置）。
   */
  function loadFor(planId: string, lv: number, multi: boolean): void {
    currentPlanId.value = planId;
    currentLevel.value = lv;
    currentMulti.value = multi;
    const stored = readPlanState(planId, lv, multi);
    const usable = stored && typeof stored === 'object' && Array.isArray((stored as PlanState).furniture);
    applyState(usable ? fixStateWith(stored, defaultState()) : defaultState());
    undoStack.value = [];
    redoStack.value = [];
  }

  /**
   * 该户型（当前层）的初始布置（原 `defaultState`，L976-981）。
   * 优先级：当前层的 `furniture` 工厂 → 户型级 `furn` 工厂 → `autoFurnish()`。
   */
  function defaultState(): PlanState {
    const plan = usePlanStore();
    const overrides: Record<string, RoomOverride> = {};
    for (const room of plan.rooms) overrides[room.id] = { name: room.name, mat: room.mat };
    const level = plan.levelData as Partial<PlanLevel>;
    const factory = level.furniture ?? plan.plan.furn ?? null;
    const furniture = typeof factory === 'function' ? factory() : autoFurnishFurniture(plan.rooms, snapRects.value);
    return { furniture, rooms: overrides, demolished: [], measures: [] };
  }

  /** 纯函数版本（X8：⛔ 不得就地改默认表）；空表打底，符合 SPEC §D.6 的 `fixState(raw)` 契约 */
  function fixState(raw: unknown): PlanState {
    return normalizeState(raw);
  }

  /** 只保留当前户型仍存在的房间 id；用户改过的名称/材质优先保留（原 L996-1000） */
  function syncRoomState(): void {
    const plan = usePlanStore();
    const valid = new Set(plan.rooms.map((r) => r.id));
    const next: Record<string, RoomOverride> = {};
    for (const [id, override] of Object.entries(rooms.value)) {
      if (valid.has(id)) next[id] = { ...override };
    }
    for (const room of plan.rooms) {
      if (!next[room.id]) next[room.id] = { name: room.name, mat: room.mat };
    }
    rooms.value = next;
  }

  /**
   * 一键自动布置（原 L2522：`state.furniture = autoFurnish()` 后 `commit(before)`）。
   * 规则引擎在 `utils/auto-furnish.ts`（2D 侧同名入口 `features/plan2d/auto-furnish.ts`）。
   */
  function autoFurnish(): void {
    const plan = usePlanStore();
    const rects = buildSnapRects(plan.walls, plan.wins, demolished.value);
    mutate(() => {
      furniture.value = autoFurnishFurniture(plan.rooms, rects);
    });
  }

  /** 新增家具（原 `addItem`，L1556-1562）：坐标取整 10mm、`pushOut()` 防穿墙、地毯压到最底层 */
  function addItem(item: LibItem, x: number, y: number): Furniture {
    const [type, name, w, d, color] = item;
    const created: Furniture = {
      id: uid(),
      type,
      name,
      cx: Math.round(x / 10) * 10,
      cy: Math.round(y / 10) * 10,
      w,
      d,
      rot: 0,
      color,
    };
    pushOutFurniture(created, snapRects.value);
    mutate(() => {
      furniture.value = type === 'rug' ? [created, ...furniture.value] : [...furniture.value, created];
    });
    const ui = useUiStore();
    ui.select({ kind: 'furn', id: created.id });
    useToastStore().push(`已添加「${name}」${w}×${d}`);
    return created;
  }

  /** 推出重叠（原 L1543-1555）：把家具推到最近的贴边位置，最多 4 轮 */
  function pushOut(f: Furniture): void {
    pushOutFurniture(f, snapRects.value);
  }

  /**
   * 拆改非承重墙（原 L1563-1570 的四个 toast 分支）。
   * 承重墙（`b`）与外墙（`e`）拒绝；`n` / `low` 可拆。返回值语义见 SPEC §D.6。
   */
  function toggleWall(id: string): 'removed' | 'restored' | 'blocked-bearing' | 'blocked-exterior' {
    const plan = usePlanStore();
    const index = Number.parseInt(id.replace(/^\D+/, ''), 10);
    const wall = Number.isFinite(index) ? plan.walls[index] : undefined;
    // 找不到对应墙体（结构已变）→ 视作「已恢复」，不写坏数据
    if (!wall) return 'restored';
    if (wall[4] === 'b') return 'blocked-bearing';
    if (wall[4] === 'e') return 'blocked-exterior';
    const on = demolished.value.includes(id);
    mutate(() => {
      demolished.value = on ? demolished.value.filter((x) => x !== id) : [...demolished.value, id];
    });
    return on ? 'restored' : 'removed';
  }

  /** 清空布置（原 `clearLayout`，L1436-1442：确认在 UI，这里只做数据）；无可清空内容时返回 `false` */
  function clearLayout(): boolean {
    if (furniture.value.length === 0) return false;
    mutate(() => {
      furniture.value = [];
    });
    useUiStore().select(null);
    return true;
  }

  function selectedFurniture(): Furniture | undefined {
    const ui = useUiStore();
    const selection = ui.selection;
    return selection && selection.kind === 'furn' ? getF(selection.id) : undefined;
  }

  function rotateSelection(delta: number): void {
    const target = selectedFurniture();
    if (!target) return;
    mutate(() => {
      target.rot = ((target.rot + delta) % 360 + 360) % 360;
    });
  }

  function deleteSelection(): void {
    const ui = useUiStore();
    const target = selectedFurniture();
    if (target) {
      mutate(() => {
        furniture.value = furniture.value.filter((f) => f.id !== target.id);
      });
    }
    ui.select(null);
  }

  function duplicateSelection(): Furniture | null {
    const target = selectedFurniture();
    if (!target) return null;
    const copy: Furniture = { ...target, id: uid(), cx: target.cx + 200, cy: target.cy + 200 };
    mutate(() => {
      furniture.value = [...furniture.value, copy];
    });
    return copy;
  }

  function nudgeSelection(dx: number, dy: number): void {
    const target = selectedFurniture();
    if (!target) return;
    mutate(() => {
      target.cx += dx;
      target.cy += dy;
    });
  }

  function bringToFront(id: string): void {
    const target = getF(id);
    if (!target) return;
    mutate(() => {
      furniture.value = [...furniture.value.filter((f) => f.id !== id), target];
    });
  }

  function sendToBack(id: string): void {
    const target = getF(id);
    if (!target) return;
    mutate(() => {
      furniture.value = [target, ...furniture.value.filter((f) => f.id !== id)];
    });
  }

  /** 房间选中（ui 联动由调用方负责，SPEC §D.6） */
  function selectRoom(id: string): void {
    const plan = usePlanStore();
    const room = plan.rooms.find((r) => r.id === id);
    if (!room) return;
    if (!rooms.value[id]) {
      rooms.value = { ...rooms.value, [id]: { name: room.name, mat: room.mat } };
    }
  }

  function renameRoom(id: string, name: string): void {
    const current = rooms.value[id];
    if (!current) return;
    const next = name.trim();
    if (!next) return;
    mutate(() => {
      rooms.value = { ...rooms.value, [id]: { ...current, name: next } };
    });
  }

  function setRoomMaterial(id: string, mat: MaterialKey): void {
    const current = rooms.value[id];
    if (!current) return;
    mutate(() => {
      rooms.value = { ...rooms.value, [id]: { ...current, mat } };
    });
  }

  function pushMeasure(a: Vec2, b: Vec2): void {
    mutate(() => {
      measures.value = [...measures.value, { a, b }];
    });
  }

  function clearMeasures(): void {
    if (measures.value.length === 0) return;
    mutate(() => {
      measures.value = [];
    });
  }

  return {
    furniture,
    rooms,
    demolished,
    measures,
    undoStack,
    redoStack,
    getF,
    snapRects,
    totalArea,
    roomRows,
    materialBreakdown,
    flooringCost,
    demolishedLength,
    canUndo,
    canRedo,
    snapshot,
    commit,
    mutate,
    undo,
    redo,
    save,
    loadFor,
    defaultState,
    fixState,
    syncRoomState,
    autoFurnish,
    addItem,
    pushOut,
    toggleWall,
    clearLayout,
    rotateSelection,
    deleteSelection,
    duplicateSelection,
    nudgeSelection,
    bringToFront,
    sendToBack,
    selectRoom,
    renameRoom,
    setRoomMaterial,
    pushMeasure,
    clearMeasures,
  };
});

export type LayoutStore = ReturnType<typeof useLayoutStore>;
