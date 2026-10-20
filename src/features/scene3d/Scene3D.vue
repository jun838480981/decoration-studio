<script setup lang="ts">
/**
 * 3D 视口组件（SPEC §C.1 / §F.3 / §F.4 / §F.7 / §E.8）。
 *
 * 职责（**只做组件该做的事**，渲染与几何全在 `engine.ts`）：
 * 1. 挂载：创建引擎 → 经 `utils/scenePort` 注册 `Scene3DApi`（⛔ 不用 `window.View3D`，X3 不保留项）；
 * 2. 生命周期：`onBeforeUnmount` **无条件** `engine.dispose()`（停 rAF / 解绑监听 / 释放 GPU 资源）+ 注销端口；
 * 3. `watch` 契约（§F.3）：三签名的输入源变化 → `engine.sync()`；未激活时引擎自己只置 dirty；
 * 4. 主题联动（§E.8 T4）：`theme.presetId` / `ui.view3d.night` 变化 → `engine.applyTheme()`（**不重建几何**）；
 * 5. 3D 内的 UI：漫游遮罩 / 准星 / 摇杆 / 提示条 / 房间列表 / 视角与剖切控件。
 *
 * ⛔ 本文件不出现任何十六进制色值（§E.8 T2）；标签与遮罩配色一律走 `--ds-*`（§E.8 T5）。
 * ⛔ 不 import `features/plan2d/**`、`features/extras/**`（§C.2 B1/B2）。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import { useEventListener } from '@vueuse/core';
import { useAppLang } from '@/composables/useAppLang';
import { usePointerKind } from '@/composables/usePointerKind';
import { stageSize, useResizeFit } from '@/composables/useResizeFit';
import { useLayoutStore } from '@/stores/layout';
import { usePlanStore } from '@/stores/plan';
import { useThemeStore } from '@/stores/theme';
import { useToastStore } from '@/stores/toast';
import { useUiStore } from '@/stores/ui';
import { registerScene3D } from '@/utils/scenePort';
import { createSceneEngine, type SceneEngine } from './engine';
import { CUT_FULL, CUT_LOW, SHOT_FILENAME } from './scene';
import type { Scene3DApi } from '@/types/scene3d';

/* ======================= 依赖 ======================= */

const plan = usePlanStore();
const layout = useLayoutStore();
const ui = useUiStore();
const theme = useThemeStore();
const toast = useToastStore();
const lang = useAppLang();
const { coarse } = usePointerKind();

const host = ref<HTMLDivElement | null>(null);
/** 引擎实例：`shallowRef`（引擎内部有大量可变状态，⛔ 不做深响应式；只需「有/无」可响应） */
const engine = shallowRef<SceneEngine | null>(null);

/** 漫游 UI 状态（由引擎回调驱动；组件只渲染） */
const walkState = reactive({ walking: false, locked: false, touch: false });
/** 摇杆手柄位移（px） */
const joyKnob = reactive({ x: 0, y: 0 });

const JOY_RADIUS = 50;

const texts = computed(() => {
  const en = lang.value === 'en';
  return {
    orbitHint: en
      ? '1 finger orbits · 2 fingers zoom / pan · select furniture to drag it · tap doors to open'
      : '单指旋转 · 双指缩放 / 平移 · 点选家具后可拖动摆放 · 点门开关',
    touchHint: en ? 'Joystick moves · drag to look · tap doors to open' : '左下摇杆移动 · 拖动画面转向 · 点门开关',
    walkHint: en
      ? 'WASD moves · mouse looks · Shift runs · E opens doors · Esc pauses'
      : 'WASD 移动 · 鼠标转向 · Shift 快走 · E 开关门 · Esc 暂停',
    walkTitle: en ? 'Walk mode' : '漫游模式',
    walkLine1: en ? 'Click to start at the front door' : '点击开始，从入户门进入',
    walkLine2: en ? 'Joystick moves · drag on screen to look' : '左下摇杆移动 · 在画面上拖动转向',
    walkLine3: en ? 'Tap doors to open them · Esc to pause' : '点门开关 · Esc 暂停',
    exitWalk: en ? 'Exit walk' : '退出漫游',
    iso: en ? 'Iso' : '斜视',
    top: en ? 'Top' : '俯视',
    shot: en ? 'Shot' : '截图',
    cutFull: en ? 'Full walls' : '全高墙',
    cutLow: en ? 'Cut walls' : '剖切墙',
    night: en ? 'Night' : '夜景',
    hour: en ? 'Sun' : '日照',
    rooms: en ? 'Rooms' : '房间',
    allRooms: en ? 'Whole home' : '全屋',
    walk: en ? 'Walk' : '漫游',
  };
});

