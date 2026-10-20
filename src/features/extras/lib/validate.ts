/**
 * 平面图自动校验（P0-4）：5 条规则 + 可点击告警。
 *
 * 规则与阈值是**本项目业务资产**（SPEC §B.1 P0-4 / OSS §12 缺口 3：装修规范校验**没有**现成库），
 * 但几何事实判断一律复用库（SPEC §B.4 红线 6 / ADR-15）：
 * - 旋转家具的相交判定 → three 自带 `OBB.intersectsOBB()`（SAT），⛔ 不自研
 * - 多边形面积 / 包围盒 → `lib/metrics.ts`（three `ShapeUtils`）
 * - 通道净宽的**区间并集** → `lib/geom.ts` 的初等函数（库不提供，且不值得为它装包）
 * - 真布尔运算（polygon-clipping）**本版未使用**：5 条规则都可以用 OBB + 投影表达（ADR-15）
 *
 * 5 条规则（`VALIDATION_RULE_IDS`）：
 * 1. `furniture-through-wall` 家具穿墙：家具 OBB 与未拆墙体 OBB 相交且穿入深度 > 容差
 * 2. `furniture-blocking-door` 家具压门洞：家具落在门洞前净空带（`doorClearanceDepth`）内
 * 3. `blocked-passage` 通道净宽不足：门洞前探测带内、家具横向投影并集之后剩余净宽 < 下限
 * 4. `empty-room` 房间无家具：房间多边形内没有任何家具中心点
 * 5. `dimension-anomaly` 尺寸异常：房间过小/短边过短、家具过小、门过窄、窗过窄
 *
 * ⚠️ 阈值是可调的业务参数（`VALIDATION_THRESHOLDS`），改阈值不需要改规则引擎。
 */
import { Matrix3, Vector3 } from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';
import {
  clearanceBand,
  intervalUnionLength,
  normalizeVec,
  pointInPolygon,
  polygonCentroid,
  projectOnAxis,
  rectCenter,
  rectHalfSize,
  rectWidth,
  rotatedCorners,
} from './geom';
import { translate, type Lang } from './i18n';
import { polygonAreaM2, roomBoxSize } from './metrics';
import type { Rect, Vec2 } from '@/types/geometry';
import type { Furniture } from '@/types/furniture';
import type { ValidationIssue } from '@/types/extras';
import type { Door, Room, Wall, WallKind, Win } from '@/types/plan';
import type { RoomOverride } from '@/types/state';

/** 5 条规则的稳定 id（SPEC §B.1 P0-4；顺序 = 报告里的呈现顺序） */
export const VALIDATION_RULE_IDS = [
  'furniture-through-wall',
  'furniture-blocking-door',
  'blocked-passage',
  'empty-room',
  'dimension-anomaly',
] as const;

export type ValidationRuleId = (typeof VALIDATION_RULE_IDS)[number];

/**
 * 阈值表（业务参数，单位 mm / m²）。取值依据写在各行注释里，⛔ 不要"顺手调参"。
 */
export const VALIDATION_THRESHOLDS = {
  /** 校验用墙厚：与 `ui.edit.thick` 默认值一致（SPEC §D.7 = 200mm） */
  wallThickness: 200,
  /** 穿墙容差：家具贴墙（≤30mm 侵入）不算穿墙 */
  wallPenetrationTolerance: 30,
  /** 门洞前净空深度：门开启/通行的最小无遮挡区 */
  doorClearanceDepth: 600,
  /** 通道最小净宽（参考无障碍通行的常用下限；低于此值判 warn） */
  minPassageWidth: 600,
  /** 通道净宽探测带深度：门洞往房间内侧的探测距离 */
  passageProbeDepth: 1200,
  /** 门宽下限：原 `edit.doorW` 默认 900（L862），低于 700 判异常 */
  minDoorWidth: 700,
  /** 窗宽下限：原 `edit.winW` 默认 1500，低于 300 判异常 */
  minWinWidth: 300,
  /** 房间面积下限：原 `closeRoomPoly` 拒绝 <0.5m² 的多边形（L2367） */
  minRoomAreaM2: 0.5,
  /** 房间短边下限（mm）：低于 900 无法作为居住空间 */
  minRoomShortSide: 900,
  /** 家具最小边：原 `autoFurnish` 的 `put()` 丢弃 <200mm 的项（L913） */
  minFurnitureSide: 200,
} as const;

