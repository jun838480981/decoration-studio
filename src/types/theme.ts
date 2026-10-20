/**
 * 主题令牌类型（SPEC §E + §D.7 🔒 冻结）。
 *
 * 设计要点：
 * 1. `ThemeTokens` 是**完整令牌集**，三套预设必须定义**完全相同**的键集合（`tokens.spec.ts` 会断言）。
 *    SPEC §E 的「日间 24 / 夜间 17 / 高对比 15」是**显式给出 hex 的条目数**；未显式给出的条目
 *    由 spec-lead 的语义等价派生值补齐（见 `theme/tokens.ts` 注释），键集合对下游始终一致。
 * 2. `keyof ThemeTokens` = `ThemeTokenName`，与 CSS 变量名一一对应：`--ds-` + 令牌名。
 * 3. 2D 图纸令牌（`plan-*` / `wall-*` / `window` / `door*` …）**必须**经 `theme.resolve()`
 *    取字面值写进 SVG **呈现属性**（SPEC §C.2 B9、§F.6 R-EXP-1），⛔ 不得写 `var(--ds-*)`。
 */

export type ThemePresetId = 'day' | 'night' | 'contrast';

export type ThemeTokenName =
  // ---- UI 语义层（SPEC §E.2） ----
  | 'bg'
  | 'surface'
  | 'surface-2'
  | 'canvas'
  | 'border'
  | 'border-strong'
  | 'focus-ring'
  | 'text'
  | 'text-secondary'
  | 'text-muted'
  | 'on-accent'
  | 'accent'
  | 'accent-hover'
  | 'accent-active'
  | 'accent-soft'
  | 'accent-2'
  | 'accent-2-soft'
  | 'success'
  | 'success-soft'
  | 'warning'
  | 'warning-soft'
  | 'danger'
  | 'danger-soft'
  | 'info'
  | 'info-soft'
  /** 非颜色令牌：驱动 `color-scheme`（浏览器原生控件/滚动条） */
  | 'color-scheme'
  // ---- 2D 图纸专用（SPEC §E.3） ----
  | 'plan-grid-minor'
  | 'plan-grid-major'
  | 'wall-bearing'
  | 'wall-bearing-hl'
  | 'wall-exterior'
  | 'wall-partition'
  | 'wall-low'
  | 'wall-low-stroke'
  | 'wall-demolished'
  | 'window'
  | 'door'
  | 'door-entry'
  | 'dim-line'
  | 'measure'
  | 'measure-pending'
  | 'snap-grid'
  | 'snap-corner'
  | 'room-label'
  | 'room-label-sub'
  | 'room-label-halo'
  | 'room-void';

export type ThemeTokens = Record<ThemeTokenName, string>;

/**
 * 令牌取色函数：给定令牌名返回**解析后的字面值**（`#rrggbb`）。
 * 2D 图层必须用它写 SVG **呈现属性**（SPEC §C.2 B9 / §F.6 R-EXP-1），
 * ⛔ 不得把 `var(--ds-*)` 写进 `fill` / `stroke`。
 */
export type TokenResolver = (name: ThemeTokenName) => string;

export interface ThemePresetMeta {
  id: ThemePresetId;
  zh: string;
  en: string;
  /** 供 `<meta name="theme-color">` 使用（取 surface） */
  themeColor: string;
}

/**
 * 对比度断言（SPEC §E.7）。`kind` 决定最低比值：
 * text/large → 4.5（large ≥18.66px bold 或 ≥24px），graphic → 3（图形/UI 边界）。
 */
export interface ContrastPair {
  id: string;
  fg: ThemeTokenName;
  bg: ThemeTokenName;
  min: number;
  kind: 'text' | 'large' | 'graphic';
}

// ---------------------------------------------------------------------------
// 3D 材质基色（SPEC §E.8 T1/T2）——运行时表在 `theme/material-palette.ts`
// ---------------------------------------------------------------------------

export interface MaterialPalette {
  wood: {
    oak: string;
    walnut: string;
  };
  metal: {
    base: string;
    chrome: string;
    hardware: string;
    black: string;
  };
  surface: {
    ceramic: string;
    mirror: string;
    glass: string;
    frame: string;
    cap: string;
    wall: string;
    skirt: string;
    edge: string;
  };
  light: {
    glow: string;
    screen: string;
  };
  fabric: {
    sofa: string;
    bed: string;
    rug: string;
  };
}

/** 必须随主题变化的场景级参数（SPEC §E.8 T3） */
export interface SceneThemeBinding {
  /** `scene.background` */
  background: string;
  /** `ground.material.color` */
  groundColor: string;
  /** `renderer.toneMappingExposure`（原 L3612：日 1.05 / 夜 1.25） */
  toneMappingExposure: number;
  /** `hemi.intensity` */
  hemiIntensity: number;
  /** `sun.color` */
  sunColor: string;
  /** `sun.intensity` */
  sunIntensity: number;
  /** `envMapIntensity` 系数（原 L3613 `envK`） */
  envK: number;
}
