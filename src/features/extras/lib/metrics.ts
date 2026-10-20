/**
 * 面积 / 材料 / 拆除长度的**纯函数口径**（逐条对齐 OF §6.2）。
 *
 * 为什么 extras 需要自己实现一份口径（重要，写给 reviewer）：
 * - `stores/layout` 的 getter（`totalArea` / `roomRows` / `materialBreakdown` / `flooringCost` /
 *   `demolishedLength`）**只描述当前打开的户型**；多方案对比（P0-5）与历史快照对比（P0-8）必须
 *   对**任意方案/任意快照**读数，所以这里提供同口径的纯函数实现。
 * - 多边形的**面积数学**不在这里实现：走 three 自带 `ShapeUtils.area()`（鞋带公式，SPEC §B.4 红线 6）。
 * - ⚠️ 一致性待验：t4 落地 store getter 后，两者对同一户型必须给出相同的数（`docs/EXTRAS.md`
 *   §「未验证清单」已登记，交给 t7 用固定样本比对）。
 *
 * 口径出处（OF §6.2）：
 * - 面积：`abs(Σ(x_i·y_{i+1} − x_{i+1}·y_i))/2 / 1e6`（L902）
 * - 套内使用面积：`Σ area(room)`，排除 `counted === false`（L1344/L1368）
 * - 地面材料：`Σ(每种材料面积 × 单价 × 1.05)`（L1372，含 5% 损耗）
 * - 墙面面积：`周长 × 2.8m`，未扣门窗洞口（L1483）
 * - 拆除长度：`Σ max(dx, dy) / 1000`（L1375）
 */
import { ShapeUtils, Vector2 } from 'three';
import { emptyPlanState } from '@/utils/normalize';
import type { Pt } from '@/types/geometry';
import type { PlanDiffSummary } from '@/types/extras';
import type { Furniture } from '@/types/furniture';
import type { MaterialKey } from '@/types/material';
import type { Plan, PlanStructure, Room } from '@/types/plan';
import type { Measure, PlanState, RoomOverride } from '@/types/state';

/** 损耗系数（OF §6.2 L1372） */
export const WASTE_FACTOR = 1.05;

/** 墙面估算高度（m，OF §6.2 L1483） */
export const WALL_HEIGHT_M = 2.8;

export interface LevelInput {
  /** 楼层名（复式；单层为空） */
  name?: string;
  structure: PlanStructure;
  state: PlanState;
}

export interface MetricsInput {
  planId: string;
  planName: string;
  levels: readonly LevelInput[];
  /** 材料单价（元/m²）；**唯一来源**是 `data/materials.ts` 的 `MATS[].price`（t4） */
  priceOf: (key: MaterialKey) => number;
}

/** 布局 store 的只读切片（`liveState()` 用；⛔ 不 import store 实例，只要结构） */
export interface LiveLayoutSlice {
  furniture: readonly Furniture[];
  rooms: Readonly<Record<string, RoomOverride>>;
  demolished: readonly string[];
  measures: readonly Measure[];
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** 多边形面积（m²）：three `ShapeUtils.area()` 返回**有向**面积（鞋带公式），这里取绝对值 */
export function polygonAreaM2(poly: readonly Pt[]): number {
  if (poly.length < 3) return 0;
  const contour = poly.map(([x, y]) => new Vector2(x, y));
  return Math.abs(ShapeUtils.area(contour)) / 1e6;
}

/** 周长（m）：各边 hypot 求和 /1000（OF §6.2 L903） */
export function polygonPerimeterM(poly: readonly Pt[]): number {
  if (poly.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    sum += Math.hypot(x1 - x0, y1 - y0);
  }
  return sum / 1000;
}

/** 房间包围盒的「开间 / 进深」（mm，OF §6.2 L1481-1482） */
export function roomBoxSize(poly: readonly Pt[]): { w: number; h: number } {
  if (poly.length === 0) return { w: 0, h: 0 };
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of poly) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { w: maxX - minX, h: maxY - minY };
}

/** 房间当前材质：存档覆盖优先，其次结构默认（原 `state.rooms[r.id].mat`，L1364/L1370） */
export function roomMaterial(room: Room, state: PlanState): MaterialKey {
  return state.rooms[room.id]?.mat ?? room.mat;
}

/** 房间当前名称：存档覆盖优先（用户改过的名字原样显示，OF §1.10） */
export function roomDisplayName(room: Room, state: PlanState): string {
  return state.rooms[room.id]?.name ?? room.name;
}

/** 单层套内使用面积（m²，排除飘窗） */
export function levelAreaM2(structure: PlanStructure, countedOnly = true): number {
  let sum = 0;
  for (const room of structure.rooms) {
    if (countedOnly && room.counted === false) continue;
    sum += polygonAreaM2(room.poly);
  }
  return round(sum);
}

/** 单层地面材料金额（元，含 5% 损耗；⛔ 含飘窗房间面积，见 OF §6.2 L1370 的原实现） */
export function levelFlooringCost(
  structure: PlanStructure,
  state: PlanState,
  priceOf: (key: MaterialKey) => number,
): number {
  let sum = 0;
  for (const room of structure.rooms) {
    sum += polygonAreaM2(room.poly) * priceOf(roomMaterial(room, state)) * WASTE_FACTOR;
  }
  return Math.round(sum);
}

