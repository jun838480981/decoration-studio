/**
 * 第三方包的**本地类型声明**（只补类型，不实现任何逻辑）。
 *
 * 为什么需要：
 * 1. `dxf-writer`（SPEC §H.1 / P0-7，captain 指定）不随包提供 `.d.ts`，SPEC §H.3 也未列
 *    `@types/dxf-writer`；没有声明就会触发 TS7016（`strict` 下为错误）。
 * 2. `three/examples/jsm/math/OBB.js`（SPEC §B.4 红线 6 / ADR-15：优先复用 three 自带的 OBB 相交）
 *    的类型是否随 `@types/three` 落到子路径，取决于 @types 包的目录布局；此处声明一次，
 *    让「复用库」这件事不依赖 @types 的目录细节。
 *
 * ⛔ 声明只描述**本工程实际调用的最小 API 面**（红线 8：不自研 DXF 文本格式、不自研 OBB 相交）。
 * ⛔ 不得把这份声明当成"自己实现 DXF/OBB"的借口：运行时一律是库的实现。
 */

declare module 'dxf-writer' {
  /** 只列出 extras 使用的方法（v1.18 的公开 API） */
  export default class Drawing {
    constructor(units?: string);
    /** 单位名（如 `'Millimeters'`）；缺失时由调用方 try/catch 兜底 */
    setUnits(units: string): Drawing;
    /** ACI 色号（1–255 的 CAD 标准索引，不是主题令牌） */
    addLayer(name: string, colorNumber: number, lineType?: string): Drawing;
    setActiveLayer(name: string): Drawing;
    drawLine(x1: number, y1: number, x2: number, y2: number): Drawing;
    drawPolyline(points: readonly (readonly [number, number])[], closed?: boolean): Drawing;
    toDxfString(): string;
  }
}

declare module 'three/examples/jsm/math/OBB.js' {
  import type { Matrix3, Vector3 } from 'three';

  /**
   * three 自带的有向包围盒（Oriented Bounding Box）。
   * 旋转家具与墙体的相交判定**必须**走这里（SPEC §B.4 红线 6、ADR-15），禁止自研 SAT。
   */
  export class OBB {
    constructor(center?: Vector3, halfSize?: Vector3, rotation?: Matrix3);
    center: Vector3;
    halfSize: Vector3;
    rotation: Matrix3;
    set(center: Vector3, halfSize: Vector3, rotation: Matrix3): this;
    /** SAT 相交（`epsilon` 用于容忍数值误差） */
    intersectsOBB(obb: OBB, epsilon?: number): boolean;
    intersectsBox3(box3: unknown): boolean;
  }
}