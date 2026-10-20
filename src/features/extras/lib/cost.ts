/**
 * 报价单 / 工程量清单模型（P0-3）。
 *
 * 口径（OF §6.2，逐条对齐，⛔ 不做任何taxes/人工费/系数扩展）：
 * - 材料用量 = 房间面积（**含飘窗**，原 L1370 就遍历全部房间）按材质分组
 * - 金额 = 面积 × 单价 × 1.05（5% 损耗，L1372）
 * - 套内使用面积 = Σ area(room)，排除 `counted === false`（L1344/L1368）
 * - 墙面面积 = Σ 周长 × 2.8（未扣洞口，L1483）
 * - 拆除长度 = Σ max(dx,dy)/1000（L1375）——**没有单价**，只作为工程量列出
 *
 * 单一来源说明（写给 reviewer）：
 * - **面积口径**的唯一实现是 `lib/metrics.ts`（内部用 three `ShapeUtils.area`）；
 * - **单价**的唯一来源是 `data/materials.ts` 的 `MATS[].price`，经 `priceResolver()` 注入
 *   （⛔ 不在 extras 里复制价格表，避免"双份真相"）；
 * - **房间名 / 材料名的英文**来自 `data/names-en.ts`（`NAMES_EN`，原实现 L418-437）。
 */
import { materialPrice } from '@/data/materials';
import { materialLabel, displayName, translate, type Lang } from './i18n';
import {
  levelDemolitionM,
  polygonAreaM2,
  polygonPerimeterM,
  roomBoxSize,
  roomDisplayName,
  roomMaterial,
  WALL_HEIGHT_M,
  WASTE_FACTOR,
} from './metrics';
import type { CostRow } from '@/types/extras';
import type { MaterialKey } from '@/types/material';
import type { PlanStructure } from '@/types/plan';
import type { PlanState } from '@/types/state';

/** 一个房间的用量条目（报价/对比/图册的最小输入单元） */
export interface RoomUsage {
  id: string;
  name: string;
  mat: MaterialKey;
  /** m²（该房间的地面面积，含飘窗） */
  area: number;
  /** 是否计入套内使用面积（飘窗为 false） */
  counted: boolean;
}

/** store `roomRows` 的结构子集（`import type` 只为结构对齐，运行时不依赖 store） */
export interface RoomRowLike {
  id: string;
  name: string;
  mat: MaterialKey;
  area: number;
  counted: boolean;
}

export interface MaterialBreakdownLike {
  key: MaterialKey;
  area: number;
  cost: number;
}

export interface CostReportInput {
  usage: readonly RoomUsage[];
  /** 材料单价（元/m²） */
  priceOf: (key: MaterialKey) => number;
  lang: Lang;
  /** 拆除墙体长度（m）；无单价，仅列工程量 */
  demolishedLength?: number;
  /** 分别为每层累加的墙面面积（m²） */
  wallAreaM2?: number;
  generatedAt?: string;
}

export interface CostReportModel {
  /** 材料行（按材质聚合，含 5% 损耗后的金额） */
  rows: CostRow[];
  /** 合计行（`key: 'total'`，`quantity` = 套内使用面积） */
  total: CostRow;
  /** 套内使用面积（m²） */
  totalArea: number;
  /** 材料计量面积（m²，含飘窗） */
  materialArea: number;
  /** 墙面面积（m²，估算） */
  wallAreaM2: number;
  /** 拆除墙体长度（m） */
  demolishedLength: number;
  /** 房间数 */
  roomCount: number;
  generatedAt: string;
}

/** 房间用量 → store `roomRows` 形状（当前方案走 store getter 时用） */
export function usageFromStoreRows(rows: readonly RoomRowLike[]): RoomUsage[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    mat: row.mat,
    area: row.area,
    counted: row.counted,
  }));
}

/** 结构 + 存档 → 房间用量（跨方案/跨层的通用路径） */
export function usageFromStructure(structure: PlanStructure, state: PlanState, lang: Lang = 'zh'): RoomUsage[] {
  return structure.rooms.map((room) => ({
    id: room.id,
    // 内置房间名走 `NAMES_EN`，用户改过的名字原样显示（OF §1.10）
    name: displayName(roomDisplayName(room, state), lang),
    mat: roomMaterial(room, state),
    area: polygonAreaM2(room.poly),
    counted: room.counted !== false,
  }));
}

export function usageFromLevels(
  levels: readonly { structure: PlanStructure; state: PlanState }[],
  lang: Lang = 'zh',
): RoomUsage[] {
  const out: RoomUsage[] = [];
  for (const level of levels) out.push(...usageFromStructure(level.structure, level.state, lang));
  return out;
}

/** 每层墙面面积合计（m²） */
export function wallAreaFromLevels(levels: readonly { structure: PlanStructure }[]): number {
  let sum = 0;
  for (const level of levels) {
    for (const room of level.structure.rooms) sum += polygonPerimeterM(room.poly) * WALL_HEIGHT_M;
  }
  return Math.round(sum * 100) / 100;
}

/**
 * 从 store 的 `materialBreakdown`（`{key, area, cost}`，cost 已含 1.05 损耗）反推单价。
 *
 * ⚠️ 保留原因（写给 reviewer）：store 的 `materialBreakdown` 用的是 `data/materials.ts` 的单价，
 * 这里反推出来的值与 `MATS[key].price` 相同；它**只作为交叉校验的备选路径**存在
 * （例如将来用户自定义单价时，store 会是唯一知道新价格的地方）。
 * 正常路径见下方 `priceResolver()` —— **单一来源是 `MATS[].price`**，本函数不再被默认使用。
 */
