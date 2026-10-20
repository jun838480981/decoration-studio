/**
 * 相机、位姿与补间（原 L3618-3667 + L3789-3807 + L3873-3886 的相机部分）。
 *
 * 关键迁移点：
 * - `planPose()` 依赖「进入 3D 那一刻的 2D 视口位姿」，原实现读全局 `view` / `stage`；
 *   现在由 `Scene3DApi.enter(ctx)` 经 `setViewport()` 注入（SPEC §F.4）。
 * - `isoFrom` / `isoWhole` / `topWhole` / `curPose` / `camTween` / `flyTo` / `flyToRoom` 逐式保留。
 * - `setMode('walk')` 的漫游定位（入户门外 1.6m，看向室内）逐式保留。
 */
import { Euler, MathUtils, PerspectiveCamera, Spherical, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import type { Bounds } from '@/types/geometry';
import type { Door } from '@/types/plan';
import type { ViewTransform } from '@/types/state';
import {
  CUT_FULL,
  FOV,
  LAYER_HEIGHT,
  MAX_DISTANCE,
  MIN_DISTANCE,
  clamp01,
  ease,
  m,
  polyBounds,
  wx,
  wz,
  type WorldConfig,
} from './scene';

export interface Pose {
  /** 注视点 */
  t: Vector3;
  /** 相机位置 */
  p: Vector3;
}

export interface CameraControls {
  camera: PerspectiveCamera;
  orbit: OrbitControls;
  walkCtl: PointerLockControls;
  /** 进入 3D 时注入 2D 视口（`planPose()` 用） */
  setViewport: (view: ViewTransform, stageW: number, stageH: number) => void;
  /** 更新世界原点（切户型后调用） */
  setWorld: (world: WorldConfig, bounds: Bounds) => void;
  /** 舞台尺寸变化（ResizeObserver） */
  setSize: (w: number, h: number) => void;
  /** 漫游转向（触摸拖动；原 `lookBy` L3762） */
  lookBy: (dx: number, dy: number) => void;
  /** 当前位姿 */
  currentPose: () => Pose;
  /** 与当前 2D 视口完全重合的正俯视位姿 */
  planPose: () => Pose;
  /** 由某个位姿推导鸟瞰位姿（复式会抬得更高，原 L3628-3633） */
  isoFrom: (from: Pose, multiLevel: boolean) => Pose;
  /** 全屋鸟瞰 / 全屋俯视 */
  isoWhole: () => Pose;
  topWhole: () => Pose;
  /** 立即应用位姿 */
  setPose: (pose: Pose) => void;
  /** 球坐标插值（沿弧线环绕，而非直线穿越；原 L3638-3644） */
  tween: (a: Pose, b: Pose, e: number) => void;
  /** 飞行动画（900ms 起） */
  flyTo: (pose: Pose, duration?: number) => void;
  /** 飞向房间（按房间包围盒定距，原 L3660-3667） */
  flyToRoom: (roomId: string, rooms: { id: string; poly: [number, number][] }[]) => void;
  /** 漫游站位（入户门外，原 L3650-3658） */
  enterWalk: (doors: Door[]) => void;
  /** 退出漫游 → 回到鸟瞰（原 L3799-3804） */
  exitWalk: () => void;
  /** 每帧推进：动画 → 飞行 → orbit/walk */
  update: (dt: number, now: number, walkingActive: boolean) => void;
  /** 是否正在做相机动画 / 飞行 */
  isAnimating: () => boolean;
  /** 设置动画（`enter/exit` 的补间由 engine 驱动） */
  setAnim: (anim: { t0: number; dur: number; fn: (t: number) => void; resolve: () => void } | null) => void;
  /** 当前动画对象（engine 读取，用于在动画期间抑制拾取） */
  anim: { t0: number; dur: number; fn: (t: number) => void } | null;
  /** 取消飞行 */
  clearFly: () => void;
  dispose: () => void;
}

export interface CameraOptions {
  canvas: HTMLElement;
  lockTarget: HTMLElement;
  world: WorldConfig;
  bounds: Bounds;
  stageW: number;
  stageH: number;
  onLockChange?: (locked: boolean) => void;
}

export function createCameraControls(options: CameraOptions): CameraControls {
  let world = options.world;
  let bounds = options.bounds;
  let view: ViewTransform = { x0: 0, y0: 0, s: 0.06 };
  let stageW = options.stageW;
  let stageH = options.stageH;

  const camera = new PerspectiveCamera(FOV, (stageW || 1) / (stageH || 1), 0.05, 300);
  const orbit = new OrbitControls(camera, options.canvas);
  orbit.enableDamping = true;
  orbit.maxPolarAngle = Math.PI * 0.495;
  orbit.minDistance = MIN_DISTANCE;
  orbit.maxDistance = MAX_DISTANCE;

  const walkCtl = new PointerLockControls(camera, options.lockTarget);
  walkCtl.addEventListener('lock', () => options.onLockChange?.(true));
  walkCtl.addEventListener('unlock', () => options.onLockChange?.(false));

  const pose = (t: Vector3, p: Vector3): Pose => ({ t, p });
  let fly: { t0: number; dur: number; A: Pose; B: Pose } | null = null;
  let anim: { t0: number; dur: number; fn: (t: number) => void; resolve: () => void } | null = null;
  let lookEuler = new Euler(0, 0, 0, 'YXZ');

  function setViewport(next: ViewTransform, w: number, h: number): void {
    view = { ...next };
    stageW = w;
    stageH = h;
  }

  function setWorld(nextWorld: WorldConfig, nextBounds: Bounds): void {
    world = nextWorld;
    bounds = nextBounds;
  }

  function setSize(w: number, h: number): void {
    stageW = w;
    stageH = h;
    camera.aspect = (w || 1) / (h || 1);
    camera.updateProjectionMatrix();
  }

  /** 与当前 2D 视口完全重合的正俯视位姿（原 L3623-3627） */
  function planPose(): Pose {
    const cx = view.x0 + stageW / 2 / view.s;
    const cy = view.y0 + stageH / 2 / view.s;
    const visH = stageH / view.s / 1000;
    const dist = visH / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);
    const t = new Vector3(wx(world, cx), 0, wz(world, cy));
    return pose(t, new Vector3(t.x, dist, t.z + 1e-4));
  }

  function isoFrom(from: Pose, multiLevel: boolean): Pose {
    const d = MathUtils.clamp(from.p.y, 5, 30);
    // 复式：镜头再抬一点，尽量俯视，避免看到上层楼板底面（原 L3630-3632）
    const dir = multiLevel
      ? new Vector3(0.22, 1.55, 0.36).normalize()
      : new Vector3(0.3, 0.82, 0.49).normalize();
    return pose(from.t.clone(), from.t.clone().addScaledVector(dir, d * (multiLevel ? 1.25 : 1)));
  }

  const isoWhole = (): Pose => pose(new Vector3(0, 0, 0), new Vector3(5.5, 15.5, 10));
  const topWhole = (): Pose => pose(new Vector3(0, 0, 0), new Vector3(0, 19, 1e-4));
  const currentPose = (): Pose => pose(orbit.target.clone(), camera.position.clone());

  /** 球坐标插值：镜头沿弧线倾斜环绕（原 L3638-3644） */
  function tween(a: Pose, b: Pose, e: number): void {
    const t = a.t.clone().lerp(b.t, e);
    const sa = new Spherical().setFromVector3(a.p.clone().sub(a.t));
    const sb = new Spherical().setFromVector3(b.p.clone().sub(b.t));
    let dth = sb.theta - sa.theta;
    dth = Math.atan2(Math.sin(dth), Math.cos(dth));
    const s = new Spherical(
      sa.radius + (sb.radius - sa.radius) * e,
      sa.phi + (sb.phi - sa.phi) * e,
      sa.theta + dth * e,
    );
    camera.position.copy(t).add(new Vector3().setFromSpherical(s));
    camera.lookAt(t);
    orbit.target.copy(t);
  }

  function setPose(next: Pose): void {
    camera.position.copy(next.p);
    orbit.target.copy(next.t);
    camera.lookAt(next.t);
  }

  function flyTo(target: Pose, duration = 900): void {
    fly = { t0: performance.now(), dur: duration, A: currentPose(), B: target };
  }

  function flyToRoom(roomId: string, rooms: { id: string; poly: [number, number][] }[]): void {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;
    const box = polyBounds(room.poly);
    const t = new Vector3(wx(world, box.x + box.w / 2), 0.6, wz(world, box.y + box.h / 2));
    const size = m(Math.max(box.w, box.h));
    const dir = camera.position.clone().sub(orbit.target).setY(0);
    if (dir.lengthSq() < 0.01) dir.set(0.6, 0, 0.8);
    dir.normalize();
    const dist = size * 1.3 + 2.2;
    flyTo(pose(t, new Vector3(t.x + dir.x * dist * 0.7, dist * 1.05, t.z + dir.z * dist * 0.7)));
  }

  /** 入户门外的站位与朝向：没有入户门时退回户型中心（原 L3650-3658） */
  function enterWalk(doors: Door[]): void {
    const entry = doors.find((d) => d.entry);
    if (!entry) {
      camera.position.set(wx(world, bounds.x + bounds.w / 2), 1.6, wz(world, bounds.y + bounds.h / 2) - 3);
      camera.lookAt(0, 1.5, 0);
      return;
    }
    const [ax, ay, bx, by] = entry.rect;
    const cx = (ax + bx) / 2;
    const cy = (ay + by) / 2;
    const vertical = bx - ax < by - ay;
    const mx = bounds.x + bounds.w / 2;
    const my = bounds.y + bounds.h / 2;
    const k = vertical ? (cx < mx ? 1 : -1) : (cy < my ? 1 : -1);
    const ux = vertical ? k : 0;
    const uy = vertical ? 0 : k;
    camera.position.set(wx(world, cx - ux * 1600), 1.6, wz(world, cy - uy * 1600));
    camera.lookAt(wx(world, cx + ux * 1500), 1.5, wz(world, cy + uy * 1500));
  }

  function exitWalk(): void {
    const dir = new Vector3();
    camera.getWorldDirection(dir);
    orbit.target.copy(camera.position).addScaledVector(dir, 3).setY(0);
    orbit.enabled = true;
    flyTo(isoWhole());
  }

  /** 漫游转向（原 L3762-3766）：灵敏度 0.005，俯仰钳制 ±1.35rad */
  function lookBy(dx: number, dy: number): void {
    lookEuler = new Euler(0, 0, 0, 'YXZ');
    lookEuler.setFromQuaternion(camera.quaternion);
    lookEuler.y += dx * 0.005;
    lookEuler.x = MathUtils.clamp(lookEuler.x + dy * 0.005, -1.35, 1.35);
    camera.quaternion.setFromEuler(lookEuler);
  }

  function setAnim(next: { t0: number; dur: number; fn: (t: number) => void; resolve: () => void } | null): void {
    anim = next;
  }

  function update(dt: number, now: number, walkingActive: boolean): void {
    if (anim) {
      const t = clamp01((now - anim.t0) / anim.dur);
      anim.fn(t);
      if (t >= 1) {
        const resolve = anim.resolve;
        anim = null;
        resolve();
      }
      return;
    }
    if (fly) {
      const t = clamp01((now - fly.t0) / fly.dur);
      tween(fly.A, fly.B, ease(t));
      if (t >= 1) fly = null;
      return;
    }
    if (!walkingActive && orbit.enabled) orbit.update();
  }

  function dispose(): void {
    anim = null;
    fly = null;
    orbit.dispose();
    walkCtl.disconnect();
  }

  return {
    camera,
    orbit,
    walkCtl,
    setViewport,
    setWorld,
    setSize,
    lookBy,
    currentPose,
    planPose,
    isoFrom: (from: Pose, multiLevel: boolean) => isoFrom(from, multiLevel),
    isoWhole,
    topWhole,
    setPose,
    tween,
    flyTo,
    flyToRoom,
    enterWalk,
    exitWalk,
    lookBy,
    update,
    isAnimating: () => anim !== null || fly !== null,
    setAnim,
    get anim() {
      return anim;
    },
    clearFly: () => {
      fly = null;
    },
    dispose,
  };
}

/** 出口常量（供 engine 判断漫游时强制全高，原 L3794） */
export const WALK_CUT = CUT_FULL;
export const ROOM_HEIGHT = LAYER_HEIGHT;