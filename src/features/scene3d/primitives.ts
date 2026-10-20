/**
 * 几何小工具 + 家具材质工厂（原 L2856-2951 全量迁移）。
 *
 * 约定（与原实现逐字一致，OF §3.3）：
 * - **y = 底面高度**：`box/rbox/cyl` 的 `y` 是物体底面，函数内部 `y + h/2`；
 * - `lathe` 的 `y` 是底面；`blob/ring` 的 `y` 是**中心**；
 * - 局部坐标：家具**背面朝 -z**；
 * - ⛔ 零 hex 字面值（SPEC §E.8 T2）：材质工厂一律从 `deps.palette` 取色，
 *   只有显式传入的**内容色**（用户家具色 `Furniture.color`）才允许被参数化。
 */
import {
  BoxGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { MaterialPalette } from '@/types/theme';
import {
  edgeGrooveOf,
  FLOWER_COLORS,
  panelGapOf,
  STEM_GREEN,
} from './furniture/content-colors';
import type { MaterialLibrary } from './materials';
import { darker } from './scene';

/** 材质相关的最小依赖（便于单测与按需替换） */
export interface PrimitiveDeps {
  ml: Pick<MaterialLibrary, 'mat' | 'content' | 'glass' | 'floorMat'>;
  palette: MaterialPalette;
}

/* ======================= 网格与变换 ======================= */

export const asMesh = (o: Object3D): Mesh => o as Mesh;

/** 同时投/受影（原 L2858 `sh`） */
export function sh<T extends Object3D>(o: T): T {
  const mesh = o as Mesh;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return o;
}

export function rot<T extends Object3D>(o: T, x = 0, y = 0, z = 0): T {
  o.rotation.set(x, y, z);
  return o;
}

export function mesh(geo: BufferGeometry, material: unknown): Mesh {
  return sh(new Mesh(geo, material as never));
}

/** 长方体；`y` = 底面 */
export function box(w: number, h: number, d: number, material: unknown, x = 0, y = 0, z = 0): Mesh {
  const o = mesh(new BoxGeometry(w, h, d), material);
  o.position.set(x, y + h / 2, z);
  return o;
}

/** 圆角长方体；`y` = 底面（原 L2864） */
export function rbox(w: number, h: number, d: number, material: unknown, x = 0, y = 0, z = 0, r = 0.04): Mesh {
  const radius = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const o = mesh(new RoundedBoxGeometry(w, h, d, 3, radius), material);
  o.position.set(x, y + h / 2, z);
  return o;
}

/** 圆柱/圆台；`y` = 底面 */
export function cyl(rt: number, rb: number, h: number, material: unknown, x = 0, y = 0, z = 0, seg = 28): Mesh {
  const o = mesh(new CylinderGeometry(rt, rb, h, seg), material);
  o.position.set(x, y + h / 2, z);
  return o;
}

/** 旋转体：`pts = [[半径, 高度], …]` 自下而上，`y` = 底面（原 L2871） */
export function lathe(pts: [number, number][], material: unknown, x = 0, y = 0, z = 0, seg = 40): Mesh {
  const o = mesh(
    new LatheGeometry(
      pts.map(([r, h]) => new Vector2(Math.max(r, 1e-4), h)),
      seg,
    ),
    material,
  );
  o.position.set(x, y, z);
  return o;
}

/** 两点之间的圆杆，`r0` 在 a 端、`r1` 在 b 端（收分椅腿、斜撑；原 L2875） */
export function rod(
  a: [number, number, number],
  b: [number, number, number],
  r0: number,
  material: unknown,
  r1 = r0,
  seg = 12,
): Mesh {
  const A = new Vector3(...a);
  const B = new Vector3(...b);
  const o = mesh(new CylinderGeometry(r1, r0, A.distanceTo(B), seg), material);
  o.position.copy(A).add(B).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), B.sub(A).normalize());
  return o;
}

/** 沿曲线的圆管（水龙头、扶手、灯臂；原 L2880） */
export function tube(pts: [number, number, number][], r: number, material: unknown, seg = 40): Mesh {
  const curve = new CatmullRomCurve3(
    pts.map((p) => new Vector3(...p)),
    false,
    'centripetal',
  );
  return mesh(new TubeGeometry(curve, seg, r, 10), material);
}

