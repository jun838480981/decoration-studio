<script setup lang="ts">
/**
 * 应用外壳（**t2 一次性装配**，SPEC §C.1 / §F.2；DOM 顺序对齐原 `装修设计.html` L257-410）。
 *
 * 布局（原 `.app` 网格 L21-23）：
 * ```
 * <header>                       ← AppHeader（含 ToolBar 插槽 + 亮点入口插槽）
 * <aside class="lib">            ← FurnitureLibrary（宽屏可收起 / 窄屏抽屉）
 * <main class="stage">           ← PlanCanvas（2D）+ scene3d 挂载位 + 比例尺 + 模式提示 + SelectionFab
 * <aside class="right">          ← PropertyPanel
 * <footer>                       ← 坐标 / 比例 / 悬停 / 提示
 * ```
 *
 * 跨特性挂载位（**契约见 `composables/useViewMounts.ts`**）：
 * | 挂载位 | 位置 | 归属 |
 * | --- | --- | --- |
 * | `scene3d` | `<main>` 内、`PlanCanvas` 之后 | scene3d-dev（t5） |
 * | `extras-toolbar` | `<AppHeader>` 的 `#extras` 插槽（主题/语言之前） | features-dev（t6） |
 * | `extras-overlay` | `<main>` 之后、`ToastHost` 之前 | features-dev（t6） |
 *
 * 传参（挂载位组件按需声明，多余项落到 attrs 不报错）：
 * - `getSvg: () => SVGSVGElement | null`（2D 画布节点，导出用；等价 `svg[data-plan-canvas]`）
 * - `resolveDrop: (clientX, clientY) => {x,y,s} | null`（家具库拖放落点）
 * - `fit: () => void`（适应窗口）
 * - `getStage: () => HTMLElement | null`（舞台节点）
 *
 * ⛔ 本文件不写业务逻辑；⛔ 不 import `features/scene3d/**` 或 `features/extras/**`（它们并行开发中，
 * 由各自模块顶层 `registerViewMount()` 注册，见 `main.ts` 的注释）。
 */
import { computed, ref } from 'vue';
import AppHeader from '@/components/AppHeader.vue';
import ToolBar from '@/components/ToolBar.vue';
import FurnitureLibrary from '@/components/FurnitureLibrary.vue';
import PropertyPanel from '@/components/PropertyPanel.vue';
import PlanLibraryModal from '@/components/PlanLibraryModal.vue';
import SelectionFab from '@/components/SelectionFab.vue';
import ToastHost from '@/components/ToastHost.vue';
import ConfirmDialog from '@/components/dialogs/ConfirmDialog.vue';
import PromptDialog from '@/components/dialogs/PromptDialog.vue';
import PlanCanvas from '@/features/plan2d/PlanCanvas.vue';
import { useViewMounts } from '@/composables/useViewMounts';
import { closePlanLibrary, overlays } from '@/composables/useOverlays';
import { useUiStore } from '@/stores/ui';
import { usePlanStore } from '@/stores/plan';
import { useTheme } from '@/theme/useTheme';
import { stageSize } from '@/composables/useResizeFit';

const ui = useUiStore();
const plan = usePlanStore();
const { resolve } = useTheme();
const mounts = useViewMounts();

const canvas = ref<InstanceType<typeof PlanCanvas> | null>(null);
const stageEl = ref<HTMLElement | null>(null);
const pointer = ref({ x: 0, y: 0, roomId: null as string | null });

const Scene3D = computed(() => mounts.scene3d);
const ExtrasToolbar = computed(() => mounts['extras-toolbar']);
const ExtrasOverlay = computed(() => mounts['extras-overlay']);

/** 屏幕 → 户型坐标（家具库拖放用；3D 侧由 `Scene3DApi.groundAt` 负责） */
function resolveDrop(clientX: number, clientY: number): { x: number; y: number; s: number } | null {
  const point = canvas.value?.toMM(clientX, clientY) ?? null;
  if (!point) return null;
  return { x: point.x, y: point.y, s: ui.view.s };
}

