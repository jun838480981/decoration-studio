<script setup lang="ts">
/**
 * 工具栏（原 `#tools` / `#editTools` / `#layers` / 缩放组 / `#viewSeg`，L268-320）。
 *
 * 分组（顺序与原实现一致，`only2d` / `only3d` 用 `v-if` 表达）：
 * 1. 2D/3D 分段控件（`data-view`）；
 * 2. 工具：选择 / 测量 / 拆改（`V` / `M` / `X`）；
 * 3. 结构编辑：画墙 / 画房间 / 加门 / 加窗 / 删除 + 墙类型 + 完成；
 * 4. 缩放：缩小 / 放大 / 适应 / 1:60 / 1:100；
 * 5. 图层：尺寸 / 房间 / 家具 / 网格 / 承重墙 / 贴墙吸附；
 * 6. 复式楼层条（`FloorSwitcher`）。
 *
 * ⛔ 颜色只走 `--ds-*`（B3）；⛔ 不直接读写 `localStorage`（B6）。
 */
import { computed } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useToastStore } from '@/stores/toast';
import { useResizeFit, stageSize } from '@/composables/useResizeFit';
import type { EditMode, LayerFlags, Tool } from '@/types/state';
import type { WallKind } from '@/types/plan';
import FloorSwitcher from './FloorSwitcher.vue';

const ui = useUiStore();
const toast = useToastStore();

// 舞台尺寸来自共享快照（`useResizeFit` 的 `stageSize`），1:60 / 1:100 需要它
void useResizeFit;

const TOOLS: readonly { key: Tool; zh: string; title: string }[] = [
  { key: 'select', zh: '选择', title: '选择 / 移动 (V)' },
  { key: 'measure', zh: '测量', title: '测量 (M)' },
  { key: 'demolish', zh: '拆改墙体', title: '拆改非承重墙 (X)' },
];

const EDIT_MODES: readonly { key: EditMode; zh: string }[] = [
  { key: 'wall', zh: '画墙' },
  { key: 'room', zh: '画房间' },
  { key: 'door', zh: '加门' },
  { key: 'win', zh: '加窗' },
  { key: 'erase', zh: '删除' },
];

const WALL_KINDS: readonly { key: WallKind; zh: string }[] = [
  { key: 'n', zh: '非承重' },
  { key: 'b', zh: '承重' },
  { key: 'e', zh: '外墙' },
  { key: 'low', zh: '矮墙' },
];

const LAYERS: readonly { key: keyof LayerFlags; zh: string; title?: string }[] = [
  { key: 'dims', zh: '尺寸' },
  { key: 'labels', zh: '房间' },
  { key: 'furn', zh: '家具' },
  { key: 'grid', zh: '网格' },
  { key: 'bearing', zh: '承重墙' },
  { key: 'wallSnap', zh: '贴墙吸附', title: '拖动家具时贴墙吸附' },
];

const ratioLabel = computed(() => ui.ratioLabel);

function setRatio(value: number): void {
  ui.setRatio(value, stageSize.w || 1, stageSize.h || 1);
  if (value === 60) toast.push('已按 1:60 显示（与原始户型图同比例）');
}

function fit(): void {
  ui.fitView(stageSize.w, stageSize.h);
}

function toggleView(mode: '2d' | '3d'): void {
  void ui.setViewMode(mode);
}
</script>

