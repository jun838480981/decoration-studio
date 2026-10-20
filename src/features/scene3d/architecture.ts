/**
 * 程序化建筑（原 `buildArch()` L3495-3559 + `buildOtherLevels()` L3458-3493 + `wallBox()` L3443-3453）。
 *
 * 覆盖：房间地面 / 飘窗台 / 天花 + 吸顶灯 / 墙体（含矮墙）/ 门洞过梁 / 窗（玻璃 + 竖梃 + 上下横梃）/
 * 门扇（含入户门色、球形把手、开合角度）/ 楼梯 / 推拉门扇 / 复式其它层 / 漫游辅助（棱线 + 踢脚线）。
 *
 * 两处与原实现的**有意差异**（都在 SPEC 契约内）：
 * 1. 拆除判定由「`state.demolished` 存墙体下标」变成 `demolished.includes('w'+i)` 的严格实现，
 *    下标语义保持不变（RISK-05 由 t4 的 `remapDemolished` 兜底），这里只读不写。
 * 2. `clearGroup()` 只 dispose geometry（原 L3442）→ 改为 `clearGroup()` + `disposeObject()` 全量释放
 *    （geometry / material / texture），修复 RISK-02。
 */
import {
  BoxGeometry,
  CylinderGeometry,
  EdgesGeometry,
  ExtrudeGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Shape,
  ShapeGeometry,
  SphereGeometry,
} from 'three';
import type { Bounds, Rect } from '@/types/geometry';
import type { MaterialKey } from '@/types/material';
import type { Door, Lintel, PlanLevel, PlanStructure, Room, Slide, Stair, Wall, Win } from '@/types/plan';
import type { MaterialPalette } from '@/types/theme';
import { clearGroup, type MaterialLibrary } from './materials';
import { CUT_FULL, LAYER_HEIGHT, isHorizontal, m, rectCenter, rectSize, wx, wz, type WorldConfig } from './scene';

/** 门扇运行时对象（原 `doors[]` 的条目，L3543） */
export interface DoorHandle {
  pivot: Group;
  /** 关闭角（= 门扇指向铰链→另一端的向量角） */
  a0: number;
  /** 开启角（= 门扇指向开启方向） */
  a1: number;
  /** 当前角（每帧向目标缓动） */
  cur: number;
  open: boolean;
  /** 门扇长度（m），漫游碰撞用 */
  len: number;
}

export interface ArchitectureGroups {
  /** 地面层（房间地板、门槛板） */
  archFloor: Group;
  /** 上部层（墙、窗、门、天花、楼梯、踢脚线） */
  archUp: Group;
  /** 吸顶灯盘 + 点光源 */
  lampG: Group;
  /** 门扇运行时对象 */
  doors: DoorHandle[];
  /** 漫游碰撞盒：世界坐标 `[x0, z0, x1, z1]`（原 `colliders`） */
  colliders: [number, number, number, number][];
}

export interface ArchitectureDeps {
  ml: MaterialLibrary;
  palette: MaterialPalette;
  world: WorldConfig;
}

export interface ArchitectureInput {
  /** 当前层结构 */
  structure: PlanStructure;
  /** 当前层的地面数据（`states.rooms[id].mat`） */
  roomMats: Record<string, string>;
  /** 已拆除墙体的 id 集合（`'w'+index`） */
  demolished: ReadonlySet<string>;
  /** 剖切高度（m）：2.8 = 全高墙，1.2 = 剖切（SPEC §D.4） */
  cut: number;
  /** 户型全部楼层（复式其它层；单层为 `undefined`） */
  levels?: PlanLevel[] | null;
  /** 当前层序号 */
  level: number;
  /** 户型包围盒（判定楼梯/门朝向等） */
  bounds: Bounds;
  /** 是否漫游（决定 `walkOnly` 元素可见性） */
  walking: boolean;
}

export function createArchitectureGroups(): ArchitectureGroups {
  return { archFloor: new Group(), archUp: new Group(), lampG: new Group(), doors: [], colliders: [] };
}

/**
 * 构建当前层的全部建筑体块（原 `buildArch()`）。
 * 每次调用都是**全量重建**：先释放旧对象（含材质/贴图），再按序构建。
 */
