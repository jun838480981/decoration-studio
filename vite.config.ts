import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

/**
 * Vite / Vitest 统一配置。
 *
 * 契约要点（SPEC §C）：
 * - `@` 别名必须与 `tsconfig.json` 的 `paths` 完全一致（`@/*` → `src/*`），否则下游三路会各写各的相对路径。
 * - `base: './'`：产物可放在任意子路径下打开（导出/离线预览都靠它）。
 * - 测试环境默认 `node`；需要 DOM 的用例在文件头写 `// @vitest-environment jsdom`。
 * - ⛔ 不要在这里加 `manualChunks` 指定当前还未被引用的包（如 `three`），rollup 会因为图里找不到模块而报错；
 *   three 的分包在 t5 接入后按需再加。
 */
export default defineConfig({
  plugins: [vue()],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  preview: {
    port: 4173,
  },
  build: {
    // `es2022` 会让 esbuild 对部分语法做降级转译；在 Windows 上，esbuild 0.28.2 的
    // `vite:esbuild-transpile` 删除临时文件时偶发 `Access is denied`（文件句柄竞争），
    // 表现为构建失败但代码本身无错（逐文件转译全部通过）。改用 `esnext` 后不再需要
    // 语法降级，绕开该路径；现代浏览器目标也符合本项目（Vue3 + WebGL2）的定位。
    target: 'esnext',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    // 只跑单元测试（`src/**`）。E2E 在 `tests/e2e/**`，由 Playwright 跑（`pnpm test:e2e`）——
    // 二者运行器不同，混在一起会让 vitest 试图加载 Playwright 的 `test()` 而报错。
    include: ['src/**/*.spec.ts'],
    globals: false,
    restoreMocks: true,
  },
});
