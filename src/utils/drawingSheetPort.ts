/**
 * 施工图导出端口（**依赖倒置**，遵守 SPEC §C.2 B1/B2 边界）。
 *
 * ## 为什么需要这个端口
 *
 * 施工图的实现（图框 / 标题栏 / 指北针）属于 `features/plan2d` 的领域——
 * 它需要平面图的 SVG 节点与户型包围盒，都是 2D 侧的数据。
 * 而「导出」入口在 `features/extras`（导出菜单）。
 *
 * 但 SPEC §C.2 B1/B2 规定：**`features/**` 之间不得互相 import**，
 * 跨特性只能经 `stores/**` / `types/**` / `utils/**` / `theme/**`。
 *
 * 解法与 `utils/scenePort.ts` 同一模式（3D 侧也是这么做的）：
 * - 接口与注册表放中立层（本文件在 `utils/`）；
 * - `plan2d` 在初始化时注册实现；
 * - `extras` 只调用端口，不 import `plan2d`。
 *
 * ## 生命周期
 *
 * `plan2d` 的 `PlanCanvas.vue` 挂载时注册、卸载时注销。
 * 端口为空时（例如 3D 视图下 2D 画布未挂载），`extras` 应给出明确提示而不是静默失败。
 */

/** 施工图导出的输入（由调用方从 store 组装） */
export interface DrawingSheetInput {
  /** 纸张规格 */
  paper: 'a4' | 'a3' | 'a2';
  /** 图框文案 */
  labels: {
    project: string;
    plan: string;
    scale: string;
    date: string;
    area: string;
    designer: string;
    fields: {
      project: string;
      plan: string;
      scale: string;
      date: string;
      area: string;
      designer: string;
      north: string;
    };
  };
}

/** 施工图导出能力（由 `plan2d` 实现） */
export interface DrawingSheetPort {
  /** 当前是否有可导出的 2D 画布 */
  available: () => boolean;
  /** 导出带图框的 SVG 文本；无画布时返回 `null` */
  toSvg: (input: DrawingSheetInput) => string | null;
  /** 导出带图框的 PNG；失败或无画布时返回 `null` */
  toPng: (input: DrawingSheetInput) => Promise<Blob | null>;
}

let port: DrawingSheetPort | null = null;

/** `plan2d` 侧注册（挂载时调用；传 `null` 注销） */
export function registerDrawingSheetPort(next: DrawingSheetPort | null): void {
  port = next;
}

/** `extras` 侧读取 */
export function getDrawingSheetPort(): DrawingSheetPort | null {
  return port;
}
