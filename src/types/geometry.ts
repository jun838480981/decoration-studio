/**
 * 基础几何类型（SPEC §D.1 🔒 冻结）。
 *
 * ⚠️ 本轮（t3）在此文件只放**类型**：`types/**` 是纯类型目录，零运行时代码（SPEC §C.1）。
 * D.1 里那两个转换函数的**实现**放在 `@/utils/geometry`：
 *   `pt2vec(p: Pt): Vec2` / `vec2pt(v: Vec2): Pt`
 * 下游只 `import type` 本文件，运行时要用转换函数请从 `@/utils/geometry` 引入。
 */

/** 紧凑二元组：用于可序列化数据（墙/房间/多边形），与 localStorage 结构逐字对齐（OF §4.1） */
export type Pt = [x: number, y: number];

/** 具名对象：用于交互数学（测量端点、吸附结果） */
export interface Vec2 {
  x: number;
  y: number;
}

/** 轴对齐矩形：[x0, y0, x1, y1]（mm）。原实现大量使用该裸元组，保留以降低迁移风险 */
export type Rect = [x0: number, y0: number, x1: number, y1: number];

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}
