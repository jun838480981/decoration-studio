<script setup lang="ts">
/**
 * 命令面板（P1-3，SPEC §B.2）+ 快捷键帮助。
 *
 * 三条硬约束（RISK-13 / OF §8.1）：
 * 1. **只新增 `Ctrl/⌘ + K`**，⛔ 不抢既有单键（`P`/`E`/`T`/`1`/`2`/`V`/`M`/`X`/`F`/`R`）；
 *    `lib/commands.ts` 的 `paletteConflicts()` 是机器闸门（`extras.spec.ts` 断言为空）。
 * 2. **守卫语义沿用原实现**（L1778-1779）：焦点在 `input/select/textarea`、
 *    或 3D 漫游中（`Scene3DApi.walking()`）一律不响应。
 * 3. 键盘监听/解绑交给 `@vueuse/core` 的 `useEventListener`（SPEC §C.2 B7），⛔ 不裸写 `addEventListener`。
 *
 * 命令的执行逻辑集中在 `runCommand()`：与 `ExportMenu` 共用 `useExtrasActions()` 的同一批动作，
 * 避免"菜单导出的和面板导出的不一样"（双份真相）。
 */
import { computed, nextTick, ref, watch } from 'vue';
import { useEventListener } from '@vueuse/core';
import { useLayoutStore } from '@/stores/layout';
import { usePlanStore } from '@/stores/plan';
import { useTheme } from '@/theme/useTheme';
import { useUiStore } from '@/stores/ui';
import { stageSize } from '@/composables/useResizeFit';
import { useFocusTrap } from '@/composables/useFocusTrap';
import { getScene3DApi } from '@/utils/scenePort';
import { filterCommands, groupLabelKey, paletteConflicts, type CommandSpec } from './lib/commands';
import { useExtrasActions } from './useExtrasActions';
import { useLang } from './lib/i18n';
import { summarizeIssues } from './lib/validate';
import type { LayerFlags, Tool } from '@/types/state';

const props = withDefaults(
  defineProps<{
    /** 受控开合（缺省由组件自己用 `Ctrl/⌘+K` 控制） */
    modelValue?: boolean;
    /** 是否显示快捷键帮助小节 */
    showHelp?: boolean;
    /** 2D 画布取用器（透传给导出动作） */
    getSvg?: () => SVGSVGElement | null;
  }>(),
  { modelValue: undefined, showHelp: true, getSvg: undefined },
);

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
  (event: 'run', id: string): void;
}>();

const plan = usePlanStore();
const layout = useLayoutStore();
const ui = useUiStore();
const { setPreset } = useTheme();
const { t } = useLang();
const actions = useExtrasActions({ getSvg: props.getSvg });

// `plan` 供将来的方案类命令（重命名 / 复制）复用；当前命令集不直接读它，
// 但保留绑定可以让新增命令不必再改 setup 顶部（`void` 显式声明"有意未用"）。
void plan;

/** 内部开合状态（未受控时由快捷键驱动） */
const innerOpen = ref(false);
const open = computed<boolean>({
  get: () => (props.modelValue === undefined ? innerOpen.value : props.modelValue),
  set: (value) => {
    innerOpen.value = value;
    emit('update:modelValue', value);
  },
});

const query = ref('');
const activeIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);
const listRef = ref<HTMLElement | null>(null);
const paletteBox = ref<HTMLElement | null>(null);

/**
 * 焦点陷阱：命令面板是模态（`role="dialog"` + `aria-modal="true"`），
 * 必须把 Tab 限制在面板内，否则键盘用户会跑到背后页面上。
 * `active` 跟随开合状态；关闭时自动解绑（`useEventListener`）并归还焦点。
 */
useFocusTrap(paletteBox, () => open.value);

/** 过滤后的命令（`lib/commands.ts` 的纯函数；标签命中 > id > 关键词） */
const filtered = computed(() => filterCommands(query.value, { translate: t.value }));

/** 分组（渲染用；保持 `COMMAND_SPECS` 的原顺序） */
const grouped = computed(() => {
  const groups: { group: string; label: string; items: { spec: CommandSpec; index: number }[] }[] = [];
  filtered.value.forEach((spec, index) => {
    const last = groups[groups.length - 1];
    const label = t.value(groupLabelKey(spec.group));
    if (last && last.group === spec.group) last.items.push({ spec, index });
    else groups.push({ group: spec.group, label, items: [{ spec, index }] });
  });
  return groups;
});

