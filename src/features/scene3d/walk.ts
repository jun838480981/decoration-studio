/**
 * 漫游（原 L3753-3831）：桌面 `PointerLockControls` + WASD，触屏左下摇杆 + 拖动转向。
 *
 * 保留的关键语义：
 * - 速度 1.4 m/s，`Shift` 快走 2.6 m/s；
 * - 摇杆推力线性映射速度（`mag = min(1, mv.length())`）；
 * - **分轴碰撞**（X、Z 分开判定，原 L3829-3830），墙体 + 门扇（线段距离）双来源；
 * - `blocked(x, z, r=0.22)` 的判定式逐式保留（原 L3808-3816）。
 */
import { Vector3 } from 'three';
import type { DoorHandle } from './architecture';
import type { CameraControls } from './camera';
import { clamp01, type WorldConfig } from './scene';

/** 摇杆归一化输出（`Scene3D.vue` 的 `#joy` 写入；原 `joy` 对象） */
export interface JoystickState {
  x: number;
  y: number;
  id: number | null;
}

export interface WalkDeps {
  controls: Pick<CameraControls, 'camera' | 'walkCtl' | 'lookBy'>;
  /** 漫游碰撞盒（世界坐标 `[x0, z0, x1, z1]`） */
  colliders: () => [number, number, number, number][];
  /** 当前门扇（含开合角，用于门板碰撞） */
  doors: () => DoorHandle[];
  /** 户型包围盒（上下限保护，防止走出地面） */
  bounds: () => { x: number; y: number; w: number; h: number };
  world: () => WorldConfig;
  /** 摇杆状态（组件写入） */
  joy: JoystickState;
  /** 当前是否触屏漫游 */
  touchWalking: () => boolean;
}

export interface WalkController {
  /** 按键状态表（原 `keys`） */
  keys: Record<string, boolean>;
  /** 触屏漫游开关（原 `startTouchWalk/stopTouchWalk`） */
  setTouchWalk: (on: boolean) => void;
  isTouchWalking: () => boolean;
  /** 是否真的能移动（桌面锁指针 或 触屏漫游已开始） */
  isActive: () => boolean;
  /** 每帧推进；`dt` 已钳制到 0.05（原 `Math.min(clock.getDelta(), .05)`） */
  step: (dt: number) => void;
  /** 碰撞判定（原 `blocked`，L3808-3816） */
  blocked: (x: number, z: number, r?: number) => boolean;
  dispose: () => void;
}

export function createWalk(deps: WalkDeps): WalkController {
  const keys: Record<string, boolean> = {};
  let touchWalk = false;
  const fwd = new Vector3();
  const right = new Vector3();
  const move = new Vector3();

  function setTouchWalk(on: boolean): void {
    touchWalk = on;
    if (!on) {
      deps.joy.x = 0;
      deps.joy.y = 0;
      deps.joy.id = null;
    }
  }

  function isActive(): boolean {
    return deps.controls.walkCtl.isLocked || touchWalk;
  }

  function blocked(x: number, z: number, r = 0.22): boolean {
    for (const [x0, z0, x1, z1] of deps.colliders()) {
      if (x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) return true;
    }
    for (const d of deps.doors()) {
      const a = d.pivot.rotation.y;
      const px = d.pivot.position.x;
      const pz = d.pivot.position.z;
      const ex = px + Math.cos(a) * 0.9;
      const ez = pz - Math.sin(a) * 0.9;
      const denom = (ex - px) ** 2 + (ez - pz) ** 2;
      const t = denom === 0 ? 0 : clamp01(((x - px) * (ex - px) + (z - pz) * (ez - pz)) / denom);
      if (Math.hypot(x - (px + t * (ex - px)), z - (pz + t * (ez - pz))) < r * 0.8) return true;
    }
    return false;
  }

  function step(dt: number): void {
    if (!isActive()) return;
    const speed = (keys.ShiftLeft || keys.ShiftRight ? RUN_SPEED : WALK_SPEED) * dt;
    deps.controls.camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    right.set(-fwd.z, 0, fwd.x);
    move.set(0, 0, 0);
    if (keys.KeyW || keys.ArrowUp) move.add(fwd);
    if (keys.KeyS || keys.ArrowDown) move.sub(fwd);
    if (keys.KeyD || keys.ArrowRight) move.add(right);
    if (keys.KeyA || keys.ArrowLeft) move.sub(right);
    if (touchWalk) move.addScaledVector(fwd, -deps.joy.y).addScaledVector(right, deps.joy.x);
    const mag = Math.min(1, move.length()); // 摇杆推得越远走得越快（原 L3825）
    if (mag < 0.05) return;
    move.normalize().multiplyScalar(speed * mag);
    const p = deps.controls.camera.position;
    // 分轴碰撞：X、Z 分开判定（原 L3829-3830）
    if (!blocked(p.x + move.x, p.z)) p.x += move.x;
    if (!blocked(p.x, p.z + move.z)) p.z += move.z;
    p.y = EYE_HEIGHT;
  }

  return {
    keys,
    setTouchWalk,
    isTouchWalking: () => touchWalk,
    isActive,
    step,
    blocked,
    dispose: () => {
      for (const key of Object.keys(keys)) keys[key] = false;
      touchWalk = false;
    },
  };
}

/** 漫游速度常量（原 L3819 / L3758） */
export const WALK_SPEED = 1.4;
export const RUN_SPEED = 2.6;
/** 视点高度（原 L3796：`camera.position.set(e.px, 1.6, e.pz)`） */
export const EYE_HEIGHT = 1.6;