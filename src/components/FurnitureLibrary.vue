<script setup lang="ts">
/**
 * 家具库（原 `buildLib()` L1813-1825 + 拖放 L1828-1876 + 落点 `dropPoint()` L1832-1838）。
 *
 * 交互口径（**逐条保真**，ADR-13：迁移既有实现，⛔ 不换手势库）：
 * - 6 分类 60 条目，缩略图 `furnSVG` 复用图纸图例，`viewBox` 按 `pad = max(w,d)*.08` 外扩（原 L1815）；
 * - **pointer 事件**（⛔ 不用 HTML5 DnD，iPad 上不可靠）；列表 `touch-action: pan-y` 让竖向滑动交还滚动；
 * - 超过 `TAP_PX` 才生成幽灵图（原 L1843），幽灵图按落点比例显示真实大小（原 L1848-1850）；
 * - 落点：2D 走画布 `toMM()`，3D 走 `Scene3DApi.groundAt()`（SPEC §F.5）；
 * - 轻点（未拖动）：放到选中房间中心，否则画面中心（原 L1866-1873）；
 * - 拖出窄屏抽屉后自动收起（原 L1852）。
 *
 * 事件生命周期由 `@vueuse/core` 的 `useEventListener` 管理（B7：⛔ 裸 `addEventListener`）。
 */
import { computed, ref } from 'vue';
import { useEventListener } from '@vueuse/core';
import { LIB } from '@/data/furniture-lib';
import { furnSVG } from '@/features/plan2d/furniture-svg';
import { TAP_PX } from '@/composables/usePointerKind';
import { useLayoutStore } from '@/stores/layout';
import { usePlanStore } from '@/stores/plan';
import { useUiStore } from '@/stores/ui';
import { useToastStore } from '@/stores/toast';
import { getScene3DApi } from '@/utils/scenePort';
import { bbox } from '@/utils/geometry';
import { readJson, writeJson } from '@/utils/persistence';
import { nameIn } from '@/data/names-en';
import { useAppLang } from '@/composables/useAppLang';
import type { LibItem } from '@/types/furniture';

const props = defineProps<{
  /**
   * 屏幕 → 户型坐标（2D 画布注入；3D 走 `Scene3DApi.groundAt`）。
   * 返回 `null` 表示落点在舞台外或落在浮层上（原 `dropPoint` 的拒绝分支）。
   */
  resolveDrop?: (clientX: number, clientY: number) => { x: number; y: number; s: number } | null;
  /** 舞台元素取用器（判断落点是否在舞台内；缺省用 `main.stage` 约定） */
  getStage?: () => HTMLElement | null;
}>();

const layout = useLayoutStore();
const plan = usePlanStore();
const ui = useUiStore();
const toast = useToastStore();
const lang = useAppLang();

interface LibDragState {
  pointerId: number;
  item: LibItem;
  sx: number;
  sy: number;
  ghost: HTMLElement | null;
  el: HTMLElement | null;
}

const drag = ref<LibDragState | null>(null);
const ghostStyle = ref<Record<string, string>>({});
const ghostHtml = ref('');
const draggingKey = ref<string | null>(null);

/** 分类 → 条目（附带扁平索引 `ci:ii`，与原 `data-key` 一致） */
const groups = computed(() =>
  LIB.map((category, ci) => ({
    cat: category.cat,
    items: category.items.map((item, ii) => ({ item, key: `${ci}:${ii}` })),
  })),
);

/* ======================= 搜索与收藏 ======================= */

/** 搜索关键词（实时过滤，按名称 / 类型 / 分类匹配） */
const query = ref('');

/** 收藏的家具 key（`ci:ii`），持久化到 localStorage */
const FAV_KEY = 'huxing-furn-fav';
const favorites = ref<Set<string>>(new Set(loadFavorites()));

function loadFavorites(): string[] {
  // 经 `utils/persistence.ts` 的唯一出口读写（B6），不直接碰 localStorage
  const raw = readJson<unknown>(FAV_KEY, []);
  return Array.isArray(raw) ? raw.filter((k): k is string => typeof k === 'string') : [];
}

function saveFavorites(): void {
  // 静默降级：隐私模式 / 配额满时 writeJson 内部已 try/catch
  writeJson(FAV_KEY, [...favorites.value]);
}

