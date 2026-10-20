#!/usr/bin/env node
/**
 * 工程自检入口（t3 交付；与 CWD 无关：根目录由脚本自身位置推导）。
 *
 * 用法（在任意目录都可以）：
 *   node scripts/verify.mjs          # 人类可读报告
 *   node scripts/verify.mjs --json   # 机器可读
 *
 * 职责边界：
 * - 本脚本做**结构性 / 契约性 / 白名单**检查，零依赖即可运行（`node_modules` 没装也能跑）；
 * - **对比度数值断言不在这里**：那由 `pnpm test`（`src/theme/contrast.spec.ts` + `colorjs.io`）裁决，
 *   因为 SPEC §B.4 红线 5 规定色彩/对比度数学必须用 colorjs.io，不得自研。
 * - ⛔ 不 spawn 子进程（受限沙箱下管道 stdio 会 EPERM），只做静态检查。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JSON_OUT = process.argv.includes('--json');
const results = [];

function read(relPath) {
  return readFileSync(join(ROOT, relPath), 'utf8');
}

function check(name, fn) {
  try {
    const detail = fn();
    results.push({ name, ok: true, detail: detail ?? '' });
  } catch (error) {
    results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const REQUIRED_FILES = [
  'package.json',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.node.json',
  'index.html',
  '.gitignore',
  '.prettierrc.json',
  'eslint.config.js',
  'README.md',
  'LICENSE',
  'scripts/verify.mjs',
  'src/main.ts',
  'src/App.vue',
  'src/env.d.ts',
  'src/theme/tokens.ts',
  'src/theme/material-palette.ts',
  'src/theme/contrast.ts',
  'src/theme/applyTheme.ts',
  'src/theme/useTheme.ts',
  'src/theme/base.css',
  'src/stores/plan.ts',
  'src/stores/layout.ts',
  'src/stores/ui.ts',
  'src/stores/theme.ts',
  'src/stores/toast.ts',
  'src/stores/index.ts',
  'src/components/index.ts',
  'src/types/index.ts',
  'src/types/theme.ts',
  'src/utils/persistence.ts',
  'docs/SPEC.md',
  'docs/ORIGINAL-FEATURES.md',
];

const REQUIRED_DIRS = [
  'docs',
  'scripts',
  'public/fonts',
  'public/textures',
  'src/types',
  'src/stores',
  'src/theme',
  'src/utils',
  'src/composables',
  'src/data',
  'src/components',
  'src/features/plan2d',
  'src/features/scene3d',
  'src/features/extras',
];

/** 禁止进入依赖树（SPEC §B.6 / §H.4 / ADR-12/ADR-14） */
const FORBIDDEN_DEPS = [
  'element-plus',
  'naive-ui',
  'konva',
  'interactjs',
  'moveable',
  'martinez-polygon-clipping',
  'rbush',
  'file-saver',
  'html-to-image',
  'modern-screenshot',
  'xlsx',
  'postprocessing',
  'three-bvh-csg',
  'three-mesh-bvh',
  'three-gpu-pathtracer',
  'three-pathfinding',
  'js-angusj-clipper',
  'dexie',
  'idb-keyval',
  'zod',
];

/** 冻结的版本策略（SPEC §H.1 / ADR-01 / ADR-15） */
const PINNED_DEPS = {
  three: '0.160.1',
  'polygon-clipping': '0.15.7',
};

const HEX_WHITELIST = [
  'src/theme/',
  'src/features/plan2d/patterns.ts',
  'src/data/materials.ts',
  'src/data/furniture-lib.ts',
];

const HEX_PATTERN = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;

/**
 * 剥离注释后再做 hex 扫描（C-7 修复）。
 *
 * 为什么必须剥离：闸门最初按「整行原文」匹配，于是把
 * ① 注释里为追溯来源而引用的原 HTML 色值（如 content-colors.ts 的 `'#2a2724'`）；
 * ② CSS 选择器里的 `#fab` 这类 id 选择器（会被 `{3,4}` 分支误判成 3 位 hex）
 * 都算成「硬编码色值」，产生假阳性，逼下游删掉有价值的来源注释。
 * 真实缺陷（代码体里的字面色值）仍然必须被拦下 —— 见本文件底部的两向自测。
 */
