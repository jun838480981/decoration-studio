/**
 * 舞台指针交互（pan / zoom / pinch / 家具拖拽 / 测量 / 拆改 / 编辑转发）。
 *
 * 对应原实现 L1642-1773 的 `svg` 指针处理器与 `applyView()` 的视图更新（SPEC §F.7、ADR-13）。
 *
 * 设计约束：
 * - **事件生命周期交给 `@vueuse/core`**（`useEventListener` 自动解绑，SPEC §C.2 B7）；
 * - 手势与业务规则强耦合（吸附阈值 `10/view.s`、`TAP_PX`、双指中点锚定缩放、触屏放大热区），
 *   因此按 **ADR-13** 迁移既有实现，⛔ 不引入 `interactjs` / `moveable`；
 * - 视图变换一律经 `ui.zoomAt()` / `ui.fitView()`（⛔ 组件不直接写 `view` 的语义化动作之外的东西）；
 * - `getScreenCTM` 换算（`toMM`）是本文件唯一与 DOM 强相关的地方。
 */
import { useEventListener } from '@vueuse/core';
import { computed, reactive, ref, type ComputedRef, type Ref } from 'vue';
import { usePlanEditor } from '@/features/plan2d/editing';
import { useLayoutStore } from '@/stores/layout';
import { usePlanStore } from '@/stores/plan';
import { useToastStore } from '@/stores/toast';
import { useUiStore } from '@/stores/ui';
import { COARSE, TAP_PX } from '@/composables/usePointerKind';
import { dist, furnitureRect, norm, snapMove, snapPoint as snapPointUtil, toLocal } from '@/utils/geometry';
import type { Vec2 } from '@/types/geometry';
import type { Furniture } from '@/types/furniture';

/** 当前拖拽种类（原 `drag.kind`） */
export type StageDragKind = 'move' | 'rot' | 'size' | 'pan' | 'measure';

interface StageDrag {
  kind: StageDragKind;
  id?: string;
  sx: number;
  sy: number;
  x0?: number;
  y0?: number;
  ox?: number;
  oy?: number;
  before?: string;
  moved: boolean;
  roomId?: string | null;
}

interface PinchState {
  d: number;
  c: [number, number];
  s: number;
  px: number;
  py: number;
}

/** 命中信息（由 `PlanCanvas` 从事件目标上取 `data-*`） */
export interface StageHit {
  /** `data-handle`：`rot` / `size` */
  handle: string | null;
  /** `data-fid` */
  furnId: string | null;
  /** `data-wall`（形如 `w12`） */
  wallId: string | null;
  /** `data-room` */
  roomId: string | null;
  /** `data-op`（形如 `d1` / `w2` / `s0`） */
  opKey: string | null;
}

export interface StageInteractionOptions {
  /** `<svg>` 元素（视图变换与坐标换算的基准） */
  svg: Ref<SVGSVGElement | null>;
  /** 命中解析：由组件从 `event.target` 读 `data-*` */
  hitOf: (target: EventTarget | null) => StageHit;
  /** 指针按下前的收尾（关闭抽屉、收起菜单），对应原 L1671 */
  onStageDown?: () => void;
  /** 拖拽结束且确实移动过（用于刷新界面提示） */
  onDragEnd?: () => void;
  /**
   * 提示出口（拆改墙体的四个分支，原 L1565-1569 的 toast）。
   * 缺省时直接写 `useToastStore()`；传入则以调用方的为准（组件可加额外埋点）。
   */
  onToast?: (message: string, kind: 'info' | 'warn' | 'danger') => void;
}

export interface StageInteractionApi {
  /** 当前拖拽种类（只读，供光标样式/提示使用） */
  dragKind: ComputedRef<StageDragKind | null>;
  /** 是否正在平移（原 `svg.classList.add('panning')`） */
  panning: Ref<boolean>;
  /** 指针在户型坐标中的位置 + 悬停房间（原 footer `#cx/#cy/#hover`） */
  pointer: { x: number; y: number; roomId: string | null };
  /** 屏幕坐标 → 户型坐标（mm）；svg 未就绪返回 `null` */
  toMM(clientX: number, clientY: number): Vec2 | null;
  /** 结束当前拖拽（供外部打断，如切换工具） */
  endDrag(cancel?: boolean): void;
}

