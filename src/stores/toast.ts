/**
 * 提示队列（原 `#toast` 单定时器 → X7 不保留项）。
 * ⛔ 不得退回「单定时器」写法：并发提示会互相吞掉。
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface ToastItem {
  id: number;
  message: string;
  kind: 'info' | 'warn' | 'danger';
  ttl: number;
}

/** 默认存活时长（原 L2549 的 1800ms） */
export const TOAST_DEFAULT_TTL = 1800;

export const useToastStore = defineStore('toast', () => {
  const items = ref<ToastItem[]>([]);
  let seq = 0;

  function push(message: string, kind: ToastItem['kind'] = 'info', ttl: number = TOAST_DEFAULT_TTL): number {
    const id = (seq += 1);
    items.value = [...items.value, { id, message, kind, ttl }];
    if (ttl > 0 && typeof window !== 'undefined') {
      window.setTimeout(() => dismiss(id), ttl);
    }
    return id;
  }

  function dismiss(id: number): void {
    items.value = items.value.filter((item) => item.id !== id);
  }

  return { items, push, dismiss };
});
