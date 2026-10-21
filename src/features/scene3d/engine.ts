/**
 * 3D 引擎（`Scene3DApi` 的实现，SPEC §F.3 / §F.4 / §F.7 / §E.8）。
 *
 * 职责划分：
 * - **engine.ts**（本文件）：渲染器 / 场景 / 分组 / 三签名增量重建 / 主循环推进 / 事件 / dispose；
 * - `Scene3D.vue`：挂载与生命周期、`watch` 契约、`ResizeObserver`、摇杆与遮罩 UI、端口注册。
 *
 * 三条验收硬线（RISK-02 / §F.7）：
 * 1. **挂载不启动 `requestAnimationFrame`**：只有 `enter()` 之后才跑循环（`exit()` 后停）；
 * 2. `onUnmounted` 必须无条件停循环 + 解绑全部监听 + `renderer/labelRenderer/material/geometry/texture` 全释放；
 * 3. 切主题只 `applyTheme()`（材质 / 光照 / 曝光），**不触发** `buildArchitecture` / `buildFurniture`。
 */
import { useEventListener } from '@vueuse/core';
import {
  ACESFilmicToneMapping,
  Clock,
  Group,
  Scene,
  WebGLRenderer,
} from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { resolveToken } from '@/theme/applyTheme';
import { MATERIAL_PALETTES, NIGHT_LIGHTING_OVERRIDE, SCENE_THEME_BINDINGS, resolveSceneTheme } from '@/theme/material-palette';
import type { Bounds } from '@/types/geometry';
import type { Furniture } from '@/types/furniture';
import type { LayerFlags } from '@/types/state';
import type { MaterialPalette, ThemePresetId } from '@/types/theme';
import type { LayoutSlice, PlanSlice, Scene3DApi, SceneSignatures, UiSlice } from '@/types/scene3d';
import {
  buildArchitecture,
  createArchitectureGroups,
  setWalkAidsVisible,
  type ArchitectureGroups,
  type DoorHandle,
} from './architecture';
import { createCameraControls, type CameraControls } from './camera';
import { buildFurniture, createFurnitureDeps } from './furniture';
import { buildLabels, roomList, showLabels, type LabelInput, type RoomListEntry } from './labels';
import { createLighting, type LightingRig } from './lighting';
import { clearGroup, createMaterialLibrary, disposeObject, type MaterialLibrary } from './materials';
import { createPicking, type Picking } from './picking';
import {
  CUT_FULL,
  COARSE,
  DOOR_EASE,
  DOOR_KEY_DIST,
  DOOR_TAP_DIST,
  SHOT_FILENAME,
  TAP,
  clamp01,
  ease,
  worldConfigOf,
  type WorldConfig,
} from './scene';
import { createWalk, type JoystickState, type WalkController } from './walk';

/* ======================= 三签名（SPEC §F.3 🔒，逐字保留原语义 L3585-3591） ======================= */

/**
 * 三签名计算（原 `sync(force)` 的脏检查，L3585-3591）。
 * `arch = [layout.rooms, layout.demolished, ui.view3d.cut, plan.plan.id, plan.level, plan.stairs.length]`
 */
export function computeSignatures(plan: PlanSlice, layout: LayoutSlice, ui: UiSlice): SceneSignatures {
  return {
    arch: JSON.stringify([
      layout.rooms,
      layout.demolished,
      ui.view3d.cut,
      plan.plan.id,
      plan.level,
      plan.stairs.length,
    ]),
    furn: JSON.stringify(layout.furniture),
    labels: JSON.stringify([layout.rooms, ui.view3d.cut, plan.plan.id, plan.level]),
  };
}

/* ======================= 引擎接口 ======================= */

export interface EnterContext {
  view: { x0: number; y0: number; s: number };
  stageW: number;
  stageH: number;
}

export interface EngineDeps {
  host: HTMLElement;
  /** 当前主题预设（`useThemeStore.presetId`） */
  presetId: ThemePresetId;
  /** 3D 夜景开关（`ui.view3d.night`） */
  night: boolean;
  /** 进入 3D 时注入的 2D 视口位姿（SPEC §F.4） */
  view: { x0: number; y0: number; s: number };
  stageW: number;
  stageH: number;
  /** 空间状态读取（store 的只读投影；⛔ 引擎不持有副本） */
  readPlan: () => PlanSlice & { bounds: Bounds; roomMats: Record<string, string>; rooms: LabelInput['rooms'] };
  readLayout: () => LayoutSlice & { snapshot: () => string };
  readUi: () => UiSlice & { flags: LayerFlags; selectedFurnitureId: string | null };
  /** 写回（3D 拖动 → `layout.mutate`，SPEC §C.2 B8） */
  writeFurniturePosition: (id: string, x: number, y: number) => void;
  commitLayout: (before: string) => void;
  /** 选中联动（`ui.select`） */
  selectFurniture: (id: string) => void;
  selectRoom: (id: string) => void;
  clearSelection: () => void;
  /** 用到 3D 内部门状态的提示（进入漫游失败时回退摇杆） */
  onPointerLockError?: () => void;
  /** 漫游 UI 状态回调（遮罩 / 准星 / 提示文案由组件渲染） */
  onWalkStateChange?: (state: { walking: boolean; locked: boolean; touch: boolean }) => void;
}

