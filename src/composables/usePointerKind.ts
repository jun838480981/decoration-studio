/**
 * 指针类型**单点定义**（SPEC §C.2 / §F.7；原 L1003-1004）。
 * ⛔ 组件内不得重复写 `matchMedia`（原实现多处散落，触屏/桌面双路径容易被统一掉：RISK-11）。
 */
import { useMediaQuery } from '@vueuse/core';

/** 模块级常量：交互数学（热区、吸附阈值）在非组件环境也要用，与原实现语义一致 */
export const COARSE: boolean =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;

/** 桌面 4px / 触屏 9px（原 L1004 `TAP_PX`） */
export const TAP_PX = COARSE ? 9 : 4;

export interface PointerKind {
  /** 触屏/笔（粗指针） */
  coarse: boolean;
  /** 点击命中容差（px） */
  tapPx: number;
}

/**
 * 组件内使用（响应式版本）：窗口从桌面切到触屏模式时会更新。
 * 注意：`TAP_PX` 模块常量是**启动时快照**，与原实现一致；需要跟随变化的场景请用本函数。
 */
export function usePointerKind(): PointerKind {
  const coarse = useMediaQuery('(pointer: coarse)');
  return {
    get coarse() {
      return coarse.value;
    },
    get tapPx() {
      return coarse.value ? 9 : 4;
    },
  };
}