function toggleFavorite(key: string): void {
  if (favorites.value.has(key)) favorites.value.delete(key);
  else favorites.value.add(key);
  // Set 是引用类型，需替换引用才能触发 Vue 更新
  favorites.value = new Set(favorites.value);
  saveFavorites();
}

/** 归一化搜索词：去空格、小写，便于中英混输 */
const normQuery = computed(() => query.value.trim().toLowerCase());

/**
 * 过滤后的分组。
 *
 * 匹配规则（任一命中即可）：
 * - 家具名（中英均可，`nameIn` 会按当前语言映射）
 * - 原始中文名（切到英文界面时仍可用中文搜索）
 * - 家具类型（如 `bed` / `sofa`，方便熟悉类型的用户）
 * - 分类名（如「卧室」匹配该分类全部家具）
 *
 * 空关键词时返回全部分组；有结果时**收藏项额外置顶为一个虚拟分类**。
 */
const filteredGroups = computed(() => {
  const q = normQuery.value;

  // 无搜索词：收藏（若有）置顶 + 全部分类
  if (!q) {
    const result = groups.value;
    const favItems = result.flatMap((g) => g.items).filter((e) => favorites.value.has(e.key));
    return favItems.length > 0 ? [{ cat: '__fav__', items: favItems }, ...result] : result;
  }

  return groups.value
    .map((g) => ({
      cat: g.cat,
      items: g.items.filter((e) => {
        const [type, name] = e.item;
        return (
          nameIn(name, lang.value).toLowerCase().includes(q) ||
          name.toLowerCase().includes(q) ||
          String(type).toLowerCase().includes(q) ||
          nameIn(g.cat, lang.value).toLowerCase().includes(q) ||
          g.cat.toLowerCase().includes(q)
        );
      }),
    }))
    .filter((g) => g.items.length > 0);
});

/** 搜索结果总数（用于空态提示） */
const resultCount = computed(() => filteredGroups.value.reduce((n, g) => n + g.items.length, 0));

function clearQuery(): void {
  query.value = '';
}


function stageElement(): HTMLElement | null {
  const provided = props.getStage?.() ?? null;
  if (provided) return provided;
  if (typeof document === 'undefined') return null;
  return document.querySelector('main.stage') as HTMLElement | null;
}

/** 屏幕坐标 → 户型坐标 + 该处比例（原 `dropPoint`，L1832-1838） */
function dropPoint(clientX: number, clientY: number): { x: number; y: number; s: number } | null {
  const stage = stageElement();
  if (!stage) return null;
  const rect = stage.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
  const over = document.elementFromPoint(clientX, clientY);
  if (over?.closest('aside.open,#fab,[data-floating]')) return null;
  if (ui.is3D) return getScene3DApi()?.groundAt(clientX, clientY) ?? null;
  const p = props.resolveDrop?.(clientX, clientY) ?? null;
  return p;
}

function thumbViewBox(item: LibItem): string {
  const [, , w, d] = item;
  const pad = Math.max(w, d) * 0.08;
  return `${-w / 2 - pad} ${-d / 2 - pad} ${w + 2 * pad} ${d + 2 * pad}`;
}

function onPointerDown(event: PointerEvent, item: LibItem, key: string): void {
  if (event.button !== 0) return;
  drag.value = {
    pointerId: event.pointerId,
    item,
    sx: event.clientX,
    sy: event.clientY,
    ghost: null,
    el: event.currentTarget as HTMLElement | null,
  };
  draggingKey.value = key;
}

useEventListener(window, 'pointermove', (event: PointerEvent) => {
  const current = drag.value;
  if (!current || event.pointerId !== current.pointerId) return;
  const [type, , w, d, color] = current.item;
  if (!current.ghost) {
    if (Math.hypot(event.clientX - current.sx, event.clientY - current.sy) < TAP_PX) return;
    const ghost = document.createElement('div');
    ghost.dataset.floating = 'ghost';
    ghost.className = 'lib-ghost';
    ghost.innerHTML = `<svg viewBox="${-w / 2} ${-d / 2} ${w} ${d}">${furnSVG(type, w, d, color)}</svg>`;
    document.body.appendChild(ghost);
    current.ghost = ghost;
    ghostHtml.value = ghost.innerHTML;
  }
  const scale = Math.max(dropPoint(event.clientX, event.clientY)?.s ?? (ui.is3D ? 0.05 : ui.view.s), 0.02);
  ghostStyle.value = {
    width: `${Math.max(28, w * scale)}px`,
    height: `${Math.max(20, d * scale)}px`,
    left: `${event.clientX}px`,
    top: `${event.clientY}px`,
  };
  if (current.ghost) {
    Object.assign(current.ghost.style, ghostStyle.value);
  }
});

