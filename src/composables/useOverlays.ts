/**
 * 应用级浮层状态（**不持久化**，SPEC §D.8 明确禁止持久化 UI 状态）。
 *
 * 为什么放在 composables 而不是 store：`stores/ui.ts` 的字段是 🔒 冻结契约（§D.7），
 * 而「户型库弹窗是否打开 / 亮点面板是否打开」属于纯视图编排，三条并行线都要读它
 * （快捷键 `P` 打开、AppHeader 按钮打开、App.vue 渲染），放模块级 `reactive` 即可，
 * 且 ⛔ 不需要新增 localStorage 键。
 */
import { reactive } from 'vue';

export interface OverlayState {
  /** 户型库弹窗（原 `#planModal`，L394-408） */
  planLibrary: boolean;
  /** 亮点层的面板（导出菜单 / 校验 / 对比 / 历史 / 命令面板），由 features-dev 的组件自行渲染 */
  extras: null | 'export' | 'validate' | 'compare' | 'history' | 'palette';
  /** 当前打开的原生替代对话框（confirm/prompt） */
  dialog: null | 'confirm' | 'prompt';
}

export const overlays = reactive<OverlayState>({
  planLibrary: false,
  extras: null,
  dialog: null,
});

export function openPlanLibrary(): void {
  overlays.planLibrary = true;
}

export function closePlanLibrary(): void {
  overlays.planLibrary = false;
}

export function togglePlanLibrary(): void {
  overlays.planLibrary = !overlays.planLibrary;
}

export function openExtras(which: NonNullable<OverlayState['extras']>): void {
  overlays.extras = overlays.extras === which ? null : which;
}

export function closeExtras(): void {
  overlays.extras = null;
}
