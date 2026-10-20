<script setup lang="ts">
/**
 * 原生 `prompt()` 的替代（X5；原 L2129 户型改名、L2044 的 `prompt`）。
 *
 * 用法：
 * ```ts
 * const name = await askPrompt({ title: '户型名称', value: plan.plan.name });
 * if (name !== null) plan.renamePlan(id, name);
 * ```
 */
import { useEventListener } from '@vueuse/core';
import { computed, nextTick, ref, watch } from 'vue';
import { promptQueue, settlePrompt } from './prompt';

const current = computed(() => promptQueue[0] ?? null);
const draft = ref('');
const inputEl = ref<HTMLInputElement | null>(null);

watch(
  current,
  async (value) => {
    draft.value = value?.value ?? '';
    await nextTick();
    inputEl.value?.focus();
    inputEl.value?.select();
  },
  { immediate: true },
);

function submit(): void {
  settlePrompt(draft.value.trim() === '' ? (current.value?.value ?? '') : draft.value.trim());
}

useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  if (!current.value) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    settlePrompt(null);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    submit();
  }
});
</script>

<template>
  <div v-if="current" class="overlay" role="presentation" @pointerdown.self="settlePrompt(null)">
    <div class="dialog" role="dialog" aria-modal="true" :aria-label="current.title ?? '输入'">
      <h3 class="dialog__title">{{ current.title ?? '输入' }}</h3>
      <input
        ref="inputEl"
        v-model="draft"
        class="dialog__input"
        type="text"
        :placeholder="current.placeholder ?? ''"
        @keydown.enter.stop="submit"
      />
      <div class="dialog__actions">
        <button type="button" class="btn" @click="settlePrompt(null)">{{ current.cancelText ?? '取消' }}</button>
        <button type="button" class="btn btn--primary" @click="submit">
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
  margin: 0 0 10px;
  font-size: 15px;
}

.dialog__input {
  width: 100%;
  border: 1px solid var(--ds-border-strong);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--ds-surface-2);
  color: var(--ds-text);
  font-size: 16px; /* 触屏 16px 防 iOS 聚焦缩放（OF §8.2） */
}

.dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
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
</style>
