/**
 * 视图挂载位注册表（**跨特性装配契约**，中性层）。
 *
 * 背景：`App.vue` 由 plan2d-dev **一次性装配**（SPEC §C.1 / 任务 t2），而 3D 视口与亮点面板
 * 分别归 `scene3d-dev` / `features-dev`。三方并行时，若 `App.vue` 直接 `import` 尚不存在的
 * `features/scene3d/Scene3D.vue` 或 `features/extras/*.vue`，构建会立刻失败（C-1 同源问题）。
 *
 * 解法（与 `utils/scenePort.ts` 同一模式：接口/挂载点在中立层，实现方运行时注册）：
 *
 * ```ts
 * // features/scene3d/Scene3D.vue（或 features/scene3d/index.ts）
 * import { registerViewMount } from '@/composables/useViewMounts';
 * registerViewMount('scene3d', Scene3D);
 * ```
 *
 * `App.vue` 的挂载位（DOM 顺序符合 SPEC §F.2 / 原实现 L257-410）：
 * | 挂载位 | 位置 | 期望内容 |
 * | --- | --- | --- |
 * | `scene3d` | `<main class="stage">` 内，2D `<svg>` 之后、`SelectionFab` 之前 | `Scene3D.vue`（`defineExpose` 暴露 `Scene3DApi` 并自行 `registerScene3D(api)`） |
 * | `extras-toolbar` | `<header>` 右段（主题/语言/全屏之前） | 亮点入口按钮组（导出/校验/对比/历史/命令面板） |
 * | `extras-overlay` | `<main>` 之后（`ToastHost` 之前） | 亮点弹层（`ExportMenu` 下拉 / `ValidationPanel` / `PlanCompare` / `HistoryPanel` / `CommandPalette`） |
 *
 * 传入的 props（`App.vue` 统一绑定，组件按需声明即可，多余项会落到 attrs 不报错）：
 * - `getSvg?: () => SVGSVGElement | null`（2D 画布节点，导出用）
 * - `resolveDrop?: (clientX, clientY) => {x,y,s} | null`（屏幕 → 户型坐标，家具库拖放用）
 * - `fit?: () => void`（适应窗口）
 *
 * ⛔ 注册必须在组件 setup 之前完成（模块顶层或 `main.ts`），否则首帧看不到；
 * ⛔ 卸载时不需要反注册（`<component :is>` 自己管生命周期）。
 */
import { shallowReactive } from 'vue';
import type { Component } from 'vue';

/** 三个固定挂载位（⛔ 不新增：新增位需要改 `App.vue`，而它由 t2 独占） */
export type ViewMountSlot = 'scene3d' | 'extras-toolbar' | 'extras-overlay';

export const VIEW_MOUNT_SLOTS: readonly ViewMountSlot[] = ['scene3d', 'extras-toolbar', 'extras-overlay'];

const registry = shallowReactive<Partial<Record<ViewMountSlot, Component>>>({});

/** 实现方注册（重复注册以最后一次为准；传 `null` 可移除） */
export function registerViewMount(slot: ViewMountSlot, component: Component | null): void {
  if (component) registry[slot] = component;
  else delete registry[slot];
}

/** `App.vue` 读取（响应式：注册发生在 `main.ts` 之后也能补上） */
export function useViewMounts(): Partial<Record<ViewMountSlot, Component>> {
  return registry;
}

/** 命令式读取（事件处理里用） */
export function getViewMount(slot: ViewMountSlot): Component | undefined {
  return registry[slot];
}
