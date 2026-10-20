/**
 * 家电 / 设备家具模型（OF §3.3 的 `tv|aircon|acwall|dishwasher|ovencol|purifier|officechair|piano|treadmill`）。
 *
 * 逐句对应原 `buildFurniture()` 的 case（`装修设计.html` L3340-3431）。
 */
import { ExtrudeGeometry, Group, Mesh, Shape, TorusGeometry } from 'three';
import {
  INDICATOR_AMBER,
  INDICATOR_GREEN,
  INDICATOR_MINT,
  INDICATOR_SKY,
  PIANO_BRASS,
  PIANO_EBONY,
  PIANO_IVORY,
  SHELL_DEEP,
  SHELL_LIGHT,
  SHELL_MID,
} from './content-colors';
import type { FurnSpec } from './shared';
import { box, cyl, fronts, rbox, rod, shell, tube } from '../primitives';

/** `tv` —— 原 L3340-3344 */
function tv(s: FurnSpec): void {
  const { group: g, w, bz, fm, colors } = s;
  const th = w * 0.5625;
  const yb = 1.2 - th / 2;
  const z = bz + 0.03;
  g.add(
    rbox(w * 0.6, th * 0.6, 0.03, colors.palette.metal.black, 0, yb + th * 0.2, bz + 0.015, 0.01),
    rbox(w, th, 0.025, colors.palette.metal.black, 0, yb, z + 0.01, 0.004),
    box(w - 0.016, th - 0.022, 0.002, fm.screenMat(INDICATOR_SKY), 0, yb + 0.014, z + 0.0235),
    box(0.04, 0.006, 0.002, SHELL_MID, 0, yb + 0.004, z + 0.0235),
  );
}

/** `aircon` —— 原 L3346-3353 */
function aircon(s: FurnSpec): void {
  const { group: g, w, d, c, fm, colors } = s;
  const am = fm.metalLike(c);
  const h = 1.8;
  const fz = d / 2 - 0.005;
  g.add(rbox(w, 0.06, d, SHELL_LIGHT, 0, 0, 0, 0.015), rbox(w - 0.01, h - 0.06, d - 0.01, am, 0, 0.06, 0, 0.06));
  g.add(rbox(w - 0.06, 1.0, 0.01, fm.woodM(SHELL_LIGHT), 0, 0.22, fz, 0.005), box(w - 0.1, 0.42, 0.01, SHELL_DEEP, 0, 1.28, fz));
  for (let i = 0; i < 8; i++) {
    const louver = box(w - 0.11, 0.012, 0.03, colors.palette.surface.ceramic, 0, 1.3 + i * 0.05, fz + 0.008);
    louver.rotation.x = -0.35;
    g.add(louver);
  }
  g.add(box(0.1, 0.035, 0.003, fm.screenMat(INDICATOR_MINT), 0, 1.12, fz + 0.006));
  for (let i = 0; i < 8; i++) g.add(box(w - 0.12, 0.005, 0.004, SHELL_MID, 0, 0.09 + i * 0.015, fz + 0.002));
}

/** `acwall` —— 原 L3355-3363 */
function acwall(s: FurnSpec): void {
  const { group: g, w, d, c, bz, fm } = s;
  const h = 0.3;
  const am = fm.metalLike(c);
  const shape = new Shape();
  shape.moveTo(0, 0.02);
  shape.lineTo(0, h);
  shape.lineTo(d * 0.75, h);
  shape.quadraticCurveTo(d, h, d, h * 0.55);
  shape.quadraticCurveTo(d, 0, d * 0.55, 0);
  shape.lineTo(0.02, 0);
  shape.lineTo(0, 0.02);
  const geo = new ExtrudeGeometry(shape, {
    depth: w - 0.02,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.006,
    bevelSegments: 3,
    curveSegments: 16,
  });
  geo.rotateY(-Math.PI / 2);
  geo.translate((w - 0.02) / 2, 2.2, bz);
  g.add(new Mesh(geo, am as never));
  g.add(box(w - 0.12, 0.004, 0.07, SHELL_DEEP, 0, 2.19, bz + d * 0.55));
  const flap = box(w - 0.12, 0.008, 0.06, am, 0, 2.18, bz + d * 0.72);
  flap.rotation.x = 0.35;
  g.add(flap, box(0.06, 0.018, 0.002, fm.screenMat(INDICATOR_MINT), w * 0.3, 2.2 + h * 0.5, bz + d + 0.007));
  for (let i = 0; i < 6; i++) g.add(box(w - 0.12, 0.003, 0.008, SHELL_LIGHT, 0, 2.2 + h + 0.006, bz + 0.03 + i * 0.022));
}

