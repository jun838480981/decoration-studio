/**
 * 主题令牌表 = **全工程唯一色值来源**（SPEC §E + §C.2 B3）。
 *
 * ⛔ 任何其它文件都不允许出现十六进制色值（白名单例外仅 `features/plan2d/patterns.ts`、
 *    `data/materials.ts`、`data/furniture-lib.ts`——那是**内容色**，ADR-10）。
 * ⛔ 3D 侧更不允许：`theme/material-palette.ts` 是 3D 材质基色的唯一来源（SPEC §E.8 T1/T2）。
 *
 * 令牌来源与分工（ADR-03）：
 * - 三套预设的 hex 由 SPEC §E 定稿（可审计、可回归）；
 * - `@material/material-color-utilities` 只负责**派生扩展**（由 `accent` 种子生成 tonal 色阶，
 *   支撑后续「一键换主题色」）；
 * - `colorjs.io` 只做**裁决**（`theme/contrast.ts` 的断言表，CI 守门）。
 *
 * 关于 SPEC §E 的「日间 24 / 夜间 17 / 高对比 15 项」：那是**显式给出 hex 的条目数**。
 * 为了让 `keyof ThemeTokens` 对三套预设保持同一集合（下游只写一份类型安全的取色代码），
 * 未显式给出的条目采用**语义等价派生值**（如 `*-soft` 配套底、夜间/高对比的 2D 图纸令牌），
 * 已在下方逐条标注「派生」。
 */
import type { ThemePresetId, ThemePresetMeta, ThemeTokenName, ThemeTokens } from '@/types/theme';

/** 预设顺序（UI 里的切换顺序，也是回归测试的遍历顺序） */
export const THEME_PRESET_IDS = ['day', 'night', 'contrast'] as const satisfies readonly ThemePresetId[];

/**
 * 全部令牌名（顺序 = `applyTheme` 写入 CSS 变量的顺序，也是 `verify.mjs` 的核对清单）。
 * 末尾的 `Exhaustive` 断言保证「类型里加了令牌却忘了加进数组」会直接编译失败。
 */
export const THEME_TOKEN_NAMES = [
  // ---- UI 语义层 ----
  'color-scheme',
  'bg',
  'surface',
  'surface-2',
  'canvas',
  'border',
  'border-strong',
  'focus-ring',
  'text',
  'text-secondary',
  'text-muted',
  'on-accent',
  'accent',
  'accent-hover',
  'accent-active',
  'accent-soft',
  'accent-2',
  'accent-2-soft',
  'success',
  'success-soft',
  'warning',
  'warning-soft',
  'danger',
  'danger-soft',
  'info',
  'info-soft',
  // ---- 2D 图纸专用 ----
  'plan-grid-minor',
  'plan-grid-major',
  'wall-bearing',
  'wall-bearing-hl',
  'wall-exterior',
  'wall-partition',
  'wall-low',
  'wall-low-stroke',
  'wall-demolished',
  'window',
  'door',
  'door-entry',
  'dim-line',
  'measure',
  'measure-pending',
  'snap-grid',
  'snap-corner',
  'room-label',
  'room-label-sub',
  'room-label-halo',
  'room-void',
] as const satisfies readonly ThemeTokenName[];

type MissingTokenName = Exclude<ThemeTokenName, (typeof THEME_TOKEN_NAMES)[number]>;
/** 若下面这行报错，说明 `types/theme.ts` 的 `ThemeTokenName` 与上面的数组不同步（元组包裹避免条件类型分发到 never） */
const _allTokensListed: [MissingTokenName] extends [never] ? true : never = true;
void _allTokensListed;

/** 只属于 2D 图纸的令牌（必须写进 SVG 呈现属性，不能写 CSS 变量：SPEC §C.2 B9 / §F.6 R-EXP-1） */
const PLAN_ONLY_TOKEN_NAMES: readonly ThemeTokenName[] = [
  'plan-grid-minor',
  'plan-grid-major',
  'wall-bearing',
  'wall-bearing-hl',
  'wall-exterior',
  'wall-partition',
  'wall-low',
  'wall-low-stroke',
  'wall-demolished',
  'window',
  'door',
  'door-entry',
  'dim-line',
  'measure',
  'measure-pending',
  'snap-grid',
  'snap-corner',
  'room-label',
  'room-label-sub',
  'room-label-halo',
  'room-void',
];

/** 2D 图纸令牌 */
export const PLAN_TOKEN_NAMES: readonly ThemeTokenName[] = THEME_TOKEN_NAMES.filter((n) =>
  PLAN_ONLY_TOKEN_NAMES.includes(n),
);

/** UI 语义令牌（面板、按钮、文字、原生控件配色） */
export const UI_TOKEN_NAMES: readonly ThemeTokenName[] = THEME_TOKEN_NAMES.filter(
  (n) => !PLAN_ONLY_TOKEN_NAMES.includes(n),
);

