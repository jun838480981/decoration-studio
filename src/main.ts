/**
 * 应用入口。
 *
 * 启动顺序（有讲究，别调）：
 * 1. `app.use(pinia)` —— 之后才允许在组件外 `useXxxStore()`（Pinia install 会设置 activePinia）。
 * 2. `initTheme()` —— **挂载前**把令牌写进 `:root` 的 CSS 变量，避免首帧无主题（FOUC）；
 *    同时同步 `<meta name="theme-color">`。
 * 3. 载入户型库与当前户型的布置存档（`localStorage`，坏数据由 `fixState` 兜底，ADR-05）。
 * 4. `app.mount('#app')`。
 *
 * ⛔ 不在这里注册全局 `window.View3D` 之类的单例（X3 不保留项）；3D 组件自行经
 *    `utils/scenePort.registerScene3D()` 注册。
 */
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { useLayoutStore } from '@/stores/layout';
import { usePlanStore } from '@/stores/plan';
import { initTheme } from '@/theme/useTheme';
import './theme/base.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

initTheme();

const planStore = usePlanStore();
planStore.loadFromStorage();

const layoutStore = useLayoutStore();
layoutStore.loadFor(planStore.plan.id, planStore.level, planStore.isMulti);

app.mount('#app');