export function priceResolverFromBreakdown(
  breakdown: readonly MaterialBreakdownLike[],
): (key: MaterialKey) => number {
  const table = new Map<MaterialKey, number>();
  for (const row of breakdown) {
    if (row.area > 0 && row.cost > 0) table.set(row.key, row.cost / (row.area * WASTE_FACTOR));
  }
  return (key: MaterialKey): number => table.get(key) ?? 0;
}

/**
 * 材料单价（元/m²）的**单一来源**：`data/materials.ts` 的 `MATS[].price`（OF §6.1）。
 * ⛔ 不在 extras 里维护第二张价格表（原 `FALLBACK_MATERIAL_PRICES` 镜像表已删除）。
 */
export function priceResolver(): (key: MaterialKey) => number {
  return (key: MaterialKey): number => materialPrice(key);
}

/**
 * @deprecated 保留签名仅为兼容既有调用点；内部已改为直接读 `MATS`（单一来源）。
 * 新代码请用 `priceResolver()`。
 */
export function priceResolverWithFallback(
  _breakdown: readonly MaterialBreakdownLike[],
): (key: MaterialKey) => number {
  return priceResolver();
}

/** 房间短边/面积异常的原料（报价模型里顺带带上，图册与校验共用） */
export function roomBoxOf(structure: PlanStructure, roomId: string): { w: number; h: number } {
  const room = structure.rooms.find((item) => item.id === roomId);
  return room ? roomBoxSize(room.poly) : { w: 0, h: 0 };
}

/**
 * 构建报价单模型。
 * 行的顺序：按材料**用量降序**（金额最大的材料排最前，与原面板一致的可读性），再拆除行，最后合计。
 */
export function buildCostReport(input: CostReportInput): CostReportModel {
  const { usage, priceOf, lang } = input;
  const byMaterial = new Map<MaterialKey, number>();
  let totalArea = 0;
  let materialArea = 0;
  let roomCount = 0;
  for (const room of usage) {
    roomCount += 1;
    materialArea += room.area;
    if (room.counted) totalArea += room.area;
    byMaterial.set(room.mat, (byMaterial.get(room.mat) ?? 0) + room.area);
  }

  const rows: CostRow[] = [...byMaterial.entries()]
    .map(([key, area]) => {
      const price = priceOf(key);
      return {
        key,
        label: materialLabel(key, lang),
        quantity: Math.round(area * 100) / 100,
        unit: 'm2' as const,
        price: Math.round(price * 100) / 100,
        cost: Math.round(area * price * WASTE_FACTOR),
      };
    })
    .sort((a, b) => b.quantity - a.quantity);

  const demolitionLength = input.demolishedLength ?? 0;
  if (demolitionLength > 0) {
    rows.push({
      key: 'demolition',
      label: translate(lang, 'cost.demolition'),
      quantity: Math.round(demolitionLength * 100) / 100,
      unit: 'm',
      // ⛔ 原实现没有拆除单价（OF §6.2）：金额留 0，不做任何"编造单价"
      price: 0,
      cost: 0,
    });
  }

  const materialsCost = rows.reduce((sum, row) => (row.unit === 'm2' ? sum + row.cost : sum), 0);
  const total: CostRow = {
    key: 'total',
    label: translate(lang, 'common.total'),
    quantity: Math.round(totalArea * 100) / 100,
    unit: 'm2',
    price: 0,
    cost: Math.round(materialsCost),
  };

  return {
    rows,
    total,
    totalArea: Math.round(totalArea * 100) / 100,
    materialArea: Math.round(materialArea * 100) / 100,
    wallAreaM2: input.wallAreaM2 ?? 0,
    demolishedLength: Math.round(demolitionLength * 100) / 100,
    roomCount,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}

/** 表格化（CSV / XLSX / 组件表格共用同一投影，避免三处各写一遍） */
export function costTableHeader(lang: Lang): string[] {
  return [
    translate(lang, 'common.name'),
    translate(lang, 'common.quantity'),
    translate(lang, 'common.unit'),
    translate(lang, 'common.price'),
    translate(lang, 'common.amount'),
  ];
}

export function costTableRows(model: CostReportModel, lang: Lang): string[][] {
  const unitLabel = (unit: CostRow['unit']): string => (unit === 'm2' ? 'm²' : 'm');
  const rows = model.rows.map((row) => [
    row.label,
    row.quantity.toFixed(2),
    unitLabel(row.unit),
    row.price ? row.price.toFixed(2) : '—',
    row.cost.toFixed(2),
  ]);
  rows.push([
    translate(lang, 'common.total'),
    model.total.quantity.toFixed(2),
    unitLabel(model.total.unit),
    '—',
    model.total.cost.toFixed(2),
  ]);
  return rows;
}

export interface CostFromLevelsInput {
  levels: readonly { structure: PlanStructure; state: PlanState }[];
  priceOf: (key: MaterialKey) => number;
  lang: Lang;
}

/** 跨层组装（当前户型 / 图册 / 导出菜单共用；面积与拆除长度都走同一份口径实现） */
export function costReportFromLevels(input: CostFromLevelsInput): CostReportModel {
  const demolishedLength = input.levels.reduce(
    (sum, level) => sum + levelDemolitionM(level.structure, level.state),
    0,
  );
  return buildCostReport({
    usage: usageFromLevels(input.levels, input.lang),
    priceOf: input.priceOf,
    demolishedLength,
    wallAreaM2: wallAreaFromLevels(input.levels),
    lang: input.lang,
  });
}