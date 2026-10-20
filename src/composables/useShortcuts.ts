/**
 * 全局快捷键（原 `document.addEventListener('keydown', …)`，`装修设计.html` L1777-1810）。
 *
 * 逐条保真（OF §8.1 的 30 项里属于 2D/全局的部分）：
 *
 * | 按键 | 行为 | 原行号 |
 * | --- | --- | --- |
 * | `Ctrl/⌘+Z` / `Ctrl/⌘+Shift+Z` / `Ctrl/⌘+Y` | 撤销 / 重做 | L1781-1782 |
 * | `Ctrl/⌘+D` | 复制选中家具 | L1783 |
 * | `[` / `]` | 家具库 / 属性面板抽屉 | L1785 |
 * | `P` | 户型库 | L1786 |
 * | `1` / `2` | 复式切层（多层，且无 Shift） | L1787 |
 * | `E` | 进入 / 退出结构编辑（仅 2D） | L1788 |
 * | `Enter` | 闭合绘制中的房间 | L1789 |
 * | `Shift+F` | 全屏 | L1790 |
 * | `T` | 2D / 3D 切换 | L1791 |
 * | `V` / `M` / `X` | 选择 / 测量 / 拆改 | L1793-1795 |
 * | `F` | 适应窗口 | L1796 |
 * | `R` / `Shift+R` | 旋转 ±90° | L1797 |
 * | `Delete` / `Backspace` | 删除选中 | L1798 |
 * | `Esc` | 编辑绘制点 → 户型弹窗 → 测量起点 → 回选择工具 | L1799-1803 |
 * | `↑ ↓ ← →`（`Shift` ×10） | 微调 10mm / 100mm | L1804-1807 |
 * | `+` / `=` / `-` | 放大 / 缩小 | L1808-1809 |
 *
 * 前置守卫（原 L1778-1779）：焦点在 `input/select/textarea` 时全部失效；3D 漫游中全部失效。
 * 3D 模式下 `v/m/x/f/+/-` 被忽略（原 L1792）。
 *
 * ⛔ 不直接 `addEventListener`：事件生命周期交给 `@vueuse/core`（SPEC §C.2 B7）。
 * ⛔ 不抢亮点层的 `Ctrl/⌘+K`（P1-3 命令面板；`RESERVED_SINGLE_KEYS` 见 `features/extras/lib/commands.ts`）。
 */
import { useEventListener } from '@vueuse/core';
import { useFullscreen } from '@vueuse/core';
import { useLayoutStore } from '@/stores/layout';
import { usePlanStore } from '@/stores/plan';
import { useToastStore } from '@/stores/toast';
import { useUiStore } from '@/stores/ui';
import { closeExtras, overlays, togglePlanLibrary } from '@/composables/useOverlays';
import { getScene3DApi } from '@/utils/scenePort';

export interface ShortcutOptions {
  /** 适应窗口（`F`；画布尺寸在组件里，故由调用方注入） */
  fit?: () => void;
  /** 闭合绘制中的房间（`Enter`；编辑内核在 `features/plan2d`，由画布注入） */
  closeRoom?: () => void;
}

/** 3D 模式下被忽略的键（原 L1792） */
const THREE_D_IGNORED = ['v', 'm', 'x', 'f', '+', '=', '-'] as const;

/** 是否在输入控件里（原 L1778：`input,select,textarea`） */
function inEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input,select,textarea,[contenteditable="true"]'));
}

export function useShortcuts(options: ShortcutOptions = {}): void {
  const plan = usePlanStore();
  const layout = useLayoutStore();
  const ui = useUiStore();
  const toast = useToastStore();
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  function undo(): void {
    // 两套历史栈互不干扰（OF §9.5 风险 2）：编辑模式下 Ctrl+Z 走**结构栈**，否则走布置栈
    if (ui.edit.on) {
      if (!plan.planUndo()) toast.push('没有可撤销的户型修改', 'warn');
      return;
    }
    if (!layout.undo()) toast.push('没有可撤销的操作', 'warn');
  }

  function redo(): void {
    if (!layout.redo()) toast.push('没有可重做的操作', 'warn');
  }

  function escape(): void {
    if (ui.edit.on && (ui.edit.pts.length > 0 || ui.edit.drag)) {
      ui.edit.pts = [];
      ui.edit.drag = null;
      ui.edit.hover = null;
      ui.edit.rawHover = null;
      ui.edit.axis = null;
      return;
    }
    if (overlays.planLibrary) {
      overlays.planLibrary = false;
      return;
    }
    if (overlays.extras) {
      closeExtras();
      return;
    }
    if (ui.measureA) {
      ui.measureA = null;
      ui.measureCur = null;
      return;
    }
    if (ui.tool !== 'select') ui.setTool('select');
    ui.select(null);
  }

  useEventListener(document, 'keydown', (event: KeyboardEvent) => {
    if (inEditable(event.target)) return;
    if (getScene3DApi()?.walking()) return;

    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();

    if (mod && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (mod && key === 'y') {
      event.preventDefault();
      redo();
      return;
    }
    if (mod && key === 'd') {
      event.preventDefault();
      const copy = layout.duplicateSelection();
      if (copy) ui.select({ kind: 'furn', id: copy.id });
      return;
    }
    if (mod) return;

    if (key === '[' || key === ']') {
      ui.openDrawer(key === '[' ? 'lib' : 'panel');
      return;
    }
    if (key === 'p') {
      togglePlanLibrary();
      return;
    }
    if (plan.isMulti && (key === '1' || key === '2') && !event.shiftKey) {
      plan.switchLevel(Number(key) - 1);
      return;
    }
    if (key === 'e' && !ui.is3D) {
      if (ui.edit.on) ui.endEdit();
      else ui.startEdit();
      return;
    }
    if (key === 'enter' && ui.edit.on && ui.edit.mode === 'room') {
      event.preventDefault();
      options.closeRoom?.();
      return;
    }
    if (key === 'f' && event.shiftKey) {
      void toggleFullscreen();
      return;
    }
    if (key === 't') {
      void ui.setViewMode(ui.is3D ? '2d' : '3d');
      return;
    }
    if (ui.is3D && (THREE_D_IGNORED as readonly string[]).includes(key)) return;

    if (key === 'v') ui.setTool('select');
    else if (key === 'm') ui.setTool('measure');
    else if (key === 'x') ui.setTool('demolish');
    else if (key === 'f') options.fit?.();
    else if (key === 'r') layout.rotateSelection(event.shiftKey ? -90 : 90);
    else if (key === 'delete' || key === 'backspace') {
      event.preventDefault();
      layout.deleteSelection();
    } else if (key === 'escape') escape();
    else if (key.startsWith('arrow') && ui.selection?.kind === 'furn') {
      event.preventDefault();
      const step = event.shiftKey ? 100 : 10;
      const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0;
      const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0;
      layout.nudgeSelection(dx, dy);
    } else if (key === '+' || key === '=') ui.zoomCenter(1.25);
    else if (key === '-') ui.zoomCenter(0.8);
  });

  // 全屏状态文案（`Shift+F` 之外的入口也要同步；原 `syncFullscreen`，L2596-2600）
  void isFullscreen;
}