/**
 * 装饰性令牌：不承载信息，**豁免** ≥3:1 的图形对比要求（SPEC §E.2 / §E.3 明确标注）。
 * 它们不得用于输入框/控件边界，也不得单独承载语义。
 *
 * 权威清单是**封闭 4 项**（SPEC §E.3 / §E.7 / ADR-17 / §K 第 1 条），⛔ 不得再扩：
 * - `wall-low` 是矮墙的**填充**（浅色、仅视觉面，日间 1.16:1）；承载「矮墙」语义的是**描边**
 *   `wall-low-stroke`，它照常参与 ≥3:1 断言（C-2 裁定：填充豁免、只校验描边）。
 */
export const DECORATIVE_TOKEN_NAMES: readonly ThemeTokenName[] = [
  'border',
  'plan-grid-minor',
  'plan-grid-major',
  'wall-low',
];

/**
 * 主题 A：日间（SPEC §E.2 / §E.3，默认预设）。
 * 相对原实现的修复点：`--muted` 3.78:1 → `text-muted` 5.71:1；白字压 `--accent` 4.30:1 → 5.89:1；
 * 非承重墙 `#a7a195`（2.34:1）→ `wall-partition`（3.41:1）；房间面积小字 `#7d7366` → `room-label-sub`。
 */
const DAY: ThemeTokens = {
  'color-scheme': 'light',
  bg: '#f2ede4',
  surface: '#fffdf9',
  'surface-2': '#faf6ef',
  canvas: '#f7f4ee',
  border: '#e0d8c9',
  'border-strong': '#93856c',
  'focus-ring': '#2f5d62',
  text: '#241f1a',
  'text-secondary': '#574f45',
  'text-muted': '#6d6459',
  'on-accent': '#ffffff',
  accent: '#9c4f28',
  'accent-hover': '#83401f',
  'accent-active': '#6d3416',
  'accent-soft': '#f6e7db',
  'accent-2': '#2f5d62',
  'accent-2-soft': '#e3ecec',
  success: '#2e6b41',
  'success-soft': '#e2efe6',
  warning: '#8a5a00',
  'warning-soft': '#f8ecd6',
  danger: '#b3372a',
  'danger-soft': '#fbe4e0',
  info: '#2f5d62',
  'info-soft': '#e3ecec',
  'plan-grid-minor': '#e5dfd3',
  'plan-grid-major': '#d8d0c1',
  'wall-bearing': '#26241f',
  'wall-bearing-hl': '#b8412c',
  'wall-exterior': '#8f897d',
  'wall-partition': '#8b8375',
  'wall-low': '#e9e3d8',
  'wall-low-stroke': '#8f897d',
  'wall-demolished': '#c65b3a',
  window: '#4f7394',
  door: '#3d3a34',
  'door-entry': '#9c4f28',
  'dim-line': '#7d7160',
  measure: '#9c4f28',
  'measure-pending': '#2f5d62',
  'snap-grid': '#c65b3a',
  'snap-corner': '#2f5d62',
  // 房间标签画在**内容色地板图案**之上（原实现是深字 + 浅色描边光晕，L1258-1260）：
  // 底衬是内容色、不随主题变，所以这三个令牌在主题间**保持不变**（ADR-10）。
  'room-label': '#241f1a',
  'room-label-sub': '#574f45',
  'room-label-halo': '#fbf9f4',
  'room-void': '#b5653a',
};

/** 主题 B：夜间（SPEC §E.4；标注「派生」的为 2D 图纸令牌的语义等价推导） */
const NIGHT: ThemeTokens = {
  'color-scheme': 'dark',
  bg: '#171a21',
  surface: '#1f232b',
  'surface-2': '#262b34',
  canvas: '#1b1f27',
  border: '#333a45',
  'border-strong': '#6b7686',
  'focus-ring': '#7fb3b8', // 派生：与 info/accent-2 同值，6.78:1 on surface
  text: '#eef1f5',
  'text-secondary': '#c2c8d2',
  'text-muted': '#97a0ad',
  'on-accent': '#1b1f27',
  accent: '#e08b5c',
  'accent-hover': '#f0a077',
  'accent-active': '#ffb78d', // 派生：更亮一档
  'accent-soft': '#3a2a20',
  'accent-2': '#7fb3b8',
  'accent-2-soft': '#22383c', // 派生
  success: '#6fbf8b',
  'success-soft': '#1e3327', // 派生
  warning: '#e0b062',
  'warning-soft': '#33291a', // 派生
  danger: '#ef8073',
  'danger-soft': '#3a2320', // 派生
  info: '#7fb3b8',
  'info-soft': '#22383c', // 派生
  'plan-grid-minor': '#2b313a', // 派生（装饰）
  'plan-grid-major': '#3a424d', // 派生（装饰）
  'wall-bearing': '#eef1f5', // SPEC §E.4：承重墙改用浅色
  'wall-bearing-hl': '#ef8073', // 派生：沿用 danger 谱系，on canvas 6.3:1
  'wall-exterior': '#8a93a0', // SPEC §E.4
  'wall-partition': '#5f6875', // SPEC §E.4（on canvas 3.14:1）
  'wall-low': '#2b313a', // 派生（填充为装饰）
  'wall-low-stroke': '#8a93a0', // 派生：= wall-exterior
  'wall-demolished': '#e08b5c', // 派生：= accent
  window: '#7fb3b8', // 派生：= accent-2
  door: '#c2c8d2', // 派生：= text-secondary
  'door-entry': '#e08b5c', // 派生：= accent
  'dim-line': '#97a0ad', // 派生：= text-muted
  measure: '#e08b5c', // 派生：= accent（与日间「measure = accent」一致）
  'measure-pending': '#7fb3b8', // 派生：= accent-2
  'snap-grid': '#e0b062', // 派生：= warning
  'snap-corner': '#7fb3b8', // 派生：= accent-2
  'room-label': '#241f1a', // 与日间同值：画在内容色图案上（ADR-10）
  'room-label-sub': '#3d3a34', // 与日间同族：画在内容色图案上（ADR-10）
  'room-label-halo': '#fbf9f4', // 同上
  'room-void': '#b5653a', // 与日间同值：挑空区叠在内容色地板上
};

