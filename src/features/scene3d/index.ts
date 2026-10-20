/**
 * 3D 场景模块出口与契约常量（SPEC §F.3 / §F.4 / §E.8）。
 *
 * ⚠️ 本目录由 **t5（scene3d-dev）** 独占实现。t3 在此固化：
 * - `Scene3DApi` 的实现入口（经 `utils/scenePort` 注册，⛔ 不用 `window.View3D`）；
 * - 三签名重建的输入来源（F.3）；
 * - 与主题联动的取色入口（E.8，⛔ 目录内不得出现任何 hex）。
 */
import { MATERIAL_PALETTES, resolveSceneTheme } from '@/theme/material-palette';

export type { Scene3DApi, SceneSignatures, LayoutSlice, PlanSlice, UiSlice } from '@/types/scene3d';
export { resolveSceneTheme, MATERIAL_PALETTES };

/** 三签名（SPEC §F.3 🔒，逐字保留原语义 L3585-3591） */
export const SCENE_SIGNATURE_SOURCES = {
  arch: ['layout.rooms', 'layout.demolished', 'ui.view3d.cut', 'plan.plan.id', 'plan.level', 'plan.stairs.length'],
  furn: ['layout.furniture'],
  labels: ['layout.rooms', 'ui.view3d.cut', 'plan.plan.id', 'plan.level'],
} as const;

/** t5 待实现的文件清单（SPEC §C.1） */
export const SCENE3D_PENDING_MODULES = [
  'Scene3D.vue',
  'engine.ts',
  'architecture.ts',
  'materials.ts',
  'primitives.ts',
  'lighting.ts',
  'camera.ts',
  'walk.ts',
  'picking.ts',
  'labels.ts',
  'furniture/*.ts',
] as const;

/** E.8 T4：切主题时**必须**更新的项（只更新材质/光照/曝光，不重建几何） */
export const SCENE_THEME_REACTIVE_FIELDS = [
  'scene.background',
  'ground.material.color',
  'renderer.toneMappingExposure',
  'hemi.intensity',
  'sun.color',
  'sun.intensity',
  'envK',
  'wallMat',
  'capMat',
  'frameMat',
  'skirtMat',
  'edgeMat',
] as const;