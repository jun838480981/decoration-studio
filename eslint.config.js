import vue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * ESLint 扁平配置。
 *
 * 这里的**模块边界规则直接对应 SPEC §C.2 的 B1–B9**，是并行开发（t4/t5/t6）不互相踩线的机器保证：
 *   B1  plan2d ⛔ scene3d，反之亦然
 *   B2  features/** 之间 ⛔ 互相 import；跨特性只能经 stores/** / types/** / utils/** / theme/**
 *   B3  hex 色值只允许出现在白名单文件（theme/**、features/plan2d/patterns.ts、data/materials.ts）
 *   B5  stores/** ⛔ import features/** 与 .vue
 *   B6  组件 ⛔ 直接读写 localStorage
 *   B7  组件 ⛔ 直接 addEventListener
 * 说明：B4（3D 内不得出现 hex）、B9（SVG 呈现属性不得写 var(--ds-*)）在**模板属性**上无法由 ESLint 完整覆盖，
 * 由 `scripts/verify.mjs` 的源码扫描作为第二道闸门（见该脚本的 checkHexWhitelist / checkNoCssVarInSvgAttr）。
 */

/** 允许出现十六进制色值的文件（SPEC §C.2 B3/B4 白名单） */
const HEX_WHITELIST = [
  'src/theme/**',
  'src/features/plan2d/patterns.ts',
  'src/data/materials.ts',
  'src/data/furniture-lib.ts',
];

const HEX_LITERAL_SELECTOR = String.raw`Literal[value=/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]`;

/** 生成「某特性目录不得 import 其它特性」的 no-restricted-imports 配置 */
function featureIsolation(selfDir, forbiddenDirs) {
  const patterns = forbiddenDirs.flatMap((dir) => [
    { group: [`@/features/${dir}`, `@/features/${dir}/*`], message: `B1/B2：${selfDir} 不得依赖 ${dir}（跨特性只能经 stores/types/utils/theme）` },
    { group: [`**/features/${dir}/**`], message: `B1/B2：${selfDir} 不得依赖 ${dir}（跨特性只能经 stores/types/utils/theme）` },
  ]);
  return {
    files: [`src/features/${selfDir}/**/*.{ts,vue}`],
    rules: {
      'no-restricted-imports': ['error', { patterns }],
    },
  };
}

export default tseslint.config(
  {
    // `.tools/` 是本地验证脚本目录（已被 .gitignore 忽略、不入库），
    // 里面是 CommonJS 诊断脚本，不适用项目的 ESM/TS 规则。
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      '.tools/**',
      '.esbuild-tmp/**',
    ],
  },

  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],

  {
    name: 'decoration-studio/vue-ts',
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },

  {
    name: 'decoration-studio/general',
    files: ['src/**/*.{ts,vue}', 'scripts/**/*.mjs'],
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      // 解构剔除字段的标准写法（`const { a: _a, ...rest } = obj`）会用 `_` 前缀占位，
      // 这类变量**本来就不该被使用**，因此必须放行，否则只能写 eslint-disable 注释。
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  // ---- B3/B4：hex 只允许出现在白名单 ----
  {
    name: 'decoration-studio/hex-single-source',
    files: ['src/**/*.{ts,vue}'],
    ignores: HEX_WHITELIST,
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: HEX_LITERAL_SELECTOR,
          message:
            'B3/B4：十六进制色值只能出现在 theme/**（tokens.ts / material-palette.ts）、features/plan2d/patterns.ts、data/materials.ts、data/furniture-lib.ts；请改用主题令牌（theme.resolve / deps.palette）。',
        },
      ],
    },
  },

  // ---- B1/B2：特性隔离 ----
  featureIsolation('plan2d', ['scene3d', 'extras']),
  featureIsolation('scene3d', ['plan2d', 'extras']),
  featureIsolation('extras', ['plan2d', 'scene3d']),

  // ---- B5：store 必须能在 Node 下单测 ----
  {
    name: 'decoration-studio/stores-pure',
    files: ['src/stores/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/features/*', '@/features/**', '**/features/**'], message: 'B5：stores/** 不得 import features/**（3D/2D 经 ports 注册，见 src/utils/scenePort.ts）' },
            { group: ['**/*.vue'], message: 'B5：stores/** 不得 import .vue 组件' },
          ],
        },
      ],
    },
  },

  // ---- B6/B7：组件不得直接碰 localStorage / addEventListener ----
  {
    name: 'decoration-studio/component-side-effects',
    files: ['src/components/**/*.{ts,vue}', 'src/features/**/*.{ts,vue}', 'src/App.vue'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'B6：只能经 src/utils/persistence.ts 读写存储' },
        { name: 'sessionStorage', message: 'B6：只能经 src/utils/persistence.ts 读写存储' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'addEventListener', message: 'B7：改用 @vueuse/core 的 useEventListener' },
        { object: 'document', property: 'addEventListener', message: 'B7：改用 @vueuse/core 的 useEventListener' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='addEventListener']",
          message: 'B7：改用 @vueuse/core 的 useEventListener',
        },
      ],
    },
  },

  // ---- 测试文件放宽（必须放在 component-side-effects 之后才能覆盖它） ----
  {
    name: 'decoration-studio/spec-relax',
    files: ['src/**/*.spec.ts'],
    rules: {
      // 测试需要直接操作 localStorage 来准备/清理夹具状态；B6 约束的是**组件**，不适用于测试。
      'no-restricted-globals': 'off',
    },
  },

  // 配置文件 / 脚本自身
  {
    name: 'decoration-studio/tooling',
    files: ['*.config.{ts,js,mjs}', 'scripts/**/*.mjs'],
    rules: {
      'no-console': 'off',
    },
  },

  prettier,
);