/** `dishwasher` —— 原 L3365-3371 */
function dishwasher(s: FurnSpec): void {
  const { group: g, w, d, c, fm, colors } = s;
  const dm = fm.metalLike(c);
  const fz = d / 2 - 0.02;
  g.add(
    box(w - 0.01, 0.08, d - 0.07, colors.palette.metal.black, 0, 0, -0.035),
    box(w - 0.005, 0.76, d - 0.03, SHELL_DEEP, 0, 0.08, -0.015),
    rbox(w - 0.006, 0.7, 0.02, dm, 0, 0.085, fz, 0.004),
    box(w - 0.006, 0.055, 0.02, colors.palette.metal.black, 0, 0.785, fz),
  );
  for (let i = 0; i < 4; i++)
    g.add(
      box(
        0.012,
        0.006,
        0.002,
        fm.screenMat(i ? INDICATOR_SKY : INDICATOR_GREEN),
        w * 0.1 + i * 0.03,
        0.81,
        fz + 0.011,
      ),
    );
  // 原 L3370 `pull(g, w*.6, false, 0, .74, fz+.01)`
  g.add(box(w * 0.6, 0.01, 0.01, fm.hwMat(), 0, 0.735, fz + 0.038));
  g.add(box(0.008, 0.008, 0.028, fm.hwMat(), -w * 0.3 + 0.015, 0.735, fz + 0.024), box(0.008, 0.008, 0.028, fm.hwMat(), w * 0.3 - 0.015, 0.735, fz + 0.024));
}

/** `ovencol` —— 原 L3373-3382 */
function ovencol(s: FurnSpec): void {
  const { group: g, w, d, c, fm, colors } = s;
  const cm = fm.woodM(c);
  const h = 2.1;
  const fz = d / 2 - 0.02;
  const frame = colors.palette.metal.black;
  g.add(
    box(w - 0.02, 0.08, d - 0.06, colors.palette.metal.black, 0, 0, -0.03),
    box(w, h - 0.08, d - 0.02, cm, 0, 0.08, -0.01),
  );
  // 原 L3376-3377：`fronts(g, -w/2, .08, w, .6, fz, 1, 2, cm, 'bar')` + 上层单列门
  fronts(g, -w / 2, 0.08, w, 0.6, fz, 1, 2, cm, fm, 'bar');
  fronts(g, -w / 2, 1.78, w, h - 1.8, fz, 1, 1, cm, fm, 'bar', 1.84);
  const levels: [number, number][] = [
    [0.7, 0.58],
    [1.3, 0.46],
  ];
  levels.forEach(([y, ah]) => {
    g.add(
      box(w - 0.02, ah - 0.01, 0.02, frame, 0, y, fz + 0.01),
      box(w - 0.1, ah * 0.52, 0.003, frame, 0, y + ah * 0.1, fz + 0.021),
      box(w - 0.04, 0.06, 0.003, colors.palette.metal.black, 0, y + ah - 0.075, fz + 0.021),
      box(0.08, 0.022, 0.002, fm.screenMat(INDICATOR_AMBER), 0, y + ah - 0.056, fz + 0.023),
    );
    g.add(box(w * 0.7, 0.01, 0.01, fm.hwMat(), 0, y + ah * 0.72 - 0.005, fz + 0.03));
  });
}

/** `purifier` —— 原 L3384-3390 */
function purifier(s: FurnSpec): void {
  const { group: g, w, d, c, fm } = s;
  const pm = fm.metalLike(c);
  const h = 0.72;
  g.add(
    rbox(w, h, d, pm, 0, 0, 0, Math.min(w, d) * 0.2),
    rbox(w - 0.05, 0.006, d - 0.05, fm.metal(), 0, h - 0.002, 0, 0.02),
  );
  for (let i = 0; i < 7; i++) g.add(box(w - 0.07, 0.004, 0.006, SHELL_MID, 0, h + 0.002, -d / 2 + 0.05 + (i * (d - 0.1)) / 6));
  g.add(rbox(w - 0.06, 0.42, 0.006, fm.fabric(SHELL_LIGHT), 0, 0.06, d / 2 - 0.001, 0.01));
  const rg = new Mesh(new TorusGeometry(0.03, 0.004, 8, 32), fm.screenMat(INDICATOR_MINT) as never);
  rg.position.set(0, 0.6, d / 2 + 0.002);
  g.add(rg);
}

