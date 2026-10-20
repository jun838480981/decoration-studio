<script setup lang="ts">
/**
 * 确认对话框宿主（替代原生 `confirm()`，X5）。
 * 挂在 `App.vue` 一次；调用方用 `askConfirm()`（`components/dialogs/confirm.ts`）。
 */
import { useEventListener } from '@vueuse/core';
import { computed } from 'vue';
import { confirmQueue, settleConfirm } from './confirm';

const current = computed(() => confirmQueue[0] ?? null);

useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  if (!current.value) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    settleConfirm(false);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    settleConfirm(true);
  }
});
</script>

<template>
  <div v-if="current" class="overlay" role="presentation" @pointerdown.self="settleConfirm(false)">
    <div class="dialog" role="alertdialog" aria-modal="true" :aria-label="current.title ?? '确认'">
      <h3 v-if="current.title" class="dialog__title">{{ current.title }}</h3>
      <p class="dialog__message">{{ current.message }}</p>
      <div class="dialog__actions">
        <button type="button" class="btn" @click="settleConfirm(false)">
          {{ current.cancelText ?? '取消' }}
        </button>
        <button
          type="button"
          class="btn"
          :class="current.danger ? 'btn--danger' : 'btn--primary'"
          @click="settleConfirm(true)"
        >
          {{ current.confirmText ?? '确定' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 45%);
  padding: 16px;
}

.dialog {
  width: min(420px, 100%);
  background: var(--ds-surface);
  border: 1px solid var(--ds-border-strong);
  border-radius: 14px;
  box-shadow: 0 20px 60px rgb(0 0 0 / 30%);
  padding: 16px 18px;
}

.dialog__title {
  margin: 0 0 8px;
  font-size: 15px;
}

.dialog__message {
  margin: 0 0 16px;
  white-space: pre-line;
  color: var(--ds-text-secondary);
}

.dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  border: 1px solid var(--ds-border-strong);
  padding: 6px 14px;
}

.btn--primary {
  background: var(--ds-accent);
  color: var(--ds-on-accent);
  border-color: var(--ds-accent);
}

.btn--danger {
  background: var(--ds-danger);
  color: var(--ds-on-accent);
  border-color: var(--ds-danger);
}
</style>