/** 单层墙面面积（m²，周长 × 2.8，未扣洞口） */
export function levelWallAreaM2(structure: PlanStructure): number {
  let sum = 0;
  for (const room of structure.rooms) sum += polygonPerimeterM(room.poly) * WALL_HEIGHT_M;
  return round(sum);
}

/** 拆除墙体的下标解析：原实现 `+id.slice(1)`（L1374），这里用正则兼容 `w3` / `3` / `wall-3` */
export function wallIndexOf(id: string): number {
  const digits = id.match(/(\d+)/);
  return digits ? Number.parseInt(digits[1], 10) : -1;
}

/** 单层拆除墙体长度（m）：`Σ max(dx, dy) / 1000`（OF §6.2 L1375） */
export function levelDemolitionM(structure: PlanStructure, state: PlanState): number {
  let sum = 0;
  for (const id of state.demolished) {
    const wall = structure.walls[wallIndexOf(id)];
    if (!wall) continue;
    sum += Math.max(Math.abs(wall[2] - wall[0]), Math.abs(wall[3] - wall[1])) / 1000;
  }
  return round(sum);
}

/** 跨层汇总口径（对比 / 图册 / 报价共用） */
export function metricsOf(input: MetricsInput): PlanDiffSummary {
  let totalArea = 0;
  let roomCount = 0;
  let furnitureCount = 0;
  let flooringCost = 0;
  let demolishedLength = 0;
  for (const level of input.levels) {
    const { structure, state } = level;
    roomCount += structure.rooms.length;
    furnitureCount += state.furniture.length;
    demolishedLength += levelDemolitionM(structure, state);
    flooringCost += levelFlooringCost(structure, state, input.priceOf);
    for (const room of structure.rooms) {
      if (room.counted === false) continue;
      totalArea += polygonAreaM2(room.poly);
    }
  }
  return {
    planId: input.planId,
    planName: input.planName,
    totalArea: round(totalArea),
    roomCount,
    furnitureCount,
    flooringCost: Math.round(flooringCost),
    demolishedLength: round(demolishedLength),
  };
}

/** 按方案 + 各层存档组装 `LevelInput[]`（复式逐层，单层一层） */
export function planLevelInputs(plan: Plan, states: readonly PlanState[]): LevelInput[] {
  const levels = plan.multilevel && plan.levels && plan.levels.length > 0 ? plan.levels : null;
  if (!levels) {
    return [{ name: plan.name, structure: plan, state: states[0] ?? emptyPlanState() }];
  }
  return levels.map((level, index) => ({
    name: level.name,
    structure: level,
    state: states[index] ?? emptyPlanState(),
  }));
}

/** 当前方案的**实时**布置状态（对比/历史面板把「未落盘的编辑」也算进去） */
export function liveState(source: LiveLayoutSlice): PlanState {
  return {
    furniture: [...source.furniture],
    rooms: { ...source.rooms },
    demolished: [...source.demolished],
    measures: [...source.measures],
  };
}

/** 相对基准方案填 `delta`（第 1 行为基准；`totalArea` 之类的差量保留两位小数） */
export function diffAgainstBaseline(rows: readonly PlanDiffSummary[]): PlanDiffSummary[] {
  const baseline = rows[0];
  if (!baseline) return [];
  return rows.map((row, index) => {
    if (index === 0) return { ...row };
    return {
      ...row,
      delta: {
        totalArea: round(row.totalArea - baseline.totalArea),
        roomCount: row.roomCount - baseline.roomCount,
        furnitureCount: row.furnitureCount - baseline.furnitureCount,
        flooringCost: Math.round(row.flooringCost - baseline.flooringCost),
        demolishedLength: round(row.demolishedLength - baseline.demolishedLength),
      },
    };
  });
}

/** 表格展示用的「指标 → 值」投影（对比面板 / 差异摘要 / 图册共用同一份顺序） */
export interface MetricField {
  key: 'totalArea' | 'roomCount' | 'furnitureCount' | 'flooringCost' | 'demolishedLength';
  /** i18n key（`cost.*` / `compare.*`） */
  labelKey: string;
  unit: 'm2' | 'count' | 'm' | 'cny';
  digits: number;
}

export const METRIC_FIELDS: readonly MetricField[] = [
  { key: 'totalArea', labelKey: 'cost.netArea', unit: 'm2', digits: 2 },
  { key: 'roomCount', labelKey: 'cost.roomCount', unit: 'count', digits: 0 },
  { key: 'furnitureCount', labelKey: 'cost.furnitureCount', unit: 'count', digits: 0 },
  { key: 'flooringCost', labelKey: 'cost.flooringTotal', unit: 'cny', digits: 0 },
  { key: 'demolishedLength', labelKey: 'cost.demolition', unit: 'm', digits: 2 },
];

export function metricValue(row: PlanDiffSummary, key: MetricField['key']): number {
  return row[key];
}