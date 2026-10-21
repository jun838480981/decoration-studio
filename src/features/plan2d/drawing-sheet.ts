/**
 * 施工图图框（sheet frame）生成：外框 / 内框 / 标题栏 / 指北针 / 比例尺。
 *
 * ## 为什么需要
 *
 * 迁移自上游时，导出的是「裸平面图」——没有图框、没有标题栏、没有指北针。
 * 那种图能看，但**不能交付**：施工方拿到图不知道项目名、比例、日期，也不知道哪边是北。
 * 真实交付的施工图必须带这些要素，这也是本项目相对上游的核心增量之一。
 *
 * ## 设计要点
 *
 * - **纯函数**：输入纸张规格 + 平面图包围盒 + 文案，输出 SVG 字符串。
 *   不依赖 DOM、不依赖 three、可单测。
 * - **颜色只用主题令牌**：通过 `TokenResolver` 取字面值（`theme.resolve()`），
 *   ⛔ 不出现十六进制字面值（`verify.mjs` 的 hex 闸门会拦）。
 * - **坐标系统一**：图框按「图纸单位」生成，平面图内容用 `viewBox` 平移缩放嵌进去。
 *   这样无论户型多大，图框尺寸都稳定。
 * - **不进入 2D 编辑画布**：只在导出时套用，避免图框遮挡编辑。
 *
 * ## 纸张规格
 *
 * 采用常见制图比例（mm）：A4 横 / A3 横 / A2 横。内框留装订边（左侧更宽）。
 */

import type { Bounds } from '@/types/geometry';
import type { TokenResolver } from '@/types/theme';

/** 纸张规格（单位 mm，横向） */
export type PaperSize = 'a4' | 'a3' | 'a2';

export interface PaperSpec {
  /** 纸宽（mm） */
  width: number;
  /** 纸高（mm） */
  height: number;
  /** 图框外边距（mm） */
  margin: number;
  /** 装订边额外留白（mm，加在左边） */
  binding: number;
}

/** 三种常用纸张（横向） */
export const PAPER_SPECS: Record<PaperSize, PaperSpec> = {
  a4: { width: 297, height: 210, margin: 10, binding: 10 },
  a3: { width: 420, height: 297, margin: 12, binding: 12 },
  a2: { width: 594, height: 420, margin: 14, binding: 14 },
};

/** 标题栏尺寸（mm）：固定在右下角 */
export const TITLE_BLOCK = {
  width: 150,
  height: 40,
} as const;

/** 指北针半径（mm） */
export const NORTH_ARROW_RADIUS = 9;

/** 图框文案（全部由调用方注入，便于 i18n） */
export interface SheetLabels {
  /** 项目名（标题栏主行） */
  project: string;
  /** 户型名（标题栏副行） */
  plan: string;
  /** 比例文字，如 `1:100` */
  scale: string;
  /** 日期文字，如 `2026-10-21` */
  date: string;
  /** 套内面积，如 `87.18 m²` */
  area: string;
  /** 设计者 */
  designer: string;
  /** 字段标签（供双语） */
  fields: {
    project: string;
    plan: string;
    scale: string;
    date: string;
    area: string;
    designer: string;
    north: string;
  };
}

export interface SheetOptions {
  /** 纸张规格 */
  paper: PaperSize;
  /** 平面图包围盒（户型坐标，mm） */
  bounds: Bounds;
  /** 主题取色器（`theme.resolve`） */
  resolve: TokenResolver;
  /** 标题栏与图框文案 */
  labels: SheetLabels;
  /** 内容区留白（mm，图框内再留一圈给平面图） */
  contentPadding?: number;
}

/** 图框几何（供测试断言与调用方复用） */
export interface SheetGeometry {
  paper: PaperSpec;
  /** 外框 */
  outer: { x: number; y: number; width: number; height: number };
  /** 内框（含装订边） */
  inner: { x: number; y: number; width: number; height: number };
  /** 标题栏（右下角） */
  titleBlock: { x: number; y: number; width: number; height: number };
  /** 平面图内容区（已扣除标题栏与留白） */
  content: { x: number; y: number; width: number; height: number };
  /** 平面图 viewBox 与内容的缩放/平移 */
  planTransform: { translateX: number; translateY: number; scale: number };
}

/**
 * 计算图框各区域几何。
 *
 * 纯函数、无副作用，单独导出便于单测（不必解析 SVG 字符串）。
 */
