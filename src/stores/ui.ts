/**
 * 交互 store（SPEC §D.7 🔒 冻结）：工具 / 选中 / 图层 / 视图变换 / 编辑态 / 视图模式 / 3D 选项。
 *
 * 初值全部按 SPEC §D.7 冻结（对应原实现 L1018-1020、L862-865、L2694），⛔ 不得「顺手调参」。
 * 跨 store 调用一律**放在函数体内**（惰性），避免模块初始化期的循环依赖。
 */
import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';
import { TAP_PX } from '@/composables/usePointerKind';
import { stageSize } from '@/composables/useResizeFit';
import { readJson, STORAGE_KEYS, writeJson } from '@/utils/persistence';
import { getScene3DApi } from '@/utils/scenePort';
import { usePlanStore } from './plan';
import { useToastStore } from './toast';
import type { Vec2 } from '@/types/geometry';
import type {
  EditMode,
  EditState,
  LayerFlags,
  Selection,
  SnapMode,
  Tool,
  View3dOptions,
  ViewTransform,
} from '@/types/state';
import type { WallKind } from '@/types/plan';

/**
 * 缩放 clamp 区间（SPEC §D.7 🔒 冻结；原 L1606）。
 * ⚠️ **规范位置就在本文件**（SPEC.md 第 520-522 行），⛔ 不得下沉到 `composables/usePointerKind.ts`
 * ——那里只负责指针类型；C-1 就是「从 usePointerKind 里 import 了这三个从未定义的常量」导致的构建阻断。
 */
export const MIN_SCALE = 0.012;
export const MAX_SCALE = 2;

/** mm / px 换算（SPEC §D.7 🔒 冻结；原 L1002 `PX_MM = 25.4/96` ≈ 0.2645833…） */
export const PX_MM = 25.4 / 96;

/**
 * 点击命中容差：桌面 4px / 触屏 9px（SPEC §D.7 第 522 行；原 L1004）。
 * 单一定义在 `composables/usePointerKind.ts`（由 `COARSE` 派生），此处**再导出**，
 * 使下游（`stores/index.ts`、`contracts.spec.ts`、2D/3D 组件）仍可从 `@/stores/ui` 取到。
 */
export { TAP_PX };

/** 图层默认值（原 L1018-1019，SPEC §D.7 冻结） */
export const layers = reactive<LayerFlags>({
  dims: true,
  labels: true,
  furn: true,
  grid: false,
  bearing: false,
  wallSnap: true,
});

/** 比例尺候选（原 L1594-1596） */
export const SCALE_BAR_STEPS = [100, 200, 500, 1000, 2000, 5000] as const;

/** 抽屉开合状态（= `huxing-panes` 的值结构，SPEC §D.8 / OF §4.2） */
export interface PanesState {
  hideLib: boolean;
  hidePanel: boolean;
}

/** 抽屉初值（原 L1447：两侧栏默认展开；SPEC §D.7 冻结，⛔ 不得改字段名与初值） */
export const PANES_DEFAULT: PanesState = { hideLib: false, hidePanel: false };

/**
 * 读 `huxing-panes`（C-4 裁定 / SPEC §D.8 / §K 第 6 条）。
 * 存储值允许只写一个字段（OF §4.2 标为 `hideLib?`/`hidePanel?`），因此逐字段合并默认值；
 * 非布尔值一律回落到默认值（坏数据不抛错，与 `readJson` 的静默降级一致）。
 */
