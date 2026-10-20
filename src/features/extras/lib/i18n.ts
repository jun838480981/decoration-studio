/**
 * 亮点层文案（中英双语）。
 *
 * 定位：这是**亮点层的局部文案表**，不是整套 i18n 方案。
 * - P0-2 的正式国际化（`vue-i18n`）由 t4 接入全局；本文件用 `extrasMessagesForI18n()`
 *   把同一批 key 还原成嵌套结构，届时直接并入 `createI18n({ messages })` 即可，⛔ 不需要重写文案。
 * - 语言来源是既有的 `huxing-lang` 键（SPEC §D.8，OF §1.10），经 `utils/persistence.ts` 读取
 *   → 满足 SPEC §C.2 B6（组件不得直接碰 `localStorage`）。
 * - ⛔ 本文件不得出现十六进制色值（SPEC §C.2 B3）。
 */
import { readRaw, STORAGE_KEYS } from '@/utils/persistence';
import type { MaterialKey } from '@/types/material';

export type Lang = 'zh' | 'en';

export const LANGS: readonly Lang[] = ['zh', 'en'];

/** 默认语言（OF §1.10：无存储值时中文） */
export const DEFAULT_LANG: Lang = 'zh';

export function normalizeLang(value: unknown): Lang {
  return value === 'en' ? 'en' : 'zh';
}

/** 当前语言（读 `huxing-lang`；键名只在 `utils/persistence.ts` 定义一次） */
export function currentLang(): Lang {
  return normalizeLang(readRaw(STORAGE_KEYS.lang));
}

/**
 * 文案表：`[中文, English]`。
 * key 用点号分层，`extrasMessagesForI18n()` 会还原成 vue-i18n 的嵌套 messages。
 */
