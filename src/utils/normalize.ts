/**
 * 户型 / 布置数据的纯函数规范化（SPEC §C.1；OF §4.3；X8 / 待确认项 U1）。
 *
 * 与原实现的一处**有意差异**（X8 不保留项）：`fixState` ⛔ 不再 `Object.assign(d.rooms, s.rooms)` 就地改默认表。
 * 这里拆成两个纯函数：
 * - `fixState(raw)`：以**空表**打底，坏数据不抛错（store 的 `fixState` 契约，SPEC §D.6）；
 * - `fixStateWith(raw, defaults)`：以调用方给的默认表打底（= 原 `fixState` 的「默认房间表 + 存档覆盖」语义，
 *   由 `layout.loadFor()` 传入 `defaultState()`）。
 *
 * `normalizePlan` 是**导入/复制的唯一入口**（原 L1916-1960），逐条保留其清洗规则：
 * 非法项直接丢弃、数值统一兜底 0、`rooms[].mat` 必须命中 `MATS`、`levels` 递归复用同一套清洗。
 */
import { DEFAULT_MATERIAL, toMaterialKey } from '@/data/materials';
import { newPlanId } from '@/utils/id';
import type { Door, Plan, PlanLevel, PlanStructure, Room, Slide, Wall, Win } from '@/types/plan';
import type { PlanState } from '@/types/state';

/** 空结构（所有数组为空、`bounds` 为 null） */
export function emptyStructure(): PlanStructure {
  return {
    bounds: null,
    walls: [],
    wins: [],
    doors: [],
    slides: [],
    rooms: [],
    dims: [],
    lintels: [],
    stairs: [],
    voids: [],
  };
}

