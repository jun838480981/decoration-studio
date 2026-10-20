/**
 * 尺寸标注链（SPEC §A13 / OF §2.5；原 `renderDims()` L1264-1280 + `autoDims()` L1282-1288）。
 *
 * 数据驱动（OF §9.2 D6）：链来自户型 `dims`；为空时按**墙体包围盒**自动生成「总宽 + 总高」两条链。
 * ⛔ 不得回到 `.bak` 的硬编码 8 条链（RISK-04：那是只对唯一户型有效的缺陷）。
 *
 * 绘制口径（与原实现逐字一致）：
 * - 主链线 + 每个节点 ±170 的界桩线 + 45° 短划（长 80、线宽 2）；
 * - 分段文字居中在分段中点、沿链方向偏移 `at-70`；字号 `值 < 400 ? 140 : 200`；竖排链旋转 -90°；
 * - 颜色取主题令牌 `dim-line` 的**字面值**（B9：⛔ 不写 `var()`）。
 */
import type { DimChain, Wall } from '@/types/plan';
import type { TokenResolver } from '@/types/theme';

/** 尺寸链节点坐标（首节点 + 逐段累加；原 L1268） */
export function chainPoints(chain: DimChain): number[] {
  const pts = [chain.start ?? 0];
  for (const seg of chain.segs) pts.push(pts[pts.length - 1] + seg);
  return pts;
}

/** 户型没有标注数据时，按墙体包围盒生成外轮廓总尺寸（原 L1282-1288） */
export function autoDims(walls: readonly Wall[]): DimChain[] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const w of walls) {
    x0 = Math.min(x0, w[0], w[2]);
    y0 = Math.min(y0, w[1], w[3]);
    x1 = Math.max(x1, w[0], w[2]);
    y1 = Math.max(y1, w[1], w[3]);
  }
  if (!Number.isFinite(x0) || x1 - x0 < 100) return [];
  return [
    { h: true, at: y0 - 700, start: x0, segs: [Math.round(x1 - x0)] },
    { h: false, at: x0 - 700, start: y0, segs: [Math.round(y1 - y0)] },
  ];
}

/** 实际使用的尺寸链：`plan.dims` 非空则用它，否则 `autoDims()`（原 L1277） */
export function effectiveDims(dims: readonly DimChain[] | undefined, walls: readonly Wall[]): DimChain[] {
  return dims && dims.length > 0 ? [...dims] : autoDims(walls);
}

/** 单条尺寸链的 SVG（原 `chain` 内部函数，L1267-1275） */
export function dimChainSvg(chain: DimChain, resolve: TokenResolver): string {
  const color = resolve('dim-line');
  const LS = `stroke="${color}" stroke-width="1" vector-effect="non-scaling-stroke"`;
  const TK = `stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"`;
  const { h: horiz, at, segs } = chain;
  const pts = chainPoints(chain);
  const txt = (tx: number, ty: number, value: number, rot?: boolean): string =>
    `<text x="${tx}" y="${ty}" font-size="${value < 400 ? 140 : 200}" text-anchor="middle" fill="${color}" ${
      rot ? `transform="rotate(-90 ${tx} ${ty})"` : ''
    }>${value}</text>`;

  let s = horiz
    ? `<line x1="${pts[0]}" y1="${at}" x2="${pts[pts.length - 1]}" y2="${at}" ${LS}/>`
    : `<line x1="${at}" y1="${pts[0]}" x2="${at}" y2="${pts[pts.length - 1]}" ${LS}/>`;

  for (const p of pts) {
    s += horiz
      ? `<line x1="${p}" y1="${at - 170}" x2="${p}" y2="${at + 170}" ${LS}/><line x1="${p - 80}" y1="${at + 80}" x2="${p + 80}" y2="${at - 80}" ${TK}/>`
      : `<line x1="${at - 170}" y1="${p}" x2="${at + 170}" y2="${p}" ${LS}/><line x1="${at - 80}" y1="${p + 80}" x2="${at + 80}" y2="${p - 80}" ${TK}/>`;
  }

  segs.forEach((value, i) => {
    const mid = (pts[i] + pts[i + 1]) / 2;
    s += horiz ? txt(mid, at - 70, value) : txt(at - 70, mid, value, true);
  });
  return s;
}

/** 全部尺寸链的 SVG（原 `renderDims` 的 `g.innerHTML = ds.map(chain).join('')`，L1278） */
export function dimsSvg(dims: readonly DimChain[], walls: readonly Wall[], resolve: TokenResolver): string {
  return effectiveDims(dims, walls)
    .map((chain) => dimChainSvg(chain, resolve))
    .join('');
}