export function buildArchitecture(groups: ArchitectureGroups, input: ArchitectureInput, deps: ArchitectureDeps): void {
  const { ml, palette, world } = deps;
  clearGroup(groups.archFloor);
  clearGroup(groups.archUp);
  clearGroup(groups.lampG);
  groups.doors.length = 0;
  groups.colliders.length = 0;

  const top = input.cut;
  const ctx: BuildCtx = {
    groups,
    input,
    deps,
    ml,
    palette,
    world,
    wallMat: ml.mat(palette.surface.wall, { roughness: 0.92 }, 'surface.wall'),
    capMat: ml.mat(palette.surface.cap, { roughness: 0.9 }, 'surface.cap'),
    frameMat: ml.mat(palette.surface.frame, { roughness: 0.5, metalness: 0.4 }, 'surface.frame'),
    glassMat: ml.glass,
    ceilingMat: ml.mat(palette.surface.ceramic, { roughness: 1 }, 'surface.ceramic'),
    slabMat: ml.mat(palette.surface.skirt, { roughness: 0.95 }, 'surface.skirt'),
    stairMat: ml.mat(palette.surface.cap, { roughness: 0.85 }, 'surface.cap'),
    lampMat: ml.mat(palette.light.glow, { emissive: palette.light.glow, emissiveIntensity: 0.3 }, 'light.glow'),
    thresholdMat: ml.mat(palette.surface.skirt, { roughness: 0.3 }, 'surface.skirt'),
    doorPanelMat: ml.mat(palette.surface.ceramic, { roughness: 0.5 }, 'surface.ceramic'),
    entryPanelMat: ml.mat(palette.wood.walnut, { roughness: 0.5 }, 'wood.walnut'),
    knobMat: ml.mat(palette.metal.base, { metalness: 0.9, roughness: 0.25 }, 'metal.base'),
    skirtMat: ml.mat(palette.surface.skirt, { roughness: 0.6 }, 'surface.skirt'),
    edgeMat: new LineBasicMaterial({ color: palette.surface.edge }),
  };

  // 复式：先画其它层（只保留墙体 / 窗 / 门 / 楼板，避免遮挡视线；原 L3458-3478）
  buildOtherLevels(ctx);

  // 1) 房间地面 + 天花 + 吸顶灯（原 L3500-3515）
  input.structure.rooms.forEach((room) => buildRoomFloor(ctx, room));

  // 2) 门槛板（原 L3516）
  [...input.structure.doors, ...input.structure.slides].forEach((d) => {
    const [x0, y0, x1, y1] = d.rect;
    const s = boxMesh(ctx, m(x1 - x0), 0.012, m(y1 - y0), ctx.thresholdMat, rectCenter(world, d.rect));
    s.castShadow = false;
    groups.archFloor.add(s);
  });

  // 3) 墙体（含碰撞盒；原 L3517-3521）
  input.structure.walls.forEach((w, i) => {
    if (input.demolished.has(`w${i}`)) return;
    wallBox(ctx, w, 0, w[4] === 'low' ? Math.min(1, top) : top);
    groups.colliders.push([wx(world, w[0]), wz(world, w[1]), wx(world, w[2]), wz(world, w[3])]);
  });

  // 4) 门洞 / 推拉门洞 / 自定义过梁上方墙体（原 L3522-3524）
  const lintels: [readonly number[], number][] = [
    ...input.structure.doors.map((d): [readonly number[], number] => [d.rect, 2.1]),
    ...input.structure.slides.map((s): [readonly number[], number] => [s.rect, s.v ? 2.4 : 2.1]),
    ...(input.structure.lintels ?? []).map((l: Lintel): [readonly number[], number] => [l.slice(0, 4), l[4] || 2.4]),
  ];
  lintels.forEach(([rect, h]) => {
    if (top > h) wallBox(ctx, rect, h, top);
  });

  // 5) 窗（上下墙 + 玻璃 + 竖梃 + 上下横梃；原 L3525-3536）
  input.structure.wins.forEach((w) => buildWindow(ctx, w));

  // 6) 门扇（原 L3537-3547）
  input.structure.doors.forEach((d) => buildDoor(ctx, d));

  // 7) 楼梯（原 L3548）
  input.structure.stairs.forEach((st) => stairBox(ctx, st, 0));

  // 8) 推拉门扇（原 L3549-3557）
  input.structure.slides.forEach((s) => buildSlide(ctx, s));
}

