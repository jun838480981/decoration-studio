/**
 * 3D 常量、世界坐标换算与纯几何工具（t5）。
 *
 * 与 SPEC 的对应关系：
 * - §D.4 `View3dOptions.cut` 默认 2.8，两档 2.8 / 1.2（OF §3.4）；
 * - §E.8 T2：**本文件（及 scene3d/ 下所有文件）不得出现任何十六进制色值**，
 *   一律经 `theme/material-palette.ts` 取色；
 * - OF §3.1：层高 `H = 2.8`、`FOV = 45`、世界原点 = 户型包围盒中心。
 *
 * ⚠️ 与 `composables/usePointerKind.ts` 的 `TAP_PX`（点击容差）、`utils/geometry.ts` 的
 * `snapMove`/`aabb`（§C.1 归 t4）的分工：本模块只放 **3D 私有的**数学，不重复 t4 的口径。
 */
import { Color } from 'three';
import { COARSE, TAP_PX } from '@/composables/usePointerKind';
import type { Bounds, Rect } from '@/types/geometry';

/** 层高（m）——OF §3.1 / 原 L2690 */
export const LAYER_HEIGHT = 2.8;
/** 剖切高档（= 层高，即「全高墙」）——SPEC §D.4 */
export const CUT_FULL = 2.8;
/** 剖切低档——SPEC §D.4 / 原 L321-324 */
export const CUT_LOW = 1.2;
/** 透视相机视场角——原 L2690 */
export const FOV = 45;

/** 点击命中容差（px，桌面 4 / 触屏 9）——单点定义在 `usePointerKind`（RISK-11） */
export const TAP = TAP_PX;
export { COARSE };

/** 门开合缓动系数（原 L3882 `Math.min(1, dt*6)`） */
export const DOOR_EASE = 6;
/** 漫游点击门开关的最大距离（m）——原 L2780 */
export const DOOR_TAP_DIST = 3.5;
/** 漫游按 E 开门的最大距离（m）——原 L3835 */
export const DOOR_KEY_DIST = 2.5;
/** 场景单位 → mm */
export const MM = 1000;

/** 相机距离钳制（OrbitControls）——原 L2719 */
export const MIN_DISTANCE = 1.5;
export const MAX_DISTANCE = 45;
/** 地面反投影的最远接受距离（m）——原 L3733 */
export const GROUND_MAX_DIST = 60;

/** 3D 截图文件名（原 L3888 的 `户型装修方案-3D.png`，⛔ 不含 hex，仅字符串常量） */
export const SHOT_FILENAME = '户型装修方案-3D.png';

/**
 * 世界坐标配置：原点 = 户型包围盒中心（原 `OX()/OY()`，L2691）。
 * 原实现每次调用都读全局 `BOUNDS`；这里改成**显式传入**，切户型时由 `engine.setBounds()` 更新。
 */
export interface WorldConfig {
  ox: number;
  oy: number;
}

export function worldConfigOf(bounds: Bounds): WorldConfig {
  return { ox: bounds.x + bounds.w / 2, oy: bounds.y + bounds.h / 2 };
}

/** 户型 x（mm）→ 世界 x（m） */
export const wx = (cfg: WorldConfig, x: number): number => (x - cfg.ox) / MM;
/** 户型 y（mm）→ 世界 z（m） */
export const wz = (cfg: WorldConfig, y: number): number => (y - cfg.oy) / MM;
/** 世界坐标 → 户型坐标（mm） */
export const planX = (cfg: WorldConfig, x: number): number => x * MM + cfg.ox;
export const planY = (cfg: WorldConfig, y: number): number => y * MM + cfg.oy;
/** mm → m */
export const m = (v: number): number => v / MM;

/** 轴对齐矩形（户型 mm）的中心世界坐标 */
export function rectCenter(cfg: WorldConfig, r: Rect): { x: number; z: number } {
  return { x: wx(cfg, (r[0] + r[2]) / 2), z: wz(cfg, (r[1] + r[3]) / 2) };
}

/** 轴对齐矩形（户型 mm）的世界尺寸（m） */
export function rectSize(r: Rect): { w: number; d: number } {
  return { w: m(Math.abs(r[2] - r[0])), d: m(Math.abs(r[3] - r[1])) };
}

/** 矩形是否为横向（宽 ≥ 深）；门/窗的横竖判定口径（原 L3530） */
export function isHorizontal(r: Rect): boolean {
  return Math.abs(r[2] - r[0]) >= Math.abs(r[3] - r[1]);
}

export const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
export const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/** 三次缓动（原 L3619 `ease`） */
export const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * 确定性伪随机（原 L2810 `rng`）。
 * 种子 = `round(w*7 + d*13 + cx + cy)`（原 L2955），保证书架/绿植等细节可复现。
 */
export function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 家具模型的确定性种子（原 L2955） */
export function furnitureSeed(w: number, d: number, cx: number, cy: number): number {
  return Math.round(w * 7 + d * 13 + cx + cy);
}

// ---------------------------------------------------------------------------
// 颜色派生：**只对「内容色」使用**（用户家具色 / 由内容色派生的部件色）
// ADR-10：内容色不随主题变化；主题色一律经 `deps.palette.*` 直接取，不做派生。
// ---------------------------------------------------------------------------

/** 压暗（原 L2898 `darker`） */
export function darker(hex: string, k = 0.8): string {
  return `#${new Color(hex).multiplyScalar(k).getHexString()}`;
}

/** 提亮（原 L2899 `lighter`） */
export function lighter(hex: string, k = 0.2): string {
  return `#${new Color(hex).lerp(new Color('white'), k).getHexString()}`;
}

/**
 * 光源自发光色：由基色派生（ADR-10 —— 3D 侧不得新增 hex 字面值）。
 * 空调/燃气灶/烤箱等「指示灯」用它；`light.glow` / `light.screen` 是基色来源。
 */
export const emissiveOf = (hex: string, k = 0.9): string => darker(hex, k);

/**
 * 房间多边形的轴对齐包围盒（mm）。
 * ⚠️ `utils/geometry.ts` 的 `boundsOf(struct)` 归 t4；3D 侧只需要多边形包围盒，故本地实现，
 * 不与该口径冲突（2D 的 `bounds` 由 plan store 提供，3D 只读）。
 */
export function polyBounds(poly: readonly (readonly [number, number])[]): Bounds {
  if (poly.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of poly) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** 多边形面积（m²，鞋带公式；与 OF §6.2 的面积口径一致，单位换到 m²） */
export function polyAreaM2(poly: readonly (readonly [number, number])[]): number {
  if (poly.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    sum += x0 * y1 - x1 * y0;
  }
  return Math.abs(sum) / 2 / (MM * MM);
}