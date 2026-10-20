/**
 * 餐厅 / 厨房家具模型（OF §3.3 的 `table|roundtable|island|barstool|counter|stove|ksink|fridge`）。
 *
 * 逐句对应原 `buildFurniture()` 的 case（`装修设计.html` L3150-3217、L3313-3330）。
 * `cabinet` 与 `wardrobe`/`shoecab` 共用一段代码，落在 `bedroom.ts`（原 L3011 的三个 case 标签）。
 */
import { Group } from 'three';
import {
  COUNTER_STONE,
  DECOR_BRICK,
  DECOR_CREAM,
  DECOR_OLIVE,
  DECOR_ROSE,
  DECOR_SAFFRON,
  DISH_SOFT,
  GLASSWARE,
  INDICATOR_SKY,
} from './content-colors';
import type { FurnSpec } from './shared';
import { blob, box, cyl, fronts, lathe, plate, pull, rbox, ring, rod, shell, tube, vase } from '../primitives';

/** `table` —— 原 L3150-3161 */
function table(s: FurnSpec): void {
  const { group: g, w, d, c, fm, colors, R } = s;
  const tm = fm.woodM(c);
  const lw = fm.woodM(colors.dark(c, 0.55));
  const ns = Math.max(1, Math.round(w / 0.62));
  const top = 0.75;
  (
    [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const
  ).forEach(([a, b]) =>
    g.add(rod([a * (w / 2 - 0.08), 0, b * (d / 2 - 0.08)], [a * (w / 2 - 0.1), 0.715, b * (d / 2 - 0.1)], 0.016, lw, 0.026)),
  );
  g.add(rbox(w, 0.035, d, tm, 0, 0.715, 0, 0.012), box(w - 0.22, 0.07, d - 0.22, lw, 0, 0.645));
  g.add(box(w * 0.7, 0.003, 0.32, fm.fabric(colors.palette.fabric.rug), 0, top, 0));
  for (let i = 0; i < ns; i++) {
    [-1, 1].forEach((side) => {
      const x = -w / 2 + (w / ns) * (i + 0.5);
      const z = side * (d / 2 - 0.17);
      g.add(box(0.38, 0.003, 0.28, fm.fabric(DISH_SOFT), x, top, z));
      plate(g, 0.12, x, top + 0.003, z, fm);
      g.add(cyl(0.03, 0.026, 0.1, fm.glassLike(GLASSWARE, 0.35), x + 0.15, top + 0.003, z - side * 0.1, 16));
    });
  }
  vase(g, 0, top + 0.003, 0, 0.06, 0.2, DECOR_CREAM, R, fm);
}

/** `roundtable` —— 原 L3163-3168 */
function roundtable(s: FurnSpec): void {
  const { group: g, w, c, fm, colors, R } = s;
  const b = Math.min(0.25, w * 0.3);
  const lw = fm.woodM(colors.palette.wood.walnut);
  const top = 0.75;
  g.add(
    lathe(
      [
        [b, 0],
        [b, 0.015],
        [b * 0.8, 0.035],
        [0.06, 0.12],
        [0.045, 0.35],
        [0.05, 0.6],
        [0.12, 0.69],
        [0.18, 0.715],
      ],
      lw,
      0,
      0,
      0,
      40,
    ),
    cyl(w / 2, w / 2, 0.035, fm.woodM(c), 0, 0.715, 0, 64),
  );
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + 0.4;
    const rr = w / 2 - 0.17;
    plate(g, 0.11, Math.cos(a) * rr, top, Math.sin(a) * rr, fm);
  }
  vase(g, 0, top, 0, 0.05, 0.18, DECOR_CREAM, R, fm);
}