/** 空布置存档（`layout.defaultState()` 的纯函数版本） */
export function emptyPlanState(): PlanState {
  return { furniture: [], rooms: {}, demolished: [], measures: [] };
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function numTuple(value: unknown, length: number): number[] {
  const list = Array.isArray(value) ? value : [];
  const out: number[] = [];
  for (let i = 0; i < length; i += 1) out.push(num(list[i]));
  return out;
}

/**
 * 存储/导入读出的任意值 → 合法 `PlanState`（永不抛错）。
 * @param defaults 打底值（缺省空表）。原 `fixState` 语义：默认房间表为底、存档覆盖；
 *                 已删房间会保留在存档里（OF §4.3 第 5 条，这是特性不是 bug）。
 */
export function fixStateWith(raw: unknown, defaults: PlanState = emptyPlanState()): PlanState {
  if (!raw || typeof raw !== 'object') return { ...defaults, rooms: { ...defaults.rooms } };
  const value = raw as Partial<PlanState>;
  const rooms =
    value.rooms && typeof value.rooms === 'object'
      ? { ...defaults.rooms, ...(value.rooms as Record<string, never>) }
      : { ...defaults.rooms };
  return {
    furniture: Array.isArray(value.furniture) ? value.furniture : defaults.furniture,
    rooms,
    demolished: Array.isArray(value.demolished) ? [...value.demolished] : defaults.demolished,
    measures: Array.isArray(value.measures) ? value.measures : defaults.measures,
  };
}

/** 以空表打底（SPEC §D.6 的 `fixState(raw)` 契约） */
export function fixState(raw: unknown): PlanState {
  return fixStateWith(raw, emptyPlanState());
}

function parseWalls(value: unknown): Wall[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((w) => Array.isArray(w) && w.length >= 4)
    .map((w) => {
      const raw = w as unknown[];
      const kind = (raw[4] as Wall[4]) ?? 'n';
      return [num(raw[0]), num(raw[1]), num(raw[2]), num(raw[3]), kind] as Wall;
    });
}

function parseWins(value: unknown): Win[] {
  if (!Array.isArray(value)) return [];
  return value.filter(Array.isArray).map((w) => {
    const raw = w as unknown[];
    return [
      num(raw[0]),
      num(raw[1]),
      num(raw[2]),
      num(raw[3]),
      raw[4] === undefined || raw[4] === null ? undefined : num(raw[4]),
      raw[5] === undefined || raw[5] === null ? undefined : num(raw[5]),
    ] as Win;
  });
}

function parseDoors(value: unknown): Door[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((d): d is Record<string, unknown> => Boolean(d) && typeof d === 'object' && Array.isArray((d as Door).rect) && Array.isArray((d as Door).h))
    .map((d) => ({
      name: String(d.name || '门'),
      rect: numTuple(d.rect, 4) as Door['rect'],
      h: numTuple(d.h, 2) as Door['h'],
      c: numTuple(d.c ?? [1, 0], 2) as Door['c'],
      o: numTuple(d.o ?? [0, 1], 2) as Door['o'],
      len: num(d.len) || 900,
      entry: Boolean(d.entry),
    }));
}

function parseSlides(value: unknown): Slide[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((d): d is Record<string, unknown> => Boolean(d) && typeof d === 'object' && Array.isArray((d as Slide).rect))
    .map((d) => ({ rect: numTuple(d.rect, 4) as Slide['rect'], v: Boolean(d.v) }));
}

function parseRooms(value: unknown): Room[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object' && Array.isArray((r as Room).poly) && ((r as Room).poly as unknown[]).length >= 3)
    .map((r, i) => {
      const poly = (r.poly as unknown[]).map((q) => {
        const pair = Array.isArray(q) ? q : [];
        return [num(pair[0]), num(pair[1])] as Room['poly'][number];
      });
      return {
        id: r.id ? String(r.id) : `r${i}${Date.now().toString(36).slice(-4)}`,
        name: String(r.name || `房间${i + 1}`),
        poly,
        mat: toMaterialKey(r.mat),
        at: Array.isArray(r.at) ? ([num((r.at as unknown[])[0]), num((r.at as unknown[])[1])] as Room['at']) : undefined,
        counted: r.counted === false ? false : undefined,
      };
    });
}

/**
 * 任意输入 → `Plan | null`（导入边界校验，原 L1916-1960）。
 * 返回的对象**一定**带 `builtin: false`：外部数据永远不算内置户型。
 */
export function normalizePlan(raw: unknown): Plan | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown> & Partial<Plan>;
  const isLevels = Array.isArray(p.levels) && p.levels.length > 0;
  if (!isLevels && !Array.isArray(p.walls) && !Array.isArray(p.rooms)) return null;

  const bounds =
    p.bounds && typeof p.bounds === 'object' && Number.isFinite((p.bounds as { w?: unknown }).w)
      ? (p.bounds as Plan['bounds'])
      : null;

  const base: Plan = {
    id: p.id ? String(p.id) : newPlanId(),
    name: String(p.name || '未命名户型'),
    tag: String(p.tag ?? ''),
    builtin: false,
    bounds,
    walls: parseWalls(p.walls),
    wins: parseWins(p.wins),
    doors: parseDoors(p.doors),
    slides: parseSlides(p.slides),
    rooms: parseRooms(p.rooms),
    dims: Array.isArray(p.dims) ? (p.dims as Plan['dims']) : [],
    lintels: Array.isArray(p.lintels) ? (p.lintels as Plan['lintels']) : [],
    stairs: Array.isArray(p.stairs) ? (p.stairs as Plan['stairs']) : [],
    voids: Array.isArray(p.voids) ? (p.voids as Plan['voids']) : [],
  };

  if (isLevels) {
    const levels: PlanLevel[] = (p.levels as unknown[]).map((level, i) => {
      const cleaned = normalizePlan({ ...(level as object), name: 'x' });
      const source = level as Partial<PlanLevel>;
      const name = String(source.name || `第${i + 1}层`);
      const elev = Number.isFinite(Number(source.elev)) ? Number(source.elev) : i * 2.9;
      if (!cleaned) {
        return { name, elev, ...emptyStructure(), furniture: null } as PlanLevel;
      }
      const { id: _id, name: _name, tag: _tag, builtin: _builtin, levels: _levels, furn: _furn, ...structure } = cleaned;
      return {
        name,
        elev,
        ...structure,
        bounds: source.bounds ?? null,
        furniture: null,
      } as PlanLevel;
    });
    base.multilevel = true;
    base.levels = levels;
    // 顶层结构清空：切层后显示的是 `levels[level]`（原 L1957）
    base.walls = [];
    base.rooms = [];
  }

  return base;
}

/** 导出白名单（原 `PLAN_KEYS`，L2049） */
export const PLAN_KEYS = [
  'id',
  'name',
  'tag',
  'bounds',
  'walls',
  'wins',
  'doors',
  'slides',
  'rooms',
  'dims',
  'lintels',
  'stairs',
  'voids',
  'multilevel',
] as const;

/**
 * 导出前剥离：只保留白名单字段 + 逐层剥离（原 `stripPlan`，L2050-2054）。
 * ⛔ 只存在于内存的 `furn`（家具工厂）与每层 `furniture` 工厂不得落盘（OF §7.3）。
 */
export function stripPlan(plan: Plan): Plan {
  const source = plan as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of PLAN_KEYS) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  if (plan.multilevel && Array.isArray(plan.levels)) {
    out.levels = plan.levels.map((level) => {
      const levelSource = level as unknown as Record<string, unknown>;
      const one: Record<string, unknown> = {};
      for (const key of PLAN_KEYS) {
        if (levelSource[key] !== undefined) one[key] = levelSource[key];
      }
      return one;
    });
  }
  return out as unknown as Plan;
}

/** 材质兜底导出（供测试与面板使用，避免各处重复写 `'tile800'`） */
export const FALLBACK_MATERIAL = DEFAULT_MATERIAL;