export function useStageInteraction(options: StageInteractionOptions): StageInteractionApi {
  const { svg, hitOf, onStageDown, onDragEnd, onToast } = options;
  const ui = useUiStore();
  const layout = useLayoutStore();
  const plan = usePlanStore();
  const editor = usePlanEditor();
  const toast = useToastStore();

  const panning = ref(false);
  const dragKind = ref<StageDragKind | null>(null);
  const pointer = reactive<{ x: number; y: number; roomId: string | null }>({ x: 0, y: 0, roomId: null });

  let drag: StageDrag | null = null;
  let pinch: PinchState | null = null;
  const touches = new Map<number, { x: number; y: number }>();

  function toMM(clientX: number, clientY: number): Vec2 | null {
    const element = svg.value;
    if (!element) return null;
    const ctm = element.getScreenCTM();
    if (!ctm) return null;
    const point = element.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const transformed = point.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  function svgXY(clientX: number, clientY: number): [number, number] {
    const rect = svg.value?.getBoundingClientRect();
    return [clientX - (rect?.left ?? 0), clientY - (rect?.top ?? 0)];
  }

  function pinchInfo(): { d: number; c: [number, number] } | null {
    const list = [...touches.values()];
    if (list.length < 2) return null;
    const [a, b] = list;
    return { d: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), c: svgXY((a.x + b.x) / 2, (a.y + b.y) / 2) };
  }

  function measureSnapPoint(p: Vec2, shift: boolean): Vec2 {
    return snapPointUtil(p, layout.snapRects, {
      tol: 8 / ui.view.s,
      shift,
      anchor: ui.measureA,
      grid: 10,
    });
  }

  /** 结束当前拖拽：移动过的家具进撤销栈（原 `endDrag`，L1651-1666） */
  function endDrag(cancel = false): void {
    const current = drag;
    drag = null;
    dragKind.value = null;
    panning.value = false;
    if (!current) return;

    if (current.kind === 'measure') {
      if (cancel) {
        ui.measureA = null;
        ui.measureCur = null;
        return;
      }
      if (current.moved && ui.measureA && ui.measureCur && dist(ui.measureA, ui.measureCur) > 20) {
        const a = ui.measureA;
        const b = ui.measureCur;
        ui.measureA = null;
        ui.measureCur = null;
        layout.pushMeasure(a, b);
      }
      return; // 没拖动：保留起点，等第二次点击（原 L1659）
    }

    if (current.kind === 'pan') {
      if (!cancel && !current.moved && ui.tool === 'select') {
        ui.select(current.roomId ? { kind: 'room', id: current.roomId } : null);
      }
      return;
    }

    if (current.moved) {
      if (current.before) layout.commit(current.before);
      onDragEnd?.();
    }
  }

  function pointerDown(event: PointerEvent): void {
    if (event.button === 1 || event.button === 2) return;
    const world = toMM(event.clientX, event.clientY);
    if (!world) return;

    // 编辑模式：整个指针流程交给编辑内核（原 L1670）
    if (ui.edit.on) {
      const hit = hitOf(event.target);
      const key = hit.opKey ? `op:${hit.opKey}` : hit.wallId ? `wall:${hit.wallId}` : hit.roomId ? `room:${hit.roomId}` : null;
      editor.down(world, key, { altKey: event.altKey });
      svg.value?.setPointerCapture?.(event.pointerId);
      return;
    }

    onStageDown?.();

    if (event.pointerType !== 'mouse') {
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      svg.value?.setPointerCapture?.(event.pointerId);
      if (touches.size >= 2) {
        // 第二根手指落下：取消单指操作，进入双指缩放 / 平移（原 L1675-1680）
        endDrag(drag?.kind === 'measure' || drag?.kind === 'pan');
        const info = pinchInfo();
        if (info) {
          pinch = {
            d: info.d,
            c: info.c,
            s: ui.view.s,
            px: ui.view.x0 + info.c[0] / ui.view.s,
            py: ui.view.y0 + info.c[1] / ui.view.s,
          };
        }
        return;
      }
    }
    if (pinch) return;

    const hit = hitOf(event.target);

    if (ui.tool === 'measure') {
      const q = measureSnapPoint(world, event.shiftKey);
      if (!ui.measureA) {
        ui.measureA = q;
        ui.measureCur = q;
        drag = { kind: 'measure', sx: event.clientX, sy: event.clientY, moved: false };
        dragKind.value = 'measure';
        svg.value?.setPointerCapture?.(event.pointerId);
      } else {
        const a = ui.measureA;
        ui.measureA = null;
        ui.measureCur = null;
        if (dist(q, a) > 20) layout.pushMeasure(a, q);
      }
      return;
    }

    if (hit.handle && ui.selection?.kind === 'furn') {
      drag = {
        kind: hit.handle === 'size' ? 'size' : 'rot',
        id: ui.selection.id,
        sx: event.clientX,
        sy: event.clientY,
        before: layout.snapshot(),
        moved: false,
      };
      dragKind.value = drag.kind;
    } else if (ui.tool === 'demolish' && hit.wallId) {
      const result = layout.toggleWall(hit.wallId);
      const index = Number.parseInt(hit.wallId.replace(/^\D+/, ''), 10);
      const wall = plan.walls[index];
      const length = wall ? Math.max(wall[2] - wall[0], wall[3] - wall[1]) : 0;
      if (result === 'blocked-bearing') uiToast('承重墙（黑色）不可拆除', 'warn');
      else if (result === 'blocked-exterior') uiToast('外墙属于建筑外围护结构，不建议拆除', 'warn');
      else if (result === 'restored') uiToast('已恢复墙体');
      else uiToast(`已标记拆除 ${length} mm 墙体`);
      return;
    } else if (ui.tool === 'select' && hit.furnId) {
      const target = layout.getF(hit.furnId);
      if (!target) return;
      if (ui.selection?.id !== target.id) ui.select({ kind: 'furn', id: target.id });
      drag = {
        kind: 'move',
        id: target.id,
        sx: event.clientX,
        sy: event.clientY,
        ox: world.x - target.cx,
        oy: world.y - target.cy,
        before: layout.snapshot(),
        moved: false,
      };
      dragKind.value = 'move';
    } else {
      drag = {
        kind: 'pan',
        sx: event.clientX,
        sy: event.clientY,
        x0: ui.view.x0,
        y0: ui.view.y0,
        moved: false,
        roomId: hit.roomId,
      };
      dragKind.value = 'pan';
    }
    svg.value?.setPointerCapture?.(event.pointerId);
  }

  /** 轻量 toast：缺省写 `useToastStore()`，调用方可注入自己的出口 */
  function uiToast(message: string, kind: 'info' | 'warn' | 'danger' = 'info'): void {
    if (onToast) {
      onToast(message, kind);
      return;
    }
    toast.push(message, kind);
  }

  function pointerMove(event: PointerEvent): void {
    if (touches.has(event.pointerId)) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const world = toMM(event.clientX, event.clientY);
    if (!world) return;
    pointer.x = Math.round(world.x);
    pointer.y = Math.round(world.y);

    if (ui.edit.on) {
      editor.move(world, { altKey: event.altKey });
      return;
    }

    if (pinch) {
      if (touches.size < 2) return;
      const info = pinchInfo();
      if (!info) return;
      const nextScale = Math.max(0.012, Math.min(2, (pinch.s * info.d) / pinch.d));
      ui.view.s = nextScale;
      ui.view.x0 = pinch.px - info.c[0] / nextScale;
      ui.view.y0 = pinch.py - info.c[1] / nextScale;
      return;
    }

    if (!drag) {
      const hit = hitOf(event.target);
      pointer.roomId = hit.roomId;
      if (ui.tool === 'measure' && ui.measureA) {
        ui.measureCur = measureSnapPoint(world, event.shiftKey);
      }
      return;
    }

    const far = Math.hypot(event.clientX - drag.sx, event.clientY - drag.sy) >= TAP_PX;

    if (drag.kind === 'measure') {
      if (far) drag.moved = true;
      ui.measureCur = measureSnapPoint(world, event.shiftKey);
      return;
    }

    if (drag.kind === 'pan') {
      if (!drag.moved && !far) return;
      drag.moved = true;
      panning.value = true;
      ui.view.x0 = (drag.x0 ?? 0) - (event.clientX - drag.sx) / ui.view.s;
      ui.view.y0 = (drag.y0 ?? 0) - (event.clientY - drag.sy) / ui.view.s;
      return;
    }

    const target = drag.id ? layout.getF(drag.id) : undefined;
    if (!target) return;
    if (!drag.moved && !far) return; // 轻点家具不应让它抖动一下（原 L1734）
    drag.moved = true;

    if (drag.kind === 'move') {
      const next = snapMove(target, world.x - (drag.ox ?? 0), world.y - (drag.oy ?? 0), layout.snapRects, {
        wallSnap: ui.flags.wallSnap,
        k: 1 / ui.view.s,
        grid: 10,
      });
      target.cx = next.x;
      target.cy = next.y;
    } else if (drag.kind === 'rot') {
      const raw = (Math.atan2(world.y - target.cy, world.x - target.cx) * 180) / Math.PI + 90;
      target.rot = norm(event.shiftKey ? raw : Math.round(raw / 15) * 15);
    } else if (drag.kind === 'size') {
      const local = toLocal(target, world.x, world.y);
      const ax = -target.w / 2;
      const ay = -target.d / 2;
      const nw = Math.max(100, Math.round((local.x - ax) / 10) * 10);
      const nd = Math.max(100, Math.round((local.y - ay) / 10) * 10);
      const mx = ax + nw / 2;
      const my = ay + nd / 2;
      const a = (target.rot * Math.PI) / 180;
      const c = Math.cos(a);
      const s = Math.sin(a);
      target.cx += mx * c - my * s;
      target.cy += mx * s + my * c;
      target.w = nw;
      target.d = nd;
    }
  }

  function pointerEnd(event: PointerEvent): void {
    touches.delete(event.pointerId);
    if (ui.edit.on) {
      editor.up();
      return;
    }
    if (pinch) {
      if (touches.size < 2) pinch = null;
      return;
    }
    endDrag(event.type === 'pointercancel');
  }

  function wheel(event: WheelEvent): void {
    event.preventDefault();
    const [mx, my] = svgXY(event.clientX, event.clientY);
    ui.zoomAt(ui.view.s * Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0015)), mx, my);
  }

  function dblclick(event: MouseEvent): void {
    if (ui.edit.on && ui.edit.mode === 'room' && ui.edit.pts.length >= 3) {
      editor.closeRoom();
      return;
    }
    const hit = hitOf(event.target);
    if (ui.tool === 'select' && hit.furnId) layout.rotateSelection(90);
  }

  function contextmenu(event: MouseEvent): void {
    if (ui.edit.on) {
      event.preventDefault();
      ui.edit.pts = [];
      ui.edit.drag = null;
      ui.edit.hover = null;
      return;
    }
    if (ui.tool === 'measure') {
      event.preventDefault();
      ui.measureA = null;
      ui.measureCur = null;
    }
  }

  useEventListener(svg, 'pointerdown', pointerDown);
  useEventListener(svg, 'pointermove', pointerMove);
  useEventListener(svg, 'pointerup', pointerEnd);
  useEventListener(svg, 'pointercancel', pointerEnd);
  useEventListener(svg, 'wheel', wheel, { passive: false });
  useEventListener(svg, 'dblclick', dblclick);
  useEventListener(svg, 'contextmenu', contextmenu);
  // 阻止 iPad Safari 把双指手势当成整页缩放（原 L1761）
  useEventListener(document, 'gesturestart', (event: Event) => event.preventDefault());
  useEventListener(document, 'gesturechange', (event: Event) => event.preventDefault());
  useEventListener(document, 'gestureend', (event: Event) => event.preventDefault());

  return {
    dragKind: computed(() => dragKind.value),
    panning,
    pointer,
    toMM,
    endDrag,
  };
}

/** 家具的轴对齐外接框（选中框/拖拽命中用；与渲染层共享同一口径） */
export function furnitureBox(f: Furniture): [number, number, number, number] {
  return furnitureRect(f);
}

/** 触屏放大热区倍数（原 `hs`，L1318） */
export const HANDLE_SCALE = COARSE ? 1.7 : 1;
/** 旋转手柄距边距离（屏幕 px，原 L1318） */
export const HANDLE_ROT_OFFSET = COARSE ? 40 : 26;
/** 手柄热区半径（屏幕 px，原 L1318） */
export const HANDLE_HIT = COARSE ? 24 : 11;