/** 提示条文案（原 `syncHint3d()`，L3759） */
const hintText = computed(() => {
  if (ui.view3d.mode === 'orbit') return texts.value.orbitHint;
  return walkState.touch ? texts.value.touchHint : texts.value.walkHint;
});

/* ======================= 引擎装配 ======================= */

/** 房间地面材质表（`layout.rooms[id].mat`，原 `states.rooms[id].mat`） */
function roomMats(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, override] of Object.entries(layout.rooms)) out[id] = override.mat;
  return out;
}

function createEngine(): SceneEngine | null {
  const element = host.value;
  if (!element) return null;
  return createSceneEngine({
    host: element,
    presetId: theme.presetId,
    night: ui.view3d.night,
    view: { ...ui.view },
    stageW: stageSize.w,
    stageH: stageSize.h,
    // §F.1：3D 只读 store，⛔ 不持有副本；每次读都取当前值
    readPlan: () => ({
      plan: plan.plan,
      level: plan.level,
      stairs: plan.stairs,
      bounds: plan.bounds,
      roomMats: roomMats(),
      rooms: plan.rooms,
    }),
    readLayout: () => ({
      rooms: layout.rooms,
      demolished: layout.demolished,
      furniture: layout.furniture,
      snapshot: () => layout.snapshot(),
    }),
    readUi: () => ({
      view3d: ui.view3d,
      flags: ui.flags,
      selectedFurnitureId: ui.selection?.kind === 'furn' ? ui.selection.id : null,
    }),
    // §C.2 B8：3D 侧只写 `stores/layout`；拖动中只改 `cx/cy`，松手由 `commitLayout` 进撤销栈（原 L2769-2773）
    writeFurniturePosition: (id, x, y) => {
      const target = layout.getF(id);
      if (!target) return;
      target.cx = x;
      target.cy = y;
    },
    commitLayout: (before) => layout.commit(before),
    selectFurniture: (id) => ui.select({ kind: 'furn', id }),
    selectRoom: (id) => ui.select({ kind: 'room', id }),
    clearSelection: () => ui.select(null),
    onPointerLockError: () => {
      // 原 L3855-3856：桌面锁指针失败 → 回退摇杆漫游，并给出提示（⛔ 不静默失败）
      toast.push(
        lang.value === 'en' ? 'Pointer lock failed, using joystick' : '指针锁定失败，已切换到摇杆漫游',
        'warn',
      );
      engine.value?.setTouchWalk(true);
    },
    onWalkStateChange: (state) => {
      walkState.walking = state.walking;
      walkState.locked = state.locked;
      walkState.touch = state.touch;
    },
  });
}

/* ======================= 挂载 / 卸载 ======================= */

onMounted(() => {
  engine.value = createEngine();
  if (!engine.value) return;
  const api = engine.value.api as Scene3DApi & {
    applyTheme?: (presetId: typeof theme.presetId, night: boolean) => void;
  };
  // P0-9 接线通道：`features/extras` 经结构化探测调用 `applyTheme`（SPEC §F.4 冻结接口不扩签名）
  api.applyTheme = (presetId, night) => engine.value?.applyTheme(presetId, night);
  registerScene3D(api);
});

onBeforeUnmount(() => {
  // §F.7：卸载必须**无条件**停循环 + 释放全部资源；端口同步注销，避免 store 拿到悬空 API
  registerScene3D(null);
  engine.value?.dispose();
  engine.value = null;
});

/* ======================= 尺寸（§F.7：2D/3D 共用同一个 observer 语义） ======================= */

useResizeFit(host, {
  onFirst: (w, h) => engine.value?.resize(w, h),
  onResize: (w, h) => engine.value?.resize(w, h),
});

/* ======================= 三签名（§F.3） ======================= */

// arch / labels 的输入源（`furniture` 单独 deep watch，避免家具变化时深遍历整个结构）
watch(
  () => [plan.plan, plan.level, plan.stairs, layout.rooms, layout.demolished, ui.view3d.cut] as const,
  () => engine.value?.sync(),
  { deep: true },
);
// furn 的输入源：`{ deep: true }` 仅此一处（§F.3 明文要求）
watch(() => layout.furniture, () => engine.value?.sync(), { deep: true });

/* ======================= 主题 / 光照 / 选项 ======================= */