export function computeSheetGeometry(options: SheetOptions): SheetGeometry {
  const spec = PAPER_SPECS[options.paper];
  const { margin, binding, width: pw, height: ph } = spec;

  // 外框：整张纸留 margin
  const outer = { x: margin, y: margin, width: pw - margin * 2, height: ph - margin * 2 };

  // 内框：左边额外留装订边
  const inner = {
    x: outer.x + binding,
    y: outer.y,
    width: outer.width - binding,
    height: outer.height,
  };

  // 标题栏：贴内框右下角
  const titleBlock = {
    x: inner.x + inner.width - TITLE_BLOCK.width,
    y: inner.y + inner.height - TITLE_BLOCK.height,
    width: TITLE_BLOCK.width,
    height: TITLE_BLOCK.height,
  };

  // 内容区：内框减去标题栏高度与一圈留白
  const pad = options.contentPadding ?? 8;
  const content = {
    x: inner.x + pad,
    y: inner.y + pad,
    width: inner.width - pad * 2,
    height: inner.height - TITLE_BLOCK.height - pad * 2,
  };

  // 平面图按「等比缩放、居中」放进内容区
  const b = options.bounds;
  const scale = Math.min(content.width / b.w, content.height / b.h);
  const drawnW = b.w * scale;
  const drawnH = b.h * scale;
  const translateX = content.x + (content.width - drawnW) / 2;
  const translateY = content.y + (content.height - drawnH) / 2;

  return { paper: spec, outer, inner, titleBlock, content, planTransform: { translateX, translateY, scale } };
}

