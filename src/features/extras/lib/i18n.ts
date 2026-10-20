/**
 * 亮点层文案（中英双语）+ **P0-2 的 vue-i18n 实例化**（C-4 裁定的 t6 部分）。
 *
 * 三层职责（写给 reviewer，别混）：
 * 1. **文案表**：`MESSAGES` 是亮点层自己的 key（`extras.*` / `export.*` / `cost.*` / `compare.*` /
 *    `validation.*` / `palette.*` / `cmd.*`），`extrasMessagesForI18n()` 把它还原成 vue-i18n 的嵌套结构。
 * 2. **全局 i18n 实例**：`createExtrasI18n()` 用 `vue-i18n` 的 `createI18n({ messages })` 建实例，
 *    `installI18n(app)` 在 `main.ts` 里装配。`huxing-lang` 的**读侧**（`currentLang()`，原有）
 *    与**写侧**（`setLang()` / `toggleLang()`，C-4 新增）都收敛在本文件，⛔ 组件不碰 `localStorage`（B6）。
 * 3. **离线翻译函数**：`translate()` / `createTranslator()` 供**非组件**场景（CSV/XLSX/DXF 导出、
 *    校验告警文案）使用 —— 那些地方没有组件上下文，不能 `useI18n()`。
 *
 * ⛔ 本文件不得出现十六进制色值（SPEC §C.2 B3）。
 * ⛔ 语言键名只能是 `huxing-lang`（SPEC §D.8 的 7 个键之一），不得新造键。
 */
import { computed, shallowRef, type ComputedRef, type Ref } from 'vue';
import { createI18n, type I18n } from 'vue-i18n';
import { setAppLang, useAppLang } from '@/composables/useAppLang';
import { MATS, MATERIAL_KEYS } from '@/data/materials';
import { nameIn } from '@/data/names-en';
import { readRaw, STORAGE_KEYS, writeRaw } from '@/utils/persistence';
import type { Lang } from '@/types/extras';
import type { MaterialKey } from '@/types/material';

export type { Lang } from '@/types/extras';

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
 * 写 `huxing-lang`（**C-4 裁定补的写侧**；原实现 `setLang()` 在 `装修设计.html` L2660 写该键）。
 * 返回写入状态：`'ok'` 成功 / `'quota'` 配额满 / `'error'` 无存储（隐私模式）。
 * ⛔ 不抛错：语言切换失败不应让 UI 崩（沿用 `utils/persistence.ts` 的静默降级口径）。
 */
export function persistLang(lang: Lang): 'ok' | 'quota' | 'error' {
  return writeRaw(STORAGE_KEYS.lang, normalizeLang(lang));
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
 *
 * 单一来源（SPEC §C.2 B4 / ADR-10）：
 * - 中文名 = `data/materials.ts` 的 `MATS[key].name`（**唯一来源**，⛔ 不在本文件复制第二份）；
 * - 英文名 = `data/names-en.ts` 的 `NAMES_EN`（原实现 L418-437 的术语表；查不到时原样返回中文）。
 *
 * ⚠️ 原实现曾在 `data/materials.ts` 落地前，于本文件内嵌过一张镜像表；t4 落地后已删除，
 *    改为直接读 `MATS` —— 这样材料改名只需改一处。
 */
export function materialLabel(key: MaterialKey, lang: Lang): string {
  const name = MATS[key]?.name ?? key;
  return nameIn(name, lang);
}

/** 房间 / 家具 / 材料的显示名（内置名走 `NAMES_EN`，用户自定义名原样返回，OF §1.10） */
export function displayName(name: string, lang: Lang): string {
  return nameIn(name, lang);
}

function nest(flat: Record<string, readonly [string, string]>, index: 0 | 1): MessageTree {
  const out: MessageTree = {};
  for (const [key, entry] of Object.entries(flat)) {
    const parts = key.split('.');
    let node = out;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i];
      if (typeof node[part] !== 'object' || node[part] === null) node[part] = {};
      node = node[part] as MessageTree;
    }
    node[parts[parts.length - 1]] = entry[index];
  }
  return out;
}

