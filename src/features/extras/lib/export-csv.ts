/**
 * CSV 导出（P0-3）。
 *
 * ⛔ 红线 3（SPEC §B.4）：**不自研 CSV 引号转义 / 分隔符处理** —— 一律交 `papaparse` 的 `unparse()`。
 * 本文件只负责三件事：
 * 1. 把业务模型摊平成二维字符串表（口径来自 `lib/cost.ts` / `lib/validate.ts` / `lib/metrics.ts`）；
 * 2. 前置 UTF-8 BOM（`\ufeff`），否则 Excel 打开中文会乱码（BOM 不是转义逻辑）；
 * 3. 文件名（含时间戳，避免覆盖）。
 */
import Papa from 'papaparse';
import { costTableHeader, costTableRows, type CostReportModel } from './cost';
import { issueRuleLabel, issueSeverityLabel } from './validate';
import { METRIC_FIELDS } from './metrics';
import { translate, type Lang } from './i18n';
import { stampedName } from './download';
import type { PlanDiffSummary, ValidationIssue } from '@/types/extras';

/** UTF-8 BOM（Excel 识别编码） */
export const CSV_BOM = '\ufeff';

export interface CsvOptions {
  /** 分隔符（默认 `,`；欧洲区域可用 `;`） */
  delimiter?: string;
}

/** 二维表 → CSV 文本（含 BOM）。转义交给 papaparse（红线 3）。 */
export function toCsv(rows: readonly (readonly string[])[], options: CsvOptions = {}): string {
  const table = rows.map((row) => [...row]);
  const text = Papa.unparse(table, { delimiter: options.delimiter ?? ',' });
  return `${CSV_BOM}${text}`;
}

/** 报价单 / 工程量清单 CSV */
export function costCsv(model: CostReportModel, lang: Lang): string {
  const t = (key: string): string => translate(lang, key);
  const summary: string[][] = [
    [t('cost.title')],
    [t('cost.netArea'), model.totalArea.toFixed(2), 'm²'],
    [t('cost.wallArea'), model.wallAreaM2.toFixed(2), 'm²'],
    [t('cost.demolition'), model.demolishedLength.toFixed(2), 'm'],
    [t('cost.roomCount'), String(model.roomCount)],
    [t('cost.generatedAt'), model.generatedAt],
    [t('cost.wasteNote')],
    [],
  ];
  return toCsv([...summary, costTableHeader(lang), ...costTableRows(model, lang)]);
}

/** 校验告警 CSV（供施工方逐条核对） */
export function issuesCsv(issues: readonly ValidationIssue[], lang: Lang): string {
  const t = (key: string): string => translate(lang, key);
  const header = [t('common.severity'), t('common.rule'), t('common.target'), t('common.detail')];
  const rows = issues.map((issue) => [
    issueSeverityLabel(issue, lang),
    issueRuleLabel(issue, lang),
    issue.targets.join(' / '),
    issue.message,
  ]);
  return toCsv([header, ...rows]);
}

/** 多方案对比 CSV（含逐指标差量列） */
export function compareCsv(rows: readonly PlanDiffSummary[], lang: Lang): string {
  const t = (key: string): string => translate(lang, key);
  const header = [
    t('common.name'),
    ...METRIC_FIELDS.map((field) => t(field.labelKey)),
    ...METRIC_FIELDS.map((field) => `${t(field.labelKey)} ${t('common.delta')}`),
  ];
  const body = rows.map((row) => [
    row.planName,
    ...METRIC_FIELDS.map((field) => row[field.key].toFixed(field.digits)),
    ...METRIC_FIELDS.map((field) => (row.delta ? row.delta[field.key].toFixed(field.digits) : '—')),
  ]);
  return toCsv([header, ...body]);
}

/** 差异摘要 CSV（只列有差异的指标） */
export function diffSummaryCsv(rows: readonly PlanDiffSummary[], lang: Lang): string {
  const t = (key: string): string => translate(lang, key);
  const header = [t('common.name'), t('common.metric'), t('common.delta')];
  const body: string[][] = [];
  for (const row of rows) {
    if (!row.delta) continue;
    for (const field of METRIC_FIELDS) {
      const delta = row.delta[field.key];
      if (Math.abs(delta) <= 0.005) continue;
      body.push([row.planName, t(field.labelKey), delta.toFixed(field.digits)]);
    }
  }
  return toCsv([header, ...body]);
}

export function csvFileName(base: string, at?: Date): string {
  return stampedName(base, 'csv', at);
}