function getSvg(): SVGSVGElement | null {
  return canvas.value?.svg ?? null;
}

function getStage(): HTMLElement | null {
  return stageEl.value;
}

function fit(): void {
  canvas.value?.fit();
}

/** 挂载位通用 props（见文件头注释的契约表） */
const mountProps = computed(() => ({
  getSvg,
  resolveDrop,
  getStage,
  fit,
}));

const hoverLabel = computed(() => {
  const id = pointer.value.roomId;
  if (!id) return '';
  const room = plan.rooms.find((item) => item.id === id);
  if (!room) return '';
  const override = plan.levelData;
  void override;
  return room.name;
});

const modeHint = computed(() => {
  if (ui.tool === 'measure') return '点击两点（或按住拖动）测量距离 · 靠近墙面自动吸附 · Shift 锁定水平/垂直 · Esc 取消';
  if (ui.tool === 'demolish') return '点击灰色非承重墙标记拆除，再次点击恢复 · 黑色承重墙不可拆';
  if (ui.edit.on) return '结构编辑：画墙 / 画房间 / 加门窗 / 删除 · 正交默认开启（Alt 自由角度）· Esc 取消当前绘制';
  return '';
});

const scaleBar = computed(() => ui.scaleBar);
</script>

<template>
  <div class="app" :class="{ 'app--hide-lib': ui.panes.hideLib, 'app--hide-panel': ui.panes.hidePanel }">
    <AppHeader class="app__header">
      <template #toolbar>
        <ToolBar />
      </template>
      <template #extras>
        <component :is="ExtrasToolbar" v-if="ExtrasToolbar" v-bind="mountProps" />
      </template>
    </AppHeader>

    <aside v-show="!ui.panes.hideLib" class="app__lib" aria-label="家具库">
      <FurnitureLibrary :resolve-drop="resolveDrop" :get-stage="getStage" />
    </aside>

    <main ref="stageEl" class="stage">
      <PlanCanvas ref="canvas" :class="{ 'stage__canvas--hidden': ui.is3D }" @pointer="pointer = $event" />

      <!-- 3D 视口挂载位（scene3d-dev 注册；未注册时给出明确提示，而不是静默空白） -->
      <div class="stage__view3d" :class="{ 'stage__view3d--on': ui.is3D }">
        <component :is="Scene3D" v-if="Scene3D" v-bind="mountProps" />
        <p v-else class="stage__placeholder">3D 模块尚未就绪（`features/scene3d/Scene3D.vue` 未注册）</p>
      </div>

      <div class="scalebar" :class="{ 'scalebar--hidden': ui.is3D }" aria-hidden="true">
        <span>{{ scaleBar.label }}</span>
        <div class="scalebar__bar" :style="{ width: `${scaleBar.len}px` }" />
      </div>

      <div v-if="modeHint" class="modehint">{{ modeHint }}</div>

      <SelectionFab />
    </main>

    <aside v-show="!ui.panes.hidePanel" class="app__panel" aria-label="属性面板">
      <PropertyPanel />
    </aside>

    <footer class="app__footer">
      <span>X <b>{{ pointer.x || '—' }}</b></span>
      <span>Y <b>{{ pointer.y || '—' }}</b></span>
      <span>当前比例 <b>{{ ui.ratioLabel }}</b></span>
      <span class="app__hover">{{ hoverLabel }}</span>
      <span class="spacer" />
      <span class="app__tip">{{ plan.plan.name }}{{ plan.isMulti ? ` · ${plan.levelName}` : '' }}</span>
    </footer>

    <PlanLibraryModal v-if="overlays.planLibrary" @close="closePlanLibrary()" />

    <!-- 亮点弹层挂载位（features-dev 注册） -->
    <component :is="ExtrasOverlay" v-if="ExtrasOverlay" v-bind="mountProps" />

    <ConfirmDialog />
    <PromptDialog />
    <ToastHost />

    <!-- 主题令牌变化时刷新比例尺等派生值（`resolve` 的依赖由各图层自行 watch） -->
    <span hidden>{{ resolve('canvas') }}{{ stageSize.w }}</span>
  </div>
