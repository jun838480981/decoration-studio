/**
 * 模态对话框焦点管理（焦点陷阱 + 初始聚焦 + 关闭后归还焦点）。
 *
 * 为什么需要：`role="dialog"` + `aria-modal="true"` 是在向屏幕阅读器**承诺**「焦点被限制在对话框内」。
 * 只写属性、不做陷阱，等于给出错误语义——用户按 Tab 会跑到背后的页面上，键盘用户完全迷失。
 *
 * 实现要点：
 * - 打开时记录 `document.activeElement`，关闭时还原（否则焦点掉回 `<body>`）；
 * - Tab / Shift+Tab 在**首尾元素之间循环**，永不离开容器；
 * - 监听 `keydown` 用 `useEventListener`（SPEC §C.2 B7：组件不得裸 `addEventListener`），
 *   且只在打开时绑定、关闭时自动解绑；
 * - 容器内没有可聚焦元素时，把容器自身设为可聚焦（`tabindex="-1"`），避免陷阱失效。
 *
 * 用法：
 * ```ts
 * const boxRef = ref<HTMLElement | null>(null);
 * useFocusTrap(boxRef, () => props.open);
 * ```
 */
import { useEventListener } from '@vueuse/core';
import { nextTick, watch, type Ref } from 'vue';

/** 可聚焦选择器（与浏览器实际 Tab 行为尽量一致） */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableIn(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    // 过滤不可见元素（offsetParent 为 null 且不是 fixed 定位）
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
    return !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true';
  });
}

export interface FocusTrapOptions {
  /** 打开时是否自动聚焦第一个可聚焦元素（默认 true） */
  autoFocus?: boolean;
  /** 关闭后是否把焦点还给打开前的元素（默认 true） */
  restoreFocus?: boolean;
}

/**
 * @param container 对话框容器（`role="dialog"` 的那一层）
 * @param active    是否处于打开状态（传 getter，支持 `() => props.open`）
 */
export function useFocusTrap(
  container: Ref<HTMLElement | null>,
  active: () => boolean,
  options: FocusTrapOptions = {},
): void {
  const { autoFocus = true, restoreFocus = true } = options;
  let previouslyFocused: HTMLElement | null = null;

  watch(
    active,
    async (isOpen) => {
      if (isOpen) {
        previouslyFocused = document.activeElement as HTMLElement | null;
        await nextTick();
        const el = container.value;
        if (!el) return;
        if (autoFocus) {
          const first = focusableIn(el)[0];
          if (first) first.focus();
          else {
            // 没有可聚焦子元素：容器自身接管焦点，保证 Tab 陷阱不失效
            if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
            el.focus();
          }
        }
      } else if (restoreFocus && previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
        previouslyFocused = null;
      }
    },
    { immediate: true },
  );

  useEventListener(document, 'keydown', (event: KeyboardEvent) => {
    if (!active()) return;
    if (event.key !== 'Tab') return;
    const el = container.value;
    if (!el) return;

    const items = focusableIn(el);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const current = document.activeElement as HTMLElement | null;

    // 焦点不在容器内（例如用户点了容器外）：拉回第一个
    if (!current || !el.contains(current)) {
      event.preventDefault();
      first.focus();
      return;
    }
    if (event.shiftKey && current === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  });
}