const MESSAGES = {
  'common.close': ['关闭', 'Close'],
  'common.cancel': ['取消', 'Cancel'],
  'common.confirm': ['确定', 'OK'],
  'common.open': ['打开', 'Open'],
  'common.refresh': ['刷新', 'Refresh'],
  'common.empty': ['暂无数据', 'No data'],
  'common.name': ['名称', 'Name'],
  'common.quantity': ['数量', 'Quantity'],
  'common.unit': ['单位', 'Unit'],
  'common.price': ['单价', 'Unit price'],
  'common.amount': ['金额', 'Amount'],
  'common.severity': ['级别', 'Severity'],
  'common.rule': ['规则', 'Rule'],
  'common.counted': ['计入使用面积', 'Counted'],
  'common.detail': ['说明', 'Detail'],
  'common.target': ['对象', 'Target'],
  'common.total': ['合计', 'Total'],
  'common.metric': ['指标', 'Metric'],
  'common.base': ['基准', 'Baseline'],
  'common.delta': ['差值', 'Delta'],
  'common.export': ['导出', 'Export'],
  'common.print': ['打印', 'Print'],
  'common.copy': ['复制', 'Copy'],
  'common.remove': ['移除', 'Remove'],

  'extras.title': ['亮点功能', 'Extras'],
  'extras.hint': [
    '亮点层（P0-3…P0-8 / P1-2…P1-4）与 store 契约、主题令牌共用同一份数据源。',
    'Extras (P0-3…P0-8 / P1-2…P1-4) share the same store contract and theme tokens.',
  ],

  'theme.title': ['主题预设', 'Theme preset'],
  'theme.hint': [
    '2D 图纸 / 3D 材质 / 导出产物共用同一套令牌（切换后导出颜色随之变化）。',
    '2D drawing, 3D materials and exports all read the same token set.',
  ],

  'export.title': ['导出', 'Export'],
  'export.imageSection': ['图片', 'Images'],
  'export.cadSection': ['CAD', 'CAD'],
  'export.sheetSection': ['工程量清单', 'Bill of quantities'],
  'export.planSection': ['方案数据', 'Plan data'],
  'export.printSection': ['打印 / 图册', 'Print / album'],
  'export.png2d': ['导出 PNG（2D 平面）', 'Export PNG (2D plan)'],
  'export.png3d': ['导出 PNG（3D 截图）', 'Export PNG (3D screenshot)'],
  'export.svg': ['导出 SVG（矢量）', 'Export SVG (vector)'],
  'export.dxf': ['导出 DXF（CAD）', 'Export DXF (CAD)'],
  'export.csv': ['导出 CSV（报价 / 清单）', 'Export CSV (cost / BOQ)'],
  'export.xlsx': ['导出 XLSX（报价 / 清单）', 'Export XLSX (cost / BOQ)'],
  'export.jsonPlan': ['导出当前户型 JSON', 'Export current plan JSON'],
  'export.jsonAll': ['导出全部户型 JSON', 'Export all plans JSON'],
  'export.jsonLayout': ['导出布置 JSON', 'Export layout JSON'],
  'export.importJson': ['导入布置 JSON', 'Import layout JSON'],
  'export.importPlan': ['导入户型 JSON', 'Import plan JSON'],
  'export.print': ['打印（可另存为 PDF）', 'Print (save as PDF)'],
  'export.pdf': ['导出 PDF 图册', 'Export PDF album'],
  'export.pdfUnavailable': [
    'PDF 图册未实现（P1-1 可选）：未安装 pdf-lib / @pdf-lib/fontkit；请用「打印 → 另存为 PDF」',
    'PDF album not implemented (P1-1 optional): pdf-lib / @pdf-lib/fontkit not installed; use Print → Save as PDF',
  ],
  'export.done': ['已生成 {name}', 'Saved {name}'],
  'export.failed': ['导出失败：{reason}', 'Export failed: {reason}'],
  'export.no2dSvg': [
    '2D 画布节点未就绪（导出需要 <svg> 节点）：请先切到 2D 并等待画布渲染',
    '2D canvas node is not ready (an <svg> node is required): switch to 2D first',
  ],
  'export.no3d': ['3D 模块未就绪', '3D module is not ready'],
  'export.xlsxFallback': ['XLSX 失败，请改用 CSV：{reason}', 'XLSX failed, fall back to CSV: {reason}'],
  'export.emptyLayout': ['当前户型还没有布置，导出的清单会是空的', 'Current plan has no layout yet; the sheet will be empty'],
  'export.dxfNote': [
    'DXF 使用 CAD 标准 ACI 色号与图层，不跟随主题令牌（矢量平面图与 PNG 跟随主题）。',
    'DXF uses CAD-standard ACI colors and layers; theme tokens drive SVG/PNG instead.',
  ],

  'cost.title': ['报价单 / 工程量清单', 'Cost report / BOQ'],
  'cost.roomTable': ['房间面积与材料', 'Room areas and materials'],
  'cost.materialTable': ['地面材料用量', 'Flooring materials'],
  'cost.netArea': ['套内使用面积', 'Net floor area'],
  'cost.flooringTotal': ['地面材料合计', 'Flooring total'],
  'cost.material': ['材质', 'Material'],
  'cost.roomArea': ['面积', 'Area'],
  'cost.wallArea': ['墙面面积（估算，未扣洞口）', 'Wall area (estimated, no openings deducted)'],
  'cost.demolition': ['拆除墙体长度', 'Removed wall length'],
  'cost.wasteNote': ['* 含 5% 损耗；飘窗不计入使用面积；面积按墙体内净尺寸计算', '* Includes 5% waste; bay windows excluded from net area; areas use net inner dimensions'],
  'cost.roomCount': ['房间数', 'Rooms'],
  'cost.furnitureCount': ['家具数量', 'Furniture'],
  'cost.emptyHint': [
    '统计口径（面积/材料/拆除）由 stores/layout 的 getter 提供，当前仍是 t3 占位零值；t4 落地后本表自动出数。',
    'Metrics come from stores/layout getters; they are still t3 placeholders and will populate after t4.',
  ],
  'cost.generatedAt': ['生成时间', 'Generated at'],

  'compare.title': ['多方案对比', 'Plan comparison'],
  'compare.hint': [
    '勾选 2 个以上方案并排对比；差量为「本方案 − 基准方案」。',
    'Select two or more plans; delta is “this plan − baseline”.',
  ],
  'compare.selectAll': ['全选', 'Select all'],
  'compare.clear': ['清空选择', 'Clear selection'],
  'compare.noDiff': ['所选方案之间没有差异', 'No differences between the selected plans'],
  'compare.diffSummary': ['差异摘要', 'Difference summary'],
  'compare.needTwo': ['至少选择 2 个方案才能对比', 'Select at least two plans to compare'],
  'compare.builtin': ['内置', 'Built-in'],
  'compare.custom': ['自定义', 'Custom'],
  'compare.selectPlans': ['选择方案', 'Select plans'],

  'history.title': ['历史与快照', 'History and snapshots'],
  'history.hint': [
    '布置撤销栈 150 步 / 结构撤销栈 80 步保持双栈隔离；命名快照仅存在于本次会话（SPEC §D.8 禁止新增存储键）。',
    'Layout undo (150) and structure undo (80) stay separate; named snapshots live in this session only.',
  ],
  'history.steps': ['布置历史', 'Layout history'],
  'history.current': ['当前状态', 'Current state'],
  'history.step': ['第 {n} 步', 'Step {n}'],
  'history.capture': ['命名快照', 'Save snapshot'],
  'history.capturePlaceholder': ['快照名称（如：方案 A 定稿）', 'Snapshot name'],
  'history.named': ['命名快照', 'Named snapshots'],
  'history.jump': ['跳转', 'Go to'],
  'history.compareWith': ['与当前对比', 'Compare with current'],
  'history.empty': ['还没有可撤销的步骤', 'No undoable steps yet'],
  'history.namedEmpty': ['还没有命名快照', 'No named snapshots yet'],
  'history.captured': ['已保存快照「{name}」', 'Snapshot saved: {name}'],

  'validation.title': ['平面图校验', 'Plan validation'],
  'validation.run': ['重新校验', 'Re-run validation'],
  'validation.allPass': ['未发现问题（{n} 条规则全部通过）', 'No issues found (all {n} rules passed)'],
  'validation.count': ['{error} 错误 · {warn} 提醒 · {info} 提示', '{error} errors · {warn} warnings · {info} notes'],
  'validation.clickHint': ['点击告警可在 2D 中定位并选中对应对象', 'Click an issue to focus and select it in 2D'],
  'validation.empty': ['当前户型没有房间结构，无法校验', 'No rooms in the current plan; nothing to validate'],
  'validation.rule.furniture-through-wall': ['家具穿墙', 'Furniture through wall'],
  'validation.rule.furniture-blocking-door': ['家具压门洞', 'Furniture blocking a door'],
  'validation.rule.blocked-passage': ['通道净宽不足', 'Passage too narrow'],
  'validation.rule.empty-room': ['房间无家具', 'Empty room'],
  'validation.rule.dimension-anomaly': ['尺寸异常', 'Dimension anomaly'],
  'validation.msg.through-wall': [
    '「{furniture}」与{wall}重叠 {depth} mm（超过 {tolerance} mm 容差）',
    '“{furniture}” overlaps {wall} by {depth} mm (tolerance {tolerance} mm)',
  ],
  'validation.msg.wall-bearing': ['承重墙', 'bearing wall'],
  'validation.msg.wall-exterior': ['外墙', 'exterior wall'],
  'validation.msg.wall-partition': ['隔墙', 'partition'],
  'validation.msg.wall-low': ['矮墙', 'low wall'],
  'validation.msg.blocking-door': [
    '「{furniture}」占用了「{door}」的门洞前净空（{clearance} mm）',
    '“{furniture}” blocks the clearance zone of “{door}” ({clearance} mm)',
  ],
  'validation.msg.passage': [
    '「{room}」入口净宽仅 {free} mm（下限 {min} mm），阻挡物：{blockers}',
    '“{room}” entrance clear width is {free} mm (min {min} mm); blockers: {blockers}',
  ],
  'validation.msg.empty-room': ['「{room}」没有任何家具', '“{room}” has no furniture'],
  'validation.msg.room-too-small': ['「{room}」面积仅 {area} m²（下限 {min} m²）', '“{room}” area is {area} m² (min {min} m²)'],
  'validation.msg.room-short-side': [
    '「{room}」短边仅 {side} mm（下限 {min} mm）',
    '“{room}” short side is {side} mm (min {min} mm)',
  ],
  'validation.msg.furniture-too-small': [
    '「{furniture}」尺寸 {w}×{d} mm 过小（下限 {min} mm）',
    '“{furniture}” is {w}×{d} mm, below the {min} mm minimum',
  ],
  'validation.msg.door-too-narrow': ['门「{door}」宽 {width} mm（下限 {min} mm）', 'Door “{door}” is {width} mm wide (min {min} mm)'],
  'validation.msg.window-too-narrow': ['窗 #{index} 宽 {width} mm（下限 {min} mm）', 'Window #{index} is {width} mm wide (min {min} mm)'],
  'validation.msg.room-door-missing': ['「{room}」没有门，无法校验通道净宽', '“{room}” has no door; passage check skipped'],
  'validation.severity.error': ['错误', 'Error'],
  'validation.severity.warn': ['提醒', 'Warning'],
  'validation.severity.info': ['提示', 'Note'],

  'palette.title': ['命令面板', 'Command palette'],
  'palette.placeholder': ['输入命令…（Ctrl/⌘ + K 打开）', 'Type a command… (Ctrl/⌘ + K)'],
  'palette.noResult': ['没有匹配的命令', 'No matching command'],
  'palette.hint': ['↑↓ 选择 · Enter 执行 · Esc 关闭（不占用既有快捷键 P/E/T/1/2/V/M/X/F/R）', '↑↓ navigate · Enter run · Esc close'],
  'palette.group.view': ['视图', 'View'],
  'palette.group.theme': ['主题', 'Theme'],
  'palette.group.tool': ['工具', 'Tool'],
  'palette.group.layer': ['图层', 'Layers'],
  'palette.group.edit': ['编辑', 'Edit'],
  'palette.group.plan': ['方案', 'Plans'],
  'palette.group.export': ['导出', 'Export'],
  'palette.group.validate': ['校验', 'Validation'],
  'cmd.view.2d': ['切到 2D 平面', 'Switch to 2D plan'],
  'cmd.view.3d': ['切到 3D 场景', 'Switch to 3D scene'],
  'cmd.view.fit': ['适应窗口', 'Fit to window'],
  'cmd.view.ratio60': ['设为 1:60', 'Set scale 1:60'],
  'cmd.view.ratio100': ['设为 1:100', 'Set scale 1:100'],
  'cmd.theme.day': ['主题：日间', 'Theme: day'],
  'cmd.theme.night': ['主题：夜间', 'Theme: night'],
  'cmd.theme.contrast': ['主题：高对比', 'Theme: high contrast'],
  'cmd.tool.select': ['工具：选择', 'Tool: select'],
  'cmd.tool.measure': ['工具：测量', 'Tool: measure'],
  'cmd.tool.demolish': ['工具：拆改墙体', 'Tool: demolish wall'],
  'cmd.layer.dims': ['图层：尺寸标注', 'Layer: dimensions'],
  'cmd.layer.labels': ['图层：房间标签', 'Layer: room labels'],
  'cmd.layer.furn': ['图层：家具', 'Layer: furniture'],
  'cmd.layer.grid': ['图层：网格', 'Layer: grid'],
  'cmd.layer.bearing': ['图层：承重墙高亮', 'Layer: bearing walls'],
  'cmd.layer.wallSnap': ['图层：墙体吸附', 'Layer: wall snapping'],
  'cmd.edit.start': ['进入 / 退出结构编辑', 'Toggle structure editing'],
  'cmd.edit.undo': ['撤销布置修改', 'Undo layout change'],
  'cmd.edit.redo': ['重做布置修改', 'Redo layout change'],
  'cmd.edit.clearLayout': ['清空布置', 'Clear layout'],
  'cmd.plan.export': ['导出当前户型 JSON', 'Export current plan JSON'],
  'cmd.plan.exportAll': ['导出全部户型 JSON', 'Export all plans JSON'],
  'cmd.export.png': ['导出 PNG（2D）', 'Export PNG (2D)'],
  'cmd.export.svg': ['导出 SVG', 'Export SVG'],
  'cmd.export.dxf': ['导出 DXF', 'Export DXF'],
  'cmd.export.csv': ['导出 CSV 报价单', 'Export cost CSV'],
  'cmd.export.xlsx': ['导出 XLSX 报价单', 'Export cost XLSX'],
  'cmd.export.print': ['打印图册（可另存 PDF）', 'Print album (save as PDF)'],
  'cmd.validate.run': ['运行平面图校验', 'Run plan validation'],
} as const;

