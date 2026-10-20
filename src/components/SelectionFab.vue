<script setup lang="ts">
/**
 * 触屏选中浮动工具条（原 `#fab` + `renderFab`，L1421-1434 / CSS L190-198）。
 *
 * 触屏没有键盘，旋转 / 复制 / 删除 / 属性 / 完成都放这里；桌面也可用（不冲突）。
 * 热区按 `TAP_PX`（触屏 9px / 桌面 4px）放大按钮最小尺寸（SPEC §D.7 / OF §8.2）。
 */
import { computed } from 'vue';
import { useLayoutStore } from '@/stores/layout';
import { usePlanStore } from '@/stores/plan';
import { useUiStore } from '@/stores/ui';
import { TAP_PX } from '@/composables/usePointerKind';
import { closeExtras } from '@/composables/useOverlays';
import { useTheme } from '@/theme/useTheme';
import { useAppLang } from '@/composables/useAppLang';
import { nameIn } from '@/data/names-en';

const ui = useUiStore();
const layout = useLayoutStore();
const plan = usePlanStore();
const { resolve } = useTheme();
const lang = useAppLang();

const furn = computed(() => (ui.selection?.kind === 'furn' ? layout.getF(ui.selection.id) : undefined));
const room = computed(() => (ui.selection?.kind === 'room' ? plan.rooms.find((r) => r.id === ui.selection?.id) : undefined));
const roomName = computed(() => {
  const target = room.value;
  if (!target) return '';
  const override = layout.rooms[target.id];
  return nameIn(override?.name ?? target.name, lang.value);
});

const minSize = computed(() => `${Math.max(28, TAP_PX * 3)}px`);

function rotate(delta: number): void {
  layout.rotateSelection(delta);
}

function duplicate(): void {
  const copy = layout.duplicateSelection();
  if (copy) ui.select({ kind: 'furn', id: copy.id });
}

function remove(): void {
  layout.deleteSelection();
}

function showProperties(): void {
  ui.openDrawer('panel', true);
}

function done(): void {
  ui.select(null);
  closeExtras();
}

void resolve;
</script>

<template>
  <div v-if="furn || room" class="fab" role="toolbar" aria-label="选中操作">
    <span class="fab__name">{{ furn ? nameIn(furn.name, lang) : roomName }}</span>
    <template v-if="furn">
      <button type="button" class="fab__btn" title="逆时针 90°" :style="{ minHeight: minSize }" @click="rotate(-90)">
        ↺
      </button>
      <button type="button" class="fab__btn" title="顺时针 90°" :style="{ minHeight: minSize }" @click="rotate(90)">
        ↻ 旋转
      </button>
      <button type="button" class="fab__btn" :style="{ minHeight: minSize }" @click="duplicate">复制</button>
      <button type="button" class="fab__btn fab__btn--danger" :style="{ minHeight: minSize }" @click="remove">
        删除
      </button>
    </template>
    <span class="fab__sep" />
    <button type="button" class="fab__btn" :style="{ minHeight: minSize }" @click="showProperties">属性</button>
    <button type="button" class="fab__btn" :style="{ minHeight: minSize }" @click="done">完成</button>
  </div>
</template>

<style scoped>
.fab {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px;
  max-width: calc(100% - 24px);
  background: var(--ds-surface);
  border: 1px solid var(--ds-border-strong);
  border-radius: 14px;
  box-shadow: 0 8px 26px rgb(0 0 0 / 16%);
  z-index: 5;
}

.fab__name {
  padding: 0 8px 0 6px;
  font-weight: 600;
  max-width: 9em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fab__btn {
  border: 1px solid transparent;
  padding: 4px 9px;
}

.fab__btn--danger {
  color: var(--ds-danger);
}

.fab__sep {
  width: 1px;
  align-self: stretch;
  margin: 4px 2px;
  background: var(--ds-border);
}
</style>
