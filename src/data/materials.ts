/**
 * 材料表（SPEC §C.1；口径与取值逐条对齐 OF §6.1，原 `装修设计.html` L522-531）。
 *
 * ⚠️ 本文件是 SPEC §C.2 **B3/B4 白名单**之一：`sw`（色板）与 `tex.base` / `tex.grout`
 * 属于**内容色**（ADR-10：不随主题变化），因此允许出现十六进制字面值。
 * ⛔ 不得把主题令牌（UI 色）搬进来；⛔ 其它文件不得复制这里的 hex。
 *
 * `price` 的唯一消费方是 `utils/measure.ts` 的报价口径（面积 ×1.05 损耗，OF §6.2）。
 */
import type { Material, MaterialKey } from '@/types/material';

/** 材料顺序（= 原 `MATS` 的定义顺序；面板与材料表按此顺序渲染） */
export const MATERIAL_KEYS = [
  'wood',
  'walnut',
  'tile800',
  'tile600',
  'marble',
  'antislip',
  'terrazzo',
  'carpet',
] as const satisfies readonly MaterialKey[];

/** 材质非法时的回落值（原 `normalizePlan` L1937：`mat` 不在 MATS 内 → `tile800`） */
export const DEFAULT_MATERIAL: MaterialKey = 'tile800';

/**
 * 8 种材料。
 * - `price`：元/m²（OF §6.1）
 * - `sw`：色板（房间面板/材料选择器的示意色）
 * - `tex`：2D 图案（`features/plan2d/patterns.ts` 用它生成 `<pattern>`）与 3D 贴图参数。
 *   `rough`（粗糙度）在原实现里没有对应常量（3D 侧只用了颜色与图案），这里是**派生值**：
 *   按材料物理属性取值（抛光石材低、地毯最高），仅用于 3D 材质，不影响 2D 保真。
 */
export const MATS: Record<MaterialKey, Material> = {
  wood: {
    key: 'wood',
    name: '橡木地板',
    price: 320,
    sw: '#d8b88a',
    tex: { sx: 1800, sy: 360, base: '#dcc09a', grout: '#bf9d70', rough: 0.55 },
  },
  walnut: {
    key: 'walnut',
    name: '胡桃木地板',
    price: 380,
    sw: '#9b7250',
    tex: { sx: 1800, sy: 360, base: '#a57c56', grout: '#80593a', rough: 0.6 },
  },
  tile800: {
    key: 'tile800',
    name: '800 地砖',
    price: 220,
    sw: '#ebe6dc',
    tex: { sx: 800, sy: 800, base: '#ece7de', grout: '#d3cabb', rough: 0.25 },
  },
  tile600: {
    key: 'tile600',
    name: '600 地砖',
    price: 160,
    sw: '#dfe3e1',
    tex: { sx: 600, sy: 600, base: '#e2e6e3', grout: '#c4cbc6', rough: 0.3 },
  },
  marble: {
    key: 'marble',
    name: '大理石',
    price: 650,
    sw: '#f1eee8',
    tex: { sx: 1200, sy: 1200, base: '#f3f0ea', grout: '#dcd5c8', rough: 0.15 },
  },
  antislip: {
    key: 'antislip',
    name: '300 防滑砖',
    price: 140,
    sw: '#d3d8d4',
    tex: { sx: 300, sy: 300, base: '#d6dbd7', grout: '#b3bab4', rough: 0.8 },
  },
  terrazzo: {
    key: 'terrazzo',
    name: '水磨石',
    price: 280,
    sw: '#e6dfd3',
    // 水磨石没有勾缝线（原图案是 6 个骨料圆），因此 `grout` 缺省
    tex: { sx: 500, sy: 500, base: '#e8e1d5', rough: 0.5 },
  },
  carpet: {
    key: 'carpet',
    name: '满铺地毯',
    price: 200,
    sw: '#c9c3d3',
    tex: { sx: 120, sy: 120, base: '#c9c3d3', grout: '#bab3c6', rough: 1 },
  },
};

/** 面板/材料选择器按固定顺序遍历用的列表 */
export const MATERIAL_LIST: readonly Material[] = MATERIAL_KEYS.map((key) => MATS[key]);

/** 运行时校验（导入数据的 `mat` 字段、用户输入） */
export function isMaterialKey(value: unknown): value is MaterialKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(MATS, value);
}

/** 非法值 → `DEFAULT_MATERIAL`（原 L1937 语义） */
export function toMaterialKey(value: unknown): MaterialKey {
  return isMaterialKey(value) ? value : DEFAULT_MATERIAL;
}

/** 单价查询（元/m²） */
export function materialPrice(key: MaterialKey): number {
  return MATS[key]?.price ?? MATS[DEFAULT_MATERIAL].price;
}