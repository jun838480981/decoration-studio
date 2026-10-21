/**
 * 3D 契约类型（SPEC §F.3 / §F.4 🔒 冻结）。
 *
 * 放在 `types/` 的原因：`stores/ui.ts` 的 `setViewMode()` 需要调用 3D 的 `enter()/exit()`（F.4 的调用方清单），
 * 而 SPEC §C.2 B5 规定 `stores/**` ⛔ 不得 import `features/**`。
 * 解法 = 依赖倒置：接口定义在 `types/`（纯类型），实现在 `features/scene3d/`，
 * 注册通道放在 `utils/scenePort.ts`。3D 组件挂载时 `registerScene3D(api)`，卸载时 `registerScene3D(null)`。
 */
import type { Plan, PlanStructure } from './plan';
import type { View3dOptions } from './state';
import type { ViewTransform } from './state';
import type { Furniture } from './furniture';
import type { RoomOverride } from './state';

/** `computeSignatures` 的入参切片：结构性类型，Pinia store 实例天然满足（SPEC §F.3） */
export interface PlanSlice {
  plan: Plan;
  /**
   * **当前层**的结构数据：复式为 `plan.levels[level]`，单层为 `plan` 自身。
   *
   * 为什么需要它（D-B 缺陷的修复点）：复式户型的顶层 `walls`/`rooms` 是空数组，
   * 真实数据在 `levels[]` 里（见 `data/presets/loft.ts`）。若 3D 直接用 `plan` 建几何，
   * 复式当前层什么都建不出来，只剩其它层被抬高绘制 → 表现为「墙体悬空、与地面分离」。
   */
  levelData: PlanStructure;
  level: number;
  stairs: readonly unknown[];
}

export interface LayoutSlice {
  rooms: Record<string, RoomOverride>;
  demolished: readonly string[];
  furniture: readonly Furniture[];
}

export interface UiSlice {
  view3d: View3dOptions;
}

export interface SceneSignatures {
  arch: string;
  furn: string;
  labels: string;
}

/**
 * `Scene3D.vue` 通过 `defineExpose` 暴露的**唯一**外部接口（SPEC §F.4）。
 * 调用方：`useUiStore.setViewMode()`、`AppHeader`（截图/斜视/俯视）、`useShortcuts`（键盘守卫）、
 * `FurnitureLibrary`（3D 落点）。
 */
export interface Scene3DApi {
  /** 进入 3D：从当前 2D 视口位姿交叉淡入（原 L3670-3689） */
  enter(ctx: { view: ViewTransform; stageW: number; stageH: number }): Promise<void>;
  /** 退出 3D：压平为正俯视后淡出（原 L3690-3706） */
  exit(): Promise<void>;
  /** 3D 截图（原 `shot()`，L3888） */
  shot(): void;
  /** 屏幕坐标 → 地面户型坐标 + 该处每个 mm 的屏幕像素（原 `groundAt`，L3728-3741） */
  groundAt(clientX: number, clientY: number): { x: number; y: number; s: number } | null;
  /** 原 L3660-3667 */
  flyToRoom(roomId: string): void;
  /** 原 `isoWhole()`，L3634 */
  iso(): void;
  /** 原 `topWhole()`，L3635 */
  top(): void;
  /** 原 L3892（键盘守卫用，L1779） */
  walking(): boolean;
  /** 语言切换后重建 CSS2D 标签（原 `relang`，L3890） */
  relabel(): void;
  /**
   * 场景内容统计（只读诊断，可选）。
   *
   * 供 E2E 断言「几何是否真的被建出来」。D-A / D-B 这类装配缺陷的特点是
   * 所有单测 / lint / 类型检查全绿，但场景里一个 mesh 都没有——
   * 只有读这个统计才能发现。声明为可选是因为测试替身可能不实现它。
   */
  stats?(): SceneStats;
}

/** 场景内容统计（与 `SceneEngine['stats']` 的返回一致） */
export interface SceneStats {
  archMeshes: number;
  furnMeshes: number;
  labels: number;
  colliders: number;
  signature: string;
  active: boolean;
}