export interface ValidationInput {
  walls: readonly Wall[];
  doors: readonly Door[];
  rooms: readonly Room[];
  furniture: readonly Furniture[];
  wins?: readonly Win[];
  /** 已拆墙体 id（占位/坏数据自动忽略） */
  demolished?: readonly string[];
  /** 用户改过的房间名（`layout.rooms`），只影响告警文案 */
  roomOverrides?: Readonly<Record<string, RoomOverride>>;
  lang?: Lang;
}

export interface ValidationSummary {
  total: number;
  error: number;
  warn: number;
  info: number;
}

const WALL_KIND_LABEL: Record<WallKind, string> = {
  b: 'validation.msg.wall-bearing',
  e: 'validation.msg.wall-exterior',
  n: 'validation.msg.wall-partition',
  low: 'validation.msg.wall-low',
};

const SEVERITY_RANK: Record<ValidationIssue['severity'], number> = { error: 0, warn: 1, info: 2 };

/** 旋转矩形 → three `OBB`（旋转约定与 2D 的 `rotate(rot)` 一致） */
function obbOf(center: Vec2, half: Vec2, rotDeg: number): OBB {
  const rad = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rotation = new Matrix3().set(cos, -sin, 0, sin, cos, 0, 0, 0, 1);
  return new OBB(new Vector3(center.x, center.y, 0), new Vector3(half.x, half.y, 1), rotation);
}

/** 家具 OBB（`shrink` 用来给"贴墙齐平"留容差） */
function furnitureObb(f: Furniture, shrink: number): OBB {
  return obbOf(
    { x: f.cx, y: f.cy },
    { x: Math.max(1, f.w / 2 - shrink), y: Math.max(1, f.d / 2 - shrink) },
    f.rot,
  );
}

/** 轴对齐矩形 → OBB */
function rectObb(rect: Rect, shrink = 0): OBB {
  const center = rectCenter(rect);
  const half = rectHalfSize(rect);
  return obbOf(center, { x: Math.max(1, half.x - shrink), y: Math.max(1, half.y - shrink) }, 0);
}

/** 线段 → 沿线段方向的 OBB（墙体占用区；⛔ 不用"外扩矩形"近似，端头会假阳性） */
function segmentObb(a: Vec2, b: Vec2, thick: number): OBB {
  const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const half = { x: Math.hypot(b.x - a.x, b.y - a.y) / 2, y: thick / 2 };
  return obbOf(center, half, angle);
}