/** `island` —— 原 L3313-3323 */
function island(s: FurnSpec): void {
  const { group: g, w, d, c, bz, fm, colors, R } = s;
  const cm = fm.woodM(c);
  const stone = fm.woodM(COUNTER_STONE);
  const cd = d - 0.3;
  const n = Math.max(1, Math.round((w - 0.1) / 0.6));
  const cab = new Group();
  const fz = cd / 2 - 0.03;
  cab.add(
    box(w - 0.12, 0.1, cd - 0.08, colors.palette.metal.black, 0, 0, -0.04),
    box(w - 0.1, 0.74, cd - 0.03, cm, 0, 0.1, -0.015),
  );
  fronts(cab, -w / 2 + 0.05, 0.64, w - 0.1, 0.2, fz, n, 1, cm, fm, 'bar');
  fronts(cab, -w / 2 + 0.05, 0.1, w - 0.1, 0.54, fz, n, 1, cm, fm, 'bar', 0.56);
  cab.rotation.y = Math.PI;
  cab.position.z = bz + cd / 2; // 柜门朝 -z，+z 侧留出吧台挑空
  g.add(cab);
  g.add(rbox(w, 0.05, d, stone, 0, 0.84, 0, 0.006));
  [-1, 1].forEach((side) => g.add(box(0.04, 0.84, d, stone, side * (w / 2 - 0.02), 0, 0))); // 瀑布式侧板
  g.add(
    lathe(
      [
        [0, 0],
        [0.06, 0],
        [0.14, 0.06],
        [0.15, 0.07],
      ],
      fm.woodM(colors.palette.wood.walnut),
      w * 0.22,
      0.89,
      0,
      32,
    ),
  );
  const fruits = [DECOR_ROSE, DECOR_OLIVE, DECOR_BRICK, DECOR_SAFFRON];
  for (let k = 0; k < 4; k++)
    g.add(
      blob(
        0.04,
        0.04,
        0.04,
        fm.fabric(fruits[k]),
        w * 0.22 + Math.cos(k * 1.6) * 0.05,
        0.935 + (k === 3 ? 0.04 : 0),
        Math.sin(k * 1.6) * 0.05,
        14,
      ),
    );
  vase(g, -w * 0.25, 0.89, -0.05, 0.05, 0.22, DECOR_CREAM, R, fm);
}