/** `officechair` —— 原 L3392-3405 */
function officechair(s: FurnSpec): void {
  const { group: g, w, d, c, bz, fm, colors } = s;
  const r = Math.min(w, d) * 0.46;
  const dk = colors.dark(c, 0.75);
  const bm = fm.blackMetal();
  const cm = fm.chrome();
  for (let k = 0; k < 5; k++) {
    const a = (k * Math.PI * 2) / 5;
    const tx = Math.sin(a) * r * 0.95;
    const tz = Math.cos(a) * r * 0.95;
    const roller = cyl(0.026, 0.026, 0.03, colors.palette.metal.black, tx, 0.011, tz, 16);
    roller.rotation.set(0, a, Math.PI / 2);
    g.add(
      rod([0, 0.1, 0], [tx, 0.07, tz], 0.022, bm, 0.014, 10),
      cyl(0.008, 0.008, 0.03, bm, tx, 0.04, tz, 8),
      roller,
    );
  }
  g.add(
    cyl(0.05, 0.06, 0.05, bm, 0, 0.08, 0, 20),
    cyl(0.025, 0.025, 0.22, cm, 0, 0.12, 0, 16),
    cyl(0.036, 0.036, 0.12, bm, 0, 0.12, 0, 16),
    rbox(0.22, 0.05, 0.22, bm, 0, 0.34, 0.02, 0.01),
    rbox(w * 0.78, 0.03, d * 0.72, bm, 0, 0.38, 0.04, 0.01),
    rbox(w * 0.8, 0.08, d * 0.74, fm.fabric(c), 0, 0.4, 0.05, 0.035),
    tube(
      [
        [0, 0.36, 0],
        [0, 0.38, bz + 0.12],
        [0, 0.6, bz + 0.07],
      ],
      0.02,
      bm,
    ),
  );
  const backFrame = shell(w * 0.72, 0.6, 0.03, 0.025, 0.08, bm);
  backFrame.rotation.x = Math.PI / 2 - 0.12;
  backFrame.position.set(0, 0.88, bz + 0.06);
  const backPad = box(w * 0.68, 0.56, 0.006, fm.fabric(dk), 0, 0.6, bz + 0.085);
  backPad.rotation.x = -0.12;
  const lumbar = rbox(w * 0.5, 0.08, 0.03, fm.fabric(c), 0, 0.66, bz + 0.11, 0.015);
  lumbar.rotation.x = -0.12;
  g.add(backFrame, backPad, lumbar);
  g.add(
    rod([-0.05, 1.14, bz + 0.025], [-0.05, 1.22, bz + 0.015], 0.008, bm),
    rod([0.05, 1.14, bz + 0.025], [0.05, 1.22, bz + 0.015], 0.008, bm),
    rbox(w * 0.45, 0.12, 0.05, fm.fabric(dk), 0, 1.2, bz + 0.02, 0.025),
  );
  [-1, 1].forEach((side) => g.add(box(0.035, 0.22, 0.035, bm, side * w * 0.4, 0.42, 0.04), rbox(0.07, 0.03, d * 0.4, bm, side * w * 0.4, 0.63, 0.04, 0.012)));
}