watch(
  () => [theme.presetId, ui.view3d.night] as const,
  ([presetId, night]) => engine.value?.applyTheme(presetId, night),
);
watch(
  () => [ui.view3d.hour, ui.view3d.night] as const,
  ([hour, night]) => engine.value?.setLighting(hour, night),
);
watch(
  () => ui.view3d.cut,
  (cut) => engine.value?.setCut(cut),
);
watch(
  () => [ui.flags.furn, ui.view3d.furn] as const,
  ([layerOn, viewOn]) => engine.value?.setFurnitureVisible(layerOn && viewOn),
);
watch(
  () => ui.view3d.labels,
  (on) => engine.value?.setLabelsVisible(on),
);
watch(
  () => ui.view3d.mode,
  (mode) => engine.value?.setMode(mode),
);

/* ======================= 指针 / 摇杆 ======================= */

function onPointerDown(e: PointerEvent): void {
  engine.value?.onPointerDown(e);
}

function onPointerMove(e: PointerEvent): void {
  engine.value?.onPointerMove(e);
}

function onPointerUp(e: PointerEvent): void {
  engine.value?.onPointerUp(e);
}

/** 漫游遮罩点击（原 L3855：触屏走摇杆，桌面走指针锁定） */
function startWalk(): void {
  if (coarse) engine.value?.setTouchWalk(true);
  else engine.value?.requestPointerLock();
}

function exitWalk(): void {
  ui.set3dOption('mode', 'orbit');
}

/** 摇杆（原 `bindJoystick()`，L3776-3788）：半径 50px，输出归一化 `joy.x/joy.y ∈ [-1,1]` */
const joyPointer = ref<number | null>(null);
const joyEl = ref<HTMLDivElement | null>(null);

function joyMove(clientX: number, clientY: number, target: HTMLElement): void {
  const rect = target.getBoundingClientRect();
  const dx = clientX - (rect.left + rect.width / 2);
  const dy = clientY - (rect.top + rect.height / 2);
  const len = Math.hypot(dx, dy);
  const k = len > JOY_RADIUS ? JOY_RADIUS / len : 1;
  joyKnob.x = dx * k;
  joyKnob.y = dy * k;
  const instance = engine.value;
  if (!instance) return;
  instance.joy.x = Math.max(-1, Math.min(1, joyKnob.x / JOY_RADIUS));
  instance.joy.y = Math.max(-1, Math.min(1, joyKnob.y / JOY_RADIUS));
}

function joyStart(e: PointerEvent): void {
  joyPointer.value = e.pointerId;
  const target = e.currentTarget as HTMLElement;
  target.setPointerCapture(e.pointerId);
  const instance = engine.value;
  if (instance) instance.joy.id = e.pointerId;
  joyMove(e.clientX, e.clientY, target);
}

function joyDrag(e: PointerEvent): void {
  if (joyPointer.value !== e.pointerId) return;
  joyMove(e.clientX, e.clientY, e.currentTarget as HTMLElement);
}

function joyEnd(e: PointerEvent): void {
  if (joyPointer.value !== e.pointerId) return;
  joyPointer.value = null;
  joyKnob.x = 0;
  joyKnob.y = 0;
  const instance = engine.value;
  if (!instance) return;
  instance.joy.x = 0;
  instance.joy.y = 0;
  instance.joy.id = null;
}

// 摇杆 DOM 事件一律经 `useEventListener`（B7），句柄随组件卸载自动解绑
useEventListener(joyEl, 'pointerdown', joyStart);
useEventListener(joyEl, 'pointermove', joyDrag);
useEventListener(joyEl, 'pointerup', joyEnd);
useEventListener(joyEl, 'pointercancel', joyEnd);

/** 3D 内键盘：Esc 退出漫游（原 L3835 的键盘守卫；`walking()` 供全局快捷键让路） */
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.code === 'Escape' && ui.view3d.mode === 'walk') exitWalk();
});

/* ======================= 3D 内控件 ======================= */

const roomEntries = computed(() => engine.value?.roomEntries() ?? []);

function flyToRoom(id: string): void {
  if (id === '__all') engine.value?.iso();
  else engine.value?.flyToRoom(id);
}

function toggleCut(): void {
  ui.set3dOption('cut', ui.view3d.cut < CUT_FULL ? CUT_FULL : CUT_LOW);
}

function toggleNight(): void {
  ui.set3dOption('night', !ui.view3d.night);
}

function setHour(value: string): void {
  const hour = Number(value);
  if (Number.isFinite(hour)) ui.set3dOption('hour', hour);
}

function toggleMode(): void {
  ui.set3dOption('mode', ui.view3d.mode === 'walk' ? 'orbit' : 'walk');
}

function takeShot(): void {
  engine.value?.shot(SHOT_FILENAME);
}