/** 椭球（靠垫、叶片、豆袋）；`y` = 中心 */
export function blob(rx: number, ry: number, rz: number, material: unknown, x = 0, y = 0, z = 0, seg = 24): Mesh {
  const o = mesh(new SphereGeometry(1, seg, Math.round(seg * 0.7)), material);
  o.scale.set(rx, ry, rz);
  o.position.set(x, y, z);
  return o;
}

/** 水平圆环；`y` = 中心 */
export function ring(R: number, r: number, material: unknown, x = 0, y = 0, z = 0): Mesh {
  const o = mesh(new TorusGeometry(R, r, 10, 48), material);
  o.rotation.x = Math.PI / 2;
  o.position.set(x, y, z);
  return o;
}

/** 圆角矩形路径（rrect/shell 用；原 L2887） */
export function rrect(w: number, d: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2;
  const y = -d / 2;
  const radius = Math.min(r, w / 2 - 0.001, d / 2 - 0.001);
  s.moveTo(x + radius, y);
  s.lineTo(x + w - radius, y);
  s.quadraticCurveTo(x + w, y, x + w, y + radius);
  s.lineTo(x + w, y + d - radius);
  s.quadraticCurveTo(x + w, y + d, x + w - radius, y + d);
  s.lineTo(x + radius, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - radius);
  s.lineTo(x, y + radius);
  s.quadraticCurveTo(x, y, x + radius, y);
  return s;
}

/** 中空圆角框（浴缸、水槽沿、椅背框）：外 w×d、壁厚 t、高 h（原 L2893） */
export function shell(w: number, d: number, h: number, t: number, r: number, material: unknown, x = 0, y = 0, z = 0): Mesh {
  const s = rrect(w, d, r);
  s.holes.push(rrect(w - 2 * t, d - 2 * t, Math.max(0.004, r - t)));
  const geo = new ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 10 });
  geo.rotateX(-Math.PI / 2);
  const o = mesh(geo, material);
  o.position.set(x, y, z);
  return o;
}

