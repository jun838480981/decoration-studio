/**
 * 卧室 / 书房家具模型（OF §3.3 的 `bed|crib|nightstand|wardrobe|cabinet|shoecab|dresser|desk|chair|bookshelf|baycushion`）。
 *
 * 逐句对应原 `buildFurniture()` 的 case（`装修设计.html` L2957-3109、L3279-3292），
 * 差异只有一处：所有 hex 字面值改为 `spec.colors.palette.*` 或 `content-colors.ts` 的内容色
 * （SPEC §E.8 T2 —— 3D 目录内不得出现 hex）。
 */
import { CircleGeometry, Mesh, TorusGeometry } from 'three';
import { DECOR_CERAMIC, DECOR_CLAY, DECOR_CREAM, BOOK_COLORS } from './content-colors';
import type { FurnSpec } from './shared';
import { blob, box, cyl, fronts, lathe, legs, pull, rbox, rod, tableLamp, vase } from '../primitives';

/** `bed` —— 原 L2957-2971 */
function bed(s: FurnSpec): void {
  const { group: g, w, d, c, bz, fm, colors } = s;
  const fr = fm.woodM(colors.palette.wood.walnut);
  const fab = fm.fabric(c);
  const fh = 0.3;
  const mt = 0.22;
  const top = fh + mt;
  const n = Math.max(3, Math.round(w / 0.28));
  const sw = (w - 0.04) / n;
  g.add(
    box(w - 0.12, 0.06, d - 0.14, colors.palette.metal.black, 0, 0, 0.03), // 内缩踢脚
    rbox(w, fh - 0.06, d - 0.08, fr, 0, 0.06, 0.04, 0.015), // 床箱
  );
  g.add(rbox(w, 1.08, 0.06, fr, 0, 0, bz + 0.03, 0.012)); // 床头板
  for (let i = 0; i < n; i++)
    g.add(
      rbox(sw - 0.006, 0.62, 0.06, fm.fabric(colors.dark(c)), -w / 2 + 0.02 + sw * (i + 0.5), 0.42, bz + 0.08, 0.025),
    );
  const md = d - 0.13;
  const dd = md * 0.66;
  const dz = d / 2 - 0.015 - dd / 2;
  g.add(rbox(w - 0.06, mt, md, fm.ceramic({ roughness: 0.9 }), 0, fh, bz + 0.11 + md / 2, 0.07)); // 床垫
  g.add(
    rbox(w + 0.02, 0.27, dd, fab, 0, top - 0.2, dz, 0.04), // 被子
    rbox(w + 0.024, 0.06, 0.22, fm.fabric(colors.palette.surface.ceramic), 0, top + 0.025, dz - dd / 2 + 0.11, 0.025), // 翻边
  );
  g.add(rbox(w + 0.05, 0.285, 0.42, fm.fabric(colors.dark(c, 0.62)), 0, top - 0.205, d / 2 - 0.35, 0.03)); // 床尾巾
  const np = w >= 1.3 ? 2 : 1;
  const pw = (w - 0.16 - (np - 1) * 0.06) / np;
  for (let i = 0; i < np; i++) {
    const x = -w / 2 + 0.08 + pw / 2 + i * (pw + 0.06);
    const pillowBack = rbox(pw, 0.15, 0.42, fm.fabric(colors.palette.surface.ceramic), x, top - 0.01, bz + 0.34, 0.07);
    pillowBack.rotation.x = -0.28;
    const pillowFront = rbox(pw * 0.62, 0.3, 0.1, fm.fabric(i ? colors.palette.fabric.bed : colors.dark(c, 0.7)), x, top, bz + 0.54, 0.045);
    pillowFront.rotation.x = -0.3;
    g.add(pillowBack, pillowFront);
  }
}