<template>
  <div class="toolbar" role="toolbar" aria-label="工具栏">
    <div class="seg" role="group" aria-label="视图切换">
      <button
        type="button"
        class="seg__btn"
        :class="{ 'seg__btn--on': !ui.is3D }"
        :aria-pressed="!ui.is3D"
        title="2D 平面 (T)"
        @click="toggleView('2d')"
      >
        2D 平面
      </button>
      <button
        type="button"
        class="seg__btn"
        :class="{ 'seg__btn--on': ui.is3D }"
        :aria-pressed="ui.is3D"
        title="3D 场景 (T)"
        @click="toggleView('3d')"
      >
        3D 场景
      </button>
    </div>

    <template v-if="!ui.is3D">
      <div class="grp" role="group" aria-label="工具">
        <button
          v-for="tool in TOOLS"
          :key="tool.key"
          type="button"
          class="btn"
          :class="{ 'btn--on': ui.tool === tool.key }"
          :aria-pressed="ui.tool === tool.key"
          :title="tool.title"
          @click="ui.setTool(tool.key)"
        >
          {{ tool.zh }}
        </button>
      </div>

      <div v-if="ui.edit.on" class="grp" role="group" aria-label="结构编辑">
        <button
          v-for="mode in EDIT_MODES"
          :key="mode.key"
          type="button"
          class="btn"
          :class="{ 'btn--on': ui.edit.mode === mode.key }"
          :aria-pressed="ui.edit.mode === mode.key"
          @click="ui.setEditMode(mode.key)"
        >
          {{ mode.zh }}
        </button>
        <span v-if="ui.edit.mode === 'wall'" class="kinds">
          <button
            v-for="kind in WALL_KINDS"
            :key="kind.key"
            type="button"
            class="chip"
            :class="{ 'chip--on': ui.edit.kind === kind.key }"
            :aria-pressed="ui.edit.kind === kind.key"
            @click="ui.setEditKind(kind.key)"
          >
            {{ kind.zh }}
          </button>
        </span>
        <button type="button" class="btn btn--primary" @click="ui.endEdit()">完成</button>
      </div>

      <div class="grp" role="group" aria-label="缩放">
        <button type="button" class="btn" title="缩小" @click="ui.zoomCenter(0.8)">−</button>
        <button type="button" class="btn" title="放大" @click="ui.zoomCenter(1.25)">＋</button>
        <button type="button" class="btn" title="适应窗口 (F)" @click="fit">适应</button>
        <button type="button" class="btn" title="按 1:60 显示（与原图同比例）" @click="setRatio(60)">1:60</button>
        <button type="button" class="btn" title="按 1:100 显示" @click="setRatio(100)">1:100</button>
        <span class="ratio" :title="`当前比例 ${ratioLabel}`">{{ ratioLabel }}</span>
      </div>

      <div class="grp" role="group" aria-label="图层">
        <button
          v-for="layer in LAYERS"
          :key="layer.key"
          type="button"
          class="chip"
          :class="{ 'chip--on': ui.flags[layer.key] }"
          :aria-pressed="ui.flags[layer.key]"
          :title="layer.title ?? layer.zh"
          @click="ui.toggleLayer(layer.key)"
        >
          {{ layer.zh }}
        </button>
      </div>

      <FloorSwitcher />
    </template>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}

.grp {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px;
  border: 1px solid var(--ds-border);
  border-radius: 8px;
}

.kinds {
  display: inline-flex;
  gap: 2px;
  margin-left: 4px;
}

.btn {
  border: 1px solid transparent;
  padding: 4px 9px;
}

.btn--on {
  background: var(--ds-accent-soft);
  color: var(--ds-accent);
  border-color: var(--ds-accent);
}

.btn--primary {
  background: var(--ds-accent);
  color: var(--ds-on-accent);
  border-color: var(--ds-accent);
}

.chip {
  border: 1px solid var(--ds-border);
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 12px;
  color: var(--ds-text-secondary);
}

.chip--on {
  background: var(--ds-accent-soft);
  color: var(--ds-accent);
  border-color: var(--ds-accent);
}

.seg {
  display: inline-flex;
  padding: 2px;
  border: 1px solid var(--ds-border-strong);
  border-radius: 8px;
}

.seg__btn {
  padding: 4px 12px;
  border-radius: 6px;
  color: var(--ds-text-secondary);
}

.seg__btn--on {
  background: var(--ds-accent);
  color: var(--ds-on-accent);
}

.ratio {
  font-size: 12px;
  color: var(--ds-text-muted);
  padding: 0 6px;
  font-variant-numeric: tabular-nums;
}
</style>