</template>

<style scoped>
.app {
  display: grid;
  grid-template-columns: 236px minmax(0, 1fr) 300px;
  grid-template-rows: auto minmax(0, 1fr) 30px;
  height: 100vh;
  height: 100dvh;
  background: var(--ds-bg);
  color: var(--ds-text);
}

.app__header {
  grid-column: 1 / -1;
}

.app__lib {
  min-height: 0;
  border-right: 1px solid var(--ds-border);
  background: var(--ds-surface);
  overflow: hidden;
}

.app__panel {
  min-height: 0;
  border-left: 1px solid var(--ds-border);
  background: var(--ds-surface);
  overflow: hidden;
}

.app--hide-lib {
  grid-template-columns: 0 minmax(0, 1fr) 300px;
}

.app--hide-panel {
  grid-template-columns: 236px minmax(0, 1fr) 0;
}

.app--hide-lib.app--hide-panel {
  grid-template-columns: 0 minmax(0, 1fr) 0;
}

.stage {
  position: relative;
  min-height: 0;
  overflow: hidden;
  background: var(--ds-canvas);
}

.stage__canvas--hidden {
  opacity: 0;
  pointer-events: none;
}

.stage__view3d {
  position: absolute;
  inset: 0;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.45s ease, visibility 0s linear 0.45s;
}

.stage__view3d--on {
  opacity: 1;
  visibility: visible;
  transition: opacity 0.45s ease;
}

.stage__placeholder {
  position: absolute;
  inset: auto 0 50% 0;
  margin: 0;
  text-align: center;
  color: var(--ds-text-muted);
  font-size: 12px;
}

.scalebar {
  position: absolute;
  left: 14px;
  bottom: 12px;
  padding: 6px 10px;
  border: 1px solid var(--ds-border-strong);
  border-radius: 8px;
  background: var(--ds-surface);
  font-size: 12px;
  pointer-events: none;
  transition: opacity 0.3s;
}

.scalebar--hidden {
  opacity: 0;
}

.scalebar__bar {
  height: 6px;
  margin-top: 3px;
  border: 1.5px solid var(--ds-text);
  border-top: 0;
}

.modehint {
  position: absolute;
  left: 50%;
  top: 12px;
  transform: translateX(-50%);
  padding: 5px 12px;
  border-radius: 20px;
  background: var(--ds-text);
  color: var(--ds-surface);
  font-size: 12px;
  opacity: 0.92;
  pointer-events: none;
  max-width: calc(100% - 32px);
}

.app__footer {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 0 14px;
  border-top: 1px solid var(--ds-border);
  background: var(--ds-surface);
  color: var(--ds-text-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  white-space: nowrap;
}

.app__footer b {
  color: var(--ds-text);
  font-weight: 500;
}

.app__hover {
  overflow: hidden;
  text-overflow: ellipsis;
}

.spacer {
  flex: 1;
}

.app__tip {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 窄屏：两侧栏变抽屉浮层（原 L236-247） */
@media (max-width: 1100px) {
  .app {
    grid-template-columns: minmax(0, 1fr);
  }

  .app--hide-lib,
  .app--hide-panel,
  .app--hide-lib.app--hide-panel {
    grid-template-columns: minmax(0, 1fr);
  }

  .app__lib,
  .app__panel {
    position: absolute;
    top: 0;
    bottom: 30px;
    width: min(300px, 86vw);
    z-index: 20;
    box-shadow: 0 12px 40px rgb(0 0 0 / 20%);
  }

  .app__lib {
    left: 0;
  }

  .app__panel {
    right: 0;
  }
}
</style>
