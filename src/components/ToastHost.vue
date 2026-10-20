<script setup lang="ts">
/**
 * 提示队列渲染（替代原 `#toast` 单定时器，X7 不保留项）。
 *
 * 契约（SPEC §C.1 / `stores/toast.ts`）：并发提示**各自**计时，互不吞掉；
 * 颜色只走令牌（`--ds-*`），`danger`/`warn` 用对应的 soft 底 + 前景。
 */
import { useToastStore } from '@/stores/toast';

const toast = useToastStore();
</script>

<template>
  <div class="toast-host" role="status" aria-live="polite">
    <div
      v-for="item in toast.items"
      :key="item.id"
      class="toast"
      :class="`toast--${item.kind}`"
      @click="toast.dismiss(item.id)"
    >
      {{ item.message }}
    </div>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  left: 50%;
  bottom: 110px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  z-index: 60;
  pointer-events: none;
  max-width: calc(100% - 24px);
}

.toast {
  pointer-events: auto;
  padding: 8px 16px;
  border-radius: 8px;
  background: var(--ds-text);
  color: var(--ds-surface);
  font-size: 13px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 18%);
  animation: toast-in 0.2s ease both;
  cursor: pointer;
}

.toast--warn {
  background: var(--ds-warning-soft);
  color: var(--ds-warning);
  border: 1px solid var(--ds-warning);
}

.toast--danger {
  background: var(--ds-danger-soft);
  color: var(--ds-danger);
  border: 1px solid var(--ds-danger);
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
</style>
