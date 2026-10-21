/**
 * 3D 场景**装配状态** E2E 测试（Playwright）。
 *
 * ## 为什么必须用真实浏览器
 *
 * D-A / D-B 两个缺陷的本质是「**装配**问题」：
 * - D-A：`Scene3D.vue` 的 watch 在 2D 模式下提前更新了签名 → 进 3D 时跳过重建
 * - D-B：引擎用 `plan.plan` 而非 `plan.levelData` → 复式当前层几何不建
 *
 * 这两类问题的共同点是：**代码逻辑看起来完全正确**（函数被调用、返回值符合预期），
 * 但「场景里一个 mesh 都没有」。只有真正跑起 WebGL、读 `engine.stats()` 才能发现。
 *
 * ## 与 scene-state.spec.ts 的分工
 *
 * - `src/features/scene3d/scene-state.spec.ts`（node，快）：验证签名计算与数据结构契约
 * - 本文件（Playwright，慢）：验证真实渲染出的几何数量与内容
 *
 * ## 运行
 *
 * ```bash
 * pnpm build                    # 需要 dist/
 * npx playwright test tests/e2e/scene-state.spec.ts
 * ```
 *
 * 用本机 Chrome（不下载 Playwright 浏览器）：
 * 通过 `channel: 'chrome'` 或 `executablePath` 指定。
 */
import { expect, test, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 本文件是 ESM（package.json 的 `"type": "module"`），没有 `__dirname`。
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const DIST = join(ROOT, 'dist');
const PORT = 4400;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

let server: Server;

test.beforeAll(async () => {
  if (!existsSync(DIST)) {
    throw new Error('dist/ 不存在，请先 `pnpm build`');
  }
  server = createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let file = join(DIST, urlPath === '/' ? 'index.html' : urlPath);
    if (!file.startsWith(DIST)) {
      res.writeHead(403).end();
      return;
    }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise<void>((r) => server.listen(PORT, '127.0.0.1', () => r()));
});

test.afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

/** 打开页面并清空持久化（避免上一个测试的户型残留） */
async function openFresh(page: Page): Promise<void> {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
}

/** 从页面读场景统计（`engine.stats()` 经 scenePort 暴露） */
async function sceneStats(page: Page) {
  return page.evaluate(() => {
    const api = window.__DSH_SCENE_STATS__;
    return api ? api() : null;
  });
}

/** 切到 3D 并等待稳定 */
async function go3d(page: Page): Promise<void> {
  await page.locator('button.seg__btn:has-text("3D"), button:has-text("3D 场景")').first().click();
  await page.waitForTimeout(3200);
}

/** 切到 2D 并等待稳定 */
async function go2d(page: Page): Promise<void> {
  await page.locator('button.seg__btn:has-text("2D"), button:has-text("2D 平面")').first().click();
  await page.waitForTimeout(1200);
}

/** 通过户型库切换户型 */
async function switchPlan(page: Page, name: string): Promise<void> {
  await page.locator('button:has-text("户型")').first().click();
  await page.waitForTimeout(700);
  const open = page
    .locator('[role="dialog"] article, [role="dialog"] .pcard')
    .filter({ hasText: name })
    .locator('button:has-text("打开"), button:has-text("Open")')
    .first();
  if (await open.count()) await open.click();
  await page.waitForTimeout(1600);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
}

/** 读 3D 场景标签里的房间名 */
async function sceneRoomNames(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('div')]
      .filter((d) => /m²$/.test((d.textContent ?? '').trim()) && d.children.length <= 2)
      .map((d) => (d.textContent ?? '').trim().replace(/\d+\.?\d*\s*m²/, '').trim())
      .filter((s) => s && !/套内|单指|双指|点击/.test(s)),
  );
}