export interface SceneEngine {
  /** 组件挂载时调用（创建 renderer / 场景 / 材质库 / 光照，但**不启动循环**） */
  init: () => void;
  /** 释放全部资源（幂等；组件卸载时无条件调用） */
  dispose: () => void;

  /** `Scene3DApi.enter` */
  enter: (ctx: EnterContext) => Promise<void>;
  /** `Scene3DApi.exit` */
  exit: () => Promise<void>;
  /** `Scene3DApi.shot` */
  shot: (filename: string) => void;
  /** `Scene3DApi.groundAt` */
  groundAt: (clientX: number, clientY: number) => { x: number; y: number; s: number } | null;
  /** `Scene3DApi.flyToRoom` */
  flyToRoom: (roomId: string) => void;
  /** `Scene3DApi.iso` */
  iso: () => void;
  /** `Scene3DApi.top` */
  top: () => void;
  /** `Scene3DApi.walking`（键盘守卫用，原 L1779/L3892） */
  walking: () => boolean;
  /** `Scene3DApi.relabel`（语言切换后重建标签） */
  relabel: () => void;

  /** 每帧推进（由组件的 rAF 循环调用） */
  frame: () => void;
  /** 三签名脏检查（由组件的 `watch` 调用） */
  sync: (force?: boolean) => void;
  /** 主题变更（§E.8 T4：**只更新材质/光照/曝光，不重建几何**） */
  applyTheme: (presetId: ThemePresetId, night: boolean) => void;
  /** 3D 视口尺寸变化（ResizeObserver） */
  resize: (w: number, h: number) => void;
  /** 相机模式（`ui.view3d.mode`） */
  setMode: (mode: 'orbit' | 'walk') => void;
  /** 家具层显隐（`ui.flags.furn` / `view3d.furn`） */
  setFurnitureVisible: (visible: boolean) => void;
  /** 标签显隐 */
  setLabelsVisible: (visible: boolean) => void;
  /** 剖切高度（`ui.view3d.cut`） */
  setCut: (cut: number) => void;
  /** 日照时刻 / 夜景（`ui.view3d.hour` / `night`） */
  setLighting: (hour: number, night: boolean) => void;
  /** 指针事件（模板上绑定） */
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  /** 摇杆状态（组件写入） */
  joy: JoystickState;
  /** 触屏漫游开关 */
  setTouchWalk: (on: boolean) => void;
  /** 请求指针锁定（桌面漫游离场点击遮罩时） */
  requestPointerLock: () => void;
  /** 房间列表（3D 左栏数据） */
  roomEntries: () => RoomListEntry[];
  /** 是否处于 3D 活跃状态 */
  isActive: () => boolean;
  /**
   * 是否有「未重建」的脏标记（SPEC §F.3：3D 不活跃时收到变化只置 dirty）。
   * 组件/测试用它确认「未激活时不重建」这条契约确实生效。
   */
  isDirty: () => boolean;
  /** 供 `Scene3DApi` 直接注册的实现对象 */
  api: Scene3DApi;
}

/* ======================= 实现 ======================= */