function stripComments(source, ext) {
  // 关键：把注释替换为**等量换行**，保持行号与原文一致，否则报错行号会偏移、难以定位。
  const keepNewlines = (text) => text.replace(/[^\n]/g, '');
  let out = source;
  // 块注释 /* ... */
  out = out.replace(/\/\*[\s\S]*?\*\//g, (m) => keepNewlines(m));
  // 行注释 // ...（前面不是冒号，避免误伤 url(https://…)）
  out = out.replace(/(^|[^:])(\/\/[^\n]*)/g, (_m, pre, comment) => pre + keepNewlines(comment));
  // .vue 模板注释
  if (ext === 'vue') out = out.replace(/<!--[\s\S]*?-->/g, (m) => keepNewlines(m));
  return out;
}

/**
 * CSS 选择器形态的 `#id` 不是颜色。
 * 仅当 `#` 后的标识符**不像** 3/4/6/8 位纯十六进制时才剥离，避免漏掉真实色值。
 */
function stripIdSelectors(source) {
  // 歧义点：`#fab` / `#abc` / `#def` 这类既是合法 3 位 hex，也常被用作 id 选择器。
  // 判据（按优先级）：
  //  ① 后随选择器分隔符（`,` `{` `}` `[` `)` `>` `+` `~`）→ 视为 id 选择器，剥离；
  //  ② 其余按「像 hex 就保留」，宁可误报也不漏报真实色值。
  return source.replace(/#([A-Za-z_][\w-]*)/g, (match, body, offset, whole) => {
    const isHexChars = /^[0-9a-fA-F]+$/.test(body) && [3, 4, 6, 8].includes(body.length);
    if (!isHexChars) return '';
    const after = whole.slice(offset + match.length);
    if (/^\s*[,{}\[)\]>+~]/.test(after)) return '';
    return match;
  });
}

/** 逐行扫描 hex，返回违规行号（1-based） */
function findHexViolations(source, ext) {
  const cleaned = stripIdSelectors(stripComments(source, ext));
  const violations = [];
  cleaned.split(/\r?\n/).forEach((line, index) => {
    if (HEX_PATTERN.test(line)) violations.push(index + 1);
  });
  return violations;
}

/** store / theme 必须保留的冻结标识（SPEC §D 🔒；改名即 RISK-01） */
const REQUIRED_IDENTIFIERS = {
  'src/stores/plan.ts': [
    'PRESET_ORDER',
    'UNDO_STRUCT_LIMIT',
    'PLAN_FMT',
    'PLAN_SET_FMT',
    'PLAN_STORE_KEY',
    'levelData',
    'structHistory',
    'planEdit',
    'planUndo',
    'switchTo',
    'switchLevel',
    'ensureCustom',
    'newBlankPlan',
    'duplicatePlan',
    'deletePlan',
    'renamePlan',
    'exportPlan',
    'exportAll',
    'importText',
    'findPlan',
  ],
  'src/stores/layout.ts': [
    'UNDO_LIMIT',
    'LEGACY_STORE_KEY',
    'stateKey',
    'stateKeyOf',
    'getF',
    'snapRects',
    'totalArea',
    'roomRows',
    'materialBreakdown',
    'flooringCost',
    'demolishedLength',
    'canUndo',
    'canRedo',
    'snapshot',
    'commit',
    'mutate',
    'undo',
    'redo',
    'save',
    'loadFor',
    'defaultState',
    'fixState',
    'syncRoomState',
    'autoFurnish',
    'addItem',
    'pushOut',
    'toggleWall',
    'clearLayout',
    'rotateSelection',
    'deleteSelection',
    'duplicateSelection',
    'nudgeSelection',
    'bringToFront',
    'sendToBack',
    'selectRoom',
    'renameRoom',
    'setRoomMaterial',
    'pushMeasure',
    'clearMeasures',
  ],
  'src/stores/ui.ts': [
    'MIN_SCALE',
    'MAX_SCALE',
    'PX_MM',
    'TAP_PX',
    'layers',
    'measureA',
    'measureCur',
    'flags',
    'view',
    'edit',
    'viewMode',
    'view3d',
    'panes',
    'switching',
    'is3D',
    'ratio',
    'ratioLabel',
    'scaleBar',
    'setTool',
    'select',
    'toggleLayer',
    'applyView',
    'fitView',
    'zoomAt',
    'zoomCenter',
    'setRatio',
    'startEdit',
    'endEdit',
    'setEditMode',
    'setEditKind',
    'setEditParam',
    'setSnap',
    'toggleOrtho',
    'openDrawer',
    'setViewMode',
    'set3dOption',
  ],
  'src/stores/theme.ts': ['THEME_STORE_KEY', 'presetId', 'tokens', 'setPreset', 'applyCssVars', 'resolve'],
  'src/types/scene3d.ts': ['Scene3DApi', 'SceneSignatures', 'enter', 'exit', 'shot', 'groundAt', 'flyToRoom', 'walking', 'relabel'],
  'src/theme/contrast.ts': ['ContrastPair', 'CONTRAST_ASSERTIONS', 'contrastRatio'],
};

/** SPEC §E.7 要求必须存在的断言 id（覆盖 13 组最低要求） */
const REQUIRED_ASSERTION_IDS = [
  'text-on-surface',
  'text-on-bg',
  'text-secondary-on-surface',
  'text-muted-on-surface',
  'text-muted-on-bg',
  'on-accent-on-accent',
  'accent-on-surface',
  'accent-on-accent-soft',
  'border-strong-on-surface',
  'border-strong-on-bg',
  'focus-ring-on-surface',
  'success-on-surface',
  'warning-on-surface',
  'danger-on-surface',
  'info-on-surface',
];