defineExpose<Scene3DApi>({
  enter: (ctx) => engine.value?.enter(ctx) ?? Promise.resolve(),
  exit: () => engine.value?.exit() ?? Promise.resolve(),
  shot: () => takeShot(),
  groundAt: (clientX, clientY) => engine.value?.groundAt(clientX, clientY) ?? null,
  flyToRoom: (roomId) => engine.value?.flyToRoom(roomId),
  iso: () => engine.value?.iso(),
  top: () => engine.value?.top(),
  walking: () => engine.value?.walking() ?? false,
  relabel: () => engine.value?.relabel(),
});
</script>

<template>
  <div
    ref="host"
    class="ds3d"
    :class="{ 'ds3d--walk': ui.view3d.mode === 'walk' }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <!-- 提示条（原 `#hint3d`）：动画期间淡出 -->
    <div class="ds3d__hint">{{ hintText }}</div>

    <!-- 漫游遮罩（原 `#walkOverlay`）：未锁指针时显示 -->
    <div v-if="walkState.walking && !walkState.locked && !walkState.touch" class="ds3d__overlay" @click="startWalk">
      <div class="ds3d__overlay-box">
        <h3>{{ texts.walkTitle }}</h3>
        <p>{{ texts.walkLine1 }}</p>
        <p>{{ texts.walkLine2 }}</p>
        <p>{{ texts.walkLine3 }}</p>
      </div>
    </div>

    <!-- 准星（原 `#cross`）：锁指针后显示 -->
    <div v-if="walkState.walking && walkState.locked" class="ds3d__cross" aria-hidden="true" />

    <!-- 摇杆（原 `#joy`）：仅触屏漫游 -->
    <div v-if="walkState.touch" ref="joyEl" class="ds3d__joy" role="group" aria-label="joystick">
      <i class="ds3d__joy-knob" :style="{ transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)` }" />
    </div>

    <!-- 退出漫游（原 `#walkExit`） -->
    <button v-if="walkState.walking" type="button" class="ds3d__btn ds3d__btn--exit" @click="exitWalk">
      {{ texts.exitWalk }}
    </button>

    <!-- 3D 控件条：视角 / 剖切 / 日照 / 夜景 / 截图 / 漫游 -->
    <div class="ds3d__bar" role="toolbar" :aria-label="texts.rooms">
      <button type="button" class="ds3d__btn" @click="engine?.iso()">{{ texts.iso }}</button>
      <button type="button" class="ds3d__btn" @click="engine?.top()">{{ texts.top }}</button>
      <button
        type="button"
        class="ds3d__btn"
        :class="{ 'ds3d__btn--on': ui.view3d.cut < CUT_FULL }"
        @click="toggleCut"
      >
        {{ ui.view3d.cut < CUT_FULL ? texts.cutLow : texts.cutFull }}
      </button>
      <button type="button" class="ds3d__btn" :class="{ 'ds3d__btn--on': ui.view3d.night }" @click="toggleNight">
        {{ texts.night }}
      </button>
      <label class="ds3d__range">
        <span>{{ texts.hour }}</span>
        <input
          type="range"
          min="7"
          max="18"
          step="0.25"
          :value="ui.view3d.hour"
          :aria-label="texts.hour"
          @input="setHour(($event.target as HTMLInputElement).value)"
        />
      </label>
      <button
        type="button"
        class="ds3d__btn"
        :class="{ 'ds3d__btn--on': ui.view3d.mode === 'walk' }"
        @click="toggleMode"
      >
        {{ texts.walk }}
      </button>
      <button type="button" class="ds3d__btn" @click="takeShot">{{ texts.shot }}</button>
    </div>

    <!-- 房间列表（原 L3574-3581；`__all` 在最后） -->
    <div class="ds3d__rooms" role="group" :aria-label="texts.rooms">
      <button v-for="entry in roomEntries" :key="entry.id" type="button" class="ds3d__room" @click="flyToRoom(entry.id)">
        <span>{{ entry.id === '__all' ? texts.allRooms : entry.name }}</span>
        <small>{{ entry.area.toFixed(1) }}m²</small>
      </button>
    </div>
  </div>
</template>

<!--
  ⚠️ 非 scoped：`.rlabel` 是 `CSS2DRenderer` **运行时创建**的 DOM（挂在 `labelRenderer.domElement` 上），
  Vue 的 scoped 属性不会加到它们身上。因此统一用 `.ds3d` 前缀收敛作用域，
  颜色全部走 `--ds-*` 令牌（SPEC §E.8 T5：标签在深浅主题下都必须可读）。
-->
<style>
.ds3d {
  position: absolute;
  inset: 0;
  overflow: hidden;
  touch-action: none;
  background: var(--ds-bg);
  color: var(--ds-text);
}

