/**
 * 卫浴家具模型（OF §3.3 的 `toilet|vanity|shower|bathtub|washer|dryer|waterheater`）。
 *
 * 逐句对应原 `buildFurniture()` 的 case（`装修设计.html` L3219-3277、L3332-3339）。
 */
import { CircleGeometry, Mesh, SphereGeometry, TorusGeometry } from 'three';
import {
  DECOR_CREAM,
  DISH_DARK,
  DISH_MID,
  DISH_SOFT,
  DRUM_COOL,
  DRUM_WARM,
  INDICATOR_GREEN,
  INDICATOR_MINT,
  PIPE_COLD,
  PIPE_HOT,
  SHELL_LIGHT,
  SHELL_MID,
  TOILET_WARE,
  TUB_WATER,
} from './content-colors';
import type { FurnSpec } from './shared';
import { blob, box, cyl, fronts, lathe, rbox, rod, shell, tube } from '../primitives';

/** `toilet` —— 原 L3219-3226 */
function toilet(s: FurnSpec): void {
  const { group: g, w, d, bz, fm } = s;
  const cer = fm.ceramic();
  const Rb = w * 0.45;
  const zc = bz + d * 0.62;
  const kz = (d * 0.37) / Rb;
  const cm = fm.chrome();
  g.add(
    rbox(w * 0.88, 0.4, d * 0.24, cer, 0, 0.36, bz + d * 0.12, 0.04),
    rbox(w * 0.92, 0.03, d * 0.27, cer, 0, 0.76, bz + d * 0.135, 0.012),
    cyl(0.022, 0.022, 0.006, cm, 0, 0.79, bz + d * 0.135, 20),
  );
  const ped = lathe(
    [
      [0, 0],
      [Rb * 0.62, 0],
      [Rb * 0.66, 0.02],
      [Rb * 0.56, 0.12],
      [Rb * 0.62, 0.22],
      [Rb * 0.92, 0.33],
      [Rb, 0.37],
    ],
    cer,
    0,
    0,
    zc,
    40,
  );
  const seat = cyl(Rb * 1.01, Rb * 1.01, 0.022, fm.woodM(TOILET_WARE), 0, 0.37, zc, 40);
  const lid = cyl(Rb * 0.97, Rb * 0.99, 0.02, fm.woodM(TOILET_WARE), 0, 0.392, zc, 40);
  ped.scale.z = kz;
  seat.scale.z = kz;
  lid.scale.z = kz;
  g.add(ped, seat, lid);
  [-1, 1].forEach((side) => g.add(box(0.03, 0.02, 0.03, cm, side * w * 0.18, 0.39, zc - Rb * kz - 0.005)));
}

/** `vanity` —— 原 L3228-3242 */
function vanity(s: FurnSpec): void {
  const { group: g, w, d, c, bz, fm } = s;
  const vm = fm.woodM(c);
  const stone = fm.ceramic({ roughness: 0.18 });
  const nb = w >= 1.1 ? 2 : 1;
  const cd = d - 0.04;
  const cm = fm.chrome();
  g.add(rbox(w, 0.45, cd, vm, 0, 0.33, bz + cd / 2, 0.008));
  fronts(g, -w / 2 + 0.005, 0.335, w - 0.01, 0.44, d / 2 - 0.04, nb, 2, vm, fm, 'edge');
  g.add(rbox(w, 0.03, d, stone, 0, 0.78, 0, 0.006));
  const rb = Math.min(0.19, (w / nb) * 0.36);
  for (let i = 0; i < nb; i++) {
    const x = nb === 1 ? 0 : i ? w / 4 : -w / 4;
    g.add(
      lathe(
        [
          [0, 0],
          [rb * 0.55, 0],
          [rb * 0.85, 0.03],
          [rb, 0.1],
          [rb * 0.97, 0.12],
        ],
        fm.ceramic({ side: 2 }),
        x,
        0.81,
        0.03,
        40,
      ),
      cyl(0.018, 0.018, 0.003, cm, x, 0.812, 0.03, 16),
      cyl(0.02, 0.022, 0.02, cm, x, 0.81, bz + 0.06, 16),
      tube(
        [
          [x, 0.83, bz + 0.06],
          [x, 1.03, bz + 0.06],
          [x, 1.07, bz + 0.11],
          [x, 1.03, bz + 0.15],
        ],
        0.01,
        cm,
      ),
    );
    const tap = box(0.01, 0.01, 0.06, cm, x, 1.05, bz + 0.04);
    tap.rotation.x = 0.4;
    g.add(tap);
  }
  const mw = Math.min(w * 0.9, nb * 0.7);
  g.add(
    rbox(mw + 0.02, 0.82, 0.02, fm.glowMat(undefined, undefined, 0.9), 0, 1.14, bz + 0.01, 0.01),
    box(mw, 0.8, 0.01, fm.mirror(), 0, 1.15, bz + 0.025),
    cyl(0.028, 0.028, 0.12, fm.ceramic({ roughness: 0.3 }), w / 2 - 0.08, 0.81, bz + 0.1, 16),
    rbox(0.18, 0.03, 0.12, fm.fabric(DECOR_CREAM), -w / 2 + 0.12, 0.81, 0.05, 0.012),
  );
}