function endDrag(event: PointerEvent, ok: boolean): void {
  const current = drag.value;
  if (!current || event.pointerId !== current.pointerId) return;
  drag.value = null;
  draggingKey.value = null;
  current.el?.classList.remove('dragging');
  if (current.ghost) {
    current.ghost.remove();
    current.ghost = null;
    ghostStyle.value = {};
    ghostHtml.value = '';
    if (!ok) return;
    const point = dropPoint(event.clientX, event.clientY);
    if (point) layout.addItem(current.item, point.x, point.y);
    else if (ui.is3D) toast.push('请拖到地面上', 'warn');
    return;
  }
  if (!ok) return;
  // 轻点：选中房间中心 → 画面中心（3D 取屏幕中心的地面点）
  let point: { x: number; y: number } | null = null;
  if (ui.selection?.kind === 'room') {
    const room = plan.rooms.find((r) => r.id === ui.selection?.id);
    if (room) {
      const [x0, y0, x1, y1] = bbox(room.poly);
      point = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    }
  } else if (ui.is3D) {
    const stage = stageElement();
    if (stage) {
      const rect = stage.getBoundingClientRect();
      point = getScene3DApi()?.groundAt(rect.left + rect.width / 2, rect.top + rect.height / 2) ?? null;
    }
  }
  if (!point) {
    const stage = stageElement();
    const rect = stage?.getBoundingClientRect();
    point = {
      x: ui.view.x0 + (rect?.width ?? 0) / 2 / ui.view.s,
      y: ui.view.y0 + (rect?.height ?? 0) / 2 / ui.view.s,
    };
  }
  layout.addItem(current.item, point.x, point.y);
}

useEventListener(window, 'pointerup', (event: PointerEvent) => endDrag(event, true));
useEventListener(window, 'pointercancel', (event: PointerEvent) => endDrag(event, false));
</script>

<template>
  <div class="library">
    <!-- 搜索框：60 件家具按名称/类型/分类实时过滤 -->
    <div class="library__search">
      <input
        v-model="query"
        type="search"
        class="library__search-input"
        :placeholder="lang === 'en' ? 'Search furniture…' : '搜索家具（名称 / 类型 / 分类）'"
        :aria-label="lang === 'en' ? 'Search furniture' : '搜索家具'"
      />
      <button
        v-if="query"
        type="button"
        class="library__search-clear"
        :title="lang === 'en' ? 'Clear' : '清空'"
        @click="clearQuery"
      >
        ✕
      </button>
    </div>

    <!-- 空态：给出明确提示而不是空白列表 -->
    <p v-if="resultCount === 0" class="library__empty">
      {{ lang === 'en' ? `No furniture matches “${query}”` : `没有匹配「${query}」的家具` }}
    </p>

    <div
      v-for="group in filteredGroups"
      :key="group.cat"
      class="library__group"
    >
      <h4 class="library__cat">
        {{ group.cat === '__fav__' ? (lang === 'en' ? '★ Favorites' : '★ 收藏') : nameIn(group.cat, lang) }}
        <small v-if="query" class="library__count">{{ group.items.length }}</small>
      </h4>
      <div class="library__grid">
        <div
          v-for="entry in group.items"
          :key="entry.key"
          class="item"
          :class="{ dragging: draggingKey === entry.key }"
          :title="'点击添加，或拖到平面图中的指定位置'"
          @pointerdown="onPointerDown($event, entry.item, entry.key)"
        >
          <!-- 收藏星标：单独可点，不触发拖拽 -->
          <button
            type="button"
            class="item__fav"
            :class="{ 'item__fav--on': favorites.has(entry.key) }"
            :title="favorites.has(entry.key) ? '取消收藏' : '收藏'"
            :aria-label="favorites.has(entry.key) ? '取消收藏' : '收藏'"
            :aria-pressed="favorites.has(entry.key)"
            @pointerdown.stop
            @click.stop="toggleFavorite(entry.key)"
          >
            {{ favorites.has(entry.key) ? '★' : '☆' }}
          </button>
          <!-- eslint-disable-next-line vue/no-v-html -- 内部生成的 SVG 缩略图（非用户输入，无 XSS 风险；SVG 无法用插值渲染） -->
          <svg class="item__thumb" :viewBox="thumbViewBox(entry.item)" v-html="furnSVG(entry.item[0], entry.item[2], entry.item[3], entry.item[4])" />
          <b class="item__name">{{ nameIn(entry.item[1], lang) }}</b>
          <small class="item__size">{{ entry.item[2] }}×{{ entry.item[3] }}</small>
        </div>
      </div>
    </div>
    <p class="library__hint">
      家具按真实尺寸（mm）绘制。点一下放到画面中央，或按住拖到平面图 / 3D 地面上的指定位置（上下滑动为滚动列表）。
      添加后可在右侧修改宽深与颜色。
    </p>
  </div>