/** 从 tokens.ts 里解析三套预设的键值（DAY / NIGHT / CONTRAST 三个对象字面量） */
function parsePresetTokens() {
  const source = read('src/theme/tokens.ts');
  const presets = {};
  for (const constName of ['DAY', 'NIGHT', 'CONTRAST']) {
    const block = source.match(new RegExp(`const ${constName}: ThemeTokens = \\{([\\s\\S]*?)\\n\\};`));
    if (!block) throw new Error(`tokens.ts 中找不到 const ${constName}: ThemeTokens = { … } 区块`);
    const tokens = {};
    for (const match of block[1].matchAll(/(['"]?)([\w-]+)\1:\s*'([^']*)'/g)) {
      tokens[match[2]] = match[3];
    }
    presets[constName] = tokens;
  }
  return presets;
}

// ---------------------------------------------------------------------------
// 静态解析工具（C-1 回归守卫用；**纯文本处理**，⛔ 不依赖 node_modules / 编译器）
//
// 背景（C-1，docs/VERIFY-T7-STATIC.md）：`src/stores/ui.ts` 曾 `import { MIN_SCALE, MAX_SCALE, PX_MM, TAP_PX }
// from '@/composables/usePointerKind'`，但该文件从未定义前三个符号 → typecheck/build 全数失败。
// 旧的「冻结标识」检查是**子串匹配**，`MIN_SCALE` 作为 import 文本出现即被视为"存在"，所以漏检。
// 下面两条守卫改成**声明级**断言：①冻结符号必须有自己的 export 声明；②任何 import 的名字都必须在目标模块里存在。
// ---------------------------------------------------------------------------

/** 收集一个模块的导出名（`export const X` / `export function X` / `export { X as Y }` / `export type { X }` …） */
function collectExportedNames(source) {
  const names = new Set();
  const declarationRe =
    /\bexport\s+(?:declare\s+)?(?:async\s+)?(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  for (const match of source.matchAll(declarationRe)) names.add(match[1]);

  const namedRe = /\bexport\s+(?:type\s+)?\{([^}]*)\}/g;
  for (const match of source.matchAll(namedRe)) {
    for (const piece of match[1].split(',')) {
      const parts = piece.trim().split(/\s+as\s+/);
      const exported = (parts[1] ?? parts[0]).trim();
      if (/^[A-Za-z_$][\w$]*$/.test(exported)) names.add(exported);
    }
  }

  for (const match of source.matchAll(/\bexport\s+(?:type\s+)?\*\s+as\s+([A-Za-z_$][\w$]*)\s+from/g)) {
    names.add(match[1]);
  }
  return names;
}

/** 收集 `import { a, b as c, type D } from 'spec'` 里的**被导入名**（忽略 default / namespace 导入） */
function collectImports(source) {
  const out = [];
  // 先剥离注释：文档注释里常写「下游统一 `import { useXxxStore } from '@/stores'`」这类示例，
  // 若不剥离会被当成真实 import 而误报「未定义的符号」（C-1 守卫的假阳性来源之一）。
  const clean = stripComments(source, 'ts');
  const importRe = /import\s+(?:type\s+)?(?:[A-Za-z_$][\w$]*\s*,?\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  for (const match of clean.matchAll(importRe)) {
    const names = match[1]
      .split(',')
      .map((piece) =>
        piece
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)[0]
          .trim(),
      )
      .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
    if (names.length > 0) out.push({ names, specifier: match[2] });
  }
  return out;
}

/** 解析为真实存在的文件（尝试扩展名与目录 index） */
function firstExistingFile(base) {
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.vue`, `${base}.d.ts`, join(base, 'index.ts')];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** `@/x/y` → `{ abs }`；非 `@/` 说明符返回 null（包依赖 / 相对路径不属本守卫范围） */
function resolveAliasSpecifier(specifier) {
  if (!specifier.startsWith('@/')) return null;
  return { abs: firstExistingFile(join(ROOT, 'src', specifier.slice(2))) };
}

/** 递归解析导出名（跟随 `export * from './x'` / `export type * from './x'` 展开 barrel） */
function collectExportedNamesDeep(absPath, seen = new Set()) {
  if (!absPath || !existsSync(absPath)) return null;
  if (seen.has(absPath)) return new Set();
  seen.add(absPath);
  const source = readFileSync(absPath, 'utf8');
  const names = collectExportedNames(source);
  for (const match of source.matchAll(/export\s+(?:type\s+)?\*\s+from\s*['"](\.[^'"]+)['"]/g)) {
    const child = firstExistingFile(resolve(dirname(absPath), match[1]));
    const childNames = collectExportedNamesDeep(child, seen);
    if (childNames) for (const name of childNames) names.add(name);
  }
  return names;
}

/**
 * 冻结导出面（SPEC §D.7 / §D.8 / §E 的跨模块契约）。
 * 这些符号必须**在其规范文件里**有 export 声明；只出现在注释 / import 行里不算（这正是 C-1 的形态）。
 */
const FROZEN_EXPORTS = {
  'src/stores/ui.ts': [
    'MIN_SCALE',
    'MAX_SCALE',
    'PX_MM',
    'TAP_PX',
    'SCALE_BAR_STEPS',
    'layers',
    'useUiStore',
  ],
  'src/stores/plan.ts': [
    'PRESET_ORDER',
    'UNDO_STRUCT_LIMIT',
    'PLAN_FMT',
    'PLAN_SET_FMT',
    'PLAN_STORE_KEY',
    'usePlanStore',
  ],
  'src/stores/layout.ts': ['UNDO_LIMIT', 'LEGACY_STORE_KEY', 'stateKey', 'stateKeyOf', 'useLayoutStore'],
  'src/stores/theme.ts': ['THEME_STORE_KEY', 'useThemeStore'],
  'src/stores/toast.ts': ['TOAST_DEFAULT_TTL', 'useToastStore'],
  'src/theme/tokens.ts': [
    'THEME_PRESET_IDS',
    'THEME_TOKEN_NAMES',
    'PLAN_TOKEN_NAMES',
    'UI_TOKEN_NAMES',
    'DECORATIVE_TOKEN_NAMES',
    'THEMES',
    'THEME_PRESETS',
    'isThemePresetId',
    'DEFAULT_THEME_PRESET_ID',
  ],
  'src/theme/applyTheme.ts': [
    'CSS_VAR_PREFIX',
    'tokenToCssVar',
    'tokensToCssVars',
    'applyCssVars',
    'resolveToken',
    'resolveTokens',
    'syncThemeColorMeta',
    'readCssVar',
  ],
  'src/theme/contrast.ts': [
    'MIN_TEXT_CONTRAST',
    'MIN_GRAPHIC_CONTRAST',
    'ASSERTION_PAIRS',
    'CONTRAST_ASSERTIONS',
    'contrastRatio',
    'evaluateContrastPreset',
    'evaluateAllContrast',
    'failedContrast',
  ],
  'src/theme/material-palette.ts': [
    'MATERIAL_PALETTES',
    'SCENE_THEME_BINDINGS',
    'NIGHT_LIGHTING_OVERRIDE',
    'PALETTE_KEY_PATHS',
    'resolveSceneTheme',
    'paletteHex',
    'flattenPalette',
  ],
  'src/theme/useTheme.ts': ['useTheme', 'initTheme', 'resolveThemeToken', 'themeTokensOf'],
  'src/utils/persistence.ts': [
    'STORAGE_KEYS',
    'stateKey',
    'stateKeyOf',
    'readRaw',
    'readJson',
    'writeRaw',
    'writeJson',
    'removeKey',
    'readPlanLibrary',
    'writePlanLibrary',
    'readPlanState',
    'writePlanState',
    'migrateLegacy',
    'removePlanState',
  ],
  'src/utils/scenePort.ts': ['registerScene3D', 'getScene3DApi', 'useScene3DApi', 'isScene3DReady'],
  'src/utils/id.ts': ['uid', 'newPlanId'],
  'src/composables/usePointerKind.ts': ['COARSE', 'TAP_PX', 'usePointerKind'],
  'src/composables/useResizeFit.ts': ['stageSize', 'useResizeFit'],
  'src/data/presets/index.ts': ['PRESETS', 'BLANK_PLAN'],
};

/**
 * import 名字解析守卫作用的目标模块（契约层）。
 * 说明：`features/**` 与 `components/**` 是三条并行线正在写入的区域，其**内部**相对导入不在本守卫范围，
 * 避免对未完成模块产生假失败；但这三条线**从契约层取名字**依然受检（因为目标是 stores/theme/utils/…）。
 */
const IMPORT_TARGET_PREFIXES = ['src/stores', 'src/theme', 'src/utils', 'src/composables', 'src/data', 'src/types'];

/**
 * 检查一段源码里的 `@/…` import 名字是否都能在目标模块里找到。
 * 被 Guard B（全仓扫描）与「C-1 自测」复用，保证**自测与实战走同一条判定路径**。
 * @returns {{ problems: string[], pending: string[], checked: number }} pending = 目标模块尚未创建（跳过）
 */
function checkImportSpecifiers(source, rel) {
  const problems = [];
  const pending = [];
  let checked = 0;
  for (const { names, specifier } of collectImports(source)) {
    if (!specifier.startsWith('@/')) continue; // 包依赖 / 相对路径：不在守卫范围
    const modulePath = `src/${specifier.slice(2)}`;
    if (!IMPORT_TARGET_PREFIXES.some((prefix) => modulePath === prefix || modulePath.startsWith(`${prefix}/`))) {
      continue;
    }
    const target = resolveAliasSpecifier(specifier);
    const exported = target ? collectExportedNamesDeep(target.abs) : null;
    if (!exported) {
      pending.push(`${rel} → ${specifier}`);
      continue;
    }
    for (const name of names) {
      checked += 1;
      if (!exported.has(name)) problems.push(`${rel} ⇢ ${specifier} ⇢ ${name} 未定义`);
    }
  }
  return { problems, pending, checked };
}

// ---------------------------------------------------------------------------
// 检查项
// ---------------------------------------------------------------------------

check('必需文件齐全', () => {
  const missing = REQUIRED_FILES.filter((file) => !existsSync(join(ROOT, file)));
  assert(missing.length === 0, `缺失：${missing.join(', ')}`);
  return `${REQUIRED_FILES.length} 个文件`;
});

check('必需目录齐全', () => {
  const missing = REQUIRED_DIRS.filter((dir) => !statSync(join(ROOT, dir)).isDirectory());
  assert(missing.length === 0, `缺失：${missing.join(', ')}`);
  return REQUIRED_DIRS.join(', ');
});

check('package.json 依赖集 = SPEC §H 收敛集', () => {
  const pkg = JSON.parse(read('package.json'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const required = [
    'vue',
    'pinia',
    'vue-i18n',
    '@vueuse/core',
    'three',
    '@types/three',
    'colorjs.io',
    '@material/material-color-utilities',
    'papaparse',
    'exceljs',
    'dxf-writer',
    'polygon-clipping',
    'earcut',
    'vite',
    '@vitejs/plugin-vue',
    'typescript',
    'vue-tsc',
    'vitest',
    '@vue/test-utils',
    'eslint',
    'eslint-plugin-vue',
    'prettier',
  ];
  const missing = required.filter((name) => !deps[name]);
  assert(missing.length === 0, `缺少依赖：${missing.join(', ')}`);
  const forbidden = FORBIDDEN_DEPS.filter((name) => name in deps);
  assert(forbidden.length === 0, `出现了 SPEC §H.4 明确不引入的包：${forbidden.join(', ')}`);
  for (const [name, version] of Object.entries(PINNED_DEPS)) {
    assert(deps[name] === version, `${name} 必须精确锁 ${version}（当前 ${deps[name]}）`);
  }
  return `${Object.keys(deps).length} 个依赖`;
});

check('package.json 脚本齐全且与 CWD 无关', () => {
  const pkg = JSON.parse(read('package.json'));
  const scripts = pkg.scripts ?? {};
  for (const name of ['dev', 'build', 'preview', 'typecheck', 'test', 'lint', 'format', 'verify']) {
    assert(scripts[name], `缺少脚本 ${name}`);
  }
  const bad = Object.entries(scripts).filter(([, cmd]) => /\bcd\b/.test(cmd) || /[A-Za-z]:[\\/]/.test(cmd));
  assert(bad.length === 0, `脚本里出现 cd 或写死盘符：${bad.map(([k]) => k).join(', ')}`);
  return Object.keys(scripts).length + ' 条脚本';
});

check('路径别名 @ 在 vite 与 tsconfig 中一致', () => {
  const vite = read('vite.config.ts');
  const tsconfig = JSON.parse(read('tsconfig.json'));
  assert(vite.includes("'@'") && vite.includes("./src"), 'vite.config.ts 缺少 @ → ./src 别名');
  assert(tsconfig.compilerOptions?.paths?.['@/*']?.[0] === './src/*', 'tsconfig.json 的 @/* 未指向 ./src/*');
  return '@/* → src/*';
});

check('主题令牌：三套预设键集合一致 + 合法 hex', () => {
  const presets = parsePresetTokens();
  const names = Object.keys(presets.DAY);
  assert(names.length > 40, `令牌数异常偏少：${names.length}`);
  for (const constName of ['NIGHT', 'CONTRAST']) {
    assert(
      Object.keys(presets[constName]).length === names.length,
      `${constName} 的键数与 DAY 不一致（${Object.keys(presets[constName]).length} vs ${names.length}）`,
    );
    const missing = names.filter((name) => !(name in presets[constName]));
    assert(missing.length === 0, `${constName} 缺少令牌：${missing.join(', ')}`);
  }
  const invalid = [];
  for (const [constName, tokens] of Object.entries(presets)) {
    for (const [name, value] of Object.entries(tokens)) {
      if (name === 'color-scheme') {
        if (!['light', 'dark'].includes(value)) invalid.push(`${constName}/${name}=${value}`);
        continue;
      }
      if (!/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) {
        invalid.push(`${constName}/${name}=${value}`);
      }
    }
  }
  assert(invalid.length === 0, `非法色值：${invalid.join(', ')}`);
  return `3 套 × ${names.length} 项`;
});

check('主题层：运行时清单与类型联动', () => {
  const tokensTs = read('src/theme/tokens.ts');
  const typesTs = read('src/types/theme.ts');
  const runtimeNames = [...tokensTs.matchAll(/^\s*'([a-z0-9-]+)',$/gm)].map((m) => m[1]);
  assert(runtimeNames.length > 40, `THEME_TOKEN_NAMES 解析异常：${runtimeNames.length} 项`);
  const unionBlock = typesTs.match(/export type ThemeTokenName =([\s\S]*?);/);
  assert(unionBlock, 'types/theme.ts 中找不到 ThemeTokenName 联合类型');
  const typeNames = [...unionBlock[1].matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
  const missingInRuntime = [...new Set(typeNames)].filter((name) => !runtimeNames.includes(name));
  assert(
    missingInRuntime.length === 0,
    `types/theme.ts 里有令牌没进 THEME_TOKEN_NAMES：${missingInRuntime.join(', ')}`,
  );
  const missingInType = [...new Set(runtimeNames)].filter((name) => !typeNames.includes(name));
  assert(missingInType.length === 0, `THEME_TOKEN_NAMES 里有令牌不在类型里：${missingInType.join(', ')}`);
  return `${typeNames.length} 个令牌（类型 ⇄ 运行时一致）`;
});

check('主题层：CSS 变量前缀与 resolve 出口齐备', () => {
  const apply = read('src/theme/applyTheme.ts');
  assert(apply.includes("'--ds-'"), 'applyTheme.ts 未定义 --ds- 前缀');
  assert(apply.includes('tokenToCssVar') && apply.includes('resolveToken'), 'applyTheme.ts 缺少取色出口');
  const useTheme = read('src/theme/useTheme.ts');
  assert(useTheme.includes('export function useTheme'), 'useTheme.ts 未导出 useTheme()');
  return '--ds-* + useTheme()';
});

check('主题层：3D 材质基色唯一来源存在且被 3D 引用', () => {
  const palette = read('src/theme/material-palette.ts');
  for (const group of ['wood', 'metal', 'surface', 'light', 'fabric']) {
    assert(palette.includes(`${group}:`), `material-palette.ts 缺少 ${group} 分组`);
  }
  const sceneBindingFields = [
    'background',
    'groundColor',
    'toneMappingExposure',
    'hemiIntensity',
    'sunColor',
    'sunIntensity',
    'envK',
  ];
  for (const field of sceneBindingFields) {
    assert(palette.includes(field), `material-palette.ts 缺少场景联动字段 ${field}`);
  }
  const sceneIndex = read('src/features/scene3d/index.ts');
  assert(sceneIndex.includes("theme/material-palette"), 'features/scene3d 未引用 material-palette');
  return 'palette + scene binding';
});

check('hex 白名单：十六进制只出现在 theme/**、patterns.ts、data/materials.ts', () => {
  const violations = [];
  for (const file of walk(join(ROOT, 'src'))) {
    const rel = relative(ROOT, file).split('\\').join('/');
    if (!/\.(ts|vue|css)$/.test(rel)) continue;
    if (HEX_WHITELIST.some((allowed) => rel.startsWith(allowed))) continue;
    // 测试文件豁免：`.spec.ts` 里的色值是**测试夹具**（用于断言渲染/导出结果），
    // 不是产品配色来源，不应受"色值必须走令牌"的约束（否则会逼测试删掉有意义的假数据）。
    if (/\.spec\.ts$/.test(rel)) continue;
    const ext = rel.endsWith('.vue') ? 'vue' : rel.endsWith('.css') ? 'css' : 'ts';
    // 剥离注释与 #id 选择器后再判（C-7：避免把来源注释 / CSS 选择器误判为硬编码色值）
    for (const lineNo of findHexViolations(readFileSync(file, 'utf8'), ext)) {
      violations.push(`${rel}:${lineNo}`);
    }
  }
  assert(violations.length === 0, `非白名单文件出现 hex：${violations.join(', ')}`);
  return '0 处越界';
});

// C-7 两向自测：注释内 hex 不得报错；代码体内 hex 必须报错。
check('hex 闸门两向自测：注释豁免、代码体拦截（C-7）', () => {
  const commentOnly = '// 原值 #2a2724 仅作来源记录\nconst a = 1;\n/* #3c3a37 */';
  assert(findHexViolations(commentOnly, 'ts').length === 0, '注释内的 hex 被误判为违规');
  const selectorOnly = 'aside.open,#fab,[data-floating] { color: red }';
  assert(findHexViolations(selectorOnly, 'css').length === 0, '#id 选择器被误判为 hex 色值');
  const selectorInString = "el.closest('aside.open,#fab,[data-floating]')";
  assert(findHexViolations(selectorInString, 'ts').length === 0, '字符串里的选择器文本被误判为 hex');
  const realHex = "const c = '#2a2724';";
  assert(findHexViolations(realHex, 'ts').length === 1, '代码体里的 hex 未被拦下');
  const realHexVue = '<div :style="{ color: \'#fff\' }"></div>';
  assert(findHexViolations(realHexVue, 'vue').length === 1, '.vue 模板里的 hex 未被拦下');
  return '注释豁免 / 选择器豁免 / 代码体拦截 共 5 例通过';
});

check('SVG 呈现属性不得写 CSS 变量（B9 / R-EXP-1）', () => {
  const violations = [];
  for (const file of walk(join(ROOT, 'src'))) {
    const rel = relative(ROOT, file).split('\\').join('/');
    if (!/^(src\/features\/plan2d|src\/features\/extras)\/.*\.(ts|vue)$/.test(rel)) continue;
    const ext = rel.endsWith('.vue') ? 'vue' : 'ts';
    // 同样先剥离注释：注释里说明「为什么不写 var(--ds-…)」不应被当成违规
    const cleaned = stripComments(readFileSync(file, 'utf8'), ext);
    cleaned.split(/\r?\n/).forEach((line, index) => {
      if (/(fill|stroke|stop-color|flood-color|color)\s*[=:]\s*['"]var\(--ds-/.test(line)) {
        violations.push(`${rel}:${index + 1}`);
      }
    });
  }
  assert(violations.length === 0, `SVG 属性用了 CSS 变量：${violations.join(', ')}`);
  return '0 处越界';
});

check('冻结签名/标识未被改名（RISK-01）', () => {
  const problems = [];
  for (const [file, identifiers] of Object.entries(REQUIRED_IDENTIFIERS)) {
    const source = read(file);
    for (const id of identifiers) {
      if (!source.includes(id)) problems.push(`${file} ⇢ ${id}`);
    }
  }
  assert(problems.length === 0, `缺少冻结标识：${problems.join('; ')}`);
  return `${Object.keys(REQUIRED_IDENTIFIERS).length} 个文件`;
});

check('冻结导出面：每个冻结符号在其规范文件里都有 export 声明（C-1 回归守卫 A）', () => {
  const problems = [];
  let checked = 0;
  for (const [file, names] of Object.entries(FROZEN_EXPORTS)) {
    const exported = collectExportedNamesDeep(join(ROOT, file));
    assert(exported !== null, `规范文件不存在：${file}`);
    for (const name of names) {
      checked += 1;
      if (!exported.has(name)) problems.push(`${file} ⇢ ${name} 没有 export 声明`);
    }
  }
  assert(problems.length === 0, `冻结符号缺 export：${problems.join('; ')}`);
  return `${checked} 个冻结符号 / ${Object.keys(FROZEN_EXPORTS).length} 个规范文件`;
});

check('import 名字可解析：禁止 import 从未定义的符号（C-1 回归守卫 B）', () => {
  const problems = [];
  const pendingModules = [];
  let checked = 0;
  for (const file of walk(join(ROOT, 'src'))) {
    const rel = relative(ROOT, file).split('\\').join('/');
    if (!/\.(ts|vue)$/.test(rel)) continue;
    const outcome = checkImportSpecifiers(readFileSync(file, 'utf8'), rel);
    problems.push(...outcome.problems);
    pendingModules.push(...outcome.pending);
    checked += outcome.checked;
  }
  const pendingNote =
    pendingModules.length > 0
      ? `；⚠️ 跳过 ${pendingModules.length} 处目标模块尚未创建：${pendingModules.slice(0, 5).join('; ')}${
          pendingModules.length > 5 ? ' …' : ''
        }`
      : '';
  assert(problems.length === 0, `无法解析的 import（构建必然失败）：${problems.join('; ')}${pendingNote}`);
  return `${checked} 个被导入名全部可在目标模块中找到${pendingNote}`;
});

check('C-1 自测：反例（import 从未定义的符号）必须被守卫检出、正例不得误报', () => {
  // 反例 = C-1 的原始形态（当时 stores/ui.ts:9 就是这样写的）
  const counterExample = [
    "import { MIN_SCALE, MAX_SCALE, PX_MM, TAP_PX } from '@/composables/usePointerKind';",
    'export const selftestCounterExample = true;',
  ].join('\n');
  const counterOutcome = checkImportSpecifiers(counterExample, 'src/__c1-selftest__.ts');
  const detected = counterOutcome.problems.filter((line) => /MIN_SCALE|MAX_SCALE|PX_MM/.test(line));
  assert(
    detected.length === 3,
    `守卫未能检出反例（检出 ${detected.length}/3）→ 说明守卫失效：${counterOutcome.problems.join('; ') || '无任何问题'}`,
  );

  // 正例 = 修复后的真实写法（只取存在的符号），守卫必须**不**报错，否则说明正则过宽
  const positiveExample = "import { COARSE, TAP_PX } from '@/composables/usePointerKind';";
  const positiveOutcome = checkImportSpecifiers(positiveExample, 'src/__c1-selftest__.ts');
  assert(
    positiveOutcome.problems.length === 0,
    `正例被误报（守卫过宽）：${positiveOutcome.problems.join('; ')}`,
  );

  return '反例 3/3 检出，正例 0 误报';
});

check('对比度断言表覆盖 SPEC §E.7 必测组合', () => {
  const source = read('src/theme/contrast.ts');
  assert(source.includes("from 'colorjs.io'"), 'contrast.ts 必须用 colorjs.io 做裁决（红线 5）');
  const missing = REQUIRED_ASSERTION_IDS.filter((id) => !source.includes(id));
  assert(missing.length === 0, `断言表缺少：${missing.join(', ')}`);
  assert(/PLAN_TOKEN_NAMES/.test(source), '断言表未覆盖 2D 图纸令牌（§E.7 第 13 条）');
  return `${REQUIRED_ASSERTION_IDS.length} 组必测 + 2D 令牌`;
});

check('装饰豁免清单是封闭 4 项，且矮墙描边仍在断言集（RISK-17 / C-2）', () => {
  const tokens = read('src/theme/tokens.ts');
  const block = tokens.match(/export const DECORATIVE_TOKEN_NAMES[^=]*=\s*\[([\s\S]*?)\];/);
  assert(block, 'tokens.ts 中找不到 DECORATIVE_TOKEN_NAMES 数组字面量');
  const names = [...block[1].matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]).sort();
  assert(
    JSON.stringify(names) === JSON.stringify(['border', 'plan-grid-major', 'plan-grid-minor', 'wall-low']),
    `装饰豁免清单必须恰好是 border / plan-grid-minor / plan-grid-major / wall-low（当前：${names.join(', ')}）`,
  );
  // 矮墙**描边**承载语义：必须仍在 2D 令牌集里（从而被 contrast.ts 的生成器纳入断言）
  assert(
    /PLAN_ONLY_TOKEN_NAMES[\s\S]*?'wall-low-stroke'/.test(tokens),
    'PLAN_ONLY_TOKEN_NAMES 必须包含 wall-low-stroke（C-2：只豁免填充，描边照常断言 ≥3:1）',
  );
  const contrast = read('src/theme/contrast.ts');
  assert(
    /DECORATIVE_TOKEN_NAMES\.includes\(name\)/.test(contrast),
    'contrast.ts 的 2D 断言生成器必须按 DECORATIVE_TOKEN_NAMES 过滤（否则 wall-low 填充会被拿去断言 ≥3）',
  );
  return '4 项豁免 + wall-low-stroke 仍在断言集';
});

check('持久化键逐字冻结（SPEC §D.8）', () => {
  const source = read('src/utils/persistence.ts');
  const keys = [
    'huxing-lang',
    'huxing-panes',
    'huxing-plans-v1',
    'huxing-state-v2-',
    'huxing-design-v1',
    'huxing-theme-v1',
  ];
  const missing = keys.filter((key) => !source.includes(key));
  assert(missing.length === 0, `缺少键：${missing.join(', ')}`);
  const others = [...read('src/stores/index.ts').matchAll(/'huxing-[a-z0-9-]+'/g)].map((m) => m[0]);
  assert(others.length === 0, `store 出口里出现了裸键名（应统一在 persistence.ts）：${others.join(', ')}`);
  return keys.length + ' 个键';
});

check('README 记录准确的命令（含 pwsh 不可用时的替代路径）', () => {
  const readme = read('README.md');
  for (const cmd of ['pnpm install', 'pnpm dev', 'pnpm build', 'pnpm test', 'pnpm verify']) {
    assert(readme.includes(cmd), `README 缺少命令：${cmd}`);
  }
  assert(/未验证|pwsh/.test(readme), 'README 必须写明本机 pwsh 不可用时的处理方式（SPEC §G.1.1）');
  return 'README 命令段落就绪';
});

check('依赖是否已安装（信息项）', () => {
  const installed = existsSync(join(ROOT, 'node_modules'));
  const locked = existsSync(join(ROOT, 'pnpm-lock.yaml'));
  return installed ? `node_modules 存在；pnpm-lock.yaml ${locked ? '存在' : '缺失'}` : '⚠️ 未安装（未验证：依赖与构建尚未跑过）';
});

// ---------------------------------------------------------------------------
// 输出
// ---------------------------------------------------------------------------

const failed = results.filter((r) => !r.ok);

if (JSON_OUT) {
  process.stdout.write(`${JSON.stringify({ root: ROOT, ok: failed.length === 0, results }, null, 2)}\n`);
} else {
  console.log(`\n工程自检：${ROOT}\n`);
  for (const result of results) {
    console.log(`${result.ok ? '✓' : '✗'} ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
  }
  console.log(
    `\n${failed.length === 0 ? '全部通过' : `${failed.length} 项失败`}；对比度数值断言请运行 \`pnpm test\`（colorjs.io 裁决）。`,
  );
}

process.exit(failed.length === 0 ? 0 : 1);