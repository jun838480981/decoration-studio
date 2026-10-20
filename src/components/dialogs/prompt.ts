/**
 * 原生 `prompt()` 的替代队列（X5 不保留项）。
 * 与 `confirm.ts` 同构：命令式 `await askPrompt(...)` + `App.vue` 挂一个宿主。
 */
import { reactive } from 'vue';

export interface PromptOptions {
  title?: string;
  value?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
}

interface PendingPrompt extends PromptOptions {
  resolve: (value: string | null) => void;
}

export const promptQueue = reactive<PendingPrompt[]>([]);

/** 弹出输入框；用户取消时 resolve `null`（与原 `prompt()` 语义一致） */
export function askPrompt(options: PromptOptions): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    promptQueue.push({ ...options, resolve });
  });
}

export function settlePrompt(value: string | null): void {
  const current = promptQueue.shift();
  current?.resolve(value);
}
