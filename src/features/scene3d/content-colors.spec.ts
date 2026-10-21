/**
 * 内容色（`content-colors.ts`）与 three.js 解析兼容性测试。
 *
 * ## 背景：一个「所有检查全绿但颜色全丢」的缺陷
 *
 * `furniture/content-colors.ts` 里 60+ 个颜色用 CSS 现代空格语法登记
 * （`hsl(103 29% 43%)`），目的是通过「scene3d 内不得出现十六进制字面值」的闸门。
 *
 * 但 **three.js 的 `Color` 不支持空格分隔的 hsl 语法**，解析失败时
 * **不抛错、静默回退成白色**（`#ffffff`）。结果：绿植叶子、土壤、花茎，
 * 以及花朵、书脊、玩具、家电外壳、钢琴、餐具……所有装饰色全部变白。
 *
 * 这个缺陷逃过了：typecheck、216 个单测、lint、verify、渲染 8/8、键盘 5/5。
 * 因为没有任何测试检查「颜色字符串能否被 three 正确解析」。
 *
 * 本文件补上这条断言：**每个内容色常量都必须能被 three 解析成非白色**。
 */
import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import * as CONTENT_COLORS from '@/features/scene3d/furniture/content-colors';

/**
 * 与 `features/scene3d/materials.ts` 的 `normalizeColor` 保持一致。
 *
 * 若将来改了实现，这里必须同步——所以本测试同时起到「锁定契约」的作用。
 */
function normalizeColor(color: string): string {
  const modernHsl = /^hsl\(\s*([\d.]+)(?:deg)?\s+([\d.]+)%\s+([\d.]+)%\s*(?:\/\s*[\d.]+%?\s*)?\)$/i;
  const m = modernHsl.exec(color.trim());
  if (m) return `hsl(${m[1]},${m[2]}%,${m[3]}%)`;
  return color;
}

/** 用 three 解析颜色，返回 6 位 hex（不含 #） */
function parseHex(input: string): string {
  return new Color(normalizeColor(input)).getHexString();
}

/**
 * 收集所有「字符串型」颜色常量。
 *
 * `content-colors.ts` 的导出是联合类型（字符串 / 函数 / 只读数组），
 * 因为有些颜色需要由主题调色板派生（`(palette) => palette.metal.black`）。
 * 这里只关心**字面量字符串**——它们才是需要验证 three 能否解析的部分。
 */
const asRecord = CONTENT_COLORS as unknown as Record<string, unknown>;

const stringConstants: [string, string][] = Object.entries(asRecord).filter(
  (entry): entry is [string, string] => typeof entry[1] === 'string',
);

/** 数组型常量（如装饰色板）展开成 `名字[下标]` */
const arrayEntries: [string, string][] = Object.entries(asRecord).flatMap(([key, value]) =>
  Array.isArray(value)
    ? value
        .filter((v): v is string => typeof v === 'string')
        .map((v, i): [string, string] => [`${key}[${i}]`, v])
    : [],
);

const allColors: [string, string][] = [...stringConstants, ...arrayEntries];

