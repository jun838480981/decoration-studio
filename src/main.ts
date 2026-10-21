/**
 * 应用入口。
 *
 * 启动顺序（有讲究，别调）：
 * 1. `app.use(pinia)` —— 之后才允许在组件外 `useXxxStore()`（Pinia install 会设置 activePinia）。
 * 2. `installI18n(app)` —— **P0-2 / C-4**：`createI18n({ messages })` 实例化并装配；
 *    语言初值读 `huxing-lang`（读侧在 `features/extras/lib/i18n.ts` 的 `currentLang()`）。
 * 3. `initTheme()` —— **挂载前**把令牌写进 `:root` 的 CSS 变量，避免首帧无主题（FOUC）；
 *    同时同步 `<meta name="theme-color">`。
 * 4. 载入户型库与当前户型的布置存档（`localStorage`，坏数据由 `fixState` 兜底，ADR-05）。
 * 5. `app.mount('#app')`。
 * 6. 触发 3D 模块的副作用导入（注册视图挂载位）。
 *
 * ⛔ 不在这里注册全局 `window.View3D` 之类的单例（X3 不保留项）；3D 组件自行经
 *    `utils/scenePort.registerScene3D()` 注册。
 */
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { applyDocumentLang, installI18n, langOf } from '@/features/extras/lib/i18n';
import { useLayoutStore } from '@/stores/layout';
import { usePlanStore } from '@/stores/plan';
import { initTheme } from '@/theme/useTheme';
import './theme/base.css';
import './features/extras/extras.css';
import './features/extras/print.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

// P0-2：正式国际化（替代原 `tr()` + `data-en` 的 DOM 改写，X4 不保留项）。
// 语言初值 = `huxing-lang`（读侧早已存在，C-4 只要求补写侧 + 实例化）。
const i18n = installI18n(app);
applyDocumentLang(langOf(i18n));

initTheme();

const planStore = usePlanStore();
planStore.loadFromStorage();

const layoutStore = useLayoutStore();
layoutStore.loadFor(planStore.plan.id, planStore.level, planStore.isMulti);

app.mount('#app');

/**
 * 视图挂载位装配（SPEC §C.1 / useViewMounts 契约）。
 *
 * `App.vue` 通过 `<component :is="mounts.scene3d">` 渲染 3D 视口，而实现方负责注册。
 * 注册动作已内聚在 `features/scene3d/index.ts` 的模块顶层（导入即注册），
 * 这里只需触发该模块的副作用导入，保持 `main.ts` 不直接依赖 3D 内部实现。
 *
 * 用**动态导入**而非顶层静态导入：
 * - 3D 场景（three.js + 程序化建模）体积大（约 600KB），按需加载让首屏更快；
 * - `useViewMounts` 的注册表是 `shallowReactive`，注册完成后挂载位会自动补渲染
 *   （见 useViewMounts 注释「注册发生在 main.ts 之后也能补上」）。
 */
void import('@/features/scene3d');

/**
 * 测试诊断挂载点（**只读**，不影响生产行为）。
 *
 * 暴露 3D 场景的内容统计，供 `tests/e2e/scene-state.spec.ts` 断言
 * 「几何是否真的被建出来」。这是 D-A / D-B 这类**装配缺陷**的唯一可靠检出手段：
 * 它们的特点是所有单测 / lint / 类型检查全绿，但场景里一个 mesh 都没有。
 *
 * 设计取舍：
 * - **始终挂载**（含生产构建）：E2E 测的是 `dist/` 产物，若只在 DEV 挂载就测不到；
 * - 用 `__DSH_` 前缀 + `Object.defineProperty`（不可枚举、不可写），
 *   避免与页面业务代码或第三方库重名；
 * - 函数体只有一次 `stats()` 调用（traverse 计数），不订阅、不持有引用、不修改状态，
 *   调用方不调它就没有任何开销。
 */
void import('@/utils/scenePort').then(({ getScene3DApi }) => {
  Object.defineProperty(window, '__DSH_SCENE_STATS__', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: () => getScene3DApi()?.stats?.() ?? null,
  });
});

/**
 * 亮点层挂载位装配（`extras-toolbar` / `extras-overlay`）。
 *
 * 与 3D 同一模式：注册动作内聚在 `features/extras/index.ts` 顶层，这里只触发副作用导入。
 *
 * ⚠️ 这一行曾经**缺失**，导致 `App.vue` 的两个亮点挂载位永远为空——
 * 命令面板（Ctrl+K）、导出菜单、平面图校验、方案对比、历史面板全部不可达，
 * 而 `typecheck` / 203 单测 / lint / verify **全部通过**（它们都不检查「组件是否被挂载」）。
 * 只有浏览器实测能发现（见 `.tools/audit-features.cjs`）。
 *
 * 用动态导入：亮点层含 exceljs / papaparse / dxf-writer（约 300KB），
 * 不该拖慢首屏；注册完成后挂载位自动补渲染。
 */
void import('@/features/extras');
