/**
 * 画布尺寸自适应（SPEC §F.7 Resize；原 L2652-2657）。
 *
 * 约定：
 * - 首次拿到尺寸 → 调 `fitView()`；之后的尺寸变化 → **保持画面中心不动**（原语义）。
 * - 2D 与 3D 共用同一个 observer 入口：组件各自把自己接到 `onResize` 上。
 * - `stageSize` 是共享的只读快照，供 `ui.setViewMode()` 在调用 `Scene3DApi.enter(ctx)` 时取舞台尺寸
 *   （契约见 SPEC §F.4；⛔ store 不得 import 组件，所以尺寸经这个中立模块传递）。
 * - 事件解绑交给 `@vueuse/core`（SPEC §C.2 B7）。
 */
import { useResizeObserver } from '@vueuse/core';
import { reactive, type Ref } from 'vue';

/** 当前舞台尺寸快照（px）。由 2D/3D 舞台的 ResizeObserver 更新。 */
export const stageSize = reactive({ w: 0, h: 0 });

export interface ResizeFitOptions {
  /** 首次尺寸（原 `lastW === 0`）：调 `fitView()` */
  onFirst?: (w: number, h: number) => void;
  /** 后续尺寸变化：保持中心 */
  onResize?: (w: number, h: number) => void;
  /** 是否同步更新全局 `stageSize`（默认 true） */
  trackStageSize?: boolean;
}

/**
 * 给元素挂尺寸监听。
 * @param target 2D `<svg>` / 3D 容器等（`Ref` 或 `ref` 的 DOM 元素）
 */
export function useResizeFit(target: Ref<HTMLElement | SVGElement | null>, options: ResizeFitOptions = {}) {
  const { onFirst, onResize, trackStageSize = true } = options;
  let lastW = 0;
  let lastH = 0;

  useResizeObserver(target, (entries) => {
    const entry = entries[0];
    if (!entry) return;
    const rect = entry.contentRect;
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w <= 0 || h <= 0) return;
    if (trackStageSize) {
      stageSize.w = w;
      stageSize.h = h;
    }
    if (lastW === 0 && lastH === 0) {
      lastW = w;
      lastH = h;
      onFirst?.(w, h);
      return;
    }
    if (w === lastW && h === lastH) return;
    lastW = w;
    lastH = h;
    onResize?.(w, h);
  });

  return stageSize;
}