export function createSceneEngine(deps: EngineDeps): SceneEngine {
  let renderer: WebGLRenderer | null = null;
  let labelRenderer: CSS2DRenderer | null = null;
  let scene: Scene | null = null;
  let ml: MaterialLibrary | null = null;
  let lights: LightingRig | null = null;
  let controls: CameraControls | null = null;
  let walk: WalkController | null = null;
  let picking: Picking | null = null;

  const archGroups: ArchitectureGroups = createArchitectureGroups();
  const furnG = new Group();
  const labelG = new Group();

  let world: WorldConfig = { ox: 0, oy: 0 };
  let bounds: Bounds = { x: 0, y: 0, w: 0, h: 0 };
  let currentPreset: ThemePresetId = deps.presetId;
  let furnitureVisible = true;
  let labelsWanted = true;
  let animating = false;
  let raf = 0;
  /** `enter/exit` 的 `await wait(...)` 定时器句柄（`dispose` 必须清掉，否则卸载后会回调已释放的引擎） */
  let waitTimer = 0;
  let clock = new Clock();
  /** 相机动画的 resolve 队列（`runAnim`，按 FIFO 配对 `controls.setAnim` 的 resolve 回调） */
  let resolvers: (() => void)[] = [];
  /** `wait()` 的 resolve 集合：`dispose()` 必须一并放行，否则 `enter()/exit()` 的 Promise 永久悬挂 */
  const pendingWaits = new Set<() => void>();

  // 三签名缓存（原 `sigArch/sigFurn/sigLabels`，L2699）
  let sigArch = '';
  let sigFurn = '';
  let sigLabels = '';

  const joy: JoystickState = { x: 0, y: 0, id: null };

  /** 未进入 3D 时收到变化只标记 dirty（SPEC §F.3：`enter()` 时 `force = true`） */
  let dirty = true;
  let initialized = false;
  const isActive = (): boolean => raf !== 0 && initialized;

  function bindingOf(presetId: ThemePresetId, night: boolean) {
    const base = SCENE_THEME_BINDINGS[presetId];
    return night ? { ...base, ...NIGHT_LIGHTING_OVERRIDE } : base;
  }

  function paletteOf(): MaterialPalette {
    return MATERIAL_PALETTES[currentPreset];
  }

  /* ---------------- 初始化 ---------------- */

  let downAt: [number, number] | null = null;
  let lookPointer: { id: number; x: number; y: number } | null = null;

  function init(): void {
    if (initialized) return;
    initialized = true;

    const rendererInstance = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer = rendererInstance;
    // ⛔ preserveDrawingBuffer 不得为性能关闭（SPEC §F.6 R-EXP-4）
    rendererInstance.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    rendererInstance.setSize(deps.stageW || 1, deps.stageH || 1);
    rendererInstance.toneMapping = ACESFilmicToneMapping;
    rendererInstance.toneMappingExposure = SCENE_THEME_BINDINGS[currentPreset].toneMappingExposure;
    deps.host.prepend(rendererInstance.domElement);

    const labels = new CSS2DRenderer();
    labelRenderer = labels;
    labels.setSize(deps.stageW || 1, deps.stageH || 1);
    Object.assign(labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    deps.host.appendChild(labels.domElement);

    scene = new Scene();
    ml = createMaterialLibrary({ renderer: rendererInstance, presetId: currentPreset, palette: paletteOf(), world });

    const input = deps.readPlan();
    bounds = input.bounds;
    world = worldConfigOf(bounds);

    controls = createCameraControls({
      canvas: rendererInstance.domElement,
      lockTarget: deps.host,
      world,
      bounds,
      stageW: deps.stageW,
      stageH: deps.stageH,
      onLockChange: (locked) => {
        emitWalkState(locked, false);
      },
    });
    controls.setViewport(deps.view, deps.stageW, deps.stageH);

    lights = createLighting(
      scene,
      rendererInstance,
      bindingOf(currentPreset, deps.night),
      paletteOf(),
    );

    scene.add(archGroups.archFloor, archGroups.archUp, furnG, labelG, archGroups.lampG);
    lights.setLamps(archGroups.lampG);

    walk = createWalk({
      controls,
      colliders: () => archGroups.colliders,
      doors: () => archGroups.doors,
      bounds: () => bounds,
      world: () => world,
      joy,
      touchWalking: () => walk?.isTouchWalking() ?? false,
    });

    picking = createPicking({
      archUp: archGroups.archUp,
      archFloor: archGroups.archFloor,
      furnG,
      furnitureVisible: () => furnitureVisible,
      glass: ml.glass as never,
      camera: controls.camera,
      renderer: rendererInstance,
      scene,
      furniture: () => deps.readLayout().furniture,
      world: () => world,
      snapshot: () => deps.readLayout().snapshot(),
      commit: (before) => deps.commitLayout(before),
      moveFurniture: (id, x, y) => deps.writeFurniturePosition(id, x, y),
      interactive: () => isActive() && !animating,
      clearSelection: () => deps.clearSelection(),
      selectFurniture: (id) => deps.selectFurniture(id),
      selectRoom: (id) => deps.selectRoom(id),
      selectionColor: () => resolveToken(currentPreset, 'accent'),
    });

    bindEvents(rendererInstance.domElement);
    lights.apply({ binding: bindingOf(currentPreset, deps.night), palette: paletteOf(), hour: 10, night: deps.night });
  }

  function emitWalkState(locked: boolean, touch: boolean): void {
    deps.onWalkStateChange?.({
      // 「漫游中」的唯一判据是 `ui.view3d.mode`（原 `opt.mode`），不是控制器内部状态
      walking: deps.readUi().view3d.mode === 'walk',
      locked,
      touch,
    });
  }

  /* ---------------- 事件（全部在 dispose 里解绑） ---------------- */

  let cleanup: (() => void)[] = [];

  function bindEvents(cv: HTMLCanvasElement): void {
    const onDown = (e: PointerEvent): void => {
      downAt = [e.clientX, e.clientY];
      if (walk?.isTouchWalking() && !lookPointer) {
        lookPointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
        cv.setPointerCapture(e.pointerId);
      }
    };
    const onMove = (e: PointerEvent): void => {
      if (!lookPointer || e.pointerId !== lookPointer.id) return;
      controls?.lookBy(e.clientX - lookPointer.x, e.clientY - lookPointer.y);
      lookPointer.x = e.clientX;
      lookPointer.y = e.clientY;
    };
    const onCancel = (e: PointerEvent): void => {
      if (lookPointer?.id === e.pointerId) lookPointer = null;
    };
    const onUp = (e: PointerEvent): void => {
      const tap = downAt ? Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) <= TAP : false;
      if (lookPointer?.id === e.pointerId) {
        lookPointer = null;
        if (tap) picking?.toggleDoorAhead(DOOR_TAP_DIST); // 漫游时点门开关（原 L2780）
        return;
      }
      if (animating) return;
      if (deps.readUi().view3d.mode === 'walk') return;
      if (tap) picking?.tap(e.clientX, e.clientY);
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input,select,textarea')) return;
      if (!isActive()) return;
      if (walk) walk.keys[e.code] = true;
      if (deps.readUi().view3d.mode === 'walk' && e.code === 'KeyE') picking?.toggleDoorAhead(DOOR_KEY_DIST);
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      if (walk) walk.keys[e.code] = false;
    };
    const onLockError = (): void => {
      if (isActive() && deps.readUi().view3d.mode === 'walk' && !COARSE) {
        deps.onPointerLockError?.();
      }
    };

    // B7（SPEC §C.2）：一律经 `@vueuse/core` 的 `useEventListener`，它返回的 stop 函数进 cleanup，
    // 与手写 removeEventListener 等价但不会漏解绑（原实现有 6 处裸监听）。
    cleanup.push(
      useEventListener(cv, 'pointerdown', onDown),
      useEventListener(cv, 'pointermove', onMove),
      useEventListener(cv, 'pointercancel', onCancel),
      useEventListener(cv, 'pointerup', onUp),
      useEventListener(window, 'keydown', onKeyDown),
      useEventListener(window, 'keyup', onKeyUp),
      useEventListener(document, 'pointerlockerror', onLockError),
    );
    // 尺寸监听由组件持有（`useResizeFit` → `engine.resize()`，SPEC §F.7「同一个 observer」），
    // 引擎不重复挂第二个 ResizeObserver。
  }

  /* ---------------- 增量重建 ---------------- */

  function setBounds(next: Bounds): void {
    if (next.w === bounds.w && next.h === bounds.h && next.x === bounds.x && next.y === bounds.y) return;
    bounds = next;
    world = worldConfigOf(bounds);
    controls?.setWorld(world, bounds);
  }

  function buildArchitectureNow(): void {
    if (!ml) return;
    const plan = deps.readPlan();
    const layout = deps.readLayout();
    const ui = deps.readUi();
    buildArchitecture(
      archGroups,
      {
        /*
         * ⚠️ 用 `levelData`（当前层）而不是 `plan.plan`（整个户型）。
         * 复式户型的顶层 `walls`/`rooms` 是空数组，真实数据在 `levels[]` 里；
         * 用 `plan.plan` 会导致复式当前层一个几何都不建，只剩其它层被抬高绘制，
         * 表现为「墙体悬空、与地面分离」（D-B 缺陷）。
         */
        structure: plan.levelData,
        roomMats: plan.roomMats,
        demolished: new Set(layout.demolished),
        cut: ui.view3d.cut,
        levels: plan.plan.levels ?? null,
        level: plan.level,
        bounds,
        walking: ui.view3d.mode === 'walk',
      },
      { ml, palette: paletteOf(), world },
    );
    lights?.setLamps(archGroups.lampG);
  }

  function buildFurnitureNow(): void {
    if (!ml) return;
    clearGroup(furnG);
    const buildDeps = createFurnitureDeps(ml, paletteOf(), world);
    deps.readLayout().furniture.forEach((f: Furniture) => furnG.add(buildFurniture(f, buildDeps)));
    furnG.visible = furnitureVisible;
  }

  function labelInput(): LabelInput {
    const plan = deps.readPlan();
    const layout = deps.readLayout();
    const ui = deps.readUi();
    return { rooms: plan.rooms, overrides: layout.rooms, cut: ui.view3d.cut, world };
  }

  function buildLabelsNow(): void {
    buildLabels(labelG, labelInput());
    showLabels(labelG, visibleLabels());
  }

  /** 标签可见性规则（原 L3866）：`view3d.labels && mode==='orbit' && !anim` */
  function visibleLabels(): boolean {
    if (!labelsWanted) return false;
    const ui = deps.readUi();
    return ui.view3d.mode === 'orbit' && !animating;
  }

  function sync(force = false): void {
    if (!initialized) {
      dirty = true;
      return;
    }
    const plan = deps.readPlan();
    const layout = deps.readLayout();
    const ui = deps.readUi();
    setBounds(plan.bounds);
    const next = computeSignatures(plan, layout, ui);

    /*
     * 3D 不活跃（当前在 2D）时的关键分支。
     *
     * ⚠️ 这里**不能**先更新 `sigArch/sigFurn/sigLabels` 再返回。
     * 历史缺陷（2026-10-21 实测定位）：`Scene3D.vue` 的 watch 在 2D 模式下也会触发 `sync()`，
     * 若此时把签名「顺手」更新为新值，等用户真正切到 3D 时，`syncStaged()` 再比较就发现
     * 「签名没变化」→ 跳过重建 → **3D 里残留上一个户型的几何**。
     * 用户可见症状：切户型后 3D 场景还是旧户型（墙体与地面错位、悬空）。
     *
     * 正确做法：不活跃时只记 `dirty`，签名保持旧值；等 `enter()` 时再比较，
     * 这样「2D 期间发生的任何变化」都能在进入 3D 时被正确检出并重建。
     */
    if (!isActive() && !force) {
      dirty = dirty || next.arch !== sigArch || next.furn !== sigFurn || next.labels !== sigLabels;
      return;
    }

    const archChanged = force || next.arch !== sigArch;
    const furnChanged = force || next.furn !== sigFurn;
    const labelsChanged = force || next.labels !== sigLabels;
    sigArch = next.arch;
    sigFurn = next.furn;
    sigLabels = next.labels;
    dirty = false;
    if (archChanged) buildArchitectureNow();
    if (furnChanged) buildFurnitureNow();
    if (labelsChanged) buildLabelsNow();
  }

  /**
   * 分帧构建（仅 `enter()` 使用）：把「建筑 → 家具 → 标签」三步拆到**不同的帧**，
   * 每步之间让出主线程，避免单个 300ms+ 长任务卡住进入动画。
   *
   * 为什么值得拆：首次进入时 Canvas 程序化贴图（地板/瓷砖/大理石）是主要开销，
   * 一次性做完会让动画前 300ms 掉帧。拆开后每帧只做一个阶段，
   * 浏览器仍有时间绘制，动画看起来是连续的——总耗时不变，但**观感顺滑**。
   *
   * 复用 `sync()` 的签名比对：没变化的阶段自动跳过（二次进入时通常全部跳过）。
   */
  async function syncStaged(): Promise<void> {
    if (!initialized) {
      dirty = true;
      return;
    }
    const plan = deps.readPlan();
    const layout = deps.readLayout();
    const ui = deps.readUi();
    setBounds(plan.bounds);
    const next = computeSignatures(plan, layout, ui);
    const archChanged = next.arch !== sigArch;
    const furnChanged = next.furn !== sigFurn;
    const labelsChanged = next.labels !== sigLabels;
    sigArch = next.arch;
    sigFurn = next.furn;
    sigLabels = next.labels;
    dirty = false;

    if (archChanged) {
      buildArchitectureNow();
      renderFrame();
      await nextFrame();
    }
    if (furnChanged) {
      buildFurnitureNow();
      renderFrame();
      await nextFrame();
    }
    if (labelsChanged) {
      buildLabelsNow();
      renderFrame();
      await nextFrame();
    }
  }

  /* ---------------- 主循环 ---------------- */

  function startLoop(): void {
    if (raf) return;
    clock = new Clock();
    clock.getDelta();
    raf = requestAnimationFrame(() => frame());
  }

  function stopLoop(): void {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function renderFrame(): void {
    if (!renderer || !scene || !controls) return;
    renderer.render(scene, controls.camera);
    labelRenderer?.render(scene, controls.camera);
  }

  /** 门开合缓动（原 L3882） */
  function updateDoors(dt: number): void {
    archGroups.doors.forEach((d: DoorHandle) => {
      const target = d.open ? d.a1 : d.a0;
      d.cur += (target - d.cur) * Math.min(1, dt * DOOR_EASE);
      d.pivot.rotation.y = d.cur;
    });
  }

  function frame(): void {
    raf = 0;
    if (!renderer || !scene || !controls || !walk) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const now = performance.now();
    animating = controls.isAnimating();
    controls.update(dt, now, deps.readUi().view3d.mode === 'walk');
    if (deps.readUi().view3d.mode === 'walk') walk.step(dt);
    updateDoors(dt);
    picking?.updateSelection(deps.readUi().selectedFurnitureId);
    showLabels(labelG, visibleLabels());
    renderFrame();
    raf = requestAnimationFrame(() => frame());
  }

  /* ---------------- 进入 / 退出（原 L3670-3706） ---------------- */

  /**
   * 切换动画时长（毫秒）。
   *
   * 原实现是 `enter` 420+1700、`exit` 1300+450，合计「进 2.1s / 出 1.75s」——
   * 对日常高频切换来说太慢（用户反馈「不够丝滑」）。
   *
   * 这里收紧到 **进 900 / 出 620**：保留「墙从地面长出来 + 相机推入」的层次感，
   * 把等待压进 1 秒内。曲线内部的相位比例（tween 0.85、grow 0.1–0.65、
   * 家具 0.45–0.95）保持不变，所以观感节奏与原实现一致，只是整体加速。
   */
  const ENTER_ANIM_MS = 900;
  const EXIT_ANIM_MS = 620;

  /**
   * `await wait(ms)`：**卸载时也必须 settle**。
   * 原实现 `dispose` 只清定时器，导致 `enter()` 的 Promise 永久悬挂（组件卸载后仍持有闭包）；
   * 这里把 resolve 登记进 `pendingWaits`，`dispose()` 统一放行。
   *
   * ⚠️ 当前 `enter()/exit()` 已改用 `nextFrame()`（不再用固定时长空等，见各自注释），
   * 因此本函数暂无调用者。**保留它**是因为 `pendingWaits` / `waitTimer` 的卸载保护
   * 是 `dispose()` 安全网的一部分，删掉会削弱「卸载时不留悬挂 Promise」的保证；
   * 将来若需要按毫秒节流（如降帧率策略）可直接复用。
   */
   
  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const settle = (): void => {
        pendingWaits.delete(settle);
        resolve();
      };
      pendingWaits.add(settle);
      waitTimer = window.setTimeout(() => {
        waitTimer = 0;
        settle();
      }, ms);
    });
  }

  // 显式引用，避免 `noUnusedLocals` 报错（TypeScript 不认 ESLint 注释）。
  // 说明见 `wait()` 上方：它是 `dispose()` 安全网的一部分，有意保留。
  void wait;

  /**
   * 让出一帧（`requestAnimationFrame` + 微任务）。
   *
   * 用途：把长任务（全量构建 3D 场景）推到**下一帧之后**，先让浏览器把当前帧画出来，
   * 用户就能立刻看到 3D 层淡入，而不是盯着冻结的界面等构建完成。
   * 与 `wait(ms)` 不同：它不依赖计时器，引擎被 `dispose()` 时也不会悬挂
   * （`requestAnimationFrame` 的回调在 `stopLoop` 之后仍可能触发，但这里只 resolve，无副作用）。
   */
  function nextFrame(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  function runAnim(duration: number, fn: (t: number) => void): Promise<void> {
    // 引擎已释放（组件已卸载）时立刻 settle，⛔ 不留悬挂 Promise
    if (!controls) return Promise.resolve();
    return new Promise((resolve) => {
      resolvers.push(resolve);
      controls?.setAnim({
        t0: performance.now(),
        dur: duration,
        fn,
        resolve: () => {
          const next = resolvers.shift();
          next?.();
        },
      });
    });
  }

  function setGrow(value: number): void {
    archGroups.archUp.scale.y = Math.max(value, 0.001);
    furnG.scale.y = Math.max(value, 0.001);
    archGroups.lampG.visible = value > 0.99;
  }

  async function enter(ctx: EnterContext): Promise<void> {
    init();
    deps.host.classList.add('is3d');
    controls?.setViewport(ctx.view, ctx.stageW, ctx.stageH);
    resize(ctx.stageW, ctx.stageH);

    const from = controls!.planPose();
    const to = controls!.isoFrom(from, Boolean(deps.readPlan().plan.levels?.length));
    controls!.orbit.enabled = false;
    showLabels(labelG, false);
    controls!.setPose(from);
    setGrow(0);
    startLoop();
    renderFrame();

    /*
     * 性能关键：**先出帧，再构建**。
     *
     * 旧顺序是 `sync(true)` → `wait(420)` → 动画：全量构建（建筑 + 家具 + 标签）是
     * 一个 800ms 级的长任务，期间主线程完全阻塞、画面停在旧帧，用户看到的是「点了没反应」。
     * 实测：首次进入 3D 要 934ms 才出第一帧，其中 870ms 是单个长任务。
     *
     * 新顺序：先渲染一帧空场景（canvas 立即出现并开始淡入），再让出到下一帧做构建，
     * 避免阻塞首帧呈现。此时 `setGrow(0)`（墙高为 0），空场景与 2D 平面视觉上正好重合，
     * 构建完成后墙「长出来」的动画自然接续——观感反而更连贯。
     *
     * 注意这里传 `false` 而不是 `true`：`sync` 内部会比对三签名（建筑/家具/标签），
     * 只有真正变化的部分才重建。二次进入时场景通常没变，于是跳过全部构建
     * （实测二次进入的长任务从 303ms 降到接近 0）；若用户在 2D 里改过东西，
     * 签名会变，仍然会正确重建。
     */
    await nextFrame();
    await syncStaged();
    renderFrame();
    await nextFrame();

    // 交叉淡入：此刻 3D 画面与 2D 平面完全重合（原 L3679）
    deps.host.classList.add('animating');
    await runAnim(ENTER_ANIM_MS, (t) => {
      controls!.tween(from, to, ease(clamp01(t / 0.85)));
      setGrow(ease(clamp01((t - 0.1) / 0.55)));
      furnG.scale.y = Math.max(ease(clamp01((t - 0.45) / 0.5)), 0.001);
    });
    controls!.orbit.enabled = true;
    showLabels(labelG, visibleLabels());
    deps.host.classList.remove('animating');
    animating = false;
  }

  async function exit(): Promise<void> {
    if (!initialized || !controls) return;
    if (deps.readUi().view3d.mode === 'walk') setMode('orbit');
    controls.clearFly();
    controls.orbit.enabled = false;
    showLabels(labelG, false);
    deps.host.classList.add('animating');
    const from = controls.currentPose();
    const to = controls.planPose();
    await runAnim(EXIT_ANIM_MS, (t) => {
      controls!.tween(from, to, ease(clamp01((t - 0.1) / 0.9)));
      // 家具先收、墙体后沉（原 L3697-3698）
      furnG.scale.y = Math.max(1 - ease(clamp01(t / 0.45)), 0.001);
      setGrow(1 - ease(clamp01((t - 0.2) / 0.6)));
    });
    /*
     * 返回 2D 的收尾。
     *
     * 旧实现：移除 `is3d` → `await wait(450)` → `stopLoop()`，串行等完 CSS 淡入才收尾，
     * 实测「点 2D 到 2D 可见」要 1807ms，其中 450ms 是纯等待（此时 3D 已收完、主线程空闲）。
     *
     * 新实现：
     * - 先移除 `is3d`（2D 立即开始 0.45s 淡入），与下面的 `stopLoop()` **并行**；
     * - `stopLoop()` 不再等 450ms，但保留一个极短的 `nextFrame()` 让最后一帧 3D 收尾画面提交，
     *   避免停循环早于最后一帧渲染而出现闪白；
     * - CSS 淡入继续自己跑，用户看到的是 2D 平滑浮现，而不是「等 1.8 秒再突然出现」。
     */
    deps.host.classList.remove('is3d');
    await nextFrame();
    stopLoop();
    deps.host.classList.remove('animating');
    setGrow(1);
    animating = false;
  }

  /* ---------------- 主题（§E.8 T4） ---------------- */

  function applyTheme(presetId: ThemePresetId, night: boolean): void {
    currentPreset = presetId;
    if (!initialized || !ml || !lights) return;
    const resolved = resolveSceneTheme(presetId, night);
    // 只更新材质 / 光照 / 曝光；**不触发** buildArchitecture/buildFurniture（T4）
    ml.applyTheme(presetId, resolved.palette, resolved.binding.envK);
    lights.apply({ binding: resolved.binding, palette: resolved.palette, hour: deps.readUi().view3d.hour, night });
    // 材质基色变了，墙/框/踢脚/棱线等已经由材质库就地换色；棱线是独立 LineBasicMaterial，这里同步
    archGroups.archUp.traverse((o) => {
      const material = (o as { material?: { color?: { set: (v: string) => void } } }).material;
      if (o.userData.walkOnly && material?.color) material.color.set(resolved.palette.surface.edge);
    });
    renderFrame();
  }

  /* ---------------- 模式 / 参数 ---------------- */

  function setMode(mode: 'orbit' | 'walk'): void {
    if (!initialized || !controls || !walk) return;
    if (mode === 'walk') {
      deps.clearSelection();
      const plan = deps.readPlan();
      const ui = deps.readUi();
      // 漫游强制全高（原 L3794）
      if (ui.view3d.cut < CUT_FULL) {
        setCut(CUT_FULL);
        sync(true);
      }
      controls.orbit.enabled = false;
      controls.clearFly();
      controls.enterWalk(plan.plan.doors);
      setWalkAidsVisible(archGroups, true);
      if (COARSE) setTouchWalk(true);
    } else {
      controls.walkCtl.unlock();
      setTouchWalk(false);
      controls.exitWalk();
      setWalkAidsVisible(archGroups, false);
    }
    showLabels(labelG, visibleLabels());
    deps.onWalkStateChange?.({ walking: mode === 'walk', locked: controls.walkCtl.isLocked, touch: walk.isTouchWalking() });
    renderFrame();
  }

  function setTouchWalk(on: boolean): void {
    walk?.setTouchWalk(on);
    if (!on) joy.x = 0;
    deps.onWalkStateChange?.({ walking: deps.readUi().view3d.mode === 'walk', locked: controls?.walkCtl.isLocked ?? false, touch: on });
  }

  function setFurnitureVisible(visible: boolean): void {
    furnitureVisible = visible;
    furnG.visible = visible;
  }

  function setLabelsVisible(visible: boolean): void {
    labelsWanted = visible;
    showLabels(labelG, visibleLabels());
  }

  function setCut(cut: number): void {
    if (!initialized) return;
    // 剖切只改 `ui.view3d.cut`（由组件写 store），这里负责重建
    void cut;
    sync();
  }

  function setLighting(hour: number, night: boolean): void {
    if (!initialized || !lights) return;
    const resolved = resolveSceneTheme(currentPreset, night);
    lights.apply({ binding: resolved.binding, palette: resolved.palette, hour, night });
    renderFrame();
  }

  function resize(w: number, h: number): void {
    if (!renderer || !labelRenderer || !controls) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    controls.setSize(w, h);
    renderFrame();
  }

  /* ---------------- 拾取接口 ---------------- */

  function isWalkingMode(): boolean {
    return deps.readUi().view3d.mode === 'walk';
  }

  function shot(filename: string): void {
    if (!renderer) return;
    const link = document.createElement('a');
    link.download = filename;
    link.href = renderer.domElement.toDataURL('image/png');
    link.click();
  }

  function flyToRoom(roomId: string): void {
    if (!isActive() || animating) return;
    controls?.flyToRoom(roomId, deps.readPlan().rooms.map((r) => ({ id: r.id, poly: r.poly })));
  }

  function dispose(): void {
    stopLoop();
    if (waitTimer) {
      window.clearTimeout(waitTimer);
      waitTimer = 0;
    }
    cleanup.forEach((fn) => fn());
    cleanup = [];
    // 放行所有悬挂的 `await`（`wait()` 与 `runAnim()` 各一套），⛔ 卸载后不留未 settle 的 Promise
    pendingWaits.forEach((resolve) => resolve());
    pendingWaits.clear();
    resolvers.forEach((resolve) => resolve());
    resolvers = [];
    picking?.dispose();
    clearGroup(furnG);
    clearGroup(labelG);
    clearGroup(archGroups.archFloor);
    clearGroup(archGroups.archUp);
    clearGroup(archGroups.lampG);
    archGroups.doors.length = 0;
    archGroups.colliders.length = 0;
    ml?.dispose();
    lights?.dispose();
    controls?.dispose();
    walk?.dispose();
    if (scene) scene.clear();
    if (labelRenderer) labelRenderer.domElement.remove();
    if (renderer) {
      renderer.dispose();
      renderer.domElement.remove();
    }
    // 释放剩余场景级对象（环境贴图等）
    if (ml?.envTex) disposeObject(ml.envTex);
    renderer = null;
    labelRenderer = null;
    scene = null;
    ml = null;
    lights = null;
    controls = null;
    walk = null;
    picking = null;
    initialized = false;
    dirty = true;
  }

  const api: Scene3DApi = {
    enter: (ctx) => enter(ctx),
    exit: () => exit(),
    shot: () => shot(SHOT_FILENAME),
    groundAt: (clientX, clientY) => picking?.groundAt(clientX, clientY) ?? null,
    flyToRoom: (roomId) => flyToRoom(roomId),
    iso: () => {
      if (!isActive()) return;
      controls?.flyTo(controls.isoWhole());
    },
    top: () => {
      if (!isActive()) return;
      controls?.flyTo(controls.topWhole());
    },
    walking: () => isActive() && isWalkingMode(),
    relabel: () => {
      if (!initialized) return;
      sync(true);
    },
  };

  return {
    init,
    dispose,
    enter,
    exit,
    shot,
    groundAt: (clientX, clientY) => picking?.groundAt(clientX, clientY) ?? null,
    flyToRoom,
    iso: api.iso,
    top: api.top,
    walking: () => api.walking(),
    relabel: () => api.relabel(),
    frame,
    sync,
    applyTheme,
    resize,
    setMode,
    setFurnitureVisible,
    setLabelsVisible,
    setCut,
    setLighting,
    onPointerDown: (e) => picking?.onPointerDown(e),
    onPointerMove: (e) => picking?.onPointerMove(e),
    onPointerUp: (e) => picking?.onPointerUp(e),
    joy,
    setTouchWalk,
    requestPointerLock: () => controls?.walkCtl.lock(),
    roomEntries: () => roomList(labelInput()),
    isActive,
    isDirty: () => dirty,
    api,
  };
}