/** 家具在任意单位轴上的支撑半径（旋转矩形的精确投影半宽） */
function supportAlongAxis(f: Furniture, axis: Vec2): number {
  const rad = (f.rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const ex = { x: cos, y: sin };
  const ey = { x: -sin, y: cos };
  return Math.abs((f.w / 2) * (axis.x * ex.x + axis.y * ex.y)) + Math.abs((f.d / 2) * (axis.x * ey.x + axis.y * ey.y));
}

/** 墙体法线（用于报告穿入深度，纯展示用） */
function normalOf(a: Vec2, b: Vec2): Vec2 {
  const dir = normalizeVec({ x: b.x - a.x, y: b.y - a.y });
  return { x: -dir.y, y: dir.x };
}

function roundMm(value: number): number {
  return Math.round(value);
}

/**
 * 运行全部 5 条规则。
 * @returns 按「严重度 → 规则顺序」排好序的告警列表（可直接渲染为可点击列表）
 */
export function validatePlan(input: ValidationInput): ValidationIssue[] {
  const lang: Lang = input.lang ?? 'zh';
  const t = (key: string, params?: Record<string, string | number>): string => translate(lang, key, params);
  const threshold = VALIDATION_THRESHOLDS;
  const issues: ValidationIssue[] = [];
  const demolished = new Set(input.demolished ?? []);
  /** 用户改过的房间名优先（OF §1.10：改过的名字原样显示） */
  const nameOfRoom = (room: Room): string => input.roomOverrides?.[room.id]?.name ?? room.name;

  // ---------------------------------------------------------------- 规则 1：家具穿墙
  input.walls.forEach((wall, index) => {
    const id = String(index);
    if (demolished.has(id) || demolished.has(`w${id}`)) return;
    const [x0, y0, x1, y1, kind] = wall;
    const wallObb = segmentObb({ x: x0, y: y0 }, { x: x1, y: y1 }, threshold.wallThickness);
    const normal = normalOf({ x: x0, y: y0 }, { x: x1, y: y1 });
    const wallCenter = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    for (const f of input.furniture) {
      const shrink = threshold.wallPenetrationTolerance;
      if (!furnitureObb(f, shrink).intersectsOBB(wallObb)) continue;
      const offset = Math.abs((f.cx - wallCenter.x) * normal.x + (f.cy - wallCenter.y) * normal.y);
      const depth = threshold.wallThickness / 2 + supportAlongAxis(f, normal) - offset;
      if (depth <= threshold.wallPenetrationTolerance) continue;
      issues.push({
        id: `furniture-through-wall#${f.id}#${id}`,
        rule: 'furniture-through-wall',
        severity: 'error',
        targets: [f.id, id],
        message: t('validation.msg.through-wall', {
          furniture: f.name,
          wall: t(WALL_KIND_LABEL[kind]),
          depth: roundMm(depth),
          tolerance: threshold.wallPenetrationTolerance,
        }),
        focus: { x: f.cx, y: f.cy },
      });
    }
  });

  // ---------------------------------------------------------------- 规则 2：家具压门洞
  for (const door of input.doors) {
    const doorCenter = rectCenter(door.rect);
    const band = clearanceBand(door.rect, { x: door.o[0], y: door.o[1] }, threshold.doorClearanceDepth);
    const bandObb = rectObb(band);
    for (const f of input.furniture) {
      if (!furnitureObb(f, 0).intersectsOBB(bandObb)) continue;
      issues.push({
        id: `furniture-blocking-door#${f.id}#${door.name}`,
        rule: 'furniture-blocking-door',
        severity: 'warn',
        targets: [f.id, door.name],
        message: t('validation.msg.blocking-door', {
          furniture: f.name,
          door: door.name,
          clearance: threshold.doorClearanceDepth,
        }),
        focus: { x: f.cx, y: f.cy },
      });
    }
  }

  // ---------------------------------------------------------------- 规则 3：通道净宽
  for (const room of input.rooms) {
    const inward: Vec2 = room.at ? { x: room.at[0], y: room.at[1] } : polygonCentroid(room.poly);
    const roomDoors = input.doors.filter((door) => pointInPolygon(rectCenter(door.rect), room.poly));
    for (const door of roomDoors) {
      const doorCenter = rectCenter(door.rect);
      const dir = normalizeVec({ x: inward.x - doorCenter.x, y: inward.y - doorCenter.y });
      if (dir.x === 0 && dir.y === 0) continue;
      const transverse: Vec2 = { x: -dir.y, y: dir.x };
      const halfWidth = Math.max(1, rectWidth(door.rect) / 2);
      const angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
      const bandCenter: Vec2 = {
        x: doorCenter.x + dir.x * (threshold.passageProbeDepth / 2),
        y: doorCenter.y + dir.y * (threshold.passageProbeDepth / 2),
      };
      const band = obbOf(bandCenter, { x: threshold.passageProbeDepth / 2, y: halfWidth }, angle);
      const intervals: [number, number][] = [];
      const blockers: { id: string; name: string }[] = [];
      for (const f of input.furniture) {
        if (!furnitureObb(f, 0).intersectsOBB(band)) continue;
        const projections = rotatedCorners(f.cx, f.cy, f.w, f.d, f.rot).map((p) =>
          projectOnAxis(p, doorCenter, transverse),
        );
        const min = Math.max(-halfWidth, Math.min(...projections));
        const max = Math.min(halfWidth, Math.max(...projections));
        if (max <= min) continue;
        intervals.push([min, max]);
        blockers.push({ id: f.id, name: f.name });
      }
      if (intervals.length === 0) continue;
      const free = Math.max(0, halfWidth * 2 - intervalUnionLength(intervals));
      if (free >= threshold.minPassageWidth) continue;
      issues.push({
        id: `blocked-passage#${room.id}#${door.name}`,
        rule: 'blocked-passage',
        severity: 'warn',
        targets: [room.id, ...blockers.map((item) => item.id)],
        message: t('validation.msg.passage', {
          room: nameOfRoom(room),
          free: roundMm(free),
          min: threshold.minPassageWidth,
          blockers: blockers.map((item) => item.name).join('、'),
        }),
        focus: { x: doorCenter.x, y: doorCenter.y },
      });
    }
  }

  // ---------------------------------------------------------------- 规则 4：房间无家具
  for (const room of input.rooms) {
    const hasFurniture = input.furniture.some((f) => pointInPolygon({ x: f.cx, y: f.cy }, room.poly));
    if (hasFurniture) continue;
    const focus = room.at ? { x: room.at[0], y: room.at[1] } : polygonCentroid(room.poly);
    issues.push({
      id: `empty-room#${room.id}`,
      rule: 'empty-room',
      severity: 'info',
      targets: [room.id],
      message: t('validation.msg.empty-room', { room: nameOfRoom(room) }),
      focus,
    });
  }

  // ---------------------------------------------------------------- 规则 5：尺寸异常
  for (const room of input.rooms) {
    const area = polygonAreaM2(room.poly);
    if (area < threshold.minRoomAreaM2) {
      issues.push({
        id: `dimension-anomaly#room-area#${room.id}`,
        rule: 'dimension-anomaly',
        severity: 'error',
        targets: [room.id],
        message: t('validation.msg.room-too-small', {
          room: nameOfRoom(room),
          area: area.toFixed(2),
          min: threshold.minRoomAreaM2,
        }),
        focus: room.at ? { x: room.at[0], y: room.at[1] } : polygonCentroid(room.poly),
      });
      continue;
    }
    const box = roomBoxSize(room.poly);
    const shortSide = Math.min(box.w, box.h);
    if (shortSide < threshold.minRoomShortSide) {
      issues.push({
        id: `dimension-anomaly#room-side#${room.id}`,
        rule: 'dimension-anomaly',
        severity: 'warn',
        targets: [room.id],
        message: t('validation.msg.room-short-side', {
          room: nameOfRoom(room),
          side: roundMm(shortSide),
          min: threshold.minRoomShortSide,
        }),
        focus: room.at ? { x: room.at[0], y: room.at[1] } : polygonCentroid(room.poly),
      });
    }
  }

  for (const f of input.furniture) {
    const minSide = Math.min(f.w, f.d);
    if (minSide >= threshold.minFurnitureSide && f.w > 0 && f.d > 0) continue;
    issues.push({
      id: `dimension-anomaly#furniture#${f.id}`,
      rule: 'dimension-anomaly',
      severity: 'warn',
      targets: [f.id],
      message: t('validation.msg.furniture-too-small', {
        furniture: f.name,
        w: roundMm(f.w),
        d: roundMm(f.d),
        min: threshold.minFurnitureSide,
      }),
      focus: { x: f.cx, y: f.cy },
    });
  }

  input.doors.forEach((door, index) => {
    if (door.len >= threshold.minDoorWidth) return;
    issues.push({
      id: `dimension-anomaly#door#${index}`,
      rule: 'dimension-anomaly',
      severity: 'warn',
      targets: [door.name],
      message: t('validation.msg.door-too-narrow', {
        door: door.name,
        width: roundMm(door.len),
        min: threshold.minDoorWidth,
      }),
      focus: { x: door.c[0], y: door.c[1] },
    });
  });

  (input.wins ?? []).forEach((win, index) => {
    const width = Math.hypot(win[2] - win[0], win[3] - win[1]);
    if (width >= threshold.minWinWidth) return;
    issues.push({
      id: `dimension-anomaly#win#${index}`,
      rule: 'dimension-anomaly',
      severity: 'warn',
      targets: [String(index)],
      message: t('validation.msg.window-too-narrow', {
        index: index + 1,
        width: roundMm(width),
        min: threshold.minWinWidth,
      }),
      focus: { x: (win[0] + win[2]) / 2, y: (win[1] + win[3]) / 2 },
    });
  });

  return sortIssues(issues);
}

/** 严重度 → 规则顺序稳定排序（UI 与导出共用） */
export function sortIssues(issues: readonly ValidationIssue[]): ValidationIssue[] {
  return [...issues].sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySeverity !== 0) return bySeverity;
    const byRule = VALIDATION_RULE_IDS.indexOf(a.rule) - VALIDATION_RULE_IDS.indexOf(b.rule);
    if (byRule !== 0) return byRule;
    return a.id.localeCompare(b.id);
  });
}

export function summarizeIssues(issues: readonly ValidationIssue[]): ValidationSummary {
  const summary: ValidationSummary = { total: issues.length, error: 0, warn: 0, info: 0 };
  for (const issue of issues) summary[issue.severity] += 1;
  return summary;
}

/** 告警文案（UI 表格 / CSV / XLSX 共用） */
export function issueRuleLabel(issue: ValidationIssue, lang: Lang): string {
  return translate(lang, `validation.rule.${issue.rule}`);
}

export function issueSeverityLabel(issue: ValidationIssue, lang: Lang): string {
  return translate(lang, `validation.severity.${issue.severity}`);
}