.ds3d canvas {
  display: block;
  outline: none;
}

/* ---- CSS2D 房间标签（原 `.rlabel`，L140-142）---- */
.ds3d .rlabel {
  padding: 2px 9px;
  border: 1px solid var(--ds-border-strong);
  border-radius: 12px;
  background: var(--ds-surface);
  color: var(--ds-text);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
}

.ds3d .rlabel small {
  margin-left: 4px;
  color: var(--ds-text-muted);
  font-weight: 400;
}

/* ---- 提示条 ---- */
.ds3d__hint {
  position: absolute;
  top: 12px;
  left: 50%;
  z-index: 2;
  max-width: min(92vw, 720px);
  padding: 5px 14px;
  border-radius: 20px;
  background: var(--ds-surface-2);
  border: 1px solid var(--ds-border);
  color: var(--ds-text-secondary);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transform: translateX(-50%);
  pointer-events: none;
  transition: opacity 0.4s;
}

/* ---- 漫游遮罩 ---- */
.ds3d__overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--ds-text) 35%, transparent);
  cursor: pointer;
}

.ds3d__overlay-box {
  max-width: 360px;
  padding: 22px 28px;
  border-radius: 14px;
  background: var(--ds-surface);
  border: 1px solid var(--ds-border-strong);
  text-align: center;
}

.ds3d__overlay-box h3 {
  margin: 0 0 6px;
  font-size: 15px;
}

.ds3d__overlay-box p {
  margin: 4px 0;
  color: var(--ds-text-muted);
  font-size: 12px;
}

/* ---- 准星 ---- */
.ds3d__cross {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 2;
  width: 14px;
  height: 14px;
  margin: -7px 0 0 -7px;
  pointer-events: none;
}

.ds3d__cross::before,
.ds3d__cross::after {
  content: '';
  position: absolute;
  background: var(--ds-text);
  opacity: 0.85;
}

.ds3d__cross::before {
  top: 0;
  left: 6px;
  width: 2px;
  height: 14px;
}

.ds3d__cross::after {
  top: 6px;
  left: 0;
  width: 14px;
  height: 2px;
}

/* ---- 摇杆 ---- */
.ds3d__joy {
  position: absolute;
  bottom: 28px;
  left: 28px;
  z-index: 3;
  width: 130px;
  height: 130px;
  border-radius: 50%;
  background: var(--ds-surface-2);
  border: 1px solid var(--ds-border-strong);
  touch-action: none;
}

.ds3d__joy-knob {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 56px;
  height: 56px;
  margin: -28px 0 0 -28px;
  border-radius: 50%;
  background: var(--ds-accent-soft);
  border: 1px solid var(--ds-accent);
}

/* ---- 控件条 / 房间列表 ---- */
.ds3d__bar {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: min(96vw, 560px);
  padding: 4px;
  border-radius: 10px;
  background: var(--ds-surface);
  border: 1px solid var(--ds-border);
}

.ds3d__btn {
  padding: 4px 9px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--ds-text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.ds3d__btn:hover {
  background: var(--ds-accent-soft);
  color: var(--ds-accent);
}

.ds3d__btn--on {
  border-color: var(--ds-accent);
  background: var(--ds-accent-soft);
  color: var(--ds-accent);
}

.ds3d__btn--exit {
  position: absolute;
  right: 16px;
  bottom: 28px;
  z-index: 3;
  background: var(--ds-accent);
  color: var(--ds-on-accent);
}

.ds3d__range {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px;
  color: var(--ds-text-muted);
  font-size: 12px;
}

.ds3d__range input {
  width: 96px;
  accent-color: var(--ds-accent);
}

.ds3d__rooms {
  position: absolute;
  bottom: 16px;
  left: 50%;
  z-index: 2;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  gap: 4px;
  width: min(92vw, 560px);
  padding: 6px;
  border-radius: 10px;
  background: var(--ds-surface);
  border: 1px solid var(--ds-border);
  transform: translateX(-50%);
}

.ds3d__room {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 5px 8px;
  border: 1px solid var(--ds-border);
  border-radius: 7px;
  background: var(--ds-surface-2);
  color: var(--ds-text);
  font-size: 12px;
  line-height: 1.3;
  cursor: pointer;
  text-align: left;
}

.ds3d__room:hover {
  background: var(--ds-accent-soft);
  color: var(--ds-accent);
}

.ds3d__room small {
  color: var(--ds-text-muted);
  font-variant-numeric: tabular-nums;
}

/* 触屏：摇杆占位时房间列表上移，避免重叠 */
@media (pointer: coarse) {
  .ds3d__rooms {
    bottom: 168px;
  }
}
</style>