/** `shower` —— 原 L3244-3255 */
function shower(s: FurnSpec): void {
  const { group: g, w, d, bz, fm, colors } = s;
  const cm = fm.chrome();
  const frameMat = fm.woodM(colors.palette.surface.frame);
  const x = -w / 4;
  g.add(
    rbox(w, 0.05, d, fm.woodM(TOILET_WARE), 0, 0, 0, 0.01),
    box(w * 0.6, 0.003, 0.05, fm.metal(), 0, 0.05, bz + 0.08),
  );
  const panels: [number, number, number, number][] = [
    [w, 0.01, 0, d / 2 - 0.005],
    [0.01, d, w / 2 - 0.005, 0],
  ];
  panels.forEach(([gw, gd, px, pz]) => {
    const p = box(gw, 1.95, gd, fm.glass(), px, 0.05, pz);
    p.castShadow = false;
    g.add(p);
  });
  g.add(
    box(0.02, 1.95, 0.02, frameMat, w / 2 - 0.01, 0.05, d / 2 - 0.01),
    box(0.02, 1.95, 0.03, frameMat, -w / 2 + 0.01, 0.05, d / 2 - 0.005),
    box(0.03, 1.95, 0.02, frameMat, w / 2 - 0.005, 0.05, bz + 0.01),
    box(w, 0.015, 0.02, frameMat, 0, 1.985, d / 2 - 0.005),
    box(0.02, 0.015, d, frameMat, w / 2 - 0.005, 1.985, 0),
    rbox(0.14, 0.1, 0.04, cm, x, 1.0, bz + 0.02, 0.01),
    rod([x, 1.1, bz + 0.03], [x, 1.95, bz + 0.03], 0.012, cm),
    tube(
      [
        [x, 1.95, bz + 0.03],
        [x, 2.02, bz + 0.06],
        [x, 2.03, bz + 0.22],
      ],
      0.01,
      cm,
    ),
    rbox(0.24, 0.012, 0.24, cm, x, 2.02, bz + 0.25, 0.004),
  );
  const handle = cyl(0.015, 0.02, 0.2, cm, x + 0.1, 1.25, bz + 0.05, 16);
  handle.rotation.x = 0.25;
  g.add(handle, blob(0.03, 0.012, 0.03, cm, x + 0.1, 1.47, bz + 0.08, 16));
  g.add(box(0.26, 0.012, 0.1, fm.ceramic(), w / 2 - 0.2, 1.2, bz + 0.05));
  const bottles: [string, number, number][] = [
    [DISH_SOFT, 0.03, 0.18],
    [DISH_MID, 0.025, 0.15],
    [DISH_DARK, 0.028, 0.12],
  ];
  bottles.forEach(([cc, r, hh], i) => g.add(cyl(r, r, hh, fm.woodM(cc), w / 2 - 0.28 + i * 0.07, 1.212, bz + 0.05, 16)));
}

/** `bathtub` —— 原 L3257-3264 */
function bathtub(s: FurnSpec): void {
  const { group: g, w, d, fm } = s;
  const cer = fm.ceramic();
  const h = 0.56;
  const t = 0.07;
  const cm = fm.chrome();
  g.add(
    shell(w, d, h, t, 0.14, cer),
    box(w - 0.1, 0.12, d - 0.1, cer, 0, 0, 0),
    box(w - 2 * t + 0.004, 0.004, d - 2 * t + 0.004, fm.glassLike(TUB_WATER, 0.6), 0, 0.4, 0),
  );
  const fx = w / 2 - t / 2;
  g.add(
    tube(
      [
        [fx, h - 0.02, 0],
        [fx, h + 0.1, 0],
        [fx - 0.06, h + 0.13, 0],
        [fx - 0.13, h + 0.09, 0],
      ],
      0.014,
      cm,
    ),
  );
  [-1, 1].forEach((side) => g.add(cyl(0.02, 0.02, 0.04, cm, fx, h, side * 0.1, 16)));
  const headrest = rbox(0.08, 0.16, 0.3, cer, -w / 2 + t + 0.06, h - 0.12, 0, 0.04);
  headrest.rotation.z = -0.5;
  g.add(headrest, rbox(0.22, 0.05, 0.16, fm.fabric(DECOR_CREAM), fx - 0.05, h, d / 2 - 0.1, 0.02));
}

