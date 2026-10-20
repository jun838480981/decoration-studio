/**
 * 3D 材质基色令牌表 —— **三维侧取色的唯一来源**（SPEC §E.8 T1/T2，ADR-10）。
 *
 * 背景：原实现在 `装修设计.html` L2902–3423 有 **40+ 处**硬编码 `mat('#...')`，
 * 散布在家具与建筑材质里；`renderer.toneMappingExposure` 在 L3612、
 * `scene.background` / 地面色 / 半球光 / 太阳色 / `envK` 在 L3603-3616。
 * 不收敛成一张表，「配色优化」在 3D 侧就等于没做（评审会直接打回）。
 *
 * 使用约定（t5 必须遵守）：
 * - ⛔ `features/scene3d/**`（含 `furniture/*.ts`、`architecture.ts`、`materials.ts`）不得出现任何十六进制字面值；
 *   一律 `deps.palette.surface.wall` / `deps.palette.metal.chrome` 这样取色（ESLint B4 + `scripts/verify.mjs` 双闸门）。
 * - 切换主题时**只更新材质/光照/曝光，不重建几何**（T4）：`theme.setPreset()` →
 *   `applyCssVars()` + `scene.applyTheme(tokens)`，材质置 `needsUpdate` 并刷新 `envMapIntensity`，
 *   耗时 < 100ms 且不得触发 `buildArch/buildFurn`。
 * - **三类颜色严格分离**（ADR-10）：本文件属于「主题令牌（随主题变）」；
 *   家具默认色 `data/furniture-lib.ts`、材料色板 `data/materials.ts`、地板图案 `features/plan2d/patterns.ts`
 *   属于「内容色（不随主题变）」；用户改过的 `Furniture.color` 永不随主题变。
 */
import type { MaterialPalette, SceneThemeBinding, ThemePresetId } from '@/types/theme';

/** 日间：暖白墙 + 浅木，与 §E.2 的暖色令牌体系同族 */
const DAY_PALETTE: MaterialPalette = {
  wood: { oak: '#d8b078', walnut: '#6b4a33' },
  metal: { base: '#b8b9bd', chrome: '#d9dde2', hardware: '#9aa0a8', black: '#2b2b2e' },
  surface: {
    ceramic: '#f2f2ef',
    mirror: '#cfd6da',
    glass: '#cfe3ea',
    frame: '#8b8375',
    cap: '#e9e3d8',
    wall: '#f6f2ea',
    skirt: '#e4ded2',
    edge: '#b9b1a3',
  },
  light: { glow: '#fff3d6', screen: '#20242c' },
  fabric: { sofa: '#8fa3b0', bed: '#e6e1d8', rug: '#b9a58c' },
};

/** 夜间：压暗的中性色，避免场景在深色 UI 下过曝 */
const NIGHT_PALETTE: MaterialPalette = {
  wood: { oak: '#b98d5c', walnut: '#5a3f2c' },
  metal: { base: '#9fa4ab', chrome: '#c3c9d1', hardware: '#828a95', black: '#1c1f24' },
  surface: {
    ceramic: '#d9dde1',
    mirror: '#aeb8c2',
    glass: '#8fb4c2',
    frame: '#5f6875',
    cap: '#3a424d',
    wall: '#2b313a',
    skirt: '#333a45',
    edge: '#6b7686',
  },
  light: { glow: '#ffd9a0', screen: '#8fd3ff' },
  fabric: { sofa: '#5c6f7d', bed: '#6a6a70', rug: '#6b5b48' },
};

/** 高对比：去掉中间调，边界清晰（可访问性优先，不追求写实） */
const CONTRAST_PALETTE: MaterialPalette = {
  wood: { oak: '#c08b4f', walnut: '#4a3324' },
  metal: { base: '#767676', chrome: '#9a9a9a', hardware: '#5a5a5a', black: '#000000' },
  surface: {
    ceramic: '#ffffff',
    mirror: '#b9c4cc',
    glass: '#a8cbd6',
    frame: '#000000',
    cap: '#f0f0f0',
    wall: '#ffffff',
    skirt: '#d0d0d0',
    edge: '#4d4d4d',
  },
  light: { glow: '#ffe9b0', screen: '#101418' },
  fabric: { sofa: '#595959', bed: '#e8e8e8', rug: '#8c8c8c' },
};