</template>

<style scoped>
.library {
  overflow: auto;
  height: 100%;
  background: var(--ds-surface);
}

/* ---- 搜索框 ---- */
.library__search {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
  background: var(--ds-surface);
  border-bottom: 1px solid var(--ds-border);
}
.library__search-input {
  flex: 1;
  min-width: 0;
  padding: 6px 9px;
  border: 1px solid var(--ds-border);
  border-radius: 7px;
  background: var(--ds-canvas);
  color: var(--ds-text);
  font-size: 12px;
}
.library__search-input:focus {
  outline: 2px solid var(--ds-focus-ring);
  outline-offset: 1px;
}
.library__search-clear {
  flex: none;
  width: 26px;
  height: 26px;
  border: 1px solid var(--ds-border);
  border-radius: 6px;
  background: var(--ds-surface);
  color: var(--ds-text-muted);
  cursor: pointer;
  line-height: 1;
}
.library__search-clear:hover {
  background: var(--ds-accent-soft);
  color: var(--ds-accent);
}

/* ---- 空态与计数 ---- */
.library__empty {
  margin: 16px 14px;
  padding: 12px;
  border: 1px dashed var(--ds-border);
  border-radius: 8px;
  color: var(--ds-text-muted);
  font-size: 12px;
  text-align: center;
}
.library__count {
  margin-left: 6px;
  padding: 0 5px;
  border-radius: 8px;
  background: var(--ds-accent-soft);
  color: var(--ds-accent);
  font-size: 11px;
  font-weight: 500;
}

/* ---- 收藏星标 ---- */
.item {
  position: relative;
}
.item__fav {
  position: absolute;
  top: 1px;
  right: 1px;
  z-index: 1;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--ds-text-muted);
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}
/* 悬停或已收藏时显示（避免 60 个星标同时抢视觉焦点） */
.item:hover .item__fav,
.item__fav:focus-visible,
.item__fav--on {
  opacity: 1;
}
.item__fav--on {
  color: var(--ds-warning);
}
.item__fav:hover {
  background: var(--ds-accent-soft);
}
/* 触屏设备常显，否则无法发现该功能 */
@media (pointer: coarse) {
  .item__fav {
    opacity: 1;
    width: 26px;
    height: 26px;
    font-size: 15px;
    line-height: 26px;
  }
}

.library__group {
  padding-bottom: 6px;
}

.library__cat {
  margin: 0;
  padding: 12px 14px 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--ds-text-muted);
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--ds-surface);
}

.library__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 0 10px 6px;
}

.item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px 6px;
  border: 1px solid var(--ds-border);
  border-radius: 8px;
  background: var(--ds-surface-2);
  cursor: grab;
  user-select: none;
  touch-action: pan-y;
  transition: border-color 0.15s, transform 0.15s;
}

.item.dragging {
  border-color: var(--ds-accent);
  opacity: 0.5;
}

@media (hover: hover) {
  .item:hover {
    border-color: var(--ds-accent);
    transform: translateY(-1px);
  }
}

.item__thumb {
  width: 56px;
  height: 44px;
}

.item__name {
  font-weight: 500;
  font-size: 12px;
}

.item__size {
  font-size: 11px;
  color: var(--ds-text-muted);
}

.library__hint {
  padding: 10px 14px 16px;
  margin: 0;
  font-size: 12px;
  color: var(--ds-text-muted);
}
</style>

<style>
/* 幽灵图挂在 body 上（原 `#ghost`，L48-49），所以不能 scoped */
.lib-ghost {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 80;
  pointer-events: none;
  opacity: 0.8;
  transform: translate(-50%, -50%);
  filter: drop-shadow(0 4px 10px rgb(0 0 0 / 30%));
}

.lib-ghost svg {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
}
</style>