/** `washer` | `dryer` —— 原 L3266-3277 */
function washer(s: FurnSpec, dryer: boolean): void {
  const { group: g, w, d, c, fm, colors } = s;
  const shellMat = fm.metalLike(c);
  const R0 = Math.min(w, d) * 0.25;
  const fz = d / 2 - 0.02;
  g.add(
    box(w - 0.02, 0.04, d - 0.04, fm.metal(), 0, 0, -0.02),
    rbox(w, 0.81, d - 0.02, shellMat, 0, 0.04, -0.01, 0.025),
    box(w - 0.04, 0.1, 0.006, fm.woodM(SHELL_LIGHT), 0, 0.72, fz + 0.003),
    rbox(0.18, 0.07, 0.01, shellMat, -w / 2 + 0.12, 0.735, fz + 0.006, 0.004),
    box(0.12, 0.035, 0.003, fm.screenMat(INDICATOR_MINT), w * 0.14, 0.745, fz + 0.007),
  );
  const knobMesh = cyl(0.03, 0.03, 0.02, fm.chrome(), -w * 0.02, 0.75, fz + 0.016, 28);
  knobMesh.rotation.x = Math.PI / 2;
  g.add(knobMesh);
  const door = new Mesh(new CircleGeometry(R0, 40), fm.woodM(colors.palette.metal.black) as never);
  door.position.set(0, 0.4, fz + 0.004);
  const rim = new Mesh(new TorusGeometry(R0 + 0.02, 0.022, 14, 48), fm.chrome() as never);
  rim.position.set(0, 0.4, fz + 0.016);
  g.add(door, rim);
  const Rs = R0 * 1.42;
  const cap = new Mesh(
    new SphereGeometry(Rs, 32, 12, 0, Math.PI * 2, 0, 0.78),
    fm.glassLike(dryer ? DRUM_WARM : DRUM_COOL, 0.8) as never,
  );
  cap.rotation.x = Math.PI / 2;
  cap.position.set(0, 0.4, fz + 0.012 - Rs * Math.cos(0.78));
  g.add(cap, box(w - 0.06, 0.004, 0.003, fm.woodM(SHELL_MID), 0, 0.08, fz + 0.002));
}

/** `waterheater` —— 原 L3332-3339 */
function waterheater(s: FurnSpec): void {
  const { group: g, w, d, c, bz, fm } = s;
  const r = Math.min(d / 2, 0.23);
  const L = w - 0.06;
  const yc = 1.95;
  const zc = bz + r + 0.02;
  const tm = fm.metalLike(c);
  const cp = fm.ceramic({ roughness: 0.4 });
  const cylinder = cyl(r, r, L, tm, 0, 0, zc, 40);
  cylinder.rotation.z = Math.PI / 2;
  cylinder.position.set(0, yc, zc);
  g.add(cylinder);
  [-1, 1].forEach((side) =>
    g.add(
      blob(0.035, r * 0.99, r * 0.99, cp, (side * L) / 2, yc, zc, 32),
      box(0.05, r * 1.1, 0.02, fm.woodM(SHELL_MID), side * L * 0.3, yc - r * 0.55, bz + 0.01),
    ),
  );
  g.add(
    rbox(0.2, 0.09, 0.02, fm.metal(), L * 0.18, yc - 0.05, zc + r * 0.93, 0.008),
    box(0.07, 0.03, 0.002, fm.screenMat(INDICATOR_GREEN), L * 0.18 - 0.04, yc - 0.02, zc + r * 0.93 + 0.011),
  );
  const pipes: [number, string][] = [
    [-L * 0.3, PIPE_HOT],
    [-L * 0.18, PIPE_COLD],
  ];
  pipes.forEach(([x, cc]) =>
    g.add(
      rod([x, yc - r * 0.8, zc], [x, 1.3, zc], 0.012, fm.metal()),
      cyl(0.02, 0.02, 0.03, fm.fabric(cc), x, 1.5, zc, 12),
    ),
  );
}

/** 卫浴分组（OF §5.1 的 7 个类型） */
export const BATH_BUILDERS: Record<string, (s: FurnSpec) => void> = {
  toilet,
  vanity,
  shower,
  bathtub,
  washer: (s) => washer(s, false),
  dryer: (s) => washer(s, true),
  waterheater,
};