/** `barstool` —— 原 L3325-3330 */
function barstool(s: FurnSpec): void {
  const { group: g, w, d, c, fm } = s;
  const r = Math.min(w, d) / 2;
  const bm = fm.blackMetal();
  const sy = 0.7;
  (
    [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const
  ).forEach(([a, b]) => g.add(rod([a * r * 0.72, 0, b * r * 0.72], [a * r * 0.4, sy, b * r * 0.4], 0.011, bm)));
  g.add(
    ring(Math.SQRT2 * r * (0.72 - 0.32 * 0.4), 0.008, bm, 0, 0.28, 0),
    cyl(r * 0.55, r * 0.55, 0.02, bm, 0, sy - 0.01, 0, 32),
    lathe(
      [
        [0, 0],
        [r * 0.85, 0],
        [r * 0.95, 0.02],
        [r * 0.97, 0.045],
        [r * 0.9, 0.07],
        [0, 0.075],
      ],
      fm.woodM(c),
      0,
      sy,
      0,
      40,
    ),
  );
}

/** `counter` —— 原 L3170-3183 */
function counter(s: FurnSpec): void {
  const { group: g, w, d, c, fm, colors } = s;
  const cm = fm.woodM(c);
  const stone = fm.woodM(COUNTER_STONE);
  const n = Math.max(1, Math.round(w / 0.6));
  const fz = d / 2 - 0.04;
  g.add(
    box(w - 0.01, 0.1, d - 0.1, colors.palette.metal.black, 0, 0, -0.05),
    box(w, 0.72, d - 0.04, cm, 0, 0.1, -0.02),
  );
  fronts(g, -w / 2, 0.64, w, 0.18, fz, n, 1, cm, fm, 'bar');
  fronts(g, -w / 2, 0.1, w, 0.54, fz, n, 1, cm, fm, 'bar', 0.56);
  g.add(
    rbox(w + 0.01, 0.04, d, stone, 0, 0.82, 0, 0.004),
    box(w, 0.62, 0.01, fm.ceramic({ roughness: 0.3 }), 0, 0.86, -d / 2 + 0.005),
    box(w, 0.7, 0.33, cm, 0, 1.48, -d / 2 + 0.165),
  );
  fronts(g, -w / 2, 1.48, w, 0.7, -d / 2 + 0.33, n, 1, cm, fm, 'bar', 1.56);
  g.add(box(w - 0.04, 0.01, 0.02, fm.glowMat(undefined, undefined, 0.8), 0, 1.47, -d / 2 + 0.29));
  if (w >= 0.8) {
    g.add(
      rbox(0.36, 0.018, 0.25, fm.woodM(colors.palette.fabric.rug), -w / 2 + 0.3, 0.86, 0, 0.005),
      cyl(0.07, 0.07, 0.16, fm.ceramic({ roughness: 0.4 }), w / 2 - 0.15, 0.86, -d / 2 + 0.1, 24),
      cyl(0.06, 0.06, 0.13, fm.ceramic({ roughness: 0.4 }), w / 2 - 0.3, 0.86, -d / 2 + 0.1, 24),
      cyl(0.05, 0.05, 0.1, fm.ceramic({ roughness: 0.4 }), w / 2 - 0.45, 0.86, -d / 2 + 0.1, 24),
      cyl(0.05, 0.045, 0.14, fm.ceramic({ roughness: 0.3 }), w / 2 - 0.6, 0.86, -d / 2 + 0.1, 20),
    );
    for (let k = 0; k < 4; k++)
      g.add(
        rod(
          [w / 2 - 0.6, 0.9, -d / 2 + 0.1],
          [w / 2 - 0.6 + (k - 1.5) * 0.018, 1.1, -d / 2 + 0.1 + ((k % 2) - 0.5) * 0.02],
          0.005,
          fm.woodM(colors.palette.wood.walnut),
          0.006,
          6,
        ),
      );
  }
}

/** `stove` —— 原 L3185-3195 */
function stove(s: FurnSpec): void {
  const { group: g, w, d, bz, fm, colors } = s;
  const sm = fm.metal();
  const burners: [number, number][] =
    w / d > 1.4
      ? [
          [-w / 4, 0],
          [w / 4, 0],
        ]
      : [
          [-w / 4, -d / 4],
          [w / 4, -d / 4],
          [-w / 4, d / 4],
          [w / 4, d / 4],
        ];
  g.add(rbox(w, 0.012, d, colors.palette.metal.black, 0, 0.862, 0, 0.004));
  burners.forEach(([x, z]) => {
    g.add(
      cyl(0.085, 0.09, 0.008, colors.palette.metal.black, x, 0.874, z, 32),
      cyl(0.045, 0.05, 0.014, colors.palette.metal.hardware, x, 0.874, z, 28),
      cyl(0.028, 0.028, 0.022, colors.palette.metal.black, x, 0.874, z, 20),
    );
    for (let k = 0; k < 5; k++) {
      const a = (k * Math.PI * 2) / 5;
      const grate = box(0.07, 0.014, 0.012, colors.palette.metal.black, x + Math.cos(a) * 0.1, 0.874, z + Math.sin(a) * 0.1);
      grate.rotation.y = -a;
      g.add(grate);
    }
    g.add(cyl(0.02, 0.022, 0.018, colors.palette.metal.black, x, 0.874, d / 2 - 0.04, 20));
  });
  g.add(rbox(w, 0.06, 0.5, sm, 0, 1.55, bz + 0.25, 0.01), box(0.3, 0.72, 0.26, sm, 0, 1.61, bz + 0.13));
  const hood = box(w - 0.02, 0.3, 0.008, colors.palette.metal.black, 0, 1.58, bz + 0.38);
  hood.rotation.x = -0.9;
  g.add(hood, box(0.16, 0.012, 0.003, fm.woodM(INDICATOR_SKY), 0, 1.575, bz + 0.502));
}

/** `ksink` —— 原 L3197-3204 */
function ksink(s: FurnSpec): void {
  const { group: g, w, d, bz, fm, colors } = s;
  const st = fm.metal();
  const inner = colors.palette.metal.hardware;
  const two = w >= 0.75;
  const bw = two ? w * 0.42 : w * 0.7;
  const bd = d * 0.66;
  g.add(box(w, 0.008, d, st, 0, 0.862, 0));
  (two ? [-w * 0.23, w * 0.23] : [0]).forEach((x) =>
    g.add(
      shell(bw, bd, 0.02, 0.015, 0.04, st, x, 0.862, 0.03),
      box(bw - 0.03, 0.002, bd - 0.03, inner, x, 0.87, 0.03),
      cyl(0.03, 0.03, 0.003, fm.chrome(), x, 0.872, 0.03, 20),
    ),
  );
  const fx = two ? 0 : w * 0.3;
  const cm = fm.chrome();
  g.add(
    cyl(0.025, 0.028, 0.03, cm, fx, 0.87, bz + 0.06, 20),
    tube(
      [
        [fx, 0.9, bz + 0.06],
        [fx, 1.12, bz + 0.06],
        [fx, 1.17, bz + 0.1],
        [fx, 1.14, bz + 0.18],
        [fx, 1.08, bz + 0.2],
      ],
      0.012,
      cm,
    ),
  );
  const lever = box(0.012, 0.012, 0.09, cm, fx + 0.035, 0.98, bz + 0.09);
  lever.rotation.x = -0.3;
  g.add(lever);
}

/** `fridge` —— 原 L3206-3217 */
function fridge(s: FurnSpec): void {
  const { group: g, w, d, c, fm, colors } = s;
  const shellMat = fm.metalLike(c);
  const h = 1.8;
  const fz = d / 2 - 0.05;
  g.add(
    box(w - 0.02, 0.06, d - 0.06, colors.palette.metal.black, 0, 0, -0.03),
    rbox(w, h - 0.06, d - 0.05, shellMat, 0, 0.06, -0.025, 0.02),
    box(w - 0.01, h - 0.07, 0.003, colors.palette.metal.black, 0, 0.065, fz + 0.0015),
  );
  if (w > 0.85) {
    [-1, 1].forEach((side) => {
      g.add(rbox(w / 2 - 0.004, h - 0.08, 0.04, shellMat, (side * w) / 4, 0.07, fz + 0.023, 0.012));
      pull(g, 0.8, true, side * 0.035, 1.05, fz + 0.043, fm);
    });
    g.add(box(0.1, 0.14, 0.003, fm.screenMat(INDICATOR_SKY), -w / 4, 1.25, fz + 0.044));
  } else {
    g.add(
      rbox(w - 0.006, 1.06, 0.04, shellMat, 0, 0.72, fz + 0.023, 0.012),
      rbox(w - 0.006, 0.64, 0.04, shellMat, 0, 0.07, fz + 0.023, 0.012),
    );
    pull(g, 0.5, true, -w / 2 + 0.06, 1.05, fz + 0.043, fm);
    pull(g, w * 0.5, false, 0, 0.64, fz + 0.043, fm);
    g.add(box(0.08, 0.1, 0.003, fm.screenMat(INDICATOR_SKY), w * 0.22, 1.4, fz + 0.044));
  }
}

/** 餐厅 / 厨房分组（OF §5.1 的 8 个类型） */
export const KITCHEN_BUILDERS: Record<string, (s: FurnSpec) => void> = {
  table,
  roundtable,
  island,
  barstool,
  counter,
  stove,
  ksink,
  fridge,
};