/** 四条收分腿：`inset` 为距边距离，`r` 为腿底半径（原 L2901） */
export function legs(
  g: Object3D,
  w: number,
  d: number,
  h: number,
  material: unknown,
  inset = 0.05,
  r = 0.02,
): void {
  (
    [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const
  ).forEach(([a, b]) => {
    g.add(
      rod(
        [a * (w / 2 - inset), 0, b * (d / 2 - inset)],
        [a * (w / 2 - inset), h, b * (d / 2 - inset)],
        r * 0.7,
        material,
        r,
      ),
    );
  });
}

/* ======================= 材质工厂（原 L2902-2911） ======================= */

export interface FurnitureMaterials {
  /** 拉丝金属 */
  metal: () => unknown;
  /** 镜面铬 */
  chrome: () => unknown;
  /** 五金件（拉手/合页） */
  hwMat: () => unknown;
  /** 黑色金属（桌架、办公椅） */
  blackMetal: () => unknown;
  /** 镜子 */
  mirror: () => unknown;
  /** 陶瓷（洁具/餐具） */
  ceramic: (o?: Record<string, unknown>) => unknown;
  /** 家电外壳：介于金属与陶瓷之间的「内容色」面（冰箱、洗衣机等） */
  metalLike: (contentColor: string) => unknown;
  /** 布艺（**内容色**，ADR-10 不随主题变） */
  fabric: (contentColor: string) => unknown;
  /** 木饰面（**内容色**） */
  woodM: (contentColor: string) => unknown;
  /** 屏幕（深色玻璃 + 自发光） */
  screenMat: (emissive?: string) => unknown;
  /** 自发光灯罩 */
  glowMat: (color?: string, emissive?: string, intensity?: number) => unknown;
  /** 玻璃（全局单例，拾取时跳过） */
  glass: () => unknown;
  /** 半透明「玻璃感」内容色（香水瓶、玻璃杯等） */
  glassLike: (contentColor: string, opacity?: number) => unknown;
  /** 金属圆管（水龙头、灯臂、椅脚），`pts` 为世界局部折线 */
  tube: (pts: [number, number, number][], r: number, material: unknown, seg?: number) => unknown;
  /** 柜门缝隙暗色（由 `metal.black` 派生，随主题） */
  gapColor: () => string;
  /** 隐形拉槽暗色（由 `surface.frame` 派生，随主题） */
  edgeGroove: () => string;
}

export function createFurnitureMaterials(deps: PrimitiveDeps): FurnitureMaterials {
  const { ml, palette } = deps;
  const mat = (color: string, options: Record<string, unknown>, path: string): unknown => ml.mat(color, options, path);
  return {
    metal: () => mat(palette.metal.base, { metalness: 0.9, roughness: 0.25 }, 'metal.base'),
    chrome: () => mat(palette.metal.chrome, { metalness: 1, roughness: 0.08 }, 'metal.chrome'),
    hwMat: () => mat(palette.metal.hardware, { metalness: 0.85, roughness: 0.3 }, 'metal.hardware'),
    blackMetal: () => mat(palette.metal.black, { metalness: 0.6, roughness: 0.4 }, 'metal.black'),
    mirror: () => mat(palette.surface.mirror, { metalness: 0.55, roughness: 0.06 }, 'surface.mirror'),
    ceramic: (o: Record<string, unknown> = {}) =>
      mat(palette.surface.ceramic, { roughness: 0.12, ...o }, 'surface.ceramic'),
    metalLike: (contentColor: string) => ml.content(contentColor, { metalness: 0.45, roughness: 0.28 }),
    fabric: (contentColor: string) => ml.content(contentColor, { roughness: 0.96 }),
    woodM: (contentColor: string) => ml.content(contentColor, { roughness: 0.55 }),
    screenMat: (emissive?: string) =>
      mat(
        palette.light.screen,
        {
          roughness: 0.1,
          metalness: 0.3,
          emissive: emissive ?? palette.light.screen,
          emissiveIntensity: 0.35,
        },
        'light.screen',
      ),
    glowMat: (color?: string, emissive?: string, intensity = 0.5) =>
      mat(
        color ?? palette.light.glow,
        {
          emissive: emissive ?? palette.light.glow,
          emissiveIntensity: intensity,
          roughness: 0.9,
          side: DoubleSide,
        },
        'light.glow',
      ),
    glass: () => ml.glass,
    glassLike: (contentColor: string, opacity = 0.8) => ml.content(contentColor, { roughness: 0.15, transparent: true, opacity }),
    tube,
    gapColor: () => panelGapOf(palette),
    edgeGroove: () => edgeGrooveOf(palette),
  };
}

/* ======================= 参数化家具部件（原 L2913-2951） ======================= */

/** 拉手：`y` 为拉手中心，`z` 为门板正面（原 L2914） */
export function pull(g: Object3D, len: number, vert: boolean, x: number, y: number, z: number, fm: FurnitureMaterials): void {
  const material = fm.hwMat();
  const group = new Group();
  group.add(vert ? box(0.01, len, 0.01, material, 0, -len / 2, 0.028) : box(len, 0.01, 0.01, material, 0, -0.005, 0.028));
  [-1, 1].forEach((s) =>
    group.add(
      vert
        ? box(0.008, 0.008, 0.028, material, 0, s * (len / 2 - 0.015) - 0.004, 0.014)
        : box(0.008, 0.008, 0.028, material, s * (len / 2 - 0.015), -0.004, 0.014),
    ),
  );
  group.position.set(x, y, z);
  g.add(group);
}

/** 圆钮拉手（原 L2920） */
export function knob(g: Object3D, x: number, y: number, z: number, fm: FurnitureMaterials): void {
  const material = fm.hwMat();
  const k = cyl(0.011, 0.014, 0.02, material, x, y - 0.01, z + 0.01, 16);
  k.rotation.x = Math.PI / 2;
  g.add(k, blob(0.014, 0.014, 0.008, material, x, y, z + 0.022, 12));
}

/**
 * 柜门 / 抽屉面板：`x0..x0+w`、`y0..y0+h` 区域内 `nx` 列 × `ny` 行，正面朝 +z（原 L2923）。
 * `hd`：`'bar'` 金属拉手 | `'knob'` 圆钮 | `'edge'` 顶部隐形拉槽 | `'none'`。
 */
export function fronts(
  g: Object3D,
  x0: number,
  y0: number,
  w: number,
  h: number,
  z: number,
  nx: number,
  ny: number,
  panelMaterial: unknown,
  fm: FurnitureMaterials,
  hd: 'bar' | 'knob' | 'edge' | 'none' = 'bar',
  hy: number | null = null,
): void {
  const gap = 0.005;
  const pw = w / nx;
  const ph = h / ny;
  const fz = z + 0.018;
  g.add(box(w, h, 0.002, fm.gapColor(), x0 + w / 2, y0, z + 0.001)); // 缝隙里透出的暗色
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const cx = x0 + pw * (i + 0.5);
      const yb = y0 + ph * j;
      const drawer = ph < 0.4 && pw >= ph;
      g.add(rbox(pw - gap, ph - gap, 0.018, panelMaterial, cx, yb + gap / 2, z + 0.009, 0.003));
      if (hd === 'none') continue;
      if (hd === 'edge') {
        g.add(box(pw - 0.05, 0.01, 0.006, fm.edgeGroove(), cx, yb + ph - gap - 0.018, fz));
        continue;
      }
      if (drawer) {
        if (hd === 'knob') knob(g, cx, yb + ph / 2, fz, fm);
        else pull(g, Math.min(0.3, pw * 0.45), false, cx, yb + ph / 2, fz, fm);
        continue;
      }
      const len = Math.min(0.45, ph * 0.35);
      const hx = nx === 1 ? cx + pw / 2 - 0.045 : i % 2 ? cx - pw / 2 + 0.04 : cx + pw / 2 - 0.04;
      const y = Math.min(yb + ph - 0.05 - len / 2, Math.max(yb + 0.05 + len / 2, hy ?? yb + ph / 2));
      if (hd === 'knob') knob(g, hx, y, fz, fm);
      else pull(g, len, true, hx, y, fz, fm);
    }
  }
}