/** `crib` —— 原 L3279-3292 */
function crib(s: FurnSpec): void {
  const { group: g, w, d, c, fm, colors, R } = s;
  const wm = fm.woodM(c);
  g.add(
    rbox(w - 0.09, 0.12, d - 0.09, fm.fabric(colors.palette.surface.ceramic), 0, 0.3, 0, 0.04),
    box(w - 0.06, 0.025, d - 0.06, wm, 0, 0.28),
  );
  (
    [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const
  ).forEach(([a, b]) =>
    g.add(
      rbox(0.045, 0.95, 0.045, wm, a * (w / 2 - 0.022), 0, b * (d / 2 - 0.022), 0.008),
      blob(0.028, 0.028, 0.028, wm, a * (w / 2 - 0.022), 0.97, b * (d / 2 - 0.022), 14),
    ),
  );
  [-1, 1].forEach((side) => {
    const z = side * (d / 2 - 0.022);
    const x = side * (w / 2 - 0.022);
    g.add(
      rbox(w - 0.05, 0.035, 0.03, wm, 0, 0.88, z, 0.008),
      rbox(w - 0.05, 0.035, 0.03, wm, 0, 0.25, z, 0.008),
      rbox(0.03, 0.035, d - 0.05, wm, x, 0.88, 0, 0.008),
      rbox(0.03, 0.035, d - 0.05, wm, x, 0.25, 0, 0.008),
    );
    for (let p = -w / 2 + 0.09; p < w / 2 - 0.05; p += 0.075) g.add(rod([p, 0.28, z], [p, 0.88, z], 0.009, wm, 0.009, 8));
    for (let p = -d / 2 + 0.09; p < d / 2 - 0.05; p += 0.075) g.add(rod([x, 0.28, p], [x, 0.88, p], 0.009, wm, 0.009, 8));
  });
  const bear = fm.woodM(colors.palette.wood.oak);
  g.add(
    rbox(w * 0.5, 0.03, d - 0.14, fm.fabric(colors.light(c, 0.55)), w * 0.12, 0.42, 0, 0.015),
    rbox(0.3, 0.06, 0.2, fm.fabric(colors.palette.surface.ceramic), -w / 2 + 0.22, 0.42, 0, 0.03),
  );
  const bx = -w * 0.3 + 0.1;
  void R;
  g.add(
    blob(0.05, 0.06, 0.045, bear, bx, 0.5, 0.12),
    blob(0.045, 0.042, 0.04, bear, bx, 0.59, 0.12),
    blob(0.016, 0.016, 0.01, bear, bx - 0.032, 0.625, 0.12),
    blob(0.016, 0.016, 0.01, bear, bx + 0.032, 0.625, 0.12),
  );
}

/** `nightstand` —— 原 L3002-3010 */
function nightstand(s: FurnSpec): void {
  const { group: g, w, d, c, fm, colors } = s;
  const wm = fm.woodM(c);
  legs(g, w, d, 0.1, fm.woodM(colors.palette.wood.walnut), 0.04, 0.014);
  g.add(rbox(w, 0.4, d - 0.02, wm, 0, 0.1, -0.01, 0.012));
  fronts(g, -w / 2 + 0.02, 0.12, w - 0.04, 0.36, d / 2 - 0.02, 1, 2, wm, fm, 'bar');
  tableLamp(g, -w * 0.12, 0.5, -d * 0.12, fm);
  g.add(
    box(0.16, 0.025, 0.22, fm.ceramic({ roughness: 0.35 }), w * 0.24, 0.5, 0.04),
    box(0.14, 0.02, 0.2, fm.ceramic({ roughness: 0.8 }), w * 0.24, 0.525, 0.04),
  );
}

/** `wardrobe` | `cabinet` | `shoecab` —— 原 L3011-3037（三个 case 共用一段代码） */
function storageCabinet(s: FurnSpec, type: 'wardrobe' | 'cabinet' | 'shoecab'): void {
  const { group: g, w, d, c, bz, fm, colors, R } = s;
  const cm = fm.woodM(c);
  const fz = d / 2 - 0.02;
  if (type === 'wardrobe') {
    const h = 2.2;
    const n = Math.max(1, Math.round(w / 0.5));
    g.add(
      box(w - 0.02, 0.08, d - 0.06, colors.palette.metal.black, 0, 0, -0.03),
      box(w, h - 0.08, d - 0.02, cm, 0, 0.08, -0.01),
    );
    fronts(g, -w / 2, 0.08, w, h - 0.1, fz, n, 1, cm, fm, 'bar', 1.05);
    g.add(box(w, 0.02, d - 0.02, colors.dark(c, 0.9), 0, h - 0.02, -0.01));
    return;
  }
  if (type === 'shoecab') {
    const h = 1.0;
    const y0 = 0.16;
    const n = Math.max(1, Math.round(w / 0.45));
    // 悬空 + 底部灯带
    g.add(
      box(w, h - y0, d - 0.02, cm, 0, y0, -0.01),
      box(w - 0.04, 0.01, 0.03, fm.glowMat(undefined, undefined, 0.8), 0, y0 - 0.01, fz - 0.06),
    );
    fronts(g, -w / 2, y0, w, h - y0, fz, n, 1, cm, fm, 'edge');
    g.add(
      rbox(w + 0.01, 0.025, d, fm.woodM(colors.dark(c)), 0, h, 0, 0.006),
      rbox(0.22, 0.015, 0.14, fm.woodM(colors.palette.wood.walnut), -w * 0.25, h + 0.025, 0, 0.006),
    );
    vase(g, w * 0.28, h + 0.025, -0.03, 0.05, 0.2, DECOR_CERAMIC, R, fm);
    return;
  }
  const h = 0.85;
  const n = Math.max(1, Math.round(w / 0.5));
  legs(g, w, d, 0.1, fm.woodM(colors.palette.wood.walnut), 0.05, 0.016);
  g.add(box(w, h - 0.13, d - 0.02, cm, 0, 0.1, -0.01));
  fronts(g, -w / 2, 0.62, w, 0.2, fz, n, 1, cm, fm, 'bar');
  fronts(g, -w / 2, 0.1, w, 0.52, fz, n, 1, cm, fm, 'bar', 0.52);
  g.add(rbox(w + 0.02, 0.03, d + 0.01, fm.woodM(colors.dark(c, 0.78)), 0, h - 0.03, 0, 0.008));
  vase(g, w * 0.3, h, 0, 0.07, 0.24, DECOR_CREAM, R, fm);
  const art = box(0.3, 0.38, 0.02, fm.woodM(colors.palette.wood.walnut), -w * 0.25, h, bz + 0.06);
  art.rotation.x = -0.12;
  const artInner = box(0.25, 0.33, 0.005, colors.palette.surface.edge, -w * 0.25, h + 0.03, bz + 0.075);
  artInner.rotation.x = -0.12;
  g.add(
    art,
    artInner, // 靠墙画框
    lathe(
      [
        [0, 0],
        [0.05, 0],
        [0.12, 0.06],
        [0.13, 0.07],
      ],
      fm.woodM(DECOR_CLAY),
      0,
      h,
      0.02,
      32,
    ),
  );
  const fruitColors = [colors.palette.wood.oak, colors.palette.wood.walnut, colors.palette.metal.hardware];
  for (let k = 0; k < 3; k++)
    g.add(blob(0.035, 0.035, 0.035, fm.fabric(fruitColors[k]), Math.cos(k * 2.1) * 0.04, h + 0.045, 0.02 + Math.sin(k * 2.1) * 0.04, 14));
}

/** `dresser` —— 原 L3039-3052 */
function dresser(s: FurnSpec): void {
  const { group: g, w, d, c, bz, fm, colors } = s;
  const wm = fm.woodM(c);
  const r = Math.min(0.34, w * 0.3);
  (
    [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const
  ).forEach(([a, b]) =>
    g.add(rod([a * (w / 2 - 0.04), 0, b * (d / 2 - 0.04)], [a * (w / 2 - 0.05), 0.58, b * (d / 2 - 0.05)], 0.012, wm, 0.02)),
  );
  g.add(box(w - 0.04, 0.14, d - 0.04, wm, 0, 0.58), rbox(w, 0.03, d, wm, 0, 0.72, 0, 0.008));
  fronts(g, -w / 2 + 0.03, 0.585, w - 0.06, 0.13, d / 2 - 0.02, 2, 1, wm, fm, 'knob');
  const frame = new Mesh(new TorusGeometry(r, 0.018, 12, 64), fm.woodM(colors.dark(c, 0.7)) as never);
  frame.position.set(0, 0.77 + r, bz + 0.04);
  const glass = new Mesh(new CircleGeometry(r, 64), fm.mirror() as never);
  glass.position.set(0, 0.77 + r, bz + 0.035);
  g.add(frame, glass, box(0.08, 0.03, 0.06, fm.woodM(colors.dark(c, 0.7)), 0, 0.75, bz + 0.04));
  const bottles: [string, number, number][] = [
    [colors.palette.fabric.bed, 0.03, 0.09],
    [colors.palette.fabric.sofa, 0.025, 0.12],
    [DECOR_CREAM, 0.02, 0.07],
  ];
  bottles.forEach(([cc, rr, hh], i) =>
    g.add(cyl(rr, rr, hh, fm.glassLike(cc), w * 0.25 + i * 0.06, 0.75, 0.02)),
  );
  g.add(rbox(0.16, 0.06, 0.1, fm.woodM(colors.palette.wood.walnut), -w * 0.28, 0.75, 0.03, 0.01));
  const sz = d / 2 + 0.25;
  (
    [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const
  ).forEach(([a, b]) => g.add(rod([a * 0.13, 0, sz + b * 0.13], [a * 0.12, 0.4, sz + b * 0.12], 0.01, wm, 0.014)));
  g.add(rbox(0.34, 0.08, 0.34, fm.fabric(colors.palette.fabric.bed), 0, 0.4, sz, 0.035));
}

/** `desk` —— 原 L3054-3071 */
function desk(s: FurnSpec): void {
  const { group: g, w, d, c, bz, fm, colors } = s;
  const tm = fm.woodM(c);
  const bm = fm.blackMetal();
  g.add(rbox(w, 0.025, d, tm, 0, 0.72, 0, 0.006));
  [-1, 1].forEach((side) => {
    const x = side * (w / 2 - 0.06);
    g.add(
      box(0.03, 0.72, 0.03, bm, x, 0, d / 2 - 0.06),
      box(0.03, 0.72, 0.03, bm, x, 0, bz + 0.06),
      box(0.03, 0.03, d - 0.1, bm, x, 0, 0),
      box(0.03, 0.03, d - 0.1, bm, x, 0.69, 0),
    );
  });
  g.add(box(w - 0.12, 0.04, 0.015, bm, 0, 0.66, bz + 0.06), box(0.4, 0.09, d - 0.12, tm, w / 2 - 0.32, 0.63, 0));
  pull(g, 0.16, false, w / 2 - 0.32, 0.675, d / 2 - 0.06, fm);
  const my = 0.745;
  const mz = bz + 0.15;
  g.add(rbox(0.22, 0.012, 0.16, bm, 0, my, mz, 0.004), rod([0, my, mz - 0.02], [0, my + 0.2, mz - 0.03], 0.012, bm));
  g.add(
    rbox(0.62, 0.37, 0.02, colors.palette.metal.black, 0, my + 0.12, mz - 0.04, 0.006),
    box(0.6, 0.33, 0.002, fm.screenMat(), 0, my + 0.15, mz - 0.029),
  );
  g.add(
    rbox(0.42, 0.015, 0.13, colors.palette.metal.base, 0, my, 0.06, 0.004),
    rbox(0.4, 0.004, 0.11, colors.palette.metal.chrome, 0, my + 0.014, 0.06, 0.002),
    blob(0.03, 0.015, 0.05, colors.palette.metal.base, 0.3, my + 0.012, 0.07, 16),
  );
  const lx = -w / 2 + 0.15;
  const lz = bz + 0.12;
  g.add(
    cyl(0.07, 0.075, 0.02, bm, lx, my, lz, 28),
    fm.tube(
      [
        [lx, my + 0.02, lz],
        [lx, my + 0.3, lz + 0.03],
        [lx + 0.12, my + 0.42, lz + 0.1],
      ],
      0.008,
      bm,
    ),
  );
  const head = cyl(0.02, 0.06, 0.1, bm, lx + 0.14, my + 0.34, lz + 0.12, 24);
  head.rotation.x = 0.5;
  g.add(head);
  g.add(
    cyl(0.04, 0.038, 0.09, fm.ceramic({ roughness: 0.3 }), w / 2 - 0.15, my, 0.05, 20),
    rbox(0.2, 0.015, 0.28, colors.palette.fabric.sofa, -w / 2 + 0.3, my, 0.1, 0.004),
  );
}

/** `chair` —— 原 L3073-3081 */
function chair(s: FurnSpec): void {
  const { group: g, w, d, c, bz, fm, colors } = s;
  const lw = fm.woodM(colors.palette.wood.walnut);
  const fab = fm.fabric(c);
  const sy = 0.44;
  const frontLegs: [number, number][] = [
    [-1, 1],
    [1, 1],
  ];
  frontLegs.forEach(([side]) =>
    g.add(rod([side * (w / 2 - 0.04), 0, d / 2 - 0.05], [side * (w / 2 - 0.05), sy, d / 2 - 0.07], 0.012, lw, 0.018)),
  );
  [-1, 1].forEach((side) => g.add(rod([side * (w / 2 - 0.04), 0, bz + 0.03], [side * (w / 2 - 0.05), 0.86, bz + 0.07], 0.012, lw, 0.018)));
  g.add(box(w - 0.08, 0.025, 0.02, lw, 0, 0.15, d / 2 - 0.06), box(w - 0.08, 0.025, 0.02, lw, 0, 0.15, bz + 0.05));
  [-1, 1].forEach((side) => g.add(box(0.02, 0.025, d - 0.12, lw, side * (w / 2 - 0.045), 0.18, 0)));
  g.add(box(w - 0.06, 0.04, d - 0.1, lw, 0, sy - 0.03, 0), rbox(w - 0.04, 0.05, d - 0.08, fab, 0, sy, 0.005, 0.022));
  const backPanel = rbox(w - 0.08, 0.15, 0.025, lw, 0, 0.66, bz + 0.065, 0.012);
  backPanel.rotation.x = -0.12;
  const backRail = box(w - 0.08, 0.025, 0.02, lw, 0, 0.52, bz + 0.055);
  backRail.rotation.x = -0.12;
  g.add(backPanel, backRail);
}

/** `bookshelf` —— 原 L3083-3104 */
function bookshelf(s: FurnSpec): void {
  const { group: g, w, d, c, bz, fm, colors, R } = s;
  const h = 1.8;
  const t = 0.022;
  const ns = 5;
  const wm = fm.woodM(c);
  const sh0 = (h - 0.06 - t) / ns;
  const cols = BOOK_COLORS;
  g.add(
    box(w, h, 0.012, fm.woodM(colors.dark(c, 0.85)), 0, 0, bz + 0.006),
    box(t, h, d, wm, -w / 2 + t / 2),
    box(t, h, d, wm, w / 2 - t / 2),
    box(w - 2 * t, 0.06, d - 0.03, wm, 0, 0, 0),
  );
  for (let sh = 0; sh <= ns; sh++) {
    const y = sh < ns ? 0.06 + sh * sh0 : h - t;
    g.add(box(w - 2 * t, t, d - 0.012, wm, 0, y, 0.006));
    if (sh === ns) break;
    const yb = y + t;
    const end = w / 2 - t - 0.01;
    let x = -w / 2 + t + 0.01;
    let deco = R() < 0.55 ? x + R() * (w - 0.45) : 99;
    while (x < end - 0.03) {
      if (x >= deco) {
        deco = 99;
        if (R() < 0.5) {
          vase(g, x + 0.07, yb, 0, 0.045, 0.16, cols[Math.floor(R() * 8)], R, fm, false);
        } else {
          for (let k = 0; k < 3; k++) {
            g.add(box(0.2 - k * 0.02, 0.028, d * 0.7, fm.woodM(cols[Math.floor(R() * 8)]), x + 0.1, yb + k * 0.028, 0.01));
          }
        }
        x += 0.2;
        continue;
      }
      if (R() < 0.07) {
        x += 0.03 + R() * 0.05;
        continue;
      }
      const bw = 0.018 + R() * 0.03;
      const bh = Math.min(sh0 - t - 0.03, 0.17 + R() * 0.13);
      const bd = d * (0.62 + R() * 0.22);
      if (x + bw > end) break;
      g.add(box(bw, bh, bd, fm.woodM(cols[Math.floor(R() * 8)]), x + bw / 2, yb, d / 2 - 0.015 - bd / 2));
      x += bw + 0.002;
    }
  }
}

/** `baycushion` —— 原 L3106-3109 */
function baycushion(s: FurnSpec): void {
  const { group: g, w, d, c, bz, fm, colors } = s;
  g.add(rbox(w, 0.08, d, fm.fabric(c), 0, 0.45, 0, 0.03));
  const inPillow = rbox(w - 0.1, 0.34, 0.14, fm.fabric(colors.palette.surface.ceramic), 0, 0.52, bz + 0.14, 0.06);
  inPillow.rotation.z = 0.25;
  const outPillow = rbox(w - 0.1, 0.34, 0.14, fm.fabric(colors.palette.fabric.bed), 0, 0.52, d / 2 - 0.14, 0.06);
  outPillow.rotation.z = -0.25;
  g.add(
    inPillow,
    outPillow,
    rbox(w * 0.8, 0.04, 0.3, fm.fabric(colors.dark(c, 0.7)), 0, 0.53, d * 0.12, 0.02),
    rbox(0.28, 0.015, 0.2, fm.woodM(colors.palette.wood.walnut), 0, 0.53, -d * 0.15, 0.006),
    cyl(0.035, 0.03, 0.06, fm.ceramic(), 0, 0.545, -d * 0.15, 20),
  );
}

/** 卧室 / 书房分组的类型表（OF §5.1 的 11 个类型） */
export const BEDROOM_BUILDERS: Record<string, (s: FurnSpec) => void> = {
  bed,
  crib,
  nightstand,
  wardrobe: (s) => storageCabinet(s, 'wardrobe'),
  shoecab: (s) => storageCabinet(s, 'shoecab'),
  cabinet: (s) => storageCabinet(s, 'cabinet'),
  dresser,
  desk,
  chair,
  bookshelf,
  baycushion,
};