/** 内部构建上下文（把常用材质与几何入口集中，减少重复取色） */
interface BuildCtx {
  groups: ArchitectureGroups;
  input: ArchitectureInput;
  deps: ArchitectureDeps;
  /** 材质库（地板贴图 / 玻璃单例等需要按 key 现取） */
  ml: MaterialLibrary;
  palette: MaterialPalette;
  world: WorldConfig;
  wallMat: MeshStandardMaterial;
  capMat: MeshStandardMaterial;
  frameMat: MeshStandardMaterial;
  glassMat: MeshStandardMaterial;
  ceilingMat: MeshStandardMaterial;
  slabMat: MeshStandardMaterial;
  stairMat: MeshStandardMaterial;
  lampMat: MeshStandardMaterial;
  thresholdMat: MeshStandardMaterial;
  doorPanelMat: MeshStandardMaterial;
  entryPanelMat: MeshStandardMaterial;
  knobMat: MeshStandardMaterial;
  skirtMat: MeshStandardMaterial;
  edgeMat: LineBasicMaterial;
}

/** 盒体（y = 中心；建筑构件用中心坐标而非底面，与原实现一致） */
function boxMesh(
  ctx: BuildCtx,
  w: number,
  h: number,
  d: number,
  material: unknown,
  center: { x: number; z: number },
  y = h / 2,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(w, h, d), material as never);
  mesh.position.set(center.x, y, center.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  ctx.groups.archUp.add(mesh);
  return mesh;
}

/** 房间多边形的世界 Shape（`flip` 用于天花：法线朝下；原 L3455） */
function shapeOf(ctx: BuildCtx, poly: Room['poly'], flip = false): Shape {
  const shape = new Shape();
  poly.forEach(([x, y], i) => {
    const px = wx(ctx.world, x);
    const py = flip ? wz(ctx.world, y) : -wz(ctx.world, y);
    if (i) shape.lineTo(px, py);
    else shape.moveTo(px, py);
  });
  return shape;
}

/**
 * 矩形入参（只读前 4 项）：墙 `Wall`（第 5 项是 `WallKind`）、窗 `Win`（后两项可选）
 * 与门洞 `Rect` 都直接传进来，由 `rectOf()` 归一，避免调用点各自 `as never`。
 */
type RectSource = readonly number[] | Wall | Win;

/** 取前 4 项为 `Rect`（`Wall` / `Win` 的尾项在建筑体块里不参与尺寸计算） */
function rectOf(src: RectSource): Rect {
  return [Number(src[0]), Number(src[1]), Number(src[2]), Number(src[3])];
}

/** 墙体（原 `wallBox`，L3443-3453）：顶面用压顶色，底部加踢脚线，附棱线（仅漫游可见） */
function wallBox(ctx: BuildCtx, source: RectSource, yb: number, yt: number, offsetY = 0): void {
  if (yt - yb <= 0.001) return;
  const { world } = ctx;
  const rect = rectOf(source);
  const center = rectCenter(world, rect);
  const size = rectSize(rect);
  const materials = [ctx.wallMat, ctx.wallMat, ctx.capMat, ctx.wallMat, ctx.wallMat, ctx.wallMat];
  const o = new Mesh(new BoxGeometry(size.w, yt - yb, size.d), materials as never);
  o.position.set(center.x, (yb + yt) / 2 + offsetY, center.z);
  o.castShadow = true;
  o.receiveShadow = true;
  ctx.groups.archUp.add(o);

  // 漫游辅助：墙体棱线 + 踢脚线，让相邻墙面、墙角一眼可分（仅漫游模式显示；原 L3447-3451）
  const line = new LineSegments(new EdgesGeometry(o.geometry), ctx.edgeMat);
  line.position.copy(o.position);
  line.userData.walkOnly = true;
  line.visible = ctx.input.walking;
  ctx.groups.archUp.add(line);
  if (yb <= 0.001) {
    const p = (o.geometry as BoxGeometry).parameters;
    const skirtH = Math.min(0.12, yt);
    const skirt = new Mesh(new BoxGeometry(p.width + 0.02, skirtH, p.depth + 0.02), ctx.skirtMat);
    skirt.position.set(o.position.x, skirtH / 2 + offsetY, o.position.z);
    skirt.userData.walkOnly = true;
    skirt.visible = ctx.input.walking;
    ctx.groups.archUp.add(skirt);
  }
}

