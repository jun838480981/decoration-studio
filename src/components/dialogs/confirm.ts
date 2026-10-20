/**
 * 原生 `confirm()` 的替代（X5 不保留项：`confirm` 在触屏/iframe 里不可用，且无法样式化）。
 *
 * 用法（命令式，保持原代码的调用形态）：
 * ```ts
 * if (await askConfirm({ message: '确定清空？', danger: true })) clearLayout();
 * ```
 * 实现是「一个全局队列 + 一个渲染宿主」：`ConfirmDialogHost` 挂在 `App.vue`，
 * 调用方不需要关心 DOM。⛔ 不用 `window.confirm`（原 L1439 / L2036 / L2622）。
 */
import { reactive } from 'vue';

export interface ConfirmOptions {
  title?: string;
  message: string;
  /** 确认按钮文案（缺省「确定」） */
  confirmText?: string;
  cancelText?: string;
  /** 危险操作：确认按钮用 danger 配色（清空 / 删除） */
  danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

/** 队列（一般只有一条；用队列是为了避免连续调用时丢 resolve） */
export const confirmQueue = reactive<PendingConfirm[]>([]);

/** 弹出确认框，返回用户选择 */
export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    confirmQueue.push({ ...options, resolve });
  });
}

/** 由宿主组件调用：结算当前确认框 */
export function settleConfirm(value: boolean): void {
  const current = confirmQueue.shift();
  current?.resolve(value);
}
