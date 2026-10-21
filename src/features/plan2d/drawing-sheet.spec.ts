/**
 * 施工图图框测试。
 *
 * 重点：`computeSheetGeometry` 是纯函数，可直接断言几何关系；
 * `buildSheetFrameSvg` 输出字符串，断言必要元素存在。
 */
import { describe, expect, it } from 'vitest';
import {
  buildSheetDocument,
  buildSheetFrameSvg,
  computeSheetGeometry,
  NORTH_ARROW_RADIUS,
  PAPER_SPECS,
  TITLE_BLOCK,
  type PaperSize,
  type SheetLabels,
  type SheetOptions,
} from '@/features/plan2d/drawing-sheet';

/** 假取色器：返回固定色名，便于断言「没有硬编码 hex」 */
const fakeResolve = ((name: string) => `var-${name}`) as unknown as SheetOptions['resolve'];

const labels: SheetLabels = {
  project: '示例项目',
  plan: '三室两厅两卫',
  scale: '1:100',
  date: '2026-10-21',
  area: '87.18 m²',
  designer: '张三',
  fields: {
    project: '项目',
    plan: '户型',
    scale: '比例',
    date: '日期',
    area: '面积',
    designer: '设计',
    north: '北',
  },
};

const bounds = { x: -1850, y: -1750, w: 15600, h: 14100 };

function opts(paper: PaperSize = 'a3'): SheetOptions {
  return { paper, bounds, resolve: fakeResolve, labels };
}

describe('图框几何', () => {
  it('三种纸张规格尺寸正确', () => {
    expect(PAPER_SPECS.a4).toMatchObject({ width: 297, height: 210 });
    expect(PAPER_SPECS.a3).toMatchObject({ width: 420, height: 297 });
    expect(PAPER_SPECS.a2).toMatchObject({ width: 594, height: 420 });
  });

  it('外框在内、内框比外框小（装订边）', () => {
    const g = computeSheetGeometry(opts());
    expect(g.outer.x).toBeGreaterThan(0);
    expect(g.outer.width).toBeLessThan(g.paper.width);
    expect(g.inner.x).toBeGreaterThan(g.outer.x); // 左边留装订边
    expect(g.inner.width).toBeLessThan(g.outer.width);
  });

  it('标题栏贴在内框右下角', () => {
    const g = computeSheetGeometry(opts());
    expect(g.titleBlock.x + g.titleBlock.width).toBeCloseTo(g.inner.x + g.inner.width, 6);
    expect(g.titleBlock.y + g.titleBlock.height).toBeCloseTo(g.inner.y + g.inner.height, 6);
    expect(g.titleBlock.width).toBe(TITLE_BLOCK.width);
    expect(g.titleBlock.height).toBe(TITLE_BLOCK.height);
  });

  it('内容区不与标题栏重叠', () => {
    const g = computeSheetGeometry(opts());
    const contentBottom = g.content.y + g.content.height;
    expect(contentBottom).toBeLessThanOrEqual(g.titleBlock.y + 0.001);
  });

  it('平面图等比缩放且居中', () => {
    const g = computeSheetGeometry(opts());
    // 缩放后应完全落在内容区内
    const drawnW = bounds.w * g.planTransform.scale;
    const drawnH = bounds.h * g.planTransform.scale;
    expect(drawnW).toBeLessThanOrEqual(g.content.width + 0.001);
    expect(drawnH).toBeLessThanOrEqual(g.content.height + 0.001);
    // 居中：左右留白相等
    const leftGap = g.planTransform.translateX - g.content.x;
    const rightGap = g.content.x + g.content.width - (g.planTransform.translateX + drawnW);
    expect(leftGap).toBeCloseTo(rightGap, 6);
  });

  it('纸张越大，平面图缩放比例越大', () => {
    const a4 = computeSheetGeometry(opts('a4'));
    const a3 = computeSheetGeometry(opts('a3'));
    const a2 = computeSheetGeometry(opts('a2'));
    expect(a3.planTransform.scale).toBeGreaterThan(a4.planTransform.scale);
    expect(a2.planTransform.scale).toBeGreaterThan(a3.planTransform.scale);
  });
});

describe('图框 SVG 输出', () => {
  it('包含外框、内框、指北针、标题栏、比例尺', () => {
    const svg = buildSheetFrameSvg(opts());
    // 两个 rect = 外框 + 内框（标题栏还有第三个）
    expect((svg.match(/<rect /g) ?? []).length).toBeGreaterThanOrEqual(3);
    // 指北针：圆 + N 字
    expect(svg).toContain('<circle');
    expect(svg).toContain('>N</text>');
    // 标题栏文案
    expect(svg).toContain('示例项目');
    expect(svg).toContain('三室两厅两卫');
    expect(svg).toContain('1:100');
    expect(svg).toContain('2026-10-21');
    expect(svg).toContain('87.18 m²');
    expect(svg).toContain('张三');
    // 比例尺
    expect(svg).toContain('<line');
  });

  it('颜色只用传入的令牌（不含十六进制字面值）', () => {
    const svg = buildSheetFrameSvg(opts());
    // 六位 hex 不应出现（令牌解析器返回 `var-xxx`）
    expect(svg).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    expect(svg).toContain('var-');
  });

  it('指北针半径可断言（几何常量生效）', () => {
    const svg = buildSheetFrameSvg(opts());
    expect(svg).toContain(`r="${NORTH_ARROW_RADIUS}"`);
  });

  it('XML 特殊字符被转义', () => {
    const svg = buildSheetFrameSvg({
      ...opts(),
      labels: { ...labels, project: 'A&B <test> "quoted"' },
    });
    expect(svg).toContain('A&amp;B &lt;test&gt; &quot;quoted&quot;');
    expect(svg).not.toContain('A&B <test>');
  });
});

describe('完整图纸文档', () => {
  it('生成合法 SVG 根节点，尺寸用 mm', () => {
    const doc = buildSheetDocument(opts(), '<g class="plan-inner"></g>');
    expect(doc.startsWith('<?xml')).toBe(true);
    expect(doc).toContain('width="420mm"');
    expect(doc).toContain('height="297mm"');
    expect(doc).toContain('viewBox="0 0 420 297"');
    expect(doc).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('平面图内容被放进 transform 组，并先归零 bounds', () => {
    const doc = buildSheetDocument(opts(), '<g class="plan-inner"></g>');
    // 外层：平移到内容区 + 缩放
    expect(doc).toMatch(/<g transform="translate\([-\d.]+ [-\d.]+\) scale\([\d.]+\)">/);
    // 内层：把 bounds 原点归零
    expect(doc).toContain(`translate(${-bounds.x} ${-bounds.y})`);
    // 内容确实被包裹
    expect(doc).toContain('class="plan-inner"');
  });

  it('图框绘制在平面图之后（覆盖在上层）', () => {
    const doc = buildSheetDocument(opts(), '<g class="plan-inner"></g>');
    const planIndex = doc.indexOf('plan-inner');
    const frameIndex = doc.indexOf('sheet-frame');
    expect(planIndex).toBeGreaterThan(-1);
    expect(frameIndex).toBeGreaterThan(planIndex);
  });

  it('带纸张规格注释，便于追溯', () => {
    const doc = buildSheetDocument(opts('a4'), '<g></g>');
    expect(doc).toContain('paper: a4');
  });
});
