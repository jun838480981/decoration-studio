/**
 * 拾取 / 地面反投影 / 3D 拖动（原 L2708-2793 的指针部分 + L3708-3751）。
 *
 * 逐条保留的语义：
 * - `pick(e)`：射线命中顺序里**跳过玻璃**（`o.material === glassMat`，原 L3717），
 *   沿父链回溯 `userData.fid`，被墙挡住则返回 `null`；
 * - `groundAt(x, y)`：屏幕 → `y = 0` 平面 → 户型 mm + 该处每 mm 的屏幕像素 `s`，
 *   视线先碰到墙体时取墙面交点（原 L3733-3741）；
 * - 拖动已选中家具：超过 `TAP` 阈值才算「移动」，拖动中只挪模型，松手才 `layout.mutate(before)` 进撤销栈
 *   （原 L2769-2773；SPEC §C.2 B8：3D 侧只能写 `stores/layout`）。
 */
import {
  BoxHelper,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
  type Camera,
  type Mesh,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from 'three';
import type { Furniture } from '@/types/furniture';
import { GROUND_MAX_DIST, MM, TAP, planX, planY, wx, wz, type WorldConfig } from './scene';
import type { DoorHandle } from './architecture';
import { snapMove } from './snap';

/** `pick()` 的返回值（原实现返回 `{door}|{room}|{fid}|null`） */
export type PickHit =
  | { kind: 'door'; door: DoorHandle; dist: number }
  | { kind: 'room'; room: string }
  | { kind: 'furn'; fid: string }
  | null;

export interface PickTargets {
  archUp: Object3D;
  archFloor: Object3D;
  furnG: Object3D;
  furnitureVisible: () => boolean;
  glass: Mesh['material'];
  camera: Camera;
  renderer: WebGLRenderer;
  scene: Scene;
  furniture: () => readonly Furniture[];
  world: () => WorldConfig;
  /** 拖动开始前压栈的快照（`layout.snapshot()`） */
  snapshot: () => string;
  /** 松手后提交（`layout.mutate` 已含 commit；这里传"改动前快照"） */
  commit: (before: string) => void;
  /** 拖动中把 mm 坐标写回 store（只改 `cx/cy`） */
  moveFurniture: (id: string, x: number, y: number) => void;
  /** 是否允许交互（3D 活跃且不在相机动画中） */
  interactive: () => boolean;
  /** 选中框颜色（`theme.resolve('accent')`，⛔ 不写 hex） */
  selectionColor: () => string;
  /** 点中空处（原 `window.select(null)`） */
  clearSelection: () => void;
  /** 选中家具（原 `window.select({kind:'furn', id})`） */
  selectFurniture: (id: string) => void;
  /** 选中房间（原 `window.select({kind:'room', id})`） */
  selectRoom: (id: string) => void;
}

export interface Picking {
  /** 屏幕坐标拾取；`null` = 未命中（含被墙挡住） */
  pick: (clientX?: number, clientY?: number) => PickHit;
  /** 屏幕 → 地面户型坐标 + 每 mm 屏幕像素（原 `groundAt`） */
  groundAt: (clientX: number, clientY: number) => { x: number; y: number; s: number } | null;
  /** 点击（含门开关、家具/房间选中、空白清选） */
  tap: (clientX: number, clientY: number) => void;
  /** 漫游按 `E` 开门（原 L3835） */
  toggleDoorAhead: (maxDist: number) => void;
  /** 指针按下：命中已选中家具则进入拖动 */
  onPointerDown: (e: PointerEvent) => void;
  /** 指针移动：拖动中挪模型 / 触屏转向 */
  onPointerMove: (e: PointerEvent) => void;
  /** 指针抬起/取消：结束拖动并提交 */
  onPointerUp: (e: PointerEvent) => void;
  /** 当前是否在拖动家具 */
  isDragging: () => boolean;
  /** 选中高亮刷新（每帧调用；原 `updateSel()` L3742-3751） */
  updateSelection: (selectedId: string | null) => void;
  dispose: () => void;
}

export function createPicking(targets: PickTargets): Picking {
  const ray = new Raycaster();
  const ptr = new Vector2();
  const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
  const hitPoint = new Vector3();
  let selKey: string | null = null;
  let selHelper: BoxHelper | null = null;

  let drag: {
    id: string;
    pid: number;
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    before: string;
    moved: boolean;
  } | null = null;

  /** 屏幕坐标 → NDC */
  function toNdc(clientX: number, clientY: number): void {
    const r = targets.renderer.domElement.getBoundingClientRect();
    ptr.set(((clientX - r.left) / r.width) * 2 - 1, (-(clientY - r.top) / r.height) * 2 + 1);
  }

  function pick(clientX?: number, clientY?: number): PickHit {
    if (clientX === undefined || clientY === undefined) ptr.set(0, 0);
    else toNdc(clientX, clientY);
    ray.setFromCamera(ptr, targets.camera);
    const roots: Object3D[] = targets.furnitureVisible() ? [targets.furnG, targets.archUp, targets.archFloor] : [targets.archUp, targets.archFloor];
    const hits = ray.intersectObjects(roots, true);
    for (const hit of hits) {
      let object: Object3D | null = hit.object;
      // 玻璃不参与拾取（原 L3717）
      if ((object as Mesh).material === targets.glass) continue;
      const userData = object.userData as { door?: DoorHandle; room?: string; fid?: string };
      if (userData.door) return { kind: 'door', door: userData.door, dist: hit.distance };
      if (userData.room) return { kind: 'room', room: userData.room };
      while (object && !(object.userData as { fid?: string }).fid && object !== targets.scene) object = object.parent;
      const fid = object ? (object.userData as { fid?: string }).fid : undefined;
      if (fid) return { kind: 'furn', fid };
      return null; // 被墙体挡住（原 L3722）
    }
    return null;
  }

  /** 屏幕点 → 地面（y = 0）上的户型坐标 mm（原 L3728-3741） */
  function groundAt(clientX: number, clientY: number): { x: number; y: number; s: number } | null {
    if (!targets.interactive()) return null;
    const r = targets.renderer.domElement.getBoundingClientRect();
    toNdc(clientX, clientY);
    ray.setFromCamera(ptr, targets.camera);
    if (!ray.ray.intersectPlane(groundPlane, hitPoint) || hitPoint.distanceTo(targets.camera.position) > GROUND_MAX_DIST) {
      return null;
    }
    // 视线先碰到墙体（或飘窗台）时，落点取碰到的位置，而不是穿过墙落到看不见的墙后（原 L3735-3736）
    const wall = ray
      .intersectObjects([targets.archUp, targets.archFloor], true)
      .find((h) => (h.object as Mesh).material !== targets.glass && h.object.visible);
    if (wall && wall.distance < hitPoint.distanceTo(targets.camera.position) - 0.01) {
      hitPoint.set(wall.point.x, 0, wall.point.z);
    }
    const world = targets.world();
    const projected = (v: Vector3): Vector2 => new Vector2((v.x * r.width) / 2, (v.y * r.height) / 2);
    const a = projected(hitPoint.clone().project(targets.camera));
    const s =
      Math.max(
        a.distanceTo(projected(hitPoint.clone().add(new Vector3(1, 0, 0)).project(targets.camera))),
        a.distanceTo(projected(hitPoint.clone().add(new Vector3(0, 0, 1)).project(targets.camera))),
      ) / MM;
    return { x: planX(world, hitPoint.x), y: planY(world, hitPoint.z), s };
  }

  /** 点击语义（原 L2783-2788）：门 → 家具 → 房间 → 清空 */
  function tap(clientX: number, clientY: number): void {
    if (!targets.interactive()) return;
    const hit = pick(clientX, clientY);
    if (hit?.kind === 'door') {
      hit.door.open = !hit.door.open;
      return;
    }
    if (hit?.kind === 'furn') {
      targets.selectFurniture(hit.fid);
      return;
    }
    if (hit?.kind === 'room') {
      targets.selectRoom(hit.room);
      return;
    }
    targets.clearSelection();
  }

  /** 漫游按 `E`：正前方 2.5m 内的门（原 L3835） */
  function toggleDoorAhead(maxDist: number): void {
    const hit = pick();
    if (hit?.kind === 'door' && hit.dist < maxDist) hit.door.open = !hit.door.open;
  }

  function onPointerDown(e: PointerEvent): void {
    if (!targets.interactive() || e.button !== 0) return;
    const hit = pick(e.clientX, e.clientY);
    if (hit?.kind !== 'furn') return;
    const furniture = targets.furniture();
    const target = furniture.find((f) => f.id === hit.fid);
    if (!target) return;
    const ground = groundAt(e.clientX, e.clientY);
    if (!ground) return;
    drag = {
      id: target.id,
      pid: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ox: ground.x - target.cx,
      oy: ground.y - target.cy,
      before: targets.snapshot(),
      moved: false,
    };
  }

  function onPointerMove(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < TAP) return;
    const ground = groundAt(e.clientX, e.clientY);
    if (!ground) return;
    drag.moved = true;
    const target = targets.furniture().find((f) => f.id === drag?.id);
    if (!target) return;
    const next = snapMove(target, ground.x - drag.ox, ground.y - drag.oy, targets.furniture());
    targets.moveFurniture(target.id, next.x, next.y);
    const model = targets.furnG.children.find((o) => (o.userData as { fid?: string }).fid === target.id);
    const world = targets.world();
    // 拖动中只挪模型（原 L2767），松手后由 store 变化触发 `buildFurn()`
    model?.position.set(wx(world, next.x), 0, wz(world, next.y));
  }

  function onPointerUp(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.pid) return;
    const finished = drag;
    drag = null;
    // 只有真的移动过才进撤销栈（原 L2772；SPEC §C.2 B8）
    if (finished.moved) targets.commit(finished.before);
  }

  /** 选中高亮（原 `updateSel()` L3742-3751，同时迁移了 BoxHelper 的释放） */
  function updateSelection(selectedId: string | null): void {
    if (selectedId !== selKey) {
      selKey = selectedId;
      if (selHelper) {
        targets.scene.remove(selHelper);
        selHelper.geometry.dispose();
        (selHelper.material as { dispose?: () => void }).dispose?.();
        selHelper = null;
      }
      const group = selectedId ? targets.furnG.children.find((o) => (o.userData as { fid?: string }).fid === selectedId) : null;
      if (group) {
        selHelper = new BoxHelper(group, targets.selectionColor());
        selHelper.castShadow = false;
        targets.scene.add(selHelper);
      }
    }
    selHelper?.update();
  }

  function dispose(): void {
    if (selHelper) {
      targets.scene.remove(selHelper);
      selHelper.geometry.dispose();
      (selHelper.material as { dispose?: () => void }).dispose?.();
      selHelper = null;
    }
    selKey = null;
    drag = null;
  }

  return {
    pick,
    groundAt,
    tap,
    toggleDoorAhead,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    isDragging: () => drag !== null,
    updateSelection,
    dispose,
  };
}