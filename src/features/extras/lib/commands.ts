/**
 * 命令面板的**命令清单**（P1-3，SPEC §B.2）。
 *
 * 职责拆分：本文件只负责「有哪些命令 + 怎么过滤 + 快捷键冲突自检」；
 * **执行**放在 `CommandPalette.vue`（需要 store / 组件的上下文，纯函数不该碰）。
 *
 * ⛔ 快捷键约束（SPEC §B.2 P1-3 / RISK-13）：面板只新增 `Ctrl/⌘ + K`，
 * 沿用 OF §8.1 的守卫语义（焦点在输入框、3D 漫游中一律不响应），
 * ⛔ 不得抢走 `P` / `E` / `T` / `1` / `2` / `V` / `M` / `X` / `F` / `R`。
 */
import type { Translate } from './i18n';

export type CommandGroup = 'view' | 'theme' | 'tool' | 'layer' | 'edit' | 'plan' | 'export' | 'validate';

export interface CommandSpec {
  /** 稳定 id（组件用 switch 映射到执行逻辑） */
  id: string;
  group: CommandGroup;
  /** i18n key（`cmd.*`） */
  labelKey: string;
  /** 检索关键词（中英混合，便于两种语言下都能搜到） */
  keywords: readonly string[];
}

/** 面板唯一新增的快捷键（SPEC §B.2 P1-3） */
export const PALETTE_SHORTCUTS = ['ctrl+k', 'meta+k'] as const;

/** OF §8.1 已占用的单键（⛔ 面板不得使用） */
export const RESERVED_SINGLE_KEYS = ['p', 'e', 't', '1', '2', 'v', 'm', 'x', 'f', 'r', 'enter', 'delete'] as const;

/**
 * 冲突自检：面板快捷键是否踩到既有单键。
 * 有冲突时返回冲突项（正常应始终为空数组 → `extras.spec.ts` 里断言）。
 *
 * 实现注记：`PALETTE_SHORTCUTS` 是 `as const` 的字面量联合，直接与 `RESERVED_SINGLE_KEYS`
 * 比较会被 TS 判成"无重叠的比较"（TS2367）；这里显式拓宽成 `string` 再比 —— 语义不变，
 * 而且**保留**了"将来有人把 `ctrl+p` 写进面板快捷键时能被这条自检抓到"的能力。
 */
export function paletteConflicts(): string[] {
  const conflicts: string[] = [];
  const reserved: readonly string[] = RESERVED_SINGLE_KEYS;
  for (const combo of PALETTE_SHORTCUTS as readonly string[]) {
    for (const key of reserved) {
      if (combo === key || combo.endsWith(`+${key}`)) conflicts.push(combo);
    }
  }
  return conflicts;
}

