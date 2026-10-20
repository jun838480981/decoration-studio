/**
 * 跨特性共享纯 UI 组件目录（SPEC §C.1：**t3 创建，下游只读不改契约**）。
 *
 * 这些组件的**文件与职责**在这里定稿；实现归属见下表（⛔ 不要在两条线里各写一份）：
 *
 * | 组件 | 职责 | 实现归属 |
 * | --- | --- | --- |
 * | `AppHeader.vue` | 品牌、工具栏、撤销/重做、主题切换、语言、全屏、截图/斜视/俯视 | t4 |
 * | `ToolBar.vue` | 选择/测量/拆改、图层 6 项、2D/3D、缩放与 1:60 / 1:100 | t4 |
 * | `FurnitureLibrary.vue` | 家具库 6 分类 60 条目、pointer 拖放、3D 落点 | t4 |
 * | `PropertyPanel.vue` | 选中属性、房间名/材质、面积与报价、拆改统计 | t4 |
 * | `PlanLibraryModal.vue` | 多方案（7 内置 + 自定义）新建/复制/改名/删除/缩略图/导入导出 | t4 |
 * | `FloorSwitcher.vue` | 复式楼层切换（`plan.switchLevel`） | t4 |
 * | `ToastHost.vue` | 提示队列渲染（`stores/toast`，替代 `#toast` 单定时器 X7） | t3 骨架已定契约，t4 实现 |
 * | `SelectionFab.vue` | 触屏选中浮动操作（旋转/删除/复制，触屏热区 `TAP_PX`） | t4 |
 * | `dialogs/ConfirmDialog.vue` / `dialogs/PromptDialog.vue` | 替代原生 `confirm()` / `prompt()`（X5） | t4 |
 *
 * 硬约束（ESLint 强制）：本目录组件
 * - ⛔ 不得直接读写 `localStorage`（B6，只能经 `utils/persistence.ts`）；
 * - ⛔ 不得直接 `addEventListener`（B7，用 `@vueuse/core`）；
 * - 取色只能用 `useTheme()` 的 `cssVar()` / `resolve()`（B3/B9）。
 */
export const SHARED_COMPONENTS = [
  'AppHeader.vue',
  'ToolBar.vue',
  'FurnitureLibrary.vue',
  'PropertyPanel.vue',
  'PlanLibraryModal.vue',
  'FloorSwitcher.vue',
  'ToastHost.vue',
  'SelectionFab.vue',
  'dialogs/ConfirmDialog.vue',
  'dialogs/PromptDialog.vue',
] as const;