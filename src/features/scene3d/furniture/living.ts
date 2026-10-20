/**
 * 客厅 / 休闲家具模型（OF §3.3 的 `sofa|armchair|cornersofa|beanbag|coffeetable|sidetable|tvstand|rug|floorlamp|plant`）。
 *
 * 逐句对应原 `buildFurniture()` 的 case（`装修设计.html` L2973-3000、L3111-3149、L3294-3312）。
 */
import { Group } from 'three';
import { DECOR_CERAMIC, DECOR_CREAM, DECOR_DENIM, LEAF_DARK, LEAF_LIGHT, SOIL_BROWN } from './content-colors';
import type { FurnSpec } from './shared';
import { blob, box, cyl, fronts, lathe, legs, rbox, ring, rod, vase } from '../primitives';

/** `sofa` | `armchair` —— 原 L2973-2984 */
function sofa(s: FurnSpec, armchair: boolean): void {
  const { group: g, w, d, c, bz, fm, colors } = s;
  const fab = fm.fabric(c);
  const dk = fm.fabric(colors.dark(c, 0.88));
  const a = Math.min(0.18, w * 0.14);
  const n = armchair ? 1 : w > 2.2 ? 3 : 2;
  const cw = (w - 2 * a) / n;
  const bd = Math.min(0.2, d * 0.24);
  const lh = 0.12;
  const sd = d - bd - 0.02;
  legs(g, w, d, lh, fm.woodM(colors.palette.wood.walnut), 0.07, 0.018);
  g.add(rbox(w, 0.16, d, dk, 0, lh, 0, 0.03), rbox(w, 0.73, bd, dk, 0, lh, bz + bd / 2, 0.06));
  [-1, 1].forEach((side) => g.add(rbox(a, 0.5, d, dk, side * (w / 2 - a / 2), lh, 0, 0.07)));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + a + cw / 2 + i * cw;
    const seat = rbox(cw - 0.012, 0.15, sd, fab, x, lh + 0.16, bz + bd + sd / 2, 0.055);
    const back = rbox(cw - 0.03, 0.44, 0.16, fab, x, lh + 0.3, bz + bd + 0.08, 0.07);
    back.rotation.x = -0.16;
    g.add(seat, back);
  }
  if (n > 1) {
    [-1, 1].forEach((side) => {
      const cushion = rbox(
        0.42,
        0.42,
        0.12,
        fm.fabric(side < 0 ? colors.palette.fabric.bed : colors.dark(c, 0.7)),
        side * (w / 2 - a - 0.26),
        lh + 0.32,
        bz + bd + 0.22,
        0.06,
      );
      cushion.rotation.set(-0.3, side * -0.25, 0);
      g.add(cushion);
    });
  } else {
    const cushion = rbox(0.4, 0.26, 0.1, fm.fabric(colors.palette.fabric.bed), 0, lh + 0.33, bz + bd + 0.2, 0.05);
    cushion.rotation.x = -0.25;
    g.add(cushion);
  }
}

/** `cornersofa` —— 原 L2986-3000 */
function cornersofa(s: FurnSpec): void {
  const { group: g, w, d, c, bz, fm, colors } = s;
  const k = Math.min(0.95, d * 0.56, w * 0.4);
  const b = 0.2;
  const fab = fm.fabric(c);
  const dk = fm.fabric(colors.dark(c, 0.88));
  const lh = 0.1;
  const sw = (w - b - 0.2) / 2;
  const legMat = fm.woodM(colors.palette.wood.walnut);
  (
    [
      [-w / 2 + 0.07, bz + 0.07],
      [w / 2 - 0.07, bz + 0.07],
      [w / 2 - 0.07, bz + k - 0.07],
      [-w / 2 + 0.07, d / 2 - 0.07],
      [-w / 2 + k - 0.07, d / 2 - 0.07],
      [-w / 2 + k - 0.07, bz + k - 0.07],
    ] as const
  ).forEach(([x, z]) => g.add(rod([x, 0, z], [x, lh, z], 0.012, legMat, 0.018)));
  g.add(
    rbox(w, 0.18, k, dk, 0, lh, bz + k / 2, 0.03),
    rbox(k, 0.18, d - k + 0.02, dk, -w / 2 + k / 2, lh, bz + k + (d - k) / 2 - 0.01, 0.03),
  );
  g.add(
    rbox(w, 0.72, b, dk, 0, lh, bz + b / 2, 0.06),
    rbox(b, 0.72, d, dk, -w / 2 + b / 2, lh, 0, 0.06),
    rbox(0.2, 0.5, k, dk, w / 2 - 0.1, lh, bz + k / 2, 0.07),
    rbox(k, 0.5, 0.2, dk, -w / 2 + k / 2, lh, d / 2 - 0.1, 0.07),
  );
  for (let i = 0; i < 2; i++) {
    const x = -w / 2 + b + sw / 2 + i * sw;
    const seat = rbox(sw - 0.012, 0.15, k - b - 0.02, fab, x, lh + 0.18, bz + b + (k - b) / 2, 0.055);
    const back = rbox(sw - 0.04, 0.42, 0.16, fab, x, lh + 0.3, bz + b + 0.07, 0.07);
    back.rotation.x = -0.16;
    g.add(seat, back);
  }
  g.add(rbox(k - b - 0.02, 0.15, d - k - 0.22, fab, -w / 2 + b + (k - b) / 2, lh + 0.18, bz + k + (d - k - 0.2) / 2, 0.055));
  const L = d - 0.2 - b - 0.18;
  const nl = Math.max(1, Math.round(L / 0.75));
  for (let i = 0; i < nl; i++) {
    const back = rbox(0.16, 0.42, L / nl - 0.03, fab, -w / 2 + b + 0.07, lh + 0.3, bz + b + 0.18 + (L / nl) * (i + 0.5), 0.07);
    back.rotation.z = 0.16;
    g.add(back);
  }
  const cushionA = rbox(0.42, 0.42, 0.12, fm.fabric(colors.palette.fabric.bed), -w / 2 + b + 0.3, lh + 0.34, bz + b + 0.24, 0.06);
  cushionA.rotation.set(-0.35, 0.6, 0);
  const cushionB = rbox(0.4, 0.4, 0.12, fm.fabric(colors.dark(c, 0.7)), w / 2 - 0.5, lh + 0.34, bz + b + 0.2, 0.06);
  cushionB.rotation.set(-0.3, -0.25, 0);
  g.add(cushionA, cushionB);
}

