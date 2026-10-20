/**
 * SVG 图案定义：8 种材质纹理 + 编辑网格（SPEC §A14 / OF §2.2；原 `buildDefs()`，`装修设计.html` L1037-1058）。
 *
 * ⚠️ 本文件是 SPEC §C.2 **B3 白名单**之一：
 * - 地板图案的**纹样色**属于「内容色」（ADR-10），允许出现十六进制字面值——但它们不是这里的字面值，
 *   而是从 `data/materials.ts` 的 `tex.base` / `tex.grout` 读取（唯一来源，避免两处色值）；
 * - **网格线**必须用主题令牌 `plan-grid-minor` / `plan-grid-major` 的**字面值**
 *   （转成 hex 常量会在夜间主题下瞎眼），因此 `buildDefs()` 接收 `resolve` 函数。
 *
 * 图案尺度与原实现逐字一致（木地板 1800×360、800 砖 800×800…），单位 mm。
 */
import { MATS } from '@/data/materials';
import type { MaterialKey } from '@/types/material';
import type { TokenResolver } from '@/types/theme';

/** 木地板：错缝铺装 + 木纹（原 `plank`，L1038-1041） */
function plankPattern(id: MaterialKey, sx: number, sy: number, base: string, line: string): string {
  return `<pattern id="m-${id}" patternUnits="userSpaceOnUse" width="${sx}" height="${sy}">
      <rect width="${sx}" height="${sy}" fill="${base}"/>
      <path d="M0 0H${sx}M0 ${sy / 2}H${sx}M${sx * 2 / 3} 0V${sy / 2}M${sx / 3} ${sy / 2}V${sy}" stroke="${line}" stroke-width="10"/>
      <path d="M100 70Q500 60 900 85T1700 75M200 260Q700 250 1100 275T1750 262" stroke="${line}" stroke-width="5" fill="none" opacity=".45"/></pattern>`;
}

/** 瓷砖：方格 + 勾缝（原 `tile`，L1042-1043） */
function tilePattern(id: MaterialKey, size: number, base: string, line: string): string {
  return `<pattern id="m-${id}" patternUnits="userSpaceOnUse" width="${size}" height="${size}">
      <rect width="${size}" height="${size}" fill="${base}"/><path d="M0 0H${size}M0 0V${size}" stroke="${line}" stroke-width="10"/></pattern>`;
}

/** 大理石：大板 + 云纹（原 L1047-1049） */
function marblePattern(base: string, line: string, cloud: string): string {
  return `<pattern id="m-marble" patternUnits="userSpaceOnUse" width="1200" height="1200">
      <rect width="1200" height="1200" fill="${base}"/><path d="M0 0H1200M0 0V1200" stroke="${line}" stroke-width="10"/>
      <path d="M-50 300C250 260 380 520 700 470S1100 640 1260 600M200 1200C300 950 520 980 640 820" stroke="${cloud}" stroke-width="12" fill="none"/></pattern>`;
}

/** 水磨石：底色 + 6 颗骨料（原 L1050-1053） */
function terrazzoPattern(base: string): string {
  return `<pattern id="m-terrazzo" patternUnits="userSpaceOnUse" width="500" height="500">
      <rect width="500" height="500" fill="${base}"/>
      <circle cx="60" cy="80" r="22" fill="#b9a58c"/><circle cx="310" cy="140" r="16" fill="#8fa3a0"/><circle cx="190" cy="330" r="26" fill="#c9b7a2"/>
      <circle cx="420" cy="400" r="18" fill="#a88f76"/><circle cx="90" cy="440" r="12" fill="#8fa3a0"/><circle cx="440" cy="40" r="10" fill="#b9a58c"/></pattern>`;
}

/** 满铺地毯：底色 + 点纹（原 L1054-1055） */
function carpetPattern(base: string, dot: string): string {
  return `<pattern id="m-carpet" patternUnits="userSpaceOnUse" width="120" height="120">
      <rect width="120" height="120" fill="${base}"/><circle cx="30" cy="30" r="8" fill="${dot}"/><circle cx="90" cy="90" r="8" fill="${dot}"/></pattern>`;
}

/** 8 种材质图案（不含网格；与主题无关，可在组件间复用） */
export function buildMaterialPatterns(): string {
  let out = '';
  for (const key of Object.keys(MATS) as MaterialKey[]) {
    const { sx, sy, base, grout } = MATS[key].tex;
    const line = grout ?? base;
    switch (key) {
      case 'wood':
      case 'walnut':
        out += plankPattern(key, sx, sy, base, line);
        break;
      case 'tile800':
      case 'tile600':
      case 'antislip':
        out += tilePattern(key, sx, base, line);
        break;
      case 'marble':
        out += marblePattern(base, line, '#d6cfc2');
        break;
      case 'terrazzo':
        out += terrazzoPattern(base);
        break;
      case 'carpet':
        out += carpetPattern(base, line);
        break;
    }
  }
  return out;
}

/**
 * 编辑网格（1000×1000mm 单元：次线每 500、主线在边界）。
 * 颜色**必须**来自主题令牌（`plan-grid-minor` / `plan-grid-major`）。
 */
export function buildGridPattern(resolve: TokenResolver): string {
  const minor = resolve('plan-grid-minor');
  const major = resolve('plan-grid-major');
  return `<pattern id="grid" patternUnits="userSpaceOnUse" width="1000" height="1000">
      <path d="M500 0V1000M0 500H1000" stroke="${minor}" stroke-width="8"/><path d="M0 0V1000M0 0H1000" stroke="${major}" stroke-width="14"/></pattern>`;
}

/** `<defs>` 的完整内容 = 8 种材质图案 + 编辑网格（原 `buildDefs`，L1044-1057） */
export function buildDefs(resolve: TokenResolver): string {
  return buildMaterialPatterns() + buildGridPattern(resolve);
}

/** 材质图案 id（房间填充 `url(#m-<mat>)`） */
export function materialPatternId(key: MaterialKey): string {
  return `m-${key}`;
}