/**
 * vue-i18n 的消息树类型。
 * `vue-i18n` 只以 `import type { LocaleMessage } from '@intlify/core-base'` 引入它、**不对外再导出**，
 * 因此这里用结构等价的本地别名（`createI18n({ messages })` 要的就是这棵"字符串 → 字符串树"）。
 */
export type MessageTree = { [key: string]: string | MessageTree };

/**
 * 供 `vue-i18n` 装载（P0-2）：把扁平 key 还原成嵌套 messages。
 * 材料名同样进 messages（`material.wood` → `messages.zh.material.wood`），
 * 这样模板里可以写 `t('material.' + key)`，不必再走 `materialLabel()`。
 */
export function extrasMessagesForI18n(): Record<Lang, MessageTree> {
  const materials: Record<string, readonly [string, string]> = {};
  for (const key of MATERIAL_KEYS) {
    const zh = MATS[key].name;
    materials[`material.${key}`] = [zh, nameIn(zh, 'en')];
  }
  return {
    zh: nest({ ...MESSAGES, ...materials }, 0),
    en: nest({ ...MESSAGES, ...materials }, 1),
  };
}

// ---------------------------------------------------------------------------
// vue-i18n 实例（P0-2 / C-4 裁定的 t6 部分）
// ---------------------------------------------------------------------------

/**
 * 应用级 i18n 实例的类型。
 * `legacy: false`（Composition API 模式）下 messages 的 value 是字符串树，
 * 这里只约束本项目实际用到的面（`global.locale` / `global.t`），避免与库的深层泛型纠缠。
 */
/**
 * 应用级 i18n 实例类型。
 *
 * 注意：`vue-i18n` 导出的 `I18n` 是 **legacy 与 composition 两种模式的联合类型**，
 * 其 `global.t` 因重载合并而**不可直接调用**（会报 TS2349「This expression is not callable」）。
 * 本项目固定用 `legacy: false`（Composition API 模式），因此把类型收窄到
 * `I18n<Messages, {}, {}, string, false>` —— 这样 `i18n.global.t('key')` 可正常调用与断言。
 */
export type AppI18n = I18n<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>, string, false>;


/** 应用标题（原 `applyStaticLang()` L442：`document.title = tr('户型装修设计', 'Floor Plan Designer')`） */
export const APP_TITLES: Record<Lang, string> = {
  zh: '户型装修设计',
  en: 'Floor Plan Designer',
};

/** `<html lang>` 取值（原 L441：`tr('zh-CN', 'en')`） */
export const HTML_LANG: Record<Lang, string> = {
  zh: 'zh-CN',
  en: 'en',
};

/**
 * 创建 `vue-i18n` 实例（`legacy: false`，Composition API 模式）。
 *
 * 语言初值来自 `huxing-lang`（读侧沿用 `currentLang()`，C-4 明确「读侧已具备，不要重写」）。
 * `fallbackLocale` 固定 `zh`：任何漏翻的 key 会回落到中文，而不是显示成 key（比原 `tr()` 更稳）。
 */
export function createExtrasI18n(initialLang: Lang = currentLang()): AppI18n {
  return createI18n({
    legacy: false,
    globalInjection: true,
    locale: normalizeLang(initialLang),
    fallbackLocale: DEFAULT_LANG,
    messages: extrasMessagesForI18n(),
    missingWarn: false,
    fallbackWarn: false,
  });
}

/** `main.ts` 用的最小 app 接口（避免在 lib 层 import `vue` 的 `App` 泛型） */
export interface I18nHost {
  use(plugin: AppI18n): unknown;
}

/**
 * 装配到 Vue 应用：`installI18n(app)`（`main.ts` 里在 `app.mount()` 之前调用）。
 * @returns 创建出的实例，便于 `main.ts` 保存引用 / 测试断言
 */
export function installI18n(app: I18nHost, initialLang: Lang = currentLang()): AppI18n {
  const i18n = createExtrasI18n(initialLang);
  app.use(i18n);
  registerI18n(i18n);
  return i18n;
}

