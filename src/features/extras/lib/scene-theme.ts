/**
 * 3D 主题联动入口（P0-9 / SPEC §E.8 T3/T4/T5 + §F.4）。
 *
 * 为什么放在 `features/extras`：
 * - `features/**` 之间 ⛔ 不得互相 import（SPEC §C.2 B1/B2），所以 `extras` 不能直接 `import`
 *   `features/scene3d/**`；
 * - 但「切主题 → 3D 场景同步换材质/光照/曝光」和「切语言 → 重建 CSS2D 标签」这两件事
 *   **必须有唯一入口**，否则每个 UI 按钮都要自己记得调一遍（漏一处就是"UI 变了 3D 没变"）。
 *
 * 解法（与 2D↔3D 同构，复用既有依赖倒置）：经 `utils/scenePort` 拿 `Scene3DApi`。
 * `Scene3DApi` 目前只有 `shot / groundAt / flyToRoom / iso / top / walking / relabel`，
 * **没有** `applyTheme` —— 这是 SPEC §F.4 冻结契约，⛔ 不能在本任务里扩签名（RISK-01）。
 * 因此本文件采取两级策略：
 *
 * | 场景 | 做法 |
 * | --- | --- |
 * | 3D 已实现 `applyTheme`（t5 落地后） | 通过**结构化探测**调用它（见 `THEMED_SCENE_METHOD`） |
 * | 3D 尚未实现 | 不做任何事，但**不报错、不阻塞**主题切换（UI/2D/导出已由 `stores/theme` 全量覆盖） |
 *
 * ⚠️ 待联调项（登记在 `docs/EXTRAS.md` 的「未验证/待联调」）：t5 的 `engine.applyTheme(presetId, night)`
 * 落地后，建议把它**正式加进** `Scene3DApi`（SPEC §F.4 需 spec-lead 定稿），届时本文件的探测分支
 * 可以退化为一行直调。当前探测是为了让联调前也能跑通、且不产生类型层面的假契约。
 */
import { watch, type WatchStopHandle } from 'vue';
import { getScene3DApi } from '@/utils/scenePort';
import type { Scene3DApi } from '@/types/scene3d';
import type { ThemePresetId } from '@/types/theme';

/** 3D 侧主题入口的约定方法名（t5 的 `engine.applyTheme(presetId, night)`） */
export const THEMED_SCENE_METHOD = 'applyTheme' as const;

/**
 * 3D 侧主题入口的最小签名（`View3dOptions.night` 与主题解耦，ADR-08：
 * `night` 覆盖光照/曝光/背景，但不覆盖材质基色）。
 */
export interface ThemedSceneApi extends Scene3DApi {
  applyTheme?(presetId: ThemePresetId, night: boolean): void;
}

/** 把 `Scene3DApi` 视为可能带主题入口的 3D 端口（结构探测，⛔ 不修改冻结接口） */
export function asThemedScene(api: Scene3DApi | null): ThemedSceneApi | null {
  if (!api) return null;
  return api as ThemedSceneApi;
}

/** 3D 侧是否具备主题联动能力（UI 可据此显示「3D 主题联动已就绪 / 待 t5 联调」） */
export function hasSceneThemeHook(api: Scene3DApi | null = getScene3DApi()): boolean {
  const themed = asThemedScene(api);
  return typeof themed?.[THEMED_SCENE_METHOD] === 'function';
}

/**
 * 把主题 / 语言变化推给 3D（**只更新材质与标签，不重建几何**，SPEC §E.8 T4）。
 *
 * @param presetId 当前主题预设
 * @param night 3D 独立夜景开关（`ui.view3d.night`，ADR-08）
 * @returns 实际执行了哪些同步动作（供 UI 提示与单测断言；未就绪时为空数组，⛔ 不抛错）
 */
export function syncSceneWithTheme(presetId: ThemePresetId, night: boolean): SceneSyncAction[] {
  const themed = asThemedScene(getScene3DApi());
  if (!themed) return [];
  const done: SceneSyncAction[] = [];
  const applyTheme = themed[THEMED_SCENE_METHOD];
  if (typeof applyTheme === 'function') {
    try {
      applyTheme.call(themed, presetId, night);
      done.push('theme');
    } catch {
      // 3D 侧实现异常不应打断主题切换（UI/2D 已经切换完成）；由 t5 的日志定位
    }
  }
  return done;
}

/**
 * 语言切换后重建 3D 的 CSS2D 房间标签（原 `View3D.relang()`，L3890）。
 * 标签是**非响应式 DOM**，Vue 的 `$t` 变化不会自动刷新它们，必须显式调用。
 */
export function syncSceneLanguage(): boolean {
  const scene = getScene3DApi();
  if (!scene) return false;
  try {
    scene.relabel();
    return true;
  } catch {
    return false;
  }
}

export type SceneSyncAction = 'theme' | 'labels';

export interface SceneSyncSource {
  /** 当前主题预设（`theme.presetId`） */
  presetId: () => ThemePresetId;
  /** 3D 独立夜景开关（`ui.view3d.night`） */
  night: () => boolean;
  /** 当前语言（`huxing-lang` 或 i18n 实例） */
  lang: () => string;
  /** 3D 端口是否已就绪（响应式；就绪时补一次同步，解决"3D 挂载晚于主题切换"） */
  ready?: () => boolean;
}

/**
 * 响应式接线：主题 / 夜景 / 语言任一变化 → 推给 3D。
 *
 * 三个必须处理的时序坑（都在这里收口，组件不必各自处理）：
 * 1. **3D 挂载晚于主题切换**：监听 `ready()`，就绪瞬间补一次全量同步；
 * 2. **未进 3D 时切主题**：`applyTheme` 调用会被 3D 侧忽略（未初始化），
 *    但 `ready()` 变化时会再补一次，所以最终状态一致；
 * 3. **ADR-08**：`night` 变化只走 `applyTheme`（3D 侧只改光照/曝光），不触发语言重建。
 *
 * @returns 停止函数（组件 `onUnmounted` 里调用；`watch` 返回的 stop 已自带清理）
 */
export function useSceneThemeSync(source: SceneSyncSource): { stop: WatchStopHandle } {
  /** 未提供 `ready` 时视为"始终就绪"（调用方已自己保证时序） */
  const isReady = (): boolean => (source.ready ? source.ready() : true);
  const stop = watch(
    () => [source.presetId(), source.night(), source.lang(), isReady()] as const,
    ([presetId, night, , ready], previous) => {
      if (!ready) return;
      const previousLang = previous?.[2];
      const previousReady = previous?.[3] ?? false;
      // 语言变化（含"刚就绪"）→ 重建 CSS2D 标签
      if (!previousReady || previousLang !== source.lang()) syncSceneLanguage();
      // 主题或夜景变化（含"刚就绪"）→ 更新材质 / 光照 / 曝光
      if (!previousReady || previous?.[0] !== presetId || previous?.[1] !== night) {
        syncSceneWithTheme(presetId, night);
      }
    },
    { flush: 'post' },
  );
  return { stop };
}