/** 转义 XML 文本 */
function esc(text: string): string {
  return String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

/**
 * 生成图框 SVG（**不含**平面图内容）。
 *
 * 返回值是一段 `<g>`，调用方负责：
 * 1. 用 `<g transform="translate(...) scale(...)">` 包裹平面图，使其落在 `content` 区；
 * 2. 把本函数结果叠加在最上层。
 *
 * 之所以分开：平面图是外部克隆来的 `<svg>` 子树，无法在本函数内拼装；
 * 由调用方组合更灵活，也便于测试（本函数输出可独立断言）。
 */
export function buildSheetFrameSvg(options: SheetOptions): string {
  const g = computeSheetGeometry(options);
  const { resolve, labels } = options;
  const stroke = resolve('text-secondary');
  const ink = resolve('text');
  const muted = resolve('text-muted');
  const surface = resolve('surface');

  const line = (x1: number, y1: number, x2: number, y2: number, w = 0.35) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${w}"/>`;

  // ---- 图框：外框粗、内框细 ----
  const frame =
    `<rect x="${g.outer.x}" y="${g.outer.y}" width="${g.outer.width}" height="${g.outer.height}" ` +
    `fill="none" stroke="${ink}" stroke-width="0.7"/>` +
    `<rect x="${g.inner.x}" y="${g.inner.y}" width="${g.inner.width}" height="${g.inner.height}" ` +
    `fill="none" stroke="${stroke}" stroke-width="0.35"/>`;

  // ---- 指北针：内框右上角 ----
  const cx = g.inner.x + g.inner.width - NORTH_ARROW_RADIUS - 6;
  const cy = g.inner.y + NORTH_ARROW_RADIUS + 6;
  const r = NORTH_ARROW_RADIUS;
  const north =
    `<g transform="translate(${cx} ${cy})">` +
    `<circle r="${r}" fill="${surface}" stroke="${stroke}" stroke-width="0.3"/>` +
    // 指针：上实下空（标准制图惯例）
    `<path d="M0 ${-r * 0.78}L${r * 0.36} ${r * 0.55}L0 ${r * 0.3}L${-r * 0.36} ${r * 0.55}Z" ` +
    `fill="${ink}" stroke="${ink}" stroke-width="0.2"/>` +
    `<text x="0" y="${-r - 1.6}" font-size="3.2" text-anchor="middle" fill="${ink}">N</text>` +
    `</g>`;

  // ---- 标题栏 ----
  const tb = g.titleBlock;
  const rowH = tb.height / 3;
  const labelW = 30;

  const titleBlock =
    `<g>` +
    `<rect x="${tb.x}" y="${tb.y}" width="${tb.width}" height="${tb.height}" fill="${surface}" stroke="${stroke}" stroke-width="0.5"/>` +
    // 三行：项目 / 户型 / 比例·日期·面积·设计者
    line(tb.x, tb.y + rowH, tb.x + tb.width, tb.y + rowH, 0.3) +
    line(tb.x, tb.y + rowH * 2, tb.x + tb.width, tb.y + rowH * 2, 0.3) +
    line(tb.x + labelW, tb.y, tb.x + labelW, tb.y + tb.height, 0.3) +
    // 行 1：项目名（主标题，字号大）
    `<text x="${tb.x + 2}" y="${tb.y + rowH / 2 + 1}" font-size="2.4" fill="${muted}">${esc(labels.fields.project)}</text>` +
    `<text x="${tb.x + labelW + 3}" y="${tb.y + rowH / 2 + 1.2}" font-size="3.6" font-weight="600" fill="${ink}">${esc(labels.project)}</text>` +
    // 行 2：户型名
    `<text x="${tb.x + 2}" y="${tb.y + rowH * 1.5 + 1}" font-size="2.4" fill="${muted}">${esc(labels.fields.plan)}</text>` +
    `<text x="${tb.x + labelW + 3}" y="${tb.y + rowH * 1.5 + 1.2}" font-size="3.2" fill="${ink}">${esc(labels.plan)}</text>` +
    // 行 3：比例 / 日期 / 面积 / 设计者（四等分）
    (() => {
      const y = tb.y + rowH * 2;
      const quarter = (tb.width - labelW) / 4;
      const items: [string, string][] = [
        [labels.fields.scale, labels.scale],
        [labels.fields.date, labels.date],
        [labels.fields.area, labels.area],
        [labels.fields.designer, labels.designer],
      ];
      return items
        .map(([label, value], i) => {
          const x = tb.x + labelW + quarter * i;
          return (
            `<text x="${x + 1.5}" y="${y + rowH * 0.36}" font-size="2" fill="${muted}">${esc(label)}</text>` +
            `<text x="${x + 1.5}" y="${y + rowH * 0.78}" font-size="2.6" fill="${ink}">${esc(value)}</text>`
          );
        })
        .join('');
    })() +
    `</g>`;

  // ---- 比例尺：左下角，长度按 1:100 对应 1 米 ----
  const barLen = 20; // mm on paper
  const barX = g.inner.x + 6;
  const barY = g.inner.y + g.inner.height - 6;
  const scaleBar =
    `<g>` +
    `<line x1="${barX}" y1="${barY}" x2="${barX + barLen}" y2="${barY}" stroke="${ink}" stroke-width="0.6"/>` +
    `<line x1="${barX}" y1="${barY - 1.2}" x2="${barX}" y2="${barY + 1.2}" stroke="${ink}" stroke-width="0.6"/>` +
    `<line x1="${barX + barLen}" y1="${barY - 1.2}" x2="${barX + barLen}" y2="${barY + 1.2}" stroke="${ink}" stroke-width="0.6"/>` +
    `<text x="${barX + barLen / 2}" y="${barY + 4}" font-size="2.6" text-anchor="middle" fill="${muted}">${esc(
      labels.scale,
    )}</text>` +
    `</g>`;

  return `<g class="sheet-frame">${frame}${north}${titleBlock}${scaleBar}</g>`;
}

/**
 * 生成完整的图纸 SVG 文档（图框 + 平面图内容）。
 *
 * @param options 图框参数
 * @param planInner 平面图的**内部内容**（不含 `<svg>` 外壳，通常是克隆出来的图层序列化结果）
 * @returns 完整 SVG 文本
 */
export function buildSheetDocument(options: SheetOptions, planInner: string): string {
  const g = computeSheetGeometry(options);
  const { paper } = g;
  const { planTransform } = g;
  const bg = options.resolve('canvas');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!-- generated by decoration-studio; units: mm; paper: ${options.paper} -->\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${paper.width}mm" height="${paper.height}mm" viewBox="0 0 ${paper.width} ${paper.height}">` +
    `<rect x="0" y="0" width="${paper.width}" height="${paper.height}" fill="${bg}"/>` +
    // 平面图：按 bounds → 内容区的等比缩放平移
    `<g transform="translate(${planTransform.translateX} ${planTransform.translateY}) scale(${planTransform.scale})">` +
    `<g transform="translate(${-options.bounds.x} ${-options.bounds.y})">` +
    planInner +
    `</g></g>` +
    buildSheetFrameSvg(options) +
    `</svg>`
  );
}
