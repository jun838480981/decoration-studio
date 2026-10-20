/// <reference types="vite/client" />

/**
 * `.vue` 单文件组件的模块声明。
 * 若后续引入 `vue-tsc` 的 `takeover` 模式以外的工具（如 IDE 原生 Volar），本文件保持不动即可。
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}