/** 从 i18n 实例读当前语言（实例缺失时回落到存储值） */
export function langOf(i18n: AppI18n | null | undefined): Lang {
  if (!i18n) return currentLang();
  // Composition 模式下 `global.locale` 是 `WritableComputedRef<string>`；legacy 模式下是裸 string。
  // 两种形态都要能读，所以先做运行时形态判定（⛔ 不用 as any）。
  const locale = i18n.global.locale as unknown;
  const value =
    locale && typeof locale === 'object' && 'value' in (locale as Record<string, unknown>)
      ? (locale as { value: unknown }).value
      : locale;
  return normalizeLang(typeof value === 'string' ? value : currentLang());
}

/** 把语言写进 i18n 实例（同样兼容 Composition / legacy 两种 `locale` 形态） */
export function setI18nLocale(i18n: AppI18n | null | undefined, lang: Lang): void {
  if (!i18n) return;
  const locale = i18n.global.locale as unknown;
  if (locale && typeof locale === 'object' && 'value' in (locale as Record<string, unknown>)) {
    (locale as { value: string }).value = normalizeLang(lang);
    return;
  }
  // legacy 模式：`global.locale` 是普通字符串属性，直接赋值即可。
  // 本项目固定 `legacy: false`（走上面的 `.value` 分支），此分支只为兼容 legacy 形态而保留，
  // 因此这里必须显式断言 —— composition 模式下该属性是 WritableComputedRef，类型上不可赋 string。
  (i18n.global as unknown as { locale: string }).locale = normalizeLang(lang);
}

/** 同步 `<html lang>` 与 `document.title`（原 L441-442 的 `applyStaticLang()` 语义） */
export function applyDocumentLang(lang: Lang): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = HTML_LANG[lang];
  document.title = APP_TITLES[lang];
}

export interface SetLangOptions {
  /** 应用级 i18n 实例（有则同步 `global.locale`） */
  i18n?: AppI18n | null;
  /** 是否同步 `<html lang>` / `document.title`（默认 true；单测里可关） */
  syncDocument?: boolean;
}

/**
 * 切换语言（**C-4 裁定的写侧**；原 `setLang(l)`，L2659-2665）。
 *
 * 与原文的差异（有意，且更强）：
 * - 原实现切语言后**手动重建** DOM（`buildLib / renderOpenings / renderAll / View3D.relang()`）；
 *   Vue 化之后这些都由响应式自动完成，本函数只负责三件事：
 *   ① 写 `huxing-lang`（经 `composables/useAppLang.ts` 的 `setAppLang`，仍是 `utils/persistence` 唯一出口）；
 *   ② 改 `i18n.global.locale`；③ 同步 `<html lang>` 与标题。
 * - 3D 的 CSS2D 标签是**非响应式 DOM**，需要显式 `relabel()`：由调用方经 `Scene3DApi.relabel()`
 *   处理（`features/extras` ⛔ 不得 import `features/scene3d`，B1/B2；见 `lib/scene-theme.ts`）。
 *
 * @returns 生效后的语言（写入失败也返回目标语言：UI 立即切换，只是刷新后回退）
 */
export function setLang(lang: Lang, options: SetLangOptions = {}): Lang {
  const next = normalizeLang(lang);
  // 语言状态（响应式单点）+ 存储写入都在 `setAppLang()` 里，这里不再重复写键
  setAppLang(next);
  persistLang(next);
  setI18nLocale(options.i18n ?? null, next);
  if (options.syncDocument !== false) applyDocumentLang(next);
  return next;
}

/** 中英互切（原 `#langBtn.onclick = () => setLang(LANG === 'en' ? 'zh' : 'en')`，L2666） */
export function toggleLang(current: Lang, options: SetLangOptions = {}): Lang {
  return setLang(current === 'en' ? 'zh' : 'en', options);
}

/** 当前语言的**展示名**（语言按钮上的文字：中文界面显示「EN」，英文界面显示「中文」，原 L445） */
export function langButtonLabel(lang: Lang): string {
  return lang === 'en' ? '中文' : 'EN';
}