describe('内容色：必须能被 three.js 正确解析', () => {
  it('content-colors.ts 至少导出了 40 个颜色常量（防止文件被误清空）', () => {
    expect(allColors.length).toBeGreaterThanOrEqual(40);
  });

  it('每个颜色都能解析成合法的 6 位 hex', () => {
    const bad: string[] = [];
    for (const [name, value] of allColors) {
      const hex = parseHex(value);
      if (!/^[0-9a-f]{6}$/i.test(hex)) bad.push(`${name}=${value} → ${hex}`);
    }
    expect(bad, `以下颜色解析异常：\n${bad.join('\n')}`).toEqual([]);
  });

  it('非纯白的颜色不能被解析成 #ffffff（这正是原缺陷的形态）', () => {
    const broken: string[] = [];
    for (const [name, value] of allColors) {
      const hex = parseHex(value);
      // 允许本来就是白色的（如 TOILET_WARE = hsl(0 0% 95%) 接近白，FLOWER_WHITE 是纯白）
      const declaredWhite = /hsl\(\s*[\d.]+\s+0%\s+9[0-9]%/.test(value) || /100%/.test(value);
      if (hex === 'ffffff' && !declaredWhite) broken.push(`${name}=${value}`);
    }
    expect(broken, `以下颜色被错误地解析成白色（three 不支持空格 hsl 语法）：\n${broken.join('\n')}`).toEqual([]);
  });

  it('绿植相关颜色必须是绿色系（R 明显低于 G）', () => {
    // 直接断言业务语义：叶子就该是绿的
    for (const name of ['LEAF_DARK', 'LEAF_LIGHT', 'STEM_GREEN'] as const) {
      const value = (CONTENT_COLORS as Record<string, unknown>)[name];
      expect(typeof value, `${name} 不存在或不是字符串`).toBe('string');
      const hex = parseHex(value as string);
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      expect(g, `${name}=${value} → #${hex} 不是绿色系（G 应明显高于 R/B）`).toBeGreaterThan(r + 20);
      expect(g).toBeGreaterThan(b + 20);
    }
  });
});

describe('normalizeColor 的行为契约', () => {
  it('空格 hsl → 逗号 hsl', () => {
    expect(normalizeColor('hsl(103 29% 43%)')).toBe('hsl(103,29%,43%)');
  });

  it('带 deg 单位的也能处理', () => {
    expect(normalizeColor('hsl(103deg 29% 43%)')).toBe('hsl(103,29%,43%)');
  });

  it('带 alpha 的现代语法也能处理（丢弃 alpha，材质用 opacity 控制）', () => {
    expect(normalizeColor('hsl(103 29% 43% / 0.5)')).toBe('hsl(103,29%,43%)');
  });

  it('已是逗号语法 / hex / rgb 的原样返回', () => {
    expect(normalizeColor('hsl(103,29%,43%)')).toBe('hsl(103,29%,43%)');
    expect(normalizeColor('#5f8f4e')).toBe('#5f8f4e');
    expect(normalizeColor('rgb(95,143,78)')).toBe('rgb(95,143,78)');
  });

  it('修复前后对比：空格语法在未归一化时会被 three 解析成白色', () => {
    // 这是缺陷的「证据」：不归一化就是白色
    expect(new Color('hsl(103 29% 43%)').getHexString()).toBe('ffffff');
    // 归一化后才是正确颜色
    expect(parseHex('hsl(103 29% 43%)')).not.toBe('ffffff');
  });
});

describe('生产代码必须保留归一化（源码级守卫）', () => {
  /**
   * 前面几组测试用的是本文件内**复制**的 `normalizeColor`。
   * 如果哪天有人把 `materials.ts` 里的转换删掉，那些测试仍会通过（它们测的是副本）。
   *
   * 这条守卫直接读 `materials.ts` 源码，确认转换逻辑还在——
   * 补上「测试副本」与「生产实现」之间的缺口。
   */
  it('materials.ts 的 mat() / content() 都调用了 normalizeColor', async () => {
    const mod = await import('node:fs');
    const url = await import('node:url');
    const here = url.fileURLToPath(import.meta.url);
    const srcPath = here.replace(/content-colors\.spec\.ts$/, 'materials.ts');
    const source = mod.readFileSync(srcPath, 'utf8');

    // 1) 必须定义了 normalizeColor
    expect(source, 'materials.ts 缺少 normalizeColor 定义').toContain('function normalizeColor(');

    // 2) mat() 与 content() 必须各自调用它（各至少一次）
    const calls = source.match(/normalizeColor\(/g) ?? [];
    // 定义 1 次 + mat 1 次 + content 1 次 = 至少 3
    expect(calls.length, 'normalizeColor 调用次数不足（mat/content 未都使用）').toBeGreaterThanOrEqual(3);

    // 3) 材质构造必须用归一化后的值，不能直接用入参 color
    expect(source, 'mat() 仍在直接用未归一化的 color').toContain('color: resolved');
  });
});
