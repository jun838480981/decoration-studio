/**
 * 算量与报价口径（SPEC §C.1 / OF §6.2，逐条对齐原 `装修设计.html` L1368-1383、L1481-1510）。
 *
 * **口径是业务资产，必须逐字保留**（SPEC §B.4「必须自研」清单）：
 *
 * | 指标 | 公式 | 原证据 |
 * | --- | --- | --- |
 * | 多边形面积 m² | 鞋带公式（`utils/geometry.area`） | L902 |
 * | 套内使用面积 | `Σ area(room)`，**排除** `counted === false` | L1368 |
 * | 地面材料合计 | `Σ (材料面积 × 单价 × 1.05)`，含 5% 损耗；**飘窗也计入材料用量** | L1369-1373 |
 * | 单房间材料估价 | `area × price × 1.05` | L1485 |
 * | 墙面面积（估算） | `周长 × 2.8m`，**未扣门窗洞口** | L1483 |
 * | 家具占地面积 | `w × d / 1e6` | L1509 |
 * | 拆除墙体长度 | `Σ max(dx, dy) / 1000` 米 | L1375 |
 * | 房间开间 / 进深 | 包围盒 `x1-x0` / `y1-y0`（mm） | L1481-1482 |
 *
 * ⛔ 不得引入税费、人工费、辅料或其它系数（OF §6.2 末条：原实现没有）。
 */
import { MATS, materialPrice } from '@/data/materials';
import { area, bbox, perim, type PointLike } from '@/utils/geometry';
import type { Furniture } from '@/types/furniture';
import type { MaterialKey } from '@/types/material';
import type { Room, Wall } from '@/types/plan';
import type { RoomOverride } from '@/types/state';

/** 5% 损耗（原 L1372 的 `*1.05`） */
export const LOSS_FACTOR = 1.05;

/** 墙面面积估算高度（m，原 L1483） */
export const WALL_HEIGHT = 2.8;

export interface MaterialUsage {
  key: MaterialKey;
  /** 该材料的地面面积（m²，含飘窗） */
  area: number;
  /** 含 5% 损耗的材料金额（元，未取整） */
  cost: number;
}

export interface RoomRow {
  id: string;
  name: string;
  mat: MaterialKey;
  area: number;
  /** `false` = 飘窗，不计入使用面积（原 L1365 的 `*` 标记） */
  counted: boolean;
}

/** 房间有效覆盖（用户改过的名称/材质优先，缺失则用结构自带值；对应 `layout.rooms` 语义） */
export function roomOverride(room: Room, overrides: Record<string, RoomOverride> | undefined): RoomOverride {
  const current = overrides?.[room.id];
  return { name: current?.name ?? room.name, mat: current?.mat ?? room.mat };
}

/** 单房间面积（m²） */
export function roomArea(room: Pick<Room, 'poly'>): number {
  return area(room.poly);
}

/** 套内使用面积（m²，排除飘窗；原 L1368） */
export function totalArea(rooms: readonly Room[]): number {
  return rooms.reduce((sum, room) => (room.counted === false ? sum : sum + area(room.poly)), 0);
}

/** 房间清单（名称/材质/面积/是否计入），供总览与编辑面板表格使用 */
export function roomRows(rooms: readonly Room[], overrides: Record<string, RoomOverride> | undefined): RoomRow[] {
  return rooms.map((room) => {
    const effective = roomOverride(room, overrides);
    return {
      id: room.id,
      name: effective.name,
      mat: effective.mat,
      area: area(room.poly),
      counted: room.counted !== false,
    };
  });
}

/** 按材料汇总用量与金额（原 L1369-1373；**含飘窗**、含 5% 损耗） */
export function materialBreakdown(
  rooms: readonly Room[],
  overrides: Record<string, RoomOverride> | undefined,
): MaterialUsage[] {
  const byMaterial = new Map<MaterialKey, number>();
  for (const room of rooms) {
    const key = roomOverride(room, overrides).mat;
    byMaterial.set(key, (byMaterial.get(key) ?? 0) + area(room.poly));
  }
  return [...byMaterial.entries()].map(([key, value]) => ({
    key,
    area: value,
    cost: value * materialPrice(key) * LOSS_FACTOR,
  }));
}

/** 地面材料合计（元；原 L1372-1373 的累加值） */
export function flooringCost(usages: readonly MaterialUsage[]): number {
  return usages.reduce((sum, usage) => sum + usage.cost, 0);
}

/** 单房间材料估价（元；原 L1485） */
export function roomEstimate(roomOrArea: Pick<Room, 'poly'> | number, mat: MaterialKey): number {
  const value = typeof roomOrArea === 'number' ? roomOrArea : area(roomOrArea.poly);
  return value * materialPrice(mat) * LOSS_FACTOR;
}

/** 墙面面积估算（m²；原 L1483：周长 × 2.8，未扣门窗） */
export function wallArea(poly: readonly PointLike[]): number {
  return perim(poly) * WALL_HEIGHT;
}

/** 家具占地面积（m²；原 L1509） */
export function furnitureFootprint(f: Pick<Furniture, 'w' | 'd'>): number {
  return (f.w * f.d) / 1e6;
}

/** 房间开间 / 进深（mm；原 L1481-1482 的包围盒口径） */
export function roomSize(poly: readonly PointLike[]): { width: number; depth: number } {
  const [x0, y0, x1, y1] = bbox(poly);
  return { width: x1 - x0, depth: y1 - y0 };
}

/** 落在家具矩形内的家具（原 L1474：按中心点判断） */
export function furnitureInside(poly: readonly PointLike[], furniture: readonly Furniture[]): Furniture[] {
  const [x0, y0, x1, y1] = bbox(poly);
  return furniture.filter((f) => f.cx > x0 && f.cx < x1 && f.cy > y0 && f.cy < y1);
}

/** 拆除墙体的总长度（米；原 L1375：`Σ max(dx,dy)/1000`） */
export function demolishedLength(walls: readonly Wall[], demolished: readonly string[]): number {
  let total = 0;
  for (const id of demolished) {
    const wall = walls[Number.parseInt(id.replace(/^\D+/, ''), 10)];
    if (!wall) continue;
    total += Math.max(wall[2] - wall[0], wall[3] - wall[1]);
  }
  return total / 1000;
}

/** 材料名称（面板显示用；缺省回落 key） */
export function materialName(key: MaterialKey): string {
  return MATS[key]?.name ?? key;
}