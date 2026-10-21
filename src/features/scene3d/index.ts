/**
 * 3D 场景模块出口与契约常量（SPEC §F.3 / §F.4 / §E.8）。
 *
 * ⚠️ 本目录由 **t5（scene3d-dev）** 独占实现；t3 在此固化了契约骨架，t5 已按下列顺序补齐：
 * `engine` → `materials` → `primitives` → `architecture` → `furniture/*` → `camera` → `lighting`
 * → `picking` → `labels` → `walk` → `Scene3D.vue`。
 *
 * 三条硬约束（评审会直接查）：
 * - `Scene3DApi` 的实现经 `utils/scenePort` 注册，⛔ 不用 `window.View3D`；
 * - 三签名重建的输入来源见 `SCENE_SIGNATURE_SOURCES`（F.3）；
 * - 主题联动取色只经 `theme/material-palette.ts`（E.8），⛔ 目录内不得出现任何十六进制字面值。
 */
import { MATERIAL_PALETTES, resolveSceneTheme } from '@/theme/material-palette';
import { registerViewMount } from '@/composables/useViewMounts';
import Scene3DComponent from './Scene3D.vue';

export type { Scene3DApi, SceneSignatures, LayoutSlice, PlanSlice, UiSlice } from '@/types/scene3d';
export { resolveSceneTheme, MATERIAL_PALETTES };

/**
 * 3D 视口组件（`App.vue` 挂载用，SPEC §F.4）。
 * ⚠️ 必须以 **`v-show`（而非 `v-if`）常驻挂载**：`ui.setViewMode('3d')` 依赖
 * `utils/scenePort` 里已注册的 API，组件未挂载时会走「3D 模块尚未就绪」分支。
 */
export const Scene3D = Scene3DComponent;
export { Scene3DComponent };

/**
 * **自注册到视图挂载位**（SPEC §C.1 / `composables/useViewMounts` 契约）。
 *
 * 为什么放在这里：`App.vue` 由 2D 侧一次性装配，若它直接 `import` 3D 组件会破坏
 * `features/**` 之间不得互相依赖的 B1/B2 边界；而 `Scene3D.vue` 是 `<script setup>`，
 * 无法在模块顶层写注册语句。因此由**本模块出口**在导入时完成注册，
 * `main.ts` 只做一次副作用导入（`import('@/features/scene3d')`）。
 *
 * ⚠️ 这是真实缺陷修复：此前无人调用 `registerViewMount('scene3d', …)`，
 * 导致切到 3D 时挂载位永远为空、`<canvas>` 从不创建（实渲染验证 R5/R6 的失败原因）。
 */
registerViewMount('scene3d', Scene3DComponent);

/** 引擎工厂与三签名计算（组件外复用 / 单测用；SPEC §F.3） */
export { computeSignatures, createSceneEngine } from './engine';
export type { EngineDeps, EnterContext, SceneEngine } from './engine';

/** 三签名（SPEC §F.3 🔒，逐字保留原语义 L3585-3591） */
export const SCENE_SIGNATURE_SOURCES = {
  arch: ['layout.rooms', 'layout.demolished', 'ui.view3d.cut', 'plan.plan.id', 'plan.level', 'plan.stairs.length'],
  furn: ['layout.furniture'],
  labels: ['layout.rooms', 'ui.view3d.cut', 'plan.plan.id', 'plan.level'],
} as const;

/** 已交付的模块清单（SPEC §C.1；`SCENE3D_PENDING_MODULES` 的完成态） */
export const SCENE3D_MODULES = [  'Scene3D.vue',
  'engine.ts',
  'architecture.ts',
  'materials.ts',
  'primitives.ts',
  'lighting.ts',
  'camera.ts',
  'walk.ts',
  'picking.ts',
  'labels.ts',
  'scene.ts',
  'snap.ts',
  'furniture/index.ts',
  'furniture/shared.ts',
  'furniture/content-colors.ts',
  'furniture/bedroom.ts',
  'furniture/living.ts',
  'furniture/tables.ts',
  'furniture/bath.ts',
  'furniture/appliances.ts',
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

/** 剖切两档（SPEC §D.4 / OF §3.4）与场景常量再导出，便于外部按档位调 `ui.set3dOption('cut', …)` */
export { CUT_FULL, CUT_LOW, LAYER_HEIGHT, SHOT_FILENAME } from './scene';