/** `beanbag` —— 原 L3294-3297 */
function beanbag(s: FurnSpec): void {
  const { group: g, w, d, c, bz, fm } = s;
  const fab = fm.fabric(c);
  g.add(blob(w * 0.5, 0.3, d * 0.5, fab, 0, 0.3, 0, 40), blob(w * 0.42, 0.22, d * 0.22, fab, 0, 0.5, bz + d * 0.26, 32));
}

/** `coffeetable` —— 原 L3111-3119 */
function coffeetable(s: FurnSpec): void {
  const { group: g, w, d, c, fm, colors, R } = s;
  const tm = fm.woodM(c);
  const lw = fm.woodM(colors.palette.wood.walnut);
  (
    [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const
  ).forEach(([a, b]) =>
    g.add(rod([a * (w / 2 - 0.05), 0, b * (d / 2 - 0.05)], [a * (w / 2 - 0.07), 0.365, b * (d / 2 - 0.07)], 0.012, lw, 0.02)),
  );
  g.add(
    rbox(w, 0.035, d, tm, 0, 0.365, 0, 0.015),
    rbox(w - 0.12, 0.02, d - 0.12, fm.woodM(colors.dark(c, 0.85)), 0, 0.12, 0, 0.006),
    box(0.3, 0.03, 0.22, fm.ceramic({ roughness: 0.4 }), w * 0.2, 0.14, 0),
    box(0.26, 0.025, 0.19, fm.ceramic({ roughness: 0.6 }), w * 0.2, 0.17, 0.01),
    rbox(0.38, 0.015, 0.24, fm.woodM(colors.palette.wood.walnut), -w * 0.2, 0.4, 0, 0.006),
    box(0.22, 0.025, 0.16, fm.ceramic({ roughness: 0.8 }), -w * 0.22, 0.415, 0),
    lathe(
      [
        [0, 0],
        [0.025, 0],
        [0.035, 0.07],
        [0.034, 0.08],
      ],
      fm.ceramic({ side: 2 }),
      -w * 0.12,
      0.415,
      0.06,
      20,
    ),
  );
  vase(g, w * 0.24, 0.4, -0.05, 0.055, 0.18, DECOR_CREAM, R, fm);
}

/** `sidetable` —— 原 L3299-3304 */
function sidetable(s: FurnSpec): void {
  const { group: g, w, d, c, fm, R } = s;
  const r = Math.min(w, d) / 2;
  const bm = fm.blackMetal();
  g.add(
    lathe(
      [
        [r * 0.55, 0],
        [r * 0.55, 0.012],
        [0.03, 0.035],
        [0.018, 0.3],
        [0.025, 0.5],
        [0.08, 0.52],
      ],
      bm,
      0,
      0,
      0,
      40,
    ),
    cyl(r, r * 0.98, 0.025, fm.woodM(c), 0, 0.52, 0, 48),
    box(0.16, 0.02, 0.12, DECOR_DENIM, -r * 0.25, 0.545, 0),
  );
  vase(g, r * 0.35, 0.545, -r * 0.1, 0.035, 0.12, DECOR_CREAM, R, fm, false);
}

/** `tvstand` —— 原 L3121-3130 */
function tvstand(s: FurnSpec): void {
  const { group: g, w, d, c, bz, fm, colors, R } = s;
  const sm = fm.woodM(c);
  const n = Math.max(2, Math.round(w / 0.6));
  legs(g, w, d, 0.1, fm.blackMetal(), 0.08, 0.012);
  g.add(rbox(w, 0.4, d - 0.02, sm, 0, 0.1, -0.01, 0.01));
  fronts(g, -w / 2 + 0.005, 0.105, w - 0.01, 0.39, d / 2 - 0.02, n, 1, sm, fm, 'edge');
  g.add(
    rbox(1.45, 0.84, 0.025, colors.palette.metal.black, 0, 0.95, bz + 0.03, 0.004),
    box(1.43, 0.81, 0.002, fm.screenMat(), 0, 0.962, bz + 0.0435),
    rbox(0.9, 0.06, 0.09, colors.palette.metal.black, 0, 0.5, -0.02, 0.02),
    box(0.86, 0.045, 0.002, fm.fabric(colors.palette.fabric.sofa), 0, 0.507, 0.026),
  );
  vase(g, w / 2 - 0.25, 0.5, 0, 0.06, 0.26, DECOR_CERAMIC, R, fm);
  g.add(
    box(0.25, 0.035, 0.18, colors.palette.wood.oak, -w / 2 + 0.3, 0.5, 0),
    box(0.22, 0.03, 0.16, fm.ceramic({ roughness: 0.8 }), -w / 2 + 0.3, 0.535, 0),
  );
}

/** `rug` —— 原 L3132-3136 */
function rug(s: FurnSpec): void {
  const { group: g, w, d, c, fm, colors } = s;
  const layers: [number, number, number, string, number][] = [
    [w, d, 0.01, c, 0],
    [w - 0.16, d - 0.16, 0.002, colors.dark(c, 0.82), 0.01],
    [w - 0.26, d - 0.26, 0.002, colors.light(c, 0.12), 0.0115],
  ];
  layers.forEach(([a, b, h, cc, y]) => {
    const r = box(a, h, b, fm.fabric(cc), 0, y + 0.002);
    r.castShadow = false;
    g.add(r);
  });
}

/** `floorlamp` —— 原 L3306-3311 */
function floorlamp(s: FurnSpec): void {
  const { group: g, w, d, c, fm } = s;
  const r = Math.min(w, d) / 2;
  const lm = fm.woodM(c);
  g.add(
    lathe(
      [
        [0, 0],
        [r * 0.55, 0],
        [r * 0.58, 0.012],
        [r * 0.5, 0.03],
        [0.02, 0.035],
      ],
      lm,
      0,
      0,
      0,
      40,
    ),
    rod([0, 0.03, 0], [0, 1.36, 0], 0.011, lm),
  );
  g.add(
    lathe(
      [
        [r * 0.85, 0],
        [r * 0.55, 0.36],
      ],
      fm.glowMat(undefined, undefined, 0.45),
      0,
      1.22,
      0,
      48,
    ),
    blob(0.035, 0.035, 0.035, fm.glowMat(undefined, undefined, 1.2), 0, 1.36, 0, 12),
    ring(r * 0.85, 0.004, lm, 0, 1.22, 0),
    ring(r * 0.55, 0.004, lm, 0, 1.58, 0),
  );
}

/** `plant` —— 原 L3137-3148 */
function plant(s: FurnSpec): void {
  const { group: g, w, d, fm, R } = s;
  const r = Math.min(w, d) / 2;
  const H = 0.9 + r * 1.6;
  const pot = fm.ceramic({ roughness: 0.6 });
  const lm = [fm.fabric(LEAF_DARK), fm.fabric(LEAF_LIGHT)];
  g.add(
    lathe(
      [
        [0, 0],
        [r * 0.4, 0],
        [r * 0.44, 0.02],
        [r * 0.54, 0.36],
        [r * 0.57, 0.4],
        [r * 0.52, 0.4],
        [r * 0.5, 0.37],
        [0, 0.37],
      ],
      pot,
      0,
      0,
      0,
      36,
    ),
    cyl(r * 0.49, r * 0.49, 0.005, fm.fabric(SOIL_BROWN), 0, 0.368, 0, 28),
  );
  g.add(rod([0, 0.37, 0], [0.02, H * 0.62, -0.01], 0.016, fm.woodM(SOIL_BROWN), 0.009));
  const N = 20 + Math.round(r * 36);
  const sc = Math.sqrt(r / 0.25);
  for (let k = 0; k < N; k++) {
    const t = k / N;
    const a = k * 2.399 + R() * 0.3;
    const len = (0.14 + R() * 0.08) * (1.1 - t * 0.4) * sc;
    const s0 = 0.03 + R() * 0.08 * sc;
    const branch = new Group();
    branch.position.set(0, H * (0.42 + 0.58 * t), 0);
    branch.rotation.set(0, -a, 0.1 + t * 0.5 + R() * 0.3, 'YXZ');
    const leaf = blob(len / 2, 0.005, len * 0.27, lm[k % 2], s0 + len / 2, 0, 0, 16);
    leaf.rotation.z = -0.3;
    branch.add(box(s0, 0.005, 0.005, fm.fabric(LEAF_DARK), s0 / 2, 0, 0), leaf);
    g.add(branch);
  }
}

/** 客厅 / 休闲分组（OF §5.1 的 10 个类型） */
export const LIVING_BUILDERS: Record<string, (s: FurnSpec) => void> = {
  sofa: (s) => sofa(s, false),
  armchair: (s) => sofa(s, true),
  cornersofa,
  beanbag,
  coffeetable,
  sidetable,
  tvstand,
  rug,
  floorlamp,
  plant,
};