export const COMMAND_SPECS: readonly CommandSpec[] = [
  { id: 'view.2d', group: 'view', labelKey: 'cmd.view.2d', keywords: ['2d', '平面', 'plan'] },
  { id: 'view.3d', group: 'view', labelKey: 'cmd.view.3d', keywords: ['3d', '场景', 'scene'] },
  { id: 'view.fit', group: 'view', labelKey: 'cmd.view.fit', keywords: ['fit', '适应', 'zoom'] },
  { id: 'view.ratio60', group: 'view', labelKey: 'cmd.view.ratio60', keywords: ['1:60', '比例', 'scale'] },
  { id: 'view.ratio100', group: 'view', labelKey: 'cmd.view.ratio100', keywords: ['1:100', '比例', 'scale'] },
  { id: 'theme.day', group: 'theme', labelKey: 'cmd.theme.day', keywords: ['theme', '日间', 'day', 'light'] },
  { id: 'theme.night', group: 'theme', labelKey: 'cmd.theme.night', keywords: ['theme', '夜间', 'night', 'dark'] },
  { id: 'theme.contrast', group: 'theme', labelKey: 'cmd.theme.contrast', keywords: ['theme', '高对比', 'contrast', 'a11y'] },
  { id: 'tool.select', group: 'tool', labelKey: 'cmd.tool.select', keywords: ['select', '选择'] },
  { id: 'tool.measure', group: 'tool', labelKey: 'cmd.tool.measure', keywords: ['measure', '测量'] },
  { id: 'tool.demolish', group: 'tool', labelKey: 'cmd.tool.demolish', keywords: ['demolish', '拆改', '拆除'] },
  { id: 'layer.dims', group: 'layer', labelKey: 'cmd.layer.dims', keywords: ['dims', '尺寸'] },
  { id: 'layer.labels', group: 'layer', labelKey: 'cmd.layer.labels', keywords: ['labels', '标签', '房间名'] },
  { id: 'layer.furn', group: 'layer', labelKey: 'cmd.layer.furn', keywords: ['furniture', '家具'] },
  { id: 'layer.grid', group: 'layer', labelKey: 'cmd.layer.grid', keywords: ['grid', '网格'] },
  { id: 'layer.bearing', group: 'layer', labelKey: 'cmd.layer.bearing', keywords: ['bearing', '承重墙'] },
  { id: 'layer.wallSnap', group: 'layer', labelKey: 'cmd.layer.wallSnap', keywords: ['snap', '吸附', '墙体'] },
  { id: 'edit.start', group: 'edit', labelKey: 'cmd.edit.start', keywords: ['edit', '编辑', '结构'] },
  { id: 'edit.undo', group: 'edit', labelKey: 'cmd.edit.undo', keywords: ['undo', '撤销'] },
  { id: 'edit.redo', group: 'edit', labelKey: 'cmd.edit.redo', keywords: ['redo', '重做'] },
  { id: 'edit.clearLayout', group: 'edit', labelKey: 'cmd.edit.clearLayout', keywords: ['clear', '清空', '布置'] },
  { id: 'plan.export', group: 'plan', labelKey: 'cmd.plan.export', keywords: ['export', '导出', 'json', '户型'] },
  { id: 'plan.exportAll', group: 'plan', labelKey: 'cmd.plan.exportAll', keywords: ['export', '导出', '全部户型'] },
  { id: 'export.png', group: 'export', labelKey: 'cmd.export.png', keywords: ['png', '图片', 'image'] },
  { id: 'export.svg', group: 'export', labelKey: 'cmd.export.svg', keywords: ['svg', '矢量', 'vector'] },
  { id: 'export.dxf', group: 'export', labelKey: 'cmd.export.dxf', keywords: ['dxf', 'cad', 'autocad'] },
  { id: 'export.csv', group: 'export', labelKey: 'cmd.export.csv', keywords: ['csv', '报价', 'cost', 'boq'] },
  { id: 'export.xlsx', group: 'export', labelKey: 'cmd.export.xlsx', keywords: ['xlsx', 'excel', '报价', 'boq'] },
  { id: 'export.print', group: 'export', labelKey: 'cmd.export.print', keywords: ['print', '打印', 'pdf', '图册'] },
  { id: 'validate.run', group: 'validate', labelKey: 'cmd.validate.run', keywords: ['validate', '校验', '检查'] },
];

export function groupLabelKey(group: CommandGroup): string {
  return `palette.group.${group}`;
}

export interface FilterOptions {
  translate: Translate;
  specs?: readonly CommandSpec[];
}

/** 过滤 + 排序（标签命中 > id 命中 > 关键词命中；同分保持原顺序） */
export function filterCommands(query: string, options: FilterOptions): CommandSpec[] {
  const specs = options.specs ?? COMMAND_SPECS;
  const q = query.trim().toLowerCase();
  if (!q) return [...specs];
  const scored: { spec: CommandSpec; index: number; score: number }[] = [];
  specs.forEach((spec, index) => {
    const label = options.translate(spec.labelKey).toLowerCase();
    const id = spec.id.toLowerCase();
    const keywords = spec.keywords.join(' ').toLowerCase();
    const score = label.includes(q) ? 3 : id.includes(q) ? 2 : keywords.includes(q) ? 1 : 0;
    if (score > 0) scored.push({ spec, index, score });
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.map((item) => item.spec);
}