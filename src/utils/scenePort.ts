/**
 * 3D 端口（依赖倒置的注册通道）。
 *
 * 为什么需要它：SPEC §F.4 规定 `useUiStore.setViewMode()` 要调用 `Scene3DApi.enter()/exit()`，
 * 而 SPEC §C.2 B5 规定 `stores/**` ⛔ 不得 import `features/**`（store 必须能在 Node 下单测）。
 * 解法：接口在 `types/scene3d.ts`（纯类型），实现在 `features/scene3d/**`，
 * 由组件在挂载时把自己注册进来：
 *
 * ```ts
 * // features/scene3d/Scene3D.vue
 * const api: Scene3DApi = { enter, exit, shot, groundAt, flyToRoom, iso, top, walking, relabel };
 * onMounted(() => registerScene3D(api));
 * onUnmounted(() => registerScene3D(null));
 * ```
 * ⛔ 禁止用 `window.View3D` 之类的全局单例（X3 不保留项）。
 */
import { shallowRef, type ShallowRef } from 'vue';
import type { Scene3DApi } from '@/types/scene3d';

const sceneApi: ShallowRef<Scene3DApi | null> = shallowRef(null);

/** 3D 组件挂载/卸载时注册（`null` = 已卸载） */
export function registerScene3D(api: Scene3DApi | null): void {
  sceneApi.value = api;
}

/** 命令式取用（事件处理里用，避免无谓的响应式依赖） */
export function getScene3DApi(): Scene3DApi | null {
  return sceneApi.value;
}

/** 响应式取用（模板里需要根据「3D 是否就绪」显隐按钮时用） */
export function useScene3DApi(): ShallowRef<Scene3DApi | null> {
  return sceneApi;
}

export function isScene3DReady(): boolean {
  return sceneApi.value !== null;
}
