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
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'tests/**/*.spec.ts'],
    globals: false,
    restoreMocks: true,
  },
});