test.describe('3D 场景装配状态', () => {
  test.beforeEach(async ({ page }) => {
    await openFresh(page);
  });

  test('进入 3D 后建筑几何真的被建出来（D-B 核心防护）', async ({ page }) => {
    await go3d(page);
    const stats = await sceneStats(page);
    expect(stats, '未暴露 __DSH_SCENE_STATS__（见 main.ts 的诊断挂载）').not.toBeNull();
    // 三室两厅有 48 面墙，建筑 mesh 数必然远大于 0
    expect(stats!.archMeshes).toBeGreaterThan(20);
    expect(stats!.colliders).toBeGreaterThan(10);
    expect(stats!.active).toBe(true);
  });

  test('复式户型当前层几何必须非空（D-B 回归防护）', async ({ page }) => {
    await switchPlan(page, '复式两层');
    await go3d(page);
    const stats = await sceneStats(page);
    // 这是 D-B 的直接断言：修复前 archMeshes 会是 0（当前层什么都没建）
    expect(stats!.archMeshes).toBeGreaterThan(20);
    expect(stats!.colliders).toBeGreaterThan(5);
  });

  test('复式两层各自都能建出几何', async ({ page }) => {
    await switchPlan(page, '复式两层');
    await go3d(page);
    const l1 = await sceneStats(page);
    await go2d(page);
    await page.keyboard.press('2');
    await page.waitForTimeout(1000);
    await go3d(page);
    const l2 = await sceneStats(page);
    expect(l1!.archMeshes).toBeGreaterThan(20);
    expect(l2!.archMeshes).toBeGreaterThan(20);
    // 两层内容不同，签名应不同
    expect(l1!.signature).not.toBe(l2!.signature);
  });

  test('切换户型后场景重建为新房型（D-A 回归防护）', async ({ page }) => {
    await go3d(page);
    const before = await sceneStats(page);
    const beforeNames = await sceneRoomNames(page);

    await go2d(page);
    await switchPlan(page, '复式两层');
    await go3d(page);
    const after = await sceneStats(page);
    const afterNames = await sceneRoomNames(page);

    // 签名必须变化
    expect(after!.signature).not.toBe(before!.signature);
    // 几何必须非空
    expect(after!.archMeshes).toBeGreaterThan(20);
    // 房间名必须换成复式的（三室两厅有「主卧室」，复式有「玄关/楼梯间」）
    expect(afterNames.join('|')).not.toBe(beforeNames.join('|'));
    expect(afterNames.join('|')).toMatch(/玄关|楼梯间|餐边过道/);
  });

  test('反复切换 3 个户型，每次都重建正确', async ({ page }) => {
    const cases: { name: string; expect: RegExp }[] = [
      { name: '三室两厅两卫', expect: /主卧室|小孩房/ },
      { name: '复式两层', expect: /玄关|楼梯间/ },
      { name: '四室两厅两卫', expect: /卧室|客厅|餐厅/ },
    ];
    for (const c of cases) {
      await go2d(page);
      await switchPlan(page, c.name);
      await go3d(page);
      const stats = await sceneStats(page);
      const names = (await sceneRoomNames(page)).join('|');
      expect(stats!.archMeshes, `${c.name} 几何为空`).toBeGreaterThan(20);
      expect(names, `${c.name} 房间名不匹配`).toMatch(c.expect);
    }
  });

  test('2D 改家具后进 3D 能重建', async ({ page }) => {
    const furn = page.locator('svg g.furn[tabindex="0"]').first();
    const hasFurn = (await furn.count()) > 0;
    test.skip(!hasFurn, '当前户型无家具');
    await furn.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);
    await go3d(page);
    const stats = await sceneStats(page);
    expect(stats!.furnMeshes).toBeGreaterThan(0);
  });

  test('二次进入同一户型仍跳过重建（性能优化未被破坏）', async ({ page }) => {
    await go3d(page);
    const first = await sceneStats(page);
    await go2d(page);
    await go3d(page);
    const second = await sceneStats(page);
    // 签名不变说明跳过了重建；几何数应保持一致（没有被清空）
    expect(second!.signature).toBe(first!.signature);
    expect(second!.archMeshes).toBe(first!.archMeshes);
  });
});