// ---------------------------------------------------------------------------
// 响应式语言状态（组件用的唯一入口）
// ---------------------------------------------------------------------------

/**
 * 应用级 i18n 实例的全局引用（`installI18n()` 时写入，`useLang()` 读取）。
 *
 * 为什么用模块级 `shallowRef` 而不是 `provide/inject`：
 * 语言是**应用级单例**（与主题同级），而 `features/extras` 的组件可能被挂在任意层级
 * （AppHeader / CommandPalette / 弹窗）；`inject` 会让"组件放在哪儿"影响功能，得不偿失。
 * `shallowRef` 只存实例引用，不会对 vue-i18n 内部状态做深度代理（避免无谓的响应式开销）。
 */
const appI18n = shallowRef<AppI18n | null>(null);

/**
 * 语言状态的**共享单点** = `composables/useAppLang.ts`（三条并行线的中立层）。
 *
 * 为什么不在这里自己再存一个 `ref`：`plan2d` 与 `scene3d` 也需要语言变化立即重渲染
 * （家具名 / 房间名 / CSS2D 标签），而 SPEC §C.2 B1/B2 禁止 `features/**` 互相 import。
 * 因此语言状态下沉到 `composables/`（与 `usePointerKind` / `useResizeFit` 同一定位），
 * 本文件只负责「文案表 + i18n 实例 + 名称术语表」，语言**状态**不重复维护（避免双份真相）。
 */
export { setAppLang, toggleAppLang, useAppLang, normalizeAppLang, DEFAULT_APP_LANG } from '@/composables/useAppLang';

/** 注册应用级实例（`installI18n()` 内部调用；重复注册时以最后一次为准） */
export function registerI18n(i18n: AppI18n | null): void {
  appI18n.value = i18n;
  if (i18n) setI18nLocale(i18n, langOf(i18n));
}

/** 取应用级实例（未装配时返回 `null`，调用方需容错） */
export function getI18n(): AppI18n | null {
  return appI18n.value;
}

export interface UseLangReturn {
  /** 当前语言（响应式只读；写入口是 `setLang` / `toggle`） */
  lang: Readonly<Ref<Lang>>;
  /** 翻译函数（响应式：语言变了它自动换文案） */
  t: ComputedRef<Translate>;
  /** 切换语言（写 `huxing-lang` + 同步 i18n 实例 + `<html lang>`） */
  setLang: (next: Lang) => Lang;
  /** 中英互切 */
  toggle: () => Lang;
  /** 语言按钮文字（中文界面「EN」/ 英文界面「中文」） */
  buttonLabel: ComputedRef<string>;
  /** 内置名称本地化（房间 / 家具 / 材料；用户自定义名原样返回） */
  name: (value: string) => string;
}

/**
 * 组件里取语言与翻译（**i18n 接线的唯一组件入口**）。
 *
 * 与 `useI18n()` 的关系：`vue-i18n` 的 `useI18n()` 需要组件里 `app.use(i18n)` 已装配；
 * 本项目还有 `translate()` 这类**非组件**场景，两套并存容易分叉。这里统一成一套：
 * 组件用 `useLang()`，非组件用 `translate(lang, key)`，底层是同一张 `MESSAGES`；
 * 语言**状态**则统一在 `composables/useAppLang.ts`（跨特性共享）。
 */
export function useLang(): UseLangReturn {
  const lang = useAppLang();

  function apply(next: Lang): Lang {
    return setLang(next, { i18n: appI18n.value });
  }

  return {
    lang,
    t: computed(() => createTranslator(lang.value)),
    setLang: apply,
    toggle: () => apply(lang.value === 'en' ? 'zh' : 'en'),
    buttonLabel: computed(() => langButtonLabel(lang.value)),
    name: (value: string) => nameIn(value, lang.value),
  };
}

/** 供非组件环境（导出 / 校验）取当前语言（等价于 `useLang().lang.value`） */
export function currentUiLang(): Lang {
  return useAppLang().value;
}