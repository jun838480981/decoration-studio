/**
 * 图层通用外壳（内部用，非公开 API）。
 *
 * 10 个图层组件都是「一个 `<g>` + 一段 SVG 字符串」，共同点：
 * - `<g>` 的 id 必须与 `export-svg.ts` 的 `SVG_LAYER_IDS` 一致（导出按 id 定位）；
 * - 显隐用 `display="inline|none"`（⛔ 不卸载 DOM：导出/命中测试都要求节点存在，原 L1279）；
 * - 标签/尺寸/测量/编辑层 `pointer-events="none"`（原 L363-367），其余层保持默认。
 *
 * 为什么用**函数式组件 + innerHTML** 而不是 `v-html`：
 * 10 个文件各写一次 `v-html` 会触发 `vue/no-v-html` 警告，且转义责任会散落；
 * 转义责任统一在 `svg.ts#esc()`（用户可编辑的房间名/家具名必须经它，原实现有 `esc()`）。
 *
 * 为什么每个图层是独立组件：SPEC §F.2 的**重建触发矩阵**要求「依赖变更 → 只重算该层」。
 * 每个组件的 `computed` 只读自己那一行的依赖源，家具拖动时其它 8 层不会重算（RISK-03）。
 */
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';

export interface SvgGroupProps {
  /** 图层组 id（`gGrid` / `gRooms` / … / `gEdit`） */
  id: string;
  /** 已转义的 SVG 片段 */
  html: string;
  /** 是否显示（缺省显示） */
  visible?: boolean;
  /** 是否忽略指针事件（标签/尺寸/测量/编辑层为 `true`） */
  passive?: boolean;
}

/** `<g>` 图层外壳 */
export const SvgGroup: FunctionalComponent<SvgGroupProps> = (props) =>
  h('g', {
    id: props.id,
    display: props.visible === false ? 'none' : 'inline',
    'pointer-events': props.passive ? 'none' : 'all',
    innerHTML: props.html,
  });

SvgGroup.props = ['id', 'html', 'visible', 'passive'];
SvgGroup.displayName = 'SvgGroup';

/** `<defs>` 外壳（材质图案 + 网格图案；`patterns.ts` 的产物是纯字符串） */
export const SvgDefs: FunctionalComponent<{ html: string }> = (props) =>
  h('defs', { id: 'defs', innerHTML: props.html });

SvgDefs.props = ['html'];
SvgDefs.displayName = 'SvgDefs';