function loadPanes(): PanesState {
  // SPEC §K.3 第 6 条：启动时 `readJson(STORAGE_KEYS.panes, { hideLib: false, hidePanel: false })`
  const raw = readJson<Partial<PanesState> | null>(STORAGE_KEYS.panes, null);
  const value: Partial<PanesState> = raw ?? {};
  return {
    hideLib: typeof value.hideLib === 'boolean' ? value.hideLib : PANES_DEFAULT.hideLib,
    hidePanel: typeof value.hidePanel === 'boolean' ? value.hidePanel : PANES_DEFAULT.hidePanel,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export const useUiStore = defineStore('ui', () => {
  const tool = ref<Tool>('select');
  const selection = ref<Selection>(null);
  const measureA = ref<Vec2 | null>(null);
  const measureCur = ref<Vec2 | null>(null);
  const flags = reactive<LayerFlags>({ ...layers });
  /** 初值冻结（原 L1020 `view = {x0:0,y0:0,s:.06}`） */
  const view = reactive<ViewTransform>({ x0: 0, y0: 0, s: 0.06 });
  /** 编辑态默认值（原 L862-865，SPEC §D.7 冻结） */
  const edit = reactive<EditState>({
    on: false,
    mode: 'wall',
    kind: 'n',
    thick: 200,
    doorW: 900,
    winW: 1500,
    grid: 100,
    snap: 'grid',
    ortho: true,
    pts: [],
    drag: null,
    hover: null,
    rawHover: null,
    axis: null,
    savedGridLayer: null,
  });
  const viewMode = ref<'2d' | '3d'>('2d');
  /** 3D 选项默认值（原 L2694，SPEC §D.7 冻结） */
  const view3d = reactive<View3dOptions>({ cut: 2.8, furn: true, labels: true, night: false, hour: 10, mode: 'orbit' });
  /** 抽屉开合：初值来自 `huxing-panes`（读不到时 = 两侧栏展开，原 L1447；SPEC §D.7 冻结） */
  const panes = reactive<PanesState>(loadPanes());
  const switching = ref(false);

  const is3D = computed<boolean>(() => viewMode.value === '3d');

  /** 当前比例分母（原 L1592-1593：`1/(view.s*PX_MM)`） */
  const ratio = computed<number>(() => 1 / (view.s * PX_MM));
  const ratioLabel = computed<string>(() => `1:${Math.round(ratio.value)}`);

  /** 比例尺：取第一个 `v * view.s >= 60` 的档位（原 L1594-1596） */
  const scaleBar = computed<{ len: number; label: string }>(() => {
    const step = SCALE_BAR_STEPS.find((v) => v * view.s >= 60) ?? SCALE_BAR_STEPS[SCALE_BAR_STEPS.length - 1];
    const len = step * view.s;
    return { len, label: step >= 1000 ? `${step / 1000} m` : `${step} mm` };
  });

  function setTool(t: Tool): void {
    tool.value = t;
    if (t !== 'measure') {
      measureA.value = null;
      measureCur.value = null;
    }
  }

  function select(sel: Selection): void {
    selection.value = sel;
  }

  function toggleLayer(k: keyof LayerFlags): void {
    flags[k] = !flags[k];
  }

  /**
   * 把 `view` 应用到 2D 舞台。SPEC §D.7 冻结签名。
   * 实现策略：图层组件按 SPEC §F.2 的依赖矩阵 `watch(view)` 自行写 SVG 变换，
   * 因此这里**有意不**做命令式 DOM 写入（原实现直接改 DOM，正是 X4 类问题的同源）。
   */
  function applyView(): void {
    /* no-op by design：见上方注释与 SPEC §F.2 */
  }

  /** 适应窗口（原 L1599-1604）：`s = min(W/BOUNDS.w, H/BOUNDS.h)` 并把包围盒居中 */
  function fitView(stageW: number, stageH: number): void {
    const plan = usePlanStore();
    const b = plan.bounds;
    if (stageW <= 0 || stageH <= 0 || b.w <= 0 || b.h <= 0) return;
    const s = clamp(Math.min(stageW / b.w, stageH / b.h), MIN_SCALE, MAX_SCALE);
    view.s = s;
    view.x0 = b.x + b.w / 2 - stageW / (2 * s);
    view.y0 = b.y + b.h / 2 - stageH / (2 * s);
    applyView();
  }

  /** 以屏幕锚点缩放（原 L1606 的钳制 + 锚点不动语义） */
  function zoomAt(nextScale: number, anchorX: number, anchorY: number): void {
    const s = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    const worldX = view.x0 + anchorX / view.s;
    const worldY = view.y0 + anchorY / view.s;
    view.s = s;
    view.x0 = worldX - anchorX / s;
    view.y0 = worldY - anchorY / s;
    applyView();
  }

  /** 以舞台中心缩放（按钮 ×1.25 / ×0.8，原 L2577-2578） */
  function zoomCenter(factor: number): void {
    const w = stageSize.w > 0 ? stageSize.w : 1;
    const h = stageSize.h > 0 ? stageSize.h : 1;
    zoomAt(view.s * factor, w / 2, h / 2);
  }

  /** 1:60 / 1:100（原 L1611） */
  function setRatio(r: number, stageW: number, stageH: number): void {
    if (r <= 0) return;
    zoomAt(1 / (r * PX_MM), stageW / 2, stageH / 2);
  }

  /** 进入结构编辑（原 L2278-2293：内置户型先转自定义副本） */
  function startEdit(): void {
    const plan = usePlanStore();
    if (plan.plan.builtin) plan.ensureCustom();
    edit.savedGridLayer = flags.grid;
    edit.on = true;
    edit.mode = 'wall';
    edit.pts = [];
    edit.drag = null;
    edit.hover = null;
    edit.rawHover = null;
    edit.axis = null;
    applyView();
  }

  /** 退出编辑（原 L2294-2301：恢复编辑前的网格图层状态） */
  function endEdit(): void {
    if (edit.savedGridLayer !== null) {
      flags.grid = edit.savedGridLayer;
      edit.savedGridLayer = null;
    }
    edit.on = false;
    edit.pts = [];
    edit.drag = null;
    edit.hover = null;
    edit.rawHover = null;
    edit.axis = null;
    applyView();
  }

  function setEditMode(m: EditMode): void {
    edit.mode = m;
    edit.pts = [];
    edit.drag = null;
  }

  function setEditKind(k: WallKind): void {
    edit.kind = k;
  }

  function setEditParam(k: 'thick' | 'doorW' | 'winW' | 'grid', v: number): void {
    if (!Number.isFinite(v)) return;
    edit[k] = Math.max(1, v);
  }

  function setSnap(m: SnapMode): void {
    edit.snap = m;
  }

  function toggleOrtho(): void {
    edit.ortho = !edit.ortho;
  }

  /**
   * 抽屉开合（原 L1448-1462）。
   * 写侧接线 `huxing-panes`（C-4 裁定 / SPEC §D.8 / §K.3 第 6 条）：改完两个字段后立即落盘。
   * `readJson`/`writeJson` 在 `utils/persistence.ts` 内静默降级（无 localStorage / 配额满都不抛错），
   * 因此这里不需要额外 try/catch，也不改变 `openDrawer` 的冻结签名与 `panes` 的字段名/初值。
   */
  function openDrawer(which: 'lib' | 'panel' | null, open = true): void {
    if (which === null) return;
    if (which === 'lib') panes.hideLib = !open;
    if (which === 'panel') panes.hidePanel = !open;
    writeJson(STORAGE_KEYS.panes, { hideLib: panes.hideLib, hidePanel: panes.hidePanel });
  }

  /**
   * 2D / 3D 切换（原 L2558-2567，SPEC §D.7 + §F.4）。
   * 契约：`switching` 互斥；进 3D 前强制回 `select` 工具并清空测量起点；
   * 3D 组件经 `utils/scenePort` 注册（⛔ 不用 `window.View3D`，X3 不保留项）。
   */
  async function setViewMode(m: '2d' | '3d'): Promise<void> {
    if (m === viewMode.value || switching.value) return;
    const toast = useToastStore();
    const scene = getScene3DApi();
    switching.value = true;
    try {
      if (m === '3d') {
        if (!scene) {
          toast.push('3D 模块尚未就绪', 'warn');
          return;
        }
        setTool('select');
        measureA.value = null;
        measureCur.value = null;
        viewMode.value = '3d';
        await scene.enter({ view: { ...view }, stageW: stageSize.w, stageH: stageSize.h });
      } else {
        await scene?.exit();
        viewMode.value = '2d';
      }
    } finally {
      switching.value = false;
    }
  }

  /** 3D 选项（原 `opt` 的写入口） */
  function set3dOption<K extends keyof View3dOptions>(k: K, v: View3dOptions[K]): void {
    Object.assign(view3d, { [k]: v } as Partial<View3dOptions>);
  }

  return {
    tool,
    selection,
    measureA,
    measureCur,
    flags,
    view,
    edit,
    viewMode,
    view3d,
    panes,
    switching,
    is3D,
    ratio,
    ratioLabel,
    scaleBar,
    setTool,
    select,
    toggleLayer,
    applyView,
    fitView,
    zoomAt,
    zoomCenter,
    setRatio,
    startEdit,
    endEdit,
    setEditMode,
    setEditKind,
    setEditParam,
    setSnap,
    toggleOrtho,
    openDrawer,
    setViewMode,
    set3dOption,
  };
});

export type UiStore = ReturnType<typeof useUiStore>;