export const MATERIAL_PALETTES: Record<ThemePresetId, MaterialPalette> = {
  day: DAY_PALETTE,
  night: NIGHT_PALETTE,
  contrast: CONTRAST_PALETTE,
};

/**
 * 场景级参数（SPEC §E.8 T3）：**必须**随 `theme.presetId` 变化。
 * 曝光沿用原实现的两档（L3612：日间 1.05 / 夜间 1.25），`envK` 沿用 L3613 的 0.15。
 */
export const SCENE_THEME_BINDINGS: Record<ThemePresetId, SceneThemeBinding> = {
  day: {
    background: '#e8e4db',
    groundColor: '#f7f4ee',
    toneMappingExposure: 1.05,
    hemiIntensity: 0.55,
    sunColor: '#fff4e2',
    sunIntensity: 2.0,
    envK: 0.15,
  },
  night: {
    background: '#171a21',
    groundColor: '#1b1f27',
    toneMappingExposure: 1.25,
    hemiIntensity: 0.3,
    sunColor: '#8fa6c8',
    sunIntensity: 0.5,
    envK: 0.15,
  },
  contrast: {
    background: '#ffffff',
    groundColor: '#ffffff',
    toneMappingExposure: 1.0,
    hemiIntensity: 1.0,
    sunColor: '#ffffff',
    sunIntensity: 2.4,
    envK: 0.15,
  },
};

/**
 * 3D 独立「夜景」开关（`ui.view3d.night`）的光照覆盖值（**ADR-08**）：
 * `view3d.night` 覆盖「光照 / 曝光 / 背景」，但 **不覆盖材质基色**；两者可同时开启
 * （例：「日间 UI + 3D 夜景」做效果图）。
 */
export const NIGHT_LIGHTING_OVERRIDE: SceneThemeBinding = {
  background: '#0b0e13',
  groundColor: '#12161c',
  toneMappingExposure: 1.25,
  hemiIntensity: 0.18,
  sunColor: '#7d8fb3',
  sunIntensity: 0.35,
  envK: 0.15,
};

export interface ResolvedSceneTheme {
  presetId: ThemePresetId;
  /** 是否叠加了 3D 夜景覆盖 */
  night: boolean;
  palette: MaterialPalette;
  binding: SceneThemeBinding;
  /** 传给 3D 做「是否需要 applyTheme」的签名 */
  signature: string;
}

/** 组合主题 + 夜景开关（ADR-08 的显式优先级：`view3d.night` 覆盖主题的光照部分） */
export function resolveSceneTheme(presetId: ThemePresetId, night: boolean): ResolvedSceneTheme {
  const base = SCENE_THEME_BINDINGS[presetId];
  const binding = night ? { ...base, ...NIGHT_LIGHTING_OVERRIDE } : base;
  return {
    presetId,
    night,
    palette: MATERIAL_PALETTES[presetId],
    binding,
    signature: `${presetId}|${night ? 'night' : 'day'}|${binding.toneMappingExposure}|${binding.envK}`,
  };
}

/** 全部可用材质基色路径（点分），供 t5 的 key 白名单与文档化核对使用 */
export const PALETTE_KEY_PATHS = [
  'wood.oak',
  'wood.walnut',
  'metal.base',
  'metal.chrome',
  'metal.hardware',
  'metal.black',
  'surface.ceramic',
  'surface.mirror',
  'surface.glass',
  'surface.frame',
  'surface.cap',
  'surface.wall',
  'surface.skirt',
  'surface.edge',
  'light.glow',
  'light.screen',
  'fabric.sofa',
  'fabric.bed',
  'fabric.rug',
] as const;

export type PaletteKeyPath = (typeof PALETTE_KEY_PATHS)[number];

/** 按点分路径取色（3D 侧可以只拿字符串配置表，避免到处 import 结构） */
export function paletteHex(presetId: ThemePresetId, path: PaletteKeyPath): string {
  const [group, key] = path.split('.') as [keyof MaterialPalette, string];
  const groupValue = MATERIAL_PALETTES[presetId][group] as unknown as Record<string, string>;
  return groupValue[key];
}

/** 生成 `<材质名, 颜色>` 的扁平映射，便于 t5 一次性遍历更新 `needsUpdate` */
export function flattenPalette(presetId: ThemePresetId): Record<PaletteKeyPath, string> {
  const out = {} as Record<PaletteKeyPath, string>;
  for (const path of PALETTE_KEY_PATHS) out[path] = paletteHex(presetId, path);
  return out;
}