/** 只画体块、不参与漫游辅助（复式其它层用；原 `wallBoxAt`，L3488-3493） */
function wallBoxAt(ctx: BuildCtx, source: RectSource, yb: number, yt: number): void {
  if (yt - yb <= 0.001) return;
  const rect = rectOf(source);
  const center = rectCenter(ctx.world, rect);
  const size = rectSize(rect);
  const o = new Mesh(
    new BoxGeometry(size.w, yt - yb, size.d),
    [ctx.wallMat, ctx.wallMat, ctx.capMat, ctx.wallMat, ctx.wallMat, ctx.wallMat] as never,
  );
  o.position.set(center.x, (yb + yt) / 2, center.z);
  o.castShadow = true;
  o.receiveShadow = true;
  ctx.groups.archUp.add(o);
}

/** 房间地面（普通房间 `ShapeGeometry`；飘窗 `ExtrudeGeometry` 挤出 0.45m）+ 天花 + 吸顶灯 */
function buildRoomFloor(ctx: BuildCtx, room: Room): void {
  const { ml, world, groups, input } = ctx;  const top = input.cut;
  const matKey = input.roomMats[room.id] ?? room.mat;
  const floorKind: MaterialKey = matKey in FLOOR_KINDS ? (matKey as MaterialKey) : 'tile800';
  const mat = ml.floorMat(floorKind);
  const bay = room.counted === false;
  const geo = bay
    ? new ExtrudeGeometry(shapeOf(ctx, room.poly), { depth: 0.45, bevelEnabled: false })
    : new ShapeGeometry(shapeOf(ctx, room.poly));
  geo.rotateX(-Math.PI / 2);
  const floor = new Mesh(geo, (bay ? [mat, ctx.slabMat] : mat) as never);
  floor.receiveShadow = true;
  floor.userData.room = room.id;
  if (bay) {
    floor.castShadow = true;
    groups.archUp.add(floor);
  } else {
    groups.archFloor.add(floor);
  }

  // 天花：法线朝下，只在室内仰视时可见（原 L3508-3509）
  const ceilGeo = new ShapeGeometry(shapeOf(ctx, room.poly, true));
  ceilGeo.rotateX(Math.PI / 2);
  const ceil = new Mesh(ceilGeo, ctx.ceilingMat);
  ceil.position.y = LAYER_HEIGHT;
  ceil.visible = top >= LAYER_HEIGHT;
  groups.archUp.add(ceil);

  if (room.at) {
    const center = { x: wx(world, room.at[0]), z: wz(world, room.at[1]) };
    const lamp = new Mesh(new CylinderGeometry(0.22, 0.22, 0.02, 32), ctx.lampMat);
    lamp.position.set(center.x, LAYER_HEIGHT - 0.012, center.z);
    lamp.visible = top >= LAYER_HEIGHT;
    groups.lampG.add(lamp);
    const pl = new PointLight(ctx.palette.light.glow, 0, 7, 1.6);
    pl.position.set(center.x, LAYER_HEIGHT - 0.25, center.z);
    groups.lampG.add(pl);
  }
}

/** 贴图类型白名单（`roomMats` 里可能出现过期/未知材质名，兜底到 `tile800`） */
const FLOOR_KINDS = {
  wood: 1,
  walnut: 1,
  tile800: 1,
  tile600: 1,
  marble: 1,
  antislip: 1,
  terrazzo: 1,
  carpet: 1,
} as const;

