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
