/**
 * 光照与地面（原 `applyLight()` L3603-3616，**迁移到主题令牌体系**）。
 *
 * SPEC §E.8 T3 + ADR-08 的强制口径：
 *
 * | 项 | 原实现（L3603-3616） | 现在 |
 * | --- | --- | --- |
 * | 太阳位置 / 高度角 / 暖度 | `hour` 驱动 | 保持 `hour` 驱动（时段的几何部分不变） |
 * | `sun.color` | `HSL(.09, .5+warm*.4, .92-warm*.12)` 硬编码 | **`theme` 令牌**（`binding.sunColor`） |
 * | `sun.intensity` | `night ? .05 : 1.4+sin(πt)*1.6` | **`theme` 令牌** + 夜景覆盖（`binding.sunIntensity`） |
 * | `hemi.intensity` | `night ? .12 : 1.1` | `binding.hemiIntensity` |
 * | `scene.background` | `night ? 0x1c2130 : 0xf7f4ee` | `binding.background` |
 * | 地面色 | `night ? 0x2a2e38 : 0xf2eee7` | `binding.groundColor` |
 * | `toneMappingExposure` | `night ? 1.25 : 1.05` | `binding.toneMappingExposure` |
 * | 环境反射系数 `envK` | `night ? .15 : 1` | `binding.envK`（夜景覆盖值恒 0.15） |
 * | 室内点光源 / 灯盘自发光 | `night ? 6 : 0` / `night ? 2 : .3` | 保留（由 `view3d.night` 决定） |
 *
 * 为什么要改：原文的 3D 光照色是写死的，切主题时 3D 场景纹丝不动 —— 评审会直接打回（§E.8 背景事实）。
 */
import {
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PlaneGeometry,
  type Scene,
  type WebGLRenderer,
} from 'three';
import type { MaterialPalette, SceneThemeBinding } from '@/types/theme';
import { COARSE } from './scene';

export interface LightingRig {
  hemi: HemisphereLight;
  sun: DirectionalLight;
  ground: Mesh;
  /** 吸顶灯组（`lampG`） */
  setLamps: (lamps: Group) => void;
  /** 每帧/每次参数变化调用：位置 + 光色 + 强度 + 背景 + 曝光 + 灯组 */
  apply: (options: {
    /** 主题 + 夜景组合后的场景绑定（`resolveSceneTheme().binding`） */
    binding: SceneThemeBinding;
    palette: MaterialPalette;
    /** 日照时刻 7–18（`ui.view3d.hour`） */
    hour: number;
    /** 3D 独立夜景开关（`ui.view3d.night`） */
    night: boolean;
  }) => void;
  dispose: () => void;
}

export function createLighting(scene: Scene, renderer: WebGLRenderer, binding: SceneThemeBinding, palette: MaterialPalette): LightingRig {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const hemi = new HemisphereLight(new Color(palette.surface.ceramic), new Color(palette.surface.skirt), binding.hemiIntensity);
  const sun = new DirectionalLight(new Color(binding.sunColor), binding.sunIntensity);
  sun.castShadow = true;
  // 平板 GPU 用小一点的阴影贴图（原 L2726）
  sun.shadow.mapSize.setScalar(COARSE ? 2048 : 4096);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 60 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;

  const ground = new Mesh(
    new PlaneGeometry(160, 160),
    new MeshStandardMaterial({ color: binding.groundColor, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.015;
  ground.receiveShadow = true;

  scene.add(hemi, sun, sun.target, ground);

  let lamps: Group | null = null;

  function apply(options: { binding: SceneThemeBinding; palette: MaterialPalette; hour: number; night: boolean }): void {
    const { binding: b, hour, night } = options;
    // 时段几何（原 L3604-3605）：方位角与高度角仍由 hour 驱动
    const t = (hour - 6) / 12;
    const az = Math.PI * (0.15 + t * 0.7);
    const el = Math.sin(Math.PI * t) * 1.05 + 0.15;
    sun.position.set(Math.cos(az) * 18, Math.sin(el) * 20 + 3, -Math.sin(az) * 10 + 8);
    sun.target.position.set(0, 0, 0);

    // 光色 / 强度 / 背景 / 地面 / 曝光 —— 全部来自主题令牌（§E.8 T3）
    sun.color.set(b.sunColor);
    sun.intensity = b.sunIntensity;
    hemi.intensity = b.hemiIntensity;
    hemi.color.set(options.palette.surface.ceramic);
    hemi.groundColor.set(options.palette.surface.skirt);
    scene.background = new Color(b.background);
    (ground.material as MeshStandardMaterial).color.set(b.groundColor);
    renderer.toneMappingExposure = b.toneMappingExposure;

    // 室内点光源 / 灯盘自发光（原 L3611）
    lamps?.children.forEach((o) => {
      const light = o as { isPointLight?: boolean; intensity?: number };
      if (light.isPointLight) {
        light.intensity = night ? 6 : 0;
        return;
      }
      const material = (o as Mesh).material as MeshStandardMaterial | undefined;
      if (material) material.emissiveIntensity = night ? 2 : 0.3;
    });
  }

  function dispose(): void {
    scene.remove(hemi, sun, sun.target, ground);
    sun.shadow.map?.dispose();
    sun.dispose();
    ground.geometry.dispose();
    (ground.material as MeshStandardMaterial).dispose();
  }

  return {
    hemi,
    sun,
    ground,
    setLamps: (value: Group) => {
      lamps = value;
    },
    apply,
    dispose,
  };
}

/** 时刻读数 `HH:MM`（原 L3614-3615，`#sunT` 文案） */
export function formatHour(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}