/** 快捷键冲突自检（正常为空；有冲突时面板顶部给出可见告警，⛔ 不静默） */
const conflicts = computed(() => paletteConflicts());

/** 守卫：焦点在可编辑元素里时，快捷键不生效（沿用 OF §8.1 L1778） */
function inEditableTarget(): boolean {
  if (typeof document === 'undefined') return false;
  const element = document.activeElement;
  if (!element) return false;
  const tag = element.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return (element as HTMLElement).isContentEditable === true;
}

/** 守卫：3D 漫游中不抢键（原 L1779） */
function walking(): boolean {
  const scene = getScene3DApi();
  if (!scene) return false;
  try {
    return scene.walking();
  } catch {
    return false;
  }
}

function canToggle(): boolean {
  return !inEditableTarget() && !walking();
}

function show(): void {
  if (!canToggle()) return;
  open.value = true;
  query.value = '';
  activeIndex.value = 0;
  void nextTick(() => inputRef.value?.focus());
}

function hide(): void {
  open.value = false;
}

function toggle(): void {
  if (open.value) hide();
  else show();
}

/**
 * `Ctrl/⌘ + K`：唯一的全局快捷键（SPEC §B.2 P1-3）。
 *
 * 实现选择：用 `@vueuse/core` 的 `useEventListener`（自动解绑，B7）而不是 `useMagicKeys` ——
 * 后者会为**每个**按键组合注册全局监听并各自 `preventDefault`，与 OF §8.1 的 20 个既有单键
 * 共存时容易互相抢键（RISK-13）。这里只在自己这一条组合上拦截，其余键一律放行。
 */
useEventListener(
  () => (typeof document === 'undefined' ? null : document),
  'keydown',
  (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
      // 输入框里也允许打开面板？⛔ 不允许：沿用 OF §8.1 的守卫（L1778）
      if (inEditableTarget() || walking()) return;
      event.preventDefault();
      toggle();
    }
  },
);

// 面板打开时：Esc 关闭（只在面板内处理，避免与 2D 的 Esc 语义打架）
useEventListener(
  () => (typeof document === 'undefined' ? null : document),
  'keydown',
  (event: KeyboardEvent) => {
    if (!open.value) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      hide();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (filtered.value.length > 0) activeIndex.value = (activeIndex.value + 1) % filtered.value.length;
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (filtered.value.length > 0) {
        activeIndex.value = (activeIndex.value - 1 + filtered.value.length) % filtered.value.length;
      }
      return;
    }
    if (event.key === 'Enter') {
      const spec = filtered.value[activeIndex.value];
      if (!spec) return;
      event.preventDefault();
      runCommand(spec);
    }
  },
);

// 查询变化时把高亮重置到第一条，并滚进视野
watch(filtered, () => {
  activeIndex.value = 0;
});
watch(activeIndex, (index) => {
  const list = listRef.value;
  if (!list) return;
  const node = list.querySelector<HTMLElement>(`[data-index="${index}"]`);
  node?.scrollIntoView({ block: 'nearest' });
});

/**
 * 执行命令（唯一执行点）。
 * ⛔ 这里只调用既有 store 动作 / `useExtrasActions()`，不新造业务逻辑。
 */
