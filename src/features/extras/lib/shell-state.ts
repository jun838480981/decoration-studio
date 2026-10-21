/**
 * 亮点层浮层的**共享开合状态**（`ExtrasToolbar` ↔ `ExtrasOverlay` 之间的唯一通道）。
 *
 * 为什么需要独立模块：工具栏挂载在 `AppHeader` 的插槽、浮层挂载在 `<main>` 之后，
 * 两个 `<component :is>` 是**兄弟节点**，没有父子关系，无法用 props/emits 传递状态。
 * 用一个轻量单例即可，避免为此引入新的 store（`stores/**` 属于冻结契约，不轻易扩）。
 *
 * 约束：
 * - 同一时刻只允许一个浮层打开（`active` 是单值而非集合），符合模态交互习惯；
 * - `issueCount` 由 `ExtrasOverlay` 在数据变化时回写，供工具栏显示告警徽标。
 */
import { computed, ref } from 'vue';

/** 可打开的浮层种类 */
export type ExtrasOverlayKind = 'export' | 'validate' | 'compare' | 'history' | 'palette';

const active = ref<ExtrasOverlayKind | null>(null);
const issueCount = ref(0);

/** 打开指定浮层（已是它则关闭，实现「再点一次收起」） */
function toggle(kind: ExtrasOverlayKind): void {
  active.value = active.value === kind ? null : kind;
}

function open(kind: ExtrasOverlayKind): void {
  active.value = kind;
}

function close(): void {
  active.value = null;
}

function isOpen(kind: ExtrasOverlayKind): boolean {
  return active.value === kind;
}

/** 供工具栏与浮层共用（单例，无需 provide/inject） */
export function useExtrasShell() {
  return {
    active: computed(() => active.value),
    issueCount,
    toggle,
    open,
    close,
    isOpen,
  };
}

/** 命令面板的命令项执行后统一收起（供 `lib/commands` 的调用方复用） */
export function closeAllOverlays(): void {
  active.value = null;
}
