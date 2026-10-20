/**
 * XLSX 导出（P0-3）。
 *
 * ⛔ 红线 2（SPEC §B.4）：**不自研 xlsx 写出** —— OOXML 容器 / 共享字符串 / 样式索引一律交 `exceljs`。
 * 三个必须遵守的工程约束：
 * 1. **动态 `import('exceljs')`**（SPEC §H.1）：exceljs 体积大且历史上在 Vite 下偶需 `buffer` polyfill，
 *    因此不进首屏；用 `import()` 按需加载。
 * 2. **失败必须可见**：返回 `{ ok: false, reason }`，由 UI 提示并退到 CSV（RISK-08 / 待确认项 C11）。
 * 3. 数值单元格写**数字**（不是字符串），并给 `numFmt`，让 Excel 能直接求和。
 */
import { translate, type Lang } from './i18n';
import { METRIC_FIELDS } from './metrics';
import { issueRuleLabel, issueSeverityLabel } from './validate';
import { stampedName } from './download';
import type { CostReportModel, RoomUsage } from './cost';
import type { PlanDiffSummary, ValidationIssue } from '@/types/extras';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type XlsxCellValue = string | number;

export interface XlsxSheetSpec {
  name: string;
  title: string;
  header: readonly string[];
  rows: readonly (readonly XlsxCellValue[])[];
  /** 列宽（按列顺序） */
  widths?: readonly number[];
  /** 需要 `#,##0.00` 的列（0-based） */
  moneyColumns?: readonly number[];
  /** 需要 `0.00` 的列（0-based） */
  decimalColumns?: readonly number[];
}

export type XlsxResult =
  | { ok: true; blob: Blob; sheetNames: string[] }
  | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// exceljs 的最小结构接口（只描述本项目用到的 API，避免与库的版本类型细节耦合）
// ---------------------------------------------------------------------------

interface XlsxCellLike {
  value: XlsxCellValue;
  font?: { bold?: boolean };
  numFmt?: string;
}

interface XlsxRowLike {
  getCell(index: number): XlsxCellLike;
}

interface XlsxWorksheetLike {
  columns: { width?: number }[];
  addRow(values: readonly XlsxCellValue[]): XlsxRowLike;
}

interface XlsxWorkbookLike {
  creator: string;
  created: Date;
  addWorksheet(name: string): XlsxWorksheetLike;
  xlsx: { writeBuffer(): Promise<unknown> };
}

interface ExcelJsModuleLike {
  Workbook: new () => XlsxWorkbookLike;
}

async function loadWorkbookConstructor(): Promise<new () => XlsxWorkbookLike> {
  const mod = (await import('exceljs')) as unknown as ExcelJsModuleLike | { default: ExcelJsModuleLike };
  const ctor = 'Workbook' in mod ? mod.Workbook : mod.default?.Workbook;
  if (typeof ctor !== 'function') throw new Error('exceljs: Workbook constructor unavailable');
  return ctor;
}

