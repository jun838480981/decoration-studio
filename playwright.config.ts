import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 配置（仅用于 `tests/e2e/**`）。
 *
 * 与 vitest 的分工：
 * - `vitest`（`pnpm test`）：单元测试，node/jsdom 环境，快
 * - `playwright`（`pnpm test:e2e`）：真实浏览器，验证渲染与装配
 *
 * **用本机 Chrome**（不下载 Playwright 自带浏览器）：
 * 通过 `channel: 'chrome'` 让 Playwright 使用系统安装的 Chrome。
 * 若机器上没有 Chrome，可改用 `pnpm exec playwright install chromium` 后去掉 channel。
 *
 * 前置：必须先 `pnpm build`（测试加载 `dist/`，不是 dev server）——
 * 因为要验证的就是**生产产物**的真实行为。
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // 场景测试共享浏览器上下文，串行更稳
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 900 },
    // 3D 需要 WebGL；headless Chrome 用 SwiftShader 软件渲染
    launchOptions: {
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
    },
  },
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