function runCommand(spec: CommandSpec): void {
  const id = spec.id;
  emit('run', id);
  hide();
  switch (id) {
    // ---- 视图 ----
    case 'view.2d':
      void ui.setViewMode('2d');
      break;
    case 'view.3d':
      void ui.setViewMode('3d');
      break;
    case 'view.fit':
      // 舞台尺寸由 `useResizeFit` 的共享快照提供（⛔ 不用 window.innerWidth 猜）
      ui.fitView(stageSize.w, stageSize.h);
      break;
    case 'view.ratio60':
      ui.setRatio(60, stageSize.w, stageSize.h);
      break;
    case 'view.ratio100':
      ui.setRatio(100, stageSize.w, stageSize.h);
      break;
    // ---- 主题 ----
    case 'theme.day':
      setPreset('day');
      break;
    case 'theme.night':
      setPreset('night');
      break;
    case 'theme.contrast':
      setPreset('contrast');
      break;
    // ---- 工具 ----
    case 'tool.select':
      ui.setTool('select' satisfies Tool);
      break;
    case 'tool.measure':
      ui.setTool('measure' satisfies Tool);
      break;
    case 'tool.demolish':
      ui.setTool('demolish' satisfies Tool);
      break;
    // ---- 图层 ----
    case 'layer.dims':
    case 'layer.labels':
    case 'layer.furn':
    case 'layer.grid':
    case 'layer.bearing':
    case 'layer.wallSnap': {
      const key = id.slice('layer.'.length) as keyof LayerFlags;
      ui.toggleLayer(key);
      break;
    }
    // ---- 编辑 ----
    case 'edit.start':
      if (ui.edit.on) ui.endEdit();
      else ui.startEdit();
      break;
    case 'edit.undo':
      layout.undo();
      break;
    case 'edit.redo':
      layout.redo();
      break;
    case 'edit.clearLayout':
      layout.clearLayout();
      break;
    // ---- 方案 ----
    case 'plan.export':
      actions.exportPlanJson();
      break;
    case 'plan.exportAll':
      actions.exportAllJson();
      break;
    // ---- 导出 ----
    case 'export.png':
      void actions.exportPng();
      break;
    case 'export.svg':
      actions.exportSvg();
      break;
    case 'export.dxf':
      void actions.exportDxf();
      break;
    case 'export.csv':
      actions.exportCsv();
      break;
    case 'export.xlsx':
      void actions.exportXlsx();
      break;
    case 'export.print':
      actions.printAlbum();
      break;
    // ---- 校验（面板由宿主挂载；命令负责"跑一次"并把结果条数报出来） ----
    case 'validate.run': {
      const summary = summarizeIssues(actions.issues.value);
      if (summary.total === 0) {
        actions.notify(t.value('validation.allPass', { n: 5 }), 'csv');
      } else {
        actions.notify(
          t.value('validation.count', { error: summary.error, warn: summary.warn, info: summary.info }),
          'csv',
        );
      }
      break;
    }
    default:
      break;
  }
}

function onInputKeydown(event: KeyboardEvent): void {
  // Enter/↑/↓/Esc 由 document 级监听统一处理；这里只阻止表单默认提交
  if (event.key === 'Enter') event.preventDefault();
}

/** 暴露给宿主（AppHeader 的「命令面板」按钮 / 快捷键帮助） */
defineExpose({ show, hide, toggle, open });
</script>

<template>
  <div v-if="open" class="dsx-palette-backdrop" data-print-hide @click.self="hide">
    <div ref="paletteBox" class="dsx-palette" role="dialog" aria-modal="true" :aria-label="t('palette.title')">
      <input
        ref="inputRef"
        v-model="query"
        class="dsx-palette__input"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="true"
        :placeholder="t('palette.placeholder')"
        @keydown="onInputKeydown"
      />

      <p v-if="conflicts.length > 0" class="dsx-panel__hint" role="alert">
        快捷键冲突：{{ conflicts.join(', ') }}
      </p>

      <ul ref="listRef" class="dsx-palette__list" role="listbox">
        <template v-for="group in grouped" :key="group.group">
          <li class="dsx-palette__group" role="presentation">{{ group.label }}</li>
          <li
            v-for="entry in group.items"
            :key="entry.spec.id"
            role="option"
            class="dsx-palette__item"
            :data-index="entry.index"
            :aria-selected="entry.index === activeIndex"
            @mouseenter="activeIndex = entry.index"
            @click="runCommand(entry.spec)"
          >
            <span>{{ t(entry.spec.labelKey) }}</span>
            <span class="dsx-palette__key">{{ entry.spec.id }}</span>
          </li>
        </template>
        <li v-if="filtered.length === 0" class="dsx-palette__group" role="presentation">
          {{ t('palette.noResult') }}
        </li>
      </ul>

      <p class="dsx-panel__hint">{{ t('palette.hint') }}</p>
      <p v-if="props.showHelp" class="dsx-panel__hint">
        Ctrl/⌘+K 打开 · Esc 关闭 · ↑↓ 选择 · Enter 执行
      </p>
    </div>
  </div>
</template>