/** 构建 XLSX（失败返回结构化原因，⛔ 不抛给调用方） */
export async function buildXlsx(
  sheets: readonly XlsxSheetSpec[],
  meta: { creator?: string; created?: Date } = {},
): Promise<XlsxResult> {
  if (sheets.length === 0) return { ok: false, reason: 'no-sheet' };
  try {
    if (typeof Blob === 'undefined') return { ok: false, reason: 'no-blob' };
    const WorkbookCtor = await loadWorkbookConstructor();
    const workbook = new WorkbookCtor();
    workbook.creator = meta.creator ?? 'decoration-studio';
    workbook.created = meta.created ?? new Date();
    for (const sheet of sheets) {
      const worksheet = workbook.addWorksheet(sheet.name);
      worksheet.columns = (sheet.widths ?? []).map((width) => ({ width }));
      const titleRow = worksheet.addRow([sheet.title]);
      titleRow.getCell(1).font = { bold: true };
      const headerRow = worksheet.addRow([...sheet.header]);
      for (let column = 1; column <= sheet.header.length; column += 1) {
        headerRow.getCell(column).font = { bold: true };
      }
      for (const values of sheet.rows) {
        const row = worksheet.addRow([...values]);
        for (const column of sheet.moneyColumns ?? []) row.getCell(column + 1).numFmt = '#,##0.00';
        for (const column of sheet.decimalColumns ?? []) row.getCell(column + 1).numFmt = '0.00';
      }
    }
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer as ArrayBuffer], { type: XLSX_MIME });
    return { ok: true, blob, sheetNames: sheets.map((sheet) => sheet.name) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

// ---------------------------------------------------------------------------
// 业务工作表
// ---------------------------------------------------------------------------

function unitLabel(unit: 'm2' | 'm'): string {
  return unit === 'm2' ? 'm²' : 'm';
}

/** 报价单工作表：数值单元格保持数字类型（Excel 可直接求和） */
function quoteSheet(model: CostReportModel, lang: Lang): XlsxSheetSpec {
  const rows: XlsxCellValue[][] = model.rows.map((row) => [
    row.label,
    row.quantity,
    unitLabel(row.unit),
    row.price,
    row.cost,
  ]);
  rows.push([translate(lang, 'common.total'), model.total.quantity, unitLabel(model.total.unit), '', model.total.cost]);
  return {
    name: lang === 'en' ? 'Quote' : '报价单',
    title: translate(lang, 'cost.title'),
    header: [
      translate(lang, 'common.name'),
      translate(lang, 'common.quantity'),
      translate(lang, 'common.unit'),
      translate(lang, 'common.price'),
      translate(lang, 'common.amount'),
    ],
    rows,
    widths: [30, 12, 8, 12, 14],
    moneyColumns: [3, 4],
    decimalColumns: [1],
  };
}

function roomSheet(usage: readonly RoomUsage[], lang: Lang): XlsxSheetSpec {
  const rows: XlsxCellValue[][] = usage.map((room) => [
    room.name,
    room.mat,
    Math.round(room.area * 100) / 100,
    room.counted ? '✓' : '*',
  ]);
  return {
    name: lang === 'en' ? 'Rooms' : '房间清单',
    title: translate(lang, 'cost.roomTable'),
    header: [
      translate(lang, 'common.name'),
      translate(lang, 'cost.material'),
      translate(lang, 'cost.roomArea'),
      translate(lang, 'common.counted'),
    ],
    rows,
    widths: [24, 18, 12, 10],
    decimalColumns: [2],
  };
}

function issueSheet(issues: readonly ValidationIssue[], lang: Lang): XlsxSheetSpec {
  const rows: XlsxCellValue[][] = issues.map((issue) => [
    issueSeverityLabel(issue, lang),
    issueRuleLabel(issue, lang),
    issue.targets.join(' / '),
    issue.message,
  ]);
  return {
    name: lang === 'en' ? 'Issues' : '校验告警',
    title: translate(lang, 'validation.title'),
    header: [
      translate(lang, 'common.severity'),
      translate(lang, 'common.rule'),
      translate(lang, 'common.target'),
      translate(lang, 'common.detail'),
    ],
    rows,
    widths: [12, 22, 24, 60],
  };
}

function compareSheet(rows: readonly PlanDiffSummary[], lang: Lang): XlsxSheetSpec {
  const body: XlsxCellValue[][] = rows.map((row) => [
    row.planName,
    ...METRIC_FIELDS.map((field) => row[field.key]),
    ...METRIC_FIELDS.map((field) => (row.delta ? row.delta[field.key] : '')),
  ]);
  return {
    name: lang === 'en' ? 'Compare' : '方案对比',
    title: translate(lang, 'compare.title'),
    header: [
      translate(lang, 'common.name'),
      ...METRIC_FIELDS.map((field) => translate(lang, field.labelKey)),
      ...METRIC_FIELDS.map((field) => `${translate(lang, field.labelKey)} ${translate(lang, 'common.delta')}`),
    ],
    rows: body,
    widths: [24, 14, 10, 12, 14, 12, 14, 10, 12, 14, 12],
    moneyColumns: [4, 9],
    decimalColumns: [1, 5, 6, 10, 11],
  };
}

export interface XlsxModelOptions {
  usage?: readonly RoomUsage[];
  issues?: readonly ValidationIssue[];
  compare?: readonly PlanDiffSummary[];
}

/** 报价单 XLSX 的全部工作表（报价单 / 房间清单 / 校验告警 / 方案对比，按需） */
export function costXlsxSheets(model: CostReportModel, lang: Lang, options: XlsxModelOptions = {}): XlsxSheetSpec[] {
  const sheets: XlsxSheetSpec[] = [quoteSheet(model, lang)];
  if (options.usage && options.usage.length > 0) sheets.push(roomSheet(options.usage, lang));
  if (options.issues && options.issues.length > 0) sheets.push(issueSheet(options.issues, lang));
  if (options.compare && options.compare.length > 0) sheets.push(compareSheet(options.compare, lang));
  return sheets;
}

export function xlsxFileName(base: string, at?: Date): string {
  return stampedName(base, 'xlsx', at);
}