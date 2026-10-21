<script setup lang="ts">
/**
 * 2D 平面画布（原 `svg#plan`，L356-368 + 指针处理 L1642-1773 + `applyView` L1589-1598）。
 *
 * 职责边界：
 * - **只做视图**：`viewBox` 由 `ui.view` 派生（`x0 y0 w/s h/s`），颜色全部来自 `theme.resolve()`
 *   的字面值（B9 / R-EXP-1）；结构数据一律从 store 读，⛔ 不持有副本（SPEC §F.1）。
 * - 10 个图层各是独立组件（`layers/*.vue`），按 §F.2 的依赖矩阵各自 watch，
 *   家具拖动时只有 `FurnitureLayer` / `SelectionLayer` 重算（RISK-03）。
 * - 指针/滚轮/双指手势交给 `useStageInteraction()`（`composables/usePointerPanZoom.ts`，
 *   事件生命周期由 `@vueuse/core` 管理，B7）。
 *
 * 对外契约（`defineExpose`）：
 * - `svg`：`<svg>` 节点（亮点层的 SVG/PNG 导出按 `svg[data-plan-canvas]` 约定取用）；
 * - `toMM(clientX, clientY)`：屏幕 → 户型坐标（家具库拖放落点用）；
 * - `fit()`：适应窗口（快捷键 `F` / 按钮）。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useLayoutStore } from '@/stores/layout';
import { useUiStore } from '@/stores/ui';
import { useResizeFit } from '@/composables/useResizeFit';
import { useStageInteraction, type StageHit } from '@/composables/usePointerPanZoom';
import { useShortcuts } from '@/composables/useShortcuts';
import { usePlanEditor } from './editing';
import { useToastStore } from '@/stores/toast';
import { usePlanStore } from '@/stores/plan';
import { useTheme } from '@/theme/useTheme';
import { registerDrawingSheetPort } from '@/utils/drawingSheetPort';
import { createDrawingSheetPort } from './export-svg';
import { PLAN_FONT_FAMILY } from './export-svg';
import DefsLayer from './layers/DefsLayer.vue';
import GridLayer from './layers/GridLayer.vue';
import RoomLayer from './layers/RoomLayer.vue';
import FurnitureLayer from './layers/FurnitureLayer.vue';
import WallLayer from './layers/WallLayer.vue';
import OpeningLayer from './layers/OpeningLayer.vue';
import LabelLayer from './layers/LabelLayer.vue';
import DimLayer from './layers/DimLayer.vue';
import MeasureLayer from './layers/MeasureLayer.vue';
import SelectionLayer from './layers/SelectionLayer.vue';
import EditLayer from './layers/EditLayer.vue';

const emit = defineEmits<{
  /** 指针在户型坐标中的位置 + 悬停房间（footer 的 X / Y / hover，原 L386-392） */
  (event: 'pointer', payload: { x: number; y: number; roomId: string | null }): void;
}>();

const ui = useUiStore();
const layout = useLayoutStore();
const toast = useToastStore();
const editor = usePlanEditor();

const svgEl = ref<SVGSVGElement | null>(null);

/** 舞台尺寸（`viewBox` 的宽高 = `w / view.s`） */
const stage = ref({ w: 0, h: 0 });

const viewBox = computed(() => {
  const { w, h } = stage.value;
  const s = ui.view.s;
  if (w <= 0 || h <= 0 || s <= 0) return '0 0 1 1';
  return `${ui.view.x0} ${ui.view.y0} ${w / s} ${h / s}`;
});

/** 工具 → CSS 类（原 `svg.setAttribute('class', 'tool-' + t)`，L1574） */
const stageClass = computed(() => [
  `tool-${ui.edit.on ? 'edit' : ui.tool}`,
  { panning: interaction.panning.value },
]);

/** 从事件目标读 `data-*`（命中键：手柄 / 家具 / 墙 / 房间 / 门窗洞） */
function hitOf(target: EventTarget | null): StageHit {
  const element = target instanceof Element ? target : null;
  const data = (name: string): string | null => element?.closest(`[data-${name}]`)?.getAttribute(`data-${name}`) ?? null;
  return {
    handle: data('handle'),
    furnId: data('fid'),
    wallId: data('wall'),
    roomId: data('room'),
    opKey: data('op'),
  };
}

/**
 * 键盘选中家具（无障碍）。
 *
 * 家具 `<g>` 现在带 `tabindex="0"` + `role="button"`，可用 Tab 遍历到，
 * 但「聚焦」不等于「选中」——还需要 Enter/Space 把焦点转成 `ui.selection`。
 * 选中之后，`useShortcuts` 里已有的方向键移动 / R 旋转 / Delete 删除才会生效，
 * 键盘操作链路才算闭合（此前只有后半段，没有入口）。
 */
function onStageKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const furnId = hitOf(event.target).furnId;
  if (!furnId) return;
  event.preventDefault();
  ui.select({ kind: 'furn', id: furnId });
  // 与鼠标点击保持一致：选中后切到选择工具，避免在测量/拆改态下误操作
  if (ui.tool !== 'select') ui.setTool('select');
}