/** 主题 C：高对比（SPEC §E.5；2D 图纸令牌为派生，全部 ≥7:1 on `#ffffff`） */
const CONTRAST: ThemeTokens = {
  'color-scheme': 'light',
  bg: '#ffffff',
  surface: '#ffffff',
  'surface-2': '#f2f2f2',
  canvas: '#ffffff',
  border: '#000000',
  'border-strong': '#000000',
  'focus-ring': '#000000',
  text: '#000000',
  'text-secondary': '#1a1a1a',
  'text-muted': '#3d3d3d',
  'on-accent': '#ffffff',
  accent: '#7a2f0c',
  'accent-hover': '#5c2208',
  'accent-active': '#451803', // 派生
  'accent-soft': '#ffe8dc',
  'accent-2': '#14343a',
  'accent-2-soft': '#d7e6e9', // 派生
  success: '#14532d',
  'success-soft': '#d9ecdf', // 派生
  warning: '#6b3f00',
  'warning-soft': '#f7e6c8', // 派生
  danger: '#8f1d14',
  'danger-soft': '#f8ddd9', // 派生
  info: '#14343a',
  'info-soft': '#d7e6e9', // 派生
  'plan-grid-minor': '#e6e6e6', // 派生（装饰）
  'plan-grid-major': '#cccccc', // 派生（装饰）
  'wall-bearing': '#000000',
  'wall-bearing-hl': '#8f1d14', // 派生：= danger
  'wall-exterior': '#3d3d3d', // 派生：= text-muted，10.86:1
  'wall-partition': '#555555', // 派生：7.45:1 on #ffffff
  'wall-low': '#f2f2f2', // 派生（填充为装饰）
  'wall-low-stroke': '#3d3d3d', // 派生
  'wall-demolished': '#8f1d14', // 派生：= danger
  window: '#14343a', // 派生：= accent-2，13.27:1
  door: '#000000', // 派生
  'door-entry': '#7a2f0c', // 派生：= accent，9.38:1
  'dim-line': '#3d3d3d', // 派生
  measure: '#7a2f0c', // 派生：= accent
  'measure-pending': '#14343a', // 派生：= accent-2
  'snap-grid': '#8f1d14', // 派生：= danger
  'snap-corner': '#14343a', // 派生：= accent-2
  'room-label': '#241f1a', // 与日间同值：画在内容色图案上（ADR-10）
  'room-label-sub': '#3d3a34',
  'room-label-halo': '#fbf9f4',
  'room-void': '#7a2f0c', // 派生：= accent
};

/** 三套预设（唯一色值来源） */
export const THEMES: Record<ThemePresetId, ThemeTokens> = {
  day: DAY,
  night: NIGHT,
  contrast: CONTRAST,
};

/** 预设元信息（UI 文案 + `<meta name="theme-color">`） */
export const THEME_PRESETS: readonly ThemePresetMeta[] = THEME_PRESET_IDS.map((id) => ({
  id,
  zh: id === 'day' ? '日间' : id === 'night' ? '夜间' : '高对比',
  en: id === 'day' ? 'Day' : id === 'night' ? 'Night' : 'High contrast',
  themeColor: THEMES[id].surface,
}));

export function isThemePresetId(value: unknown): value is ThemePresetId {
  return typeof value === 'string' && (THEME_PRESET_IDS as readonly string[]).includes(value);
}

/** 取默认预设（无存储值时使用） */
export const DEFAULT_THEME_PRESET_ID: ThemePresetId = 'day';