/** 窗（原 L3525-3536）：上下墙 + 玻璃板 + 竖梃（间距 0.9m）+ 上下横梃 */
function buildWindow(ctx: BuildCtx, w: Win): void {
  const { world, groups } = ctx;
  const top = ctx.input.cut;
  const [x0, y0, x1, y1, sill = 0.9, head = 2.4] = w;
  const rect: [number, number, number, number] = [x0, y0, x1, y1];
  wallBox(ctx, rect, 0, Math.min(sill, top));
  if (top > head) wallBox(ctx, rect, head, top);
  groups.colliders.push([wx(world, x0), wz(world, y0), wx(world, x1), wz(world, y1)]);
  const glassTop = Math.min(head, top);
  if (glassTop <= sill) return;
  const horizontal = isHorizontal(rect);
  const L = m(horizontal ? x1 - x0 : y1 - y0);
  const gh = glassTop - sill;
  const center = rectCenter(world, rect);
  const pane = new Mesh(new BoxGeometry(horizontal ? L : 0.01, gh, horizontal ? 0.01 : L), ctx.glassMat);
  pane.position.set(center.x, sill + gh / 2, center.z);
  groups.archUp.add(pane);
  const n = Math.max(1, Math.round(L / 0.9));
  for (let k = 0; k <= n; k++) {
    const t = -L / 2 + (k * L) / n;
    const mullion = new Mesh(new BoxGeometry(horizontal ? 0.04 : 0.06, gh, horizontal ? 0.06 : 0.04), ctx.frameMat);
    mullion.position.set(center.x + (horizontal ? t : 0), sill + gh / 2, center.z + (horizontal ? 0 : t));
    mullion.castShadow = true;
    groups.archUp.add(mullion);
  }
  [sill + 0.02, glassTop - 0.02].forEach((y) => {
    const rail = new Mesh(new BoxGeometry(horizontal ? L : 0.06, 0.04, horizontal ? 0.06 : L), ctx.frameMat);
    rail.position.set(center.x, y, center.z);
    groups.archUp.add(rail);
  });
}

/** 门扇（原 L3537-3547）：铰点 pivot + ±2π 归一的开合角 + 球形把手 */
function buildDoor(ctx: BuildCtx, d: Door): void {
  const { world, groups } = ctx;
  const pivot = new Group();
  const L = m(d.len);
  const dh = Math.min(2.05, ctx.input.cut);
  pivot.position.set(wx(world, d.h[0]), 0, wz(world, d.h[1]));
  const leaf = new Mesh(
    new BoxGeometry(L, dh, 0.04),
    (d.entry ? ctx.entryPanelMat : ctx.doorPanelMat) as never,
  );
  leaf.position.set(L / 2, dh / 2, 0);
  leaf.castShadow = true;
  leaf.receiveShadow = true;
  const knob = new Mesh(new SphereGeometry(0.03, 12, 8), ctx.knobMat);
  knob.position.set(L - 0.07, Math.min(1, dh - 0.05), 0);
  knob.scale.z = 2.2;
  pivot.add(leaf, knob);

  const angleOf = (v: readonly [number, number]): number => Math.atan2(-v[1], v[0]);
  const handle: DoorHandle = { pivot, a0: angleOf(d.c), a1: angleOf(d.o), cur: 0, open: true, len: L };
  if (handle.a1 - handle.a0 > Math.PI) handle.a1 -= Math.PI * 2;
  if (handle.a0 - handle.a1 > Math.PI) handle.a1 += Math.PI * 2;
  handle.cur = handle.a1;
  pivot.rotation.y = handle.cur;
  leaf.userData.door = handle;
  knob.userData.door = handle;
  groups.doors.push(handle);
  groups.archUp.add(pivot);
}

/** 楼梯（原 `stairBox`，L3479-3487）：踏步数 `max(4, round(|Δy|/260))`、宽 1000mm */
function stairBox(ctx: BuildCtx, st: Stair, base: number): void {
  const n = Math.max(4, Math.round(Math.abs(st.y1 - st.y0) / 260));
  const x0 = st.x;
  const x1 = st.x + 1000;
  const dy = (st.y1 - st.y0) / n;
  const rise = LAYER_HEIGHT / n;
  for (let i = 0; i < n; i++) {
    const y0 = Math.min(st.y0, st.y1) + dy * i;
    const step = new Mesh(
      new BoxGeometry(m(x1 - x0), rise * (i + 1), m(Math.abs(dy))),
      ctx.stairMat as never,
    );
    step.position.set(wx(ctx.world, (x0 + x1) / 2), base + (rise * (i + 1)) / 2, wz(ctx.world, y0 + Math.abs(dy) / 2));
    step.castShadow = true;
    step.receiveShadow = true;
    ctx.groups.archUp.add(step);
  }
}