/** 花瓶（原 L2937）：`R` 为确定性随机源 */
export function vase(
  g: Object3D,
  x: number,
  y: number,
  z: number,
  r: number,
  h: number,
  contentColor: string,
  R: () => number,
  fm: FurnitureMaterials,
  flowers = true,
): void {
  const pts: [number, number][] = [
    [0, 0],
    [r * 0.65, 0],
    [r, h * 0.32],
    [r * 0.92, h * 0.62],
    [r * 0.42, h * 0.86],
    [r * 0.5, h],
  ];
  g.add(lathe(pts, fm.ceramic({ roughness: 0.35, side: DoubleSide }), x, y, z, 32));
  if (!flowers) return;
  const cols = FLOWER_COLORS;
  for (let k = 0; k < 5; k++) {
    const a = k * 1.26 + R() * 0.4;
    const s = 0.03 + R() * 0.05;
    const top: [number, number, number] = [x + Math.cos(a) * s, y + h + 0.12 + R() * 0.14, z + Math.sin(a) * s];
    g.add(rod([x, y + h * 0.6, z], top, 0.003, STEM_GREEN, 0.003, 6), blob(0.022, 0.018, 0.022, cols[k % 4], ...top, 12));
  }
}

/** 台灯（原 L2947） */
export function tableLamp(g: Object3D, x: number, y: number, z: number, fm: FurnitureMaterials, s = 1): void {
  g.add(
    lathe(
      [
        [0, 0],
        [0.06 * s, 0],
        [0.075 * s, 0.05 * s],
        [0.08 * s, 0.12 * s],
        [0.055 * s, 0.2 * s],
        [0.018 * s, 0.25 * s],
        [0.012 * s, 0.3 * s],
      ],
      fm.ceramic({ roughness: 0.3 }),
      x,
      y,
      z,
      32,
    ),
  );
  g.add(
    lathe(
      [
        [0.13 * s, 0],
        [0.1 * s, 0.18 * s],
      ],
      fm.glowMat(undefined, undefined, 0.35),
      x,
      y + 0.26 * s,
      z,
      40,
    ),
    blob(0.03 * s, 0.03 * s, 0.03 * s, fm.glowMat(undefined, undefined, 1), x, y + 0.31 * s, z, 12),
  );
}

/** 餐盘（原 L2951） */
export function plate(g: Object3D, r: number, x: number, y: number, z: number, fm: FurnitureMaterials): void {
  g.add(
    lathe(
      [
        [0, 0],
        [r * 0.6, 0],
        [r * 0.72, 0.008],
        [r, 0.02],
      ],
      fm.ceramic({ side: DoubleSide }),
      x,
      y,
      z,
      32,
    ),
  );
}

/** 供颜色派生使用的再导出（家具模型文件常用） */
export { darker };