/** `piano` —— 原 L3407-3421 */
function piano(s: FurnSpec): void {
  const { group: g, w, d, c, bz, fm, colors } = s;
  const pk = fm.woodM(c);
  const bd = d * 0.5;
  const kz = bz + bd;
  const h = 1.25;
  const kd = d * 0.22 - 0.03;
  const ivory = fm.woodM(PIANO_IVORY);
  const ebony = fm.woodM(PIANO_EBONY);
  const kw = (w - 0.12) / 52;
  g.add(box(w, h, bd, pk, 0, 0, bz + bd / 2), rbox(w + 0.02, 0.03, bd + 0.03, pk, 0, h, bz + bd / 2 + 0.01, 0.008));
  [-1, 1].forEach((side) =>
    g.add(
      rbox(0.06, 0.13, kd + 0.06, pk, side * (w / 2 - 0.03), 0.6, kz + (kd + 0.06) / 2, 0.01),
      box(0.05, 0.6, 0.05, pk, side * (w / 2 - 0.08), 0, kz + kd + 0.01),
      box(0.06, 0.04, d - bd, pk, side * (w / 2 - 0.08), 0, kz + (d - bd) / 2),
    ),
  );
  g.add(box(w - 0.12, 0.08, kd + 0.05, pk, 0, 0.6, kz + (kd + 0.05) / 2), box(w - 0.12, 0.1, 0.03, pk, 0, 0.68, kz + 0.015));
  const blackKeys = 'ACDFG';
  for (let i = 0; i < 52; i++) {
    const x = -w / 2 + 0.06 + kw * (i + 0.5);
    g.add(box(kw - 0.0015, 0.022, kd, ivory, x, 0.68, kz + 0.03 + kd / 2));
    if (i < 51 && blackKeys.includes('ABCDEFG'[i % 7])) g.add(box(kw * 0.58, 0.02, kd * 0.62, ebony, x + kw / 2, 0.7, kz + 0.03 + kd * 0.31));
  }
  const lid = box(w * 0.42, 0.18, 0.012, pk, 0, 0.84, kz + 0.012);
  lid.rotation.x = -0.25;
  g.add(lid);
  [-0.06, 0, 0.06].forEach((x) => g.add(box(0.025, 0.012, 0.07, fm.fabric(PIANO_BRASS), x, 0.05, kz + 0.03)));
  const metronome = cyl(0, 0.05, 0.2, fm.woodM(PIANO_EBONY), w * 0.3, h + 0.03, bz + bd / 2, 4);
  metronome.rotation.y = Math.PI / 4;
  g.add(metronome);
  const art = box(0.14, 0.18, 0.015, fm.woodM(colors.palette.wood.oak), -w * 0.3, h + 0.03, bz + 0.06);
  art.rotation.x = -0.15;
  const artInner = box(0.11, 0.14, 0.002, fm.fabric(colors.palette.fabric.sofa), -w * 0.3, h + 0.05, bz + 0.07);
  artInner.rotation.x = -0.15;
  g.add(art, artInner);
}

/** `treadmill` —— 原 L3422-3431 */
function treadmill(s: FurnSpec): void {
  const { group: g, w, d, c, bz, fm, colors } = s;
  const tm = fm.metalLike(c);
  const bm = fm.blackMetal();
  const al = fm.metal();
  g.add(
    rbox(w, 0.14, d - 0.25, tm, 0, 0.03, 0.125, 0.03),
    box(w - 0.16, 0.006, d - 0.5, colors.palette.metal.black, 0, 0.17, 0.15),
  );
  [-1, 1].forEach((side) => g.add(box(0.07, 0.008, d - 0.45, al, side * (w / 2 - 0.05), 0.17, 0.15)));
  [bz + 0.06, d / 2 - 0.06].forEach((z) => [-1, 1].forEach((side) => g.add(box(0.06, 0.03, 0.06, bm, side * (w / 2 - 0.06), 0, z))));
  g.add(rbox(w, 0.22, 0.32, tm, 0, 0, bz + 0.16, 0.05));
  [-1, 1].forEach((side) =>
    g.add(
      rod([side * (w / 2 - 0.06), 0.15, bz + 0.2], [side * (w / 2 - 0.06), 1.15, bz + 0.3], 0.025, bm, 0.022),
      tube(
        [
          [side * (w / 2 - 0.06), 1.0, bz + 0.28],
          [side * (w / 2 - 0.06), 1.0, bz + 0.5],
          [side * (w / 2 - 0.07), 0.97, bz + 0.62],
        ],
        0.018,
        bm,
      ),
    ),
  );
  const console3d = new Group();
  console3d.position.set(0, 1.2, bz + 0.31);
  console3d.rotation.x = -0.5;
  console3d.add(box(w * 0.8, 0.2, 0.08, bm, 0, -0.1, 0), box(w * 0.4, 0.11, 0.004, fm.screenMat(INDICATOR_SKY), 0, -0.055, 0.041));
  g.add(console3d);
}

/** 家电 / 设备分组（OF §5.1 的 9 个类型） */
export const APPLIANCE_BUILDERS: Record<string, (s: FurnSpec) => void> = {
  tv,
  aircon,
  acwall,
  dishwasher,
  ovencol,
  purifier,
  officechair,
  piano,
  treadmill,
};