const interaction = useStageInteraction({
  svg: svgEl,
  hitOf,
  onStageDown: () => ui.openDrawer(null, false),
  onToast: (message, kind) => toast.push(message, kind),
});

// ---- 尺寸：首次 fitView，之后保持画面中心（原 L2652-2657） ----
let lastW = 0;
let lastH = 0;
useResizeFit(svgEl, {
  onFirst: (w, h) => {
    lastW = w;
    lastH = h;
    stage.value = { w, h };
    ui.fitView(w, h);
  },
  onResize: (w, h) => {
    if (lastW > 0 && lastH > 0) {
      // 保持画面中心不动（原 L2655）
      ui.view.x0 -= (w - lastW) / 2 / ui.view.s;
      ui.view.y0 -= (h - lastH) / 2 / ui.view.s;
    }
    lastW = w;
    lastH = h;
    stage.value = { w, h };
  },
});

// footer 的坐标/悬停（原 `#cx/#cy/#hover`）
watch(
  () => ({ x: interaction.pointer.x, y: interaction.pointer.y, roomId: interaction.pointer.roomId }),
  (payload) => emit('pointer', payload),
);

/** 适应窗口（快捷键 F / 工具栏「适应」） */
function fit(): void {
  ui.fitView(stage.value.w, stage.value.h);
}

// 全局快捷键（原 `keydown` 处理器，L1777-1810）：`F` 需要画布尺寸、`Enter` 需要编辑内核，
// 所以在这里挂一次（`document` 级监听，由 `@vueuse/core` 自动解绑，B7）。
useShortcuts({ fit, closeRoom: () => editor.closeRoom() });

/**
 * 注册「施工图导出端口」。
 *
 * `features/extras` 的导出菜单需要导出带图框的施工图，但它**不能 import `features/plan2d`**
 * （SPEC §C.2 B1/B2：跨特性只能经 stores/types/utils/theme）。
 * 因此由本组件在挂载时把实现注册到中立层 `utils/drawingSheetPort.ts`，
 * extras 侧经端口调用——与 3D 的 `utils/scenePort.ts` 同一模式。
 *
 * 卸载时注销，避免 extras 拿到已卸载画布的悬空引用。
 */
const planStore = usePlanStore();
const { resolve } = useTheme();

onMounted(() => {
  registerDrawingSheetPort(
    createDrawingSheetPort({
      getSvg: () => svgEl.value,
      getBounds: () => planStore.bounds,
      resolve,
      getGridOn: () => ui.flags.grid,
    }),
  );
});

onBeforeUnmount(() => {
  registerDrawingSheetPort(null);
});

defineExpose({
  svg: svgEl,
  toMM: interaction.toMM,
  fit,
  stage,
});

// 家具层/选中层的重算在各自组件内部；这里只保证 layout 的 `snapRects` 懒计算被引用，
// 避免「没有任何组件读 snapRects 时 computed 永不建立」的假象（吸附在 composable 里读）。
void layout;
</script>

<template>
  <svg
    ref="svgEl"
    data-plan-canvas
    :class="stageClass"
    :viewBox="viewBox"
    :font-family="PLAN_FONT_FAMILY"
    preserveAspectRatio="xMinYMin meet"
    role="application"
    aria-label="2D 平面图"
    @keydown="onStageKeydown"
  >
    <DefsLayer />
    <GridLayer />
    <RoomLayer />
    <FurnitureLayer />
    <WallLayer />
    <OpeningLayer />
    <LabelLayer />
    <DimLayer />
    <MeasureLayer />
    <SelectionLayer />
    <EditLayer />
  </svg>
</template>

<style scoped>
svg {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  cursor: default;
}

svg.panning {
  cursor: grabbing;
}

svg.tool-measure,
svg.tool-edit {
  cursor: crosshair;
}

/* 原 L58-63：墙体默认不吃指针；拆改工具下才可点 */
svg :deep(.wall) {
  pointer-events: none;
}

svg.tool-demolish :deep(.wall) {
  pointer-events: all;
  cursor: pointer;
}

svg.tool-demolish :deep(.wall:hover) {
  fill: var(--ds-accent);
}

svg.tool-select :deep(.room:hover) {
  opacity: 0.82;
}

svg :deep(.furn) {
  cursor: move;
}

/* 原 L182-189：编辑模式下墙与门窗可点、房间用透明补层承接点击 */
svg.tool-edit :deep(.wall),
svg.tool-edit :deep([data-op]) {
  pointer-events: all;
}

svg.tool-edit :deep(.room) {
  pointer-events: none;
}

svg.tool-edit :deep(.wall:hover) {
  fill: var(--ds-wall-demolished);
}

svg.tool-edit :deep([data-op]:hover) {
  opacity: 0.6;
}

svg.tool-edit :deep(.room[fill='transparent']) {
  pointer-events: all;
}

svg.tool-edit :deep(.room[fill='transparent']:hover) {
  fill: var(--ds-accent-soft);
}

svg.tool-edit :deep(#gEdit),
svg.tool-edit :deep(#gEdit *) {
  pointer-events: none;
}

svg :deep([data-handle]) {
  cursor: pointer;
}

svg :deep([data-handle='size']) {
  cursor: nwse-resize;
}
</style>