/** 推拉门扇（原 L3549-3557）：两片玻璃各占 55% + 上下框 + 两侧竖框 */
function buildSlide(ctx: BuildCtx, slide: Slide): void {
  const { world, groups } = ctx;
  const [x0, y0, x1, y1] = slide.rect;
  const v = slide.v;
  const top = ctx.input.cut;
  const L = m(v ? y1 - y0 : x1 - x0);
  const ph = Math.min(v ? 2.4 : 2.1, top);
  const pl = L * 0.55;
  (
    [
      [-1, -0.02],
      [1, 0.02],
    ] as const
  ).forEach(([s, off]) => {
    const c = s < 0 ? -L / 2 + pl / 2 : L / 2 - pl / 2;
    const x = v ? wx(world, (x0 + x1) / 2) + off : wx(world, x0) + L / 2 + c;
    const z = v ? wz(world, y0) + L / 2 + c : wz(world, (y0 + y1) / 2) + off;
    const p = new Mesh(new BoxGeometry(v ? 0.02 : pl, ph, v ? pl : 0.02), ctx.glassMat);
    p.position.set(x, ph / 2, z);
    groups.archUp.add(p);
    [ph - 0.03, 0.03].forEach((y) => {
      const fr = new Mesh(new BoxGeometry(v ? 0.04 : pl, 0.05, v ? pl : 0.04), ctx.frameMat);
      fr.position.set(x, y, z);
      groups.archUp.add(fr);
    });
    [-1, 1].forEach((e) => {
      const fr = new Mesh(new BoxGeometry(0.04, ph, 0.04), ctx.frameMat);
      fr.position.set(v ? x : x + (e * pl) / 2, ph / 2, v ? z + (e * pl) / 2 : z);
      groups.archUp.add(fr);
    });
  });
}

/**
 * 复式其它层（原 `buildOtherLevels`，L3458-3478）：**只**画墙体 / 窗 / 门 / 楼梯，
 * 以及「当前层之下」的楼板（当前层之上的楼板会遮挡视线，不画）。
 */
function buildOtherLevels(ctx: BuildCtx): void {
  const levels = ctx.input.levels ?? [];
  const curLv = ctx.input.level;
  const top = ctx.input.cut;
  levels.forEach((level, li) => {
    if (li === curLv) return;
    const dy = level.elev || li * 2.9;
    const walls = level.walls ?? [];
    const wins = level.wins ?? [];
    const doors = level.doors ?? [];
    const slides = level.slides ?? [];
    const rooms = level.rooms ?? [];
    if (li < curLv) {
      rooms.forEach((room) => {
        const geo = new ShapeGeometry(shapeOf(ctx, room.poly));
        geo.rotateX(-Math.PI / 2);
        const slab = new Mesh(geo, ctx.slabMat);
        slab.position.y = dy - 0.02;
        slab.receiveShadow = true;
        ctx.groups.archUp.add(slab);
      });
    }
    walls.forEach((w, i) => {
      if (ctx.input.demolished.has(`w${i}`)) return;
      wallBoxAt(ctx, w, dy, dy + (w[4] === 'low' ? Math.min(1, top) : top));
    });
    wins.forEach((r) => {
      const sill = r[4] ?? 0.9;
      const head = r[5] ?? 2.4;
      wallBoxAt(ctx, r, dy, dy + Math.min(sill, top));
      if (top > head) wallBoxAt(ctx, r, dy + head, dy + top);
    });
    const openings: [readonly number[], number][] = [
      ...doors.map((d2): [readonly number[], number] => [d2.rect, 2.1]),
      ...slides.map((s2): [readonly number[], number] => [s2.rect, 2.1]),
    ];
    openings.forEach(([r, h]) => {
      if (top > h) wallBoxAt(ctx, r, dy + h, dy + top);
    });
    (level.stairs ?? []).forEach((st) => stairBox(ctx, st, dy));
  });
}

/** 漫游辅助元素的显隐（原 L3806：`archUp.traverse(o => o.userData.walkOnly && (o.visible = m === 'walk'))`） */
export function setWalkAidsVisible(groups: ArchitectureGroups, walking: boolean): void {
  groups.archUp.traverse((o) => {
    if (o.userData.walkOnly) o.visible = walking;
  });
}

export { CUT_FULL };