export type MessageKey = keyof typeof MESSAGES;

export type Translate = (key: string, params?: Record<string, string | number>) => string;

/** 取一条文案（缺失时回退成 key 本身，便于发现漏翻） */
export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const entry = (MESSAGES as Record<string, readonly [string, string]>)[key];
  let text = entry ? entry[lang === 'en' ? 1 : 0] : key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

/** 绑定语言的翻译函数（组件里用 `computed(() => createTranslator(lang.value))`） */
export function createTranslator(lang: Lang): Translate {
  return (key, params) => translate(lang, key, params);
}

/**
 * 材料名称（**内容名称，不是色值**）。
 * 单一来源最终是 `data/materials.ts` 的 `MATS[].name`（t4）+ `NAMES_EN`（OF §1.10）；
 * 这里先给出中英对照，避免亮点层在 vue-i18n 接入前无法双语显示。
 */
export const MATERIAL_LABELS: Record<MaterialKey, readonly [string, string]> = {
  wood: ['橡木地板', 'Oak flooring'],
  walnut: ['胡桃木地板', 'Walnut flooring'],
  tile800: ['800 地砖', '800 mm tile'],
  tile600: ['600 地砖', '600 mm tile'],
  marble: ['大理石', 'Marble'],
  antislip: ['300 防滑砖', '300 mm anti-slip tile'],
  terrazzo: ['水磨石', 'Terrazzo'],
  carpet: ['满铺地毯', 'Wall-to-wall carpet'],
};

export function materialLabel(key: MaterialKey, lang: Lang): string {
  const entry = MATERIAL_LABELS[key];
  return entry ? entry[lang === 'en' ? 1 : 0] : key;
}

function nest(flat: Record<string, readonly [string, string]>, index: 0 | 1): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(flat)) {
    const parts = key.split('.');
    let node = out;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i];
      if (typeof node[part] !== 'object' || node[part] === null) node[part] = {};
      node = node[part] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = entry[index];
  }
  return out;
}

/**
 * 供 `vue-i18n` 装载（P0-2）：把扁平 key 还原成嵌套 messages。
 * 用法（t4 接入 i18n 时）：
 * ```ts
 * createI18n({ messages: { zh: { ...zhCore, ...extrasMessagesForI18n().zh }, en: { ... } } });
 * ```
 */
export function extrasMessagesForI18n(): Record<Lang, Record<string, unknown>> {
  const materials: Record<string, readonly [string, string]> = {};
  for (const [key, entry] of Object.entries(MATERIAL_LABELS)) materials[`material.${key}`] = entry;
  return {
    zh: nest({ ...MESSAGES, ...materials }, 0),
    en: nest({ ...MESSAGES, ...materials }, 1),
  };
}