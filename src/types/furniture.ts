/**
 * 家具类型（SPEC §D.3 🔒 冻结）。45 个唯一类型，与 OF §5.1 去重类型数一致。
 * ⛔ 新增类型必须同步 `data/furniture-lib.ts`、2D 图例 `features/plan2d/furniture-svg.ts`、
 *   3D 模型 `features/scene3d/furniture/*`，三处缺一即图例与模型不对应（验收清单第 5 条）。
 */

export type FurnitureType =
  // 卧室
  | 'bed'
  | 'crib'
  | 'nightstand'
  | 'wardrobe'
  | 'dresser'
  | 'desk'
  | 'chair'
  | 'bookshelf'
  | 'baycushion'
  // 客厅
  | 'sofa'
  | 'cornersofa'
  | 'armchair'
  | 'beanbag'
  | 'coffeetable'
  | 'sidetable'
  | 'tvstand'
  | 'rug'
  | 'shoecab'
  | 'floorlamp'
  | 'plant'
  // 餐厅 / 厨房
  | 'table'
  | 'roundtable'
  | 'island'
  | 'barstool'
  | 'counter'
  | 'stove'
  | 'ksink'
  | 'fridge'
  | 'cabinet'
  // 卫浴
  | 'toilet'
  | 'vanity'
  | 'shower'
  | 'bathtub'
  | 'washer'
  | 'waterheater'
  // 家电 / 设备
  | 'tv'
  | 'aircon'
  | 'acwall'
  | 'dishwasher'
  | 'ovencol'
  | 'dryer'
  | 'purifier'
  // 书房 / 休闲
  | 'officechair'
  | 'piano'
  | 'treadmill';

export interface Furniture {
  id: string;
  type: FurnitureType;
  name: string;
  /** 中心 x（mm，户型坐标系） */
  cx: number;
  /** 中心 y（mm，户型坐标系） */
  cy: number;
  /** 宽（mm） */
  w: number;
  /** 深（mm） */
  d: number;
  /** 0..359，平面顺时针 */
  rot: number;
  /** 内容色（来自家具库或用户改色）——ADR-10：永不随主题变 */
  color: string;
}

/** [type, name, w, d, color]（原 `LIB` 条目结构，OF §5.1） */
export type LibItem = readonly [type: FurnitureType, name: string, w: number, d: number, color: string];

export interface LibCategory {
  cat: string;
  items: LibItem[];
}
