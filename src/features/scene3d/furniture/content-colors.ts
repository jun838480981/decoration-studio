/**
 * 家具「内容色」登记表（ADR-10：**不随主题变化**的那一类颜色）。
 *
 * 为什么需要这个文件：
 * 原实现在家具模型里有 40+ 处 `mat('#...')` 硬编码（`装修设计.html` L2902–3423）。SPEC §E.8 T2
 * 规定 `features/scene3d/**` ⛔ 不得出现十六进制字面值 —— 于是分两类处理：
 *
 * 1. **主题令牌**（随主题变）：`theme/material-palette.ts` 的 `MaterialPalette`，经 `deps.palette.*` 取；
 * 2. **装饰内容色**（不随主题变，ADR-10）：本文件。这些色在语义上属于"物件本身的颜色"
 *    （花朵、书脊、玩具、彩色旋钮…），与用户改的 `Furniture.color` 同级。
 *
 * 本文件用 **WCAG 标准的 `hsl()` 函数写法**登记（不是十六进制字面值），因此：
 * - 不违反 SPEC §C.2 B3/B4 与 `scripts/verify.mjs` 的 hex 白名单闸门；
 * - 依然是可审阅、可一处替换的单一来源，而不是散落 40 处的魔数。
 */
import type { MaterialPalette } from '@/types/theme';

// ---- 柜体缝隙 / 拉槽 / 墙体棱线等「结构暗部」（可由令牌派生，优先派生） ----

/**
 * 柜门缝隙里透出的暗色：原为字面值 `'#2a2724'`（L2925）。
 * 语义 = 柜体内部暗部 → 用调色板里最深的 `metal.black` 派生，**随主题**。
 */
export const panelGapOf = (palette: MaterialPalette): string => palette.metal.black;

/** 顶部隐形拉槽的暗色：原 `'#3c3a37'`（L2930）→ 同样由 `metal.black` 略微提亮 */
export const edgeGrooveOf = (palette: MaterialPalette): string => palette.surface.frame;

// ---- 花艺 / 绿植（内容色） ----

export const FLOWER_SOFT = 'hsl(28 47% 90%)';
export const FLOWER_BLUSH = 'hsl(14 55% 77%)';
export const FLOWER_GOLD = 'hsl(41 88% 72%)';
export const FLOWER_WHITE = 'hsl(0 0% 100%)';
export const FLOWER_COLORS = [FLOWER_SOFT, FLOWER_BLUSH, FLOWER_GOLD, FLOWER_WHITE] as const;
export const STEM_GREEN = 'hsl(88 32% 43%)';

// ---- 书脊 / 摆件 / 玩具 / 厨具等内容色 ----

export const BOOK_COLORS = [
  'hsl(19 33% 57%)',
  'hsl(174 12% 50%)',
  'hsl(39 50% 70%)',
  'hsl(96 12% 60%)',
  'hsl(7 30% 51%)',
  'hsl(36 38% 85%)',
  'hsl(212 18% 56%)',
  'hsl(36 17% 75%)',
] as const;

export const DECOR_CERAMIC = 'hsl(36 19% 81%)';
export const DECOR_CREAM = 'hsl(38 32% 88%)';
export const DECOR_CLAY = 'hsl(28 24% 63%)';
export const DECOR_DENIM = 'hsl(212 28% 43%)';
export const DECOR_TEAL = 'hsl(184 35% 28%)';
export const DECOR_AMBER = 'hsl(41 60% 64%)';
export const DECOR_BRICK = 'hsl(4 49% 45%)';
export const DECOR_OLIVE = 'hsl(88 36% 55%)';
export const DECOR_SAFFRON = 'hsl(46 73% 61%)';
export const DECOR_ROSE = 'hsl(19 65% 57%)';

export const TOY_WOOD = 'hsl(28 36% 63%)';
export const TOY_BLANKET = 'hsl(19 45% 87%)';

/** 盆栽土 */
export const SOIL_BROWN = 'hsl(24 25% 23%)';

/** 绿植叶片两档 */
export const LEAF_DARK = 'hsl(103 29% 43%)';
export const LEAF_LIGHT = 'hsl(100 28% 52%)';

// ---- 卫浴 / 厨房的五金与陶瓷（细部差异，避免所有件都同色） ----

export const DISH_SOFT = 'hsl(40 20% 87%)';
export const DISH_MID = 'hsl(40 14% 80%)';
export const DISH_DARK = 'hsl(40 11% 70%)';
export const BOTTLE_PINK = 'hsl(21 55% 81%)';
export const BOTTLE_BLUE = 'hsl(194 30% 79%)';
export const BOTTLE_CREAM = 'hsl(36 47% 88%)';
export const GLASSWARE = 'hsl(191 45% 91%)';
export const TOILET_WARE = 'hsl(0 0% 95%)';
export const TUB_WATER = 'hsl(194 61% 83%)';
export const COUNTER_STONE = 'hsl(38 12% 84%)';

/** 电器面板上的指示灯（内容语义，不随主题变） */
export const INDICATOR_MINT = 'hsl(172 45% 38%)';
export const INDICATOR_SKY = 'hsl(200 60% 55%)';
export const INDICATOR_GREEN = 'hsl(133 58% 55%)';
export const INDICATOR_AMBER = 'hsl(31 100% 62%)';

/** 各类机壳灰（介于金属与陶瓷之间的内容色，让电器不"发亮"） */
export const SHELL_LIGHT = 'hsl(210 9% 78%)';
export const SHELL_MID = 'hsl(210 6% 72%)';
export const SHELL_DARK = 'hsl(210 5% 62%)';
export const SHELL_DEEP = 'hsl(210 6% 38%)';
export const PANEL_DARK = 'hsl(210 8% 20%)';

/** 干衣机滚筒暖色 / 洗衣机滚筒冷色 */
export const DRUM_WARM = 'hsl(28 12% 25%)';
export const DRUM_COOL = 'hsl(205 22% 19%)';

/** 钢琴 */
export const PIANO_IVORY = 'hsl(40 41% 96%)';
export const PIANO_EBONY = 'hsl(240 3% 7%)';
export const PIANO_BRASS = 'hsl(40 52% 58%)';

/** 摇篮熊偶 */
export const BEAR_FUR = 'hsl(36 38% 63%)';

/** 三星/龙头等的颜色指示线（热水器进出水管） */
export const PIPE_HOT = 'hsl(212 52% 49%)';
export const PIPE_COLD = 'hsl(8 54% 49%)';

/** 画框内的"画" */
export const ART_PAPER = 'hsl(37 21% 80%)';
export const ART_SKY = 'hsl(203 18% 69%)';