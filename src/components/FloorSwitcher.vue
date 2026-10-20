<script setup lang="ts">
/**
 * 复式楼层切换（原 `#lvBar`，L292 + 运行时生成 L1982-1989；快捷键 `1` / `2`，L1787）。
 *
 * 单层户型不渲染（`v-if`）：原实现同样把 `#lvBar` 留 `hidden`。
 */
import { computed } from 'vue';
import { usePlanStore } from '@/stores/plan';

const plan = usePlanStore();

const levels = computed(() => plan.plan.levels ?? []);

function select(index: number): void {
  if (index === plan.level) return;
  plan.switchLevel(index);
}
</script>

<template>
  <div v-if="plan.isMulti && levels.length > 0" class="floors" role="group" aria-label="楼层">
    <button
      v-for="(item, index) in levels"
      :key="`${item.name}-${index}`"
      type="button"
      class="floor"
      :class="{ 'floor--on': plan.level === index }"
      :aria-pressed="plan.level === index"
      :title="`切换到 ${item.name || `F${index + 1}`}`"
      @click="select(index)"
    >
      {{ item.name || `F${index + 1}` }}
    </button>
  </div>
</template>

<style scoped>
.floors {
  display: inline-flex;
  gap: 3px;
  padding: 2px;
  border: 1px solid var(--ds-border);
  border-radius: 8px;
}

.floor {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 6px;
  color: var(--ds-text-secondary);
}

.floor--on {
  background: var(--ds-accent-soft);
  color: var(--ds-accent);
  border: 1px solid var(--ds-accent);
}
</style>
