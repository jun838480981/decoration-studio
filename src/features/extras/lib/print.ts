/**
 * 打印友好输出（P1-4）+ 图册模型（P1-1 的**唯一数据源**）。
 *
 * 为什么拆成"模型 + 渲染器"（写给 reviewer）：
 * - P1-1 的 PDF（`pdf-lib`）本轮**未实现**（体积与工时成本，SPEC §B.2 P1-1 降级为可选）。
 *   但图册内容（封面 / 房间面积表 / 主材表 / 家具表 / 校验与对比）是**业务资产**，
 *   先在这里定稿成 `PrintAlbumModel`，打印走 `print.css`；
 *   将来装 `pdf-lib` 只需新增一个 renderer（`lib/export-pdf.ts` 的注入点），⛔ 不需要改业务代码。
 * - ⛔ 红线 1：不自研 PDF 排版（字节流/字体子集/TTF 子集化）—— 一律交给 pdf-lib + fontkit。
 * - ⛔ 不在这里写颜色（SPEC §C.2 B3）：打印样式只做排版与分页，颜色全部沿用 `--ds-*` 令牌，
 *   因此"打印成浅色"由主题预设（P0-1/P1-2 的日间）负责，而不是在打印 CSS 里复制一套色值。
 */
import { costTableHeader, costTableRows, type CostReportModel, type RoomUsage } from './cost';
import { METRIC_FIELDS } from './metrics';
import { issueRuleLabel, issueSeverityLabel } from './validate';
import { materialLabel, translate, type Lang } from './i18n';
import { stampedName } from './download';
import type { PlanDiffSummary, ValidationIssue } from '@/types/extras';

export type PrintSectionId = 'cover' | 'rooms' | 'materials' | 'furniture' | 'issues' | 'compare';

export interface PrintAlbumSection {
  id: PrintSectionId;
  title: string;
  header: readonly string[];
  rows: readonly (readonly string[])[];
}

export interface PrintAlbumModel {
  title: string;
  subtitle: string;
  generatedAt: string;
  sections: readonly PrintAlbumSection[];
}

export interface PrintAlbumInput {
  planName: string;
  levelName?: string;
  lang: Lang;
  cost: CostReportModel;
  usage: readonly RoomUsage[];
  furnitureNames?: readonly string[];
  issues?: readonly ValidationIssue[];
  compare?: readonly PlanDiffSummary[];
}

/** 图册页序（PDF renderer 也按这个顺序排页） */
export const PRINT_ALBUM_SECTION_IDS: readonly PrintSectionId[] = [
  'cover',
  'rooms',
  'materials',
  'furniture',
  'compare',
  'issues',
];

/** 构建图册模型（打印与将来的 PDF 共用同一份内容） */
export function buildPrintAlbum(input: PrintAlbumInput): PrintAlbumModel {
  const { lang, cost } = input;
  const t = (key: string): string => translate(lang, key);
  const sections: PrintAlbumSection[] = [];

  sections.push({
    id: 'cover',
    title: t('cost.title'),
    header: [t('common.name'), t('common.detail')],
    rows: [
      [t('common.name'), input.planName],
      ...(input.levelName ? [[t('common.open'), input.levelName]] : []),
      [t('cost.netArea'), `${cost.totalArea.toFixed(2)} m²`],
      [t('cost.wallArea'), `${cost.wallAreaM2.toFixed(2)} m²`],
      [t('cost.demolition'), `${cost.demolishedLength.toFixed(2)} m`],
      [t('cost.roomCount'), String(cost.roomCount)],
      [t('cost.generatedAt'), cost.generatedAt],
    ],
  });

  if (input.usage.length > 0) {
    sections.push({
      id: 'rooms',
      title: t('cost.roomTable'),
      header: [t('common.name'), t('cost.material'), t('cost.roomArea'), t('common.counted')],
      rows: input.usage.map((room) => [
        room.name,
        materialLabel(room.mat, lang),
        `${room.area.toFixed(2)} m²`,
        room.counted ? '✓' : '*',
      ]),
    });
  }

  sections.push({
    id: 'materials',
    title: t('cost.materialTable'),
    header: costTableHeader(lang),
    rows: costTableRows(cost, lang),
  });

  if (input.furnitureNames && input.furnitureNames.length > 0) {
    sections.push({
      id: 'furniture',
      title: t('cost.furnitureCount'),
      header: ['#', t('common.name')],
      rows: input.furnitureNames.map((name, index) => [String(index + 1), name]),
    });
  }

  if (input.compare && input.compare.length > 1) {
    sections.push({
      id: 'compare',
      title: t('compare.title'),
      header: [t('common.name'), ...METRIC_FIELDS.map((field) => t(field.labelKey))],
      rows: input.compare.map((row) => [row.planName, ...METRIC_FIELDS.map((field) => row[field.key].toFixed(field.digits))]),
    });
  }

  if (input.issues && input.issues.length > 0) {
    sections.push({
      id: 'issues',
      title: t('validation.title'),
      header: [t('common.severity'), t('common.rule'), t('common.target'), t('common.detail')],
      rows: input.issues.map((issue) => [
        issueSeverityLabel(issue, lang),
        issueRuleLabel(issue, lang),
        issue.targets.join(' / '),
        issue.message,
      ]),
    });
  }

  return {
    title: `${input.planName} · ${t('cost.title')}`,
    subtitle: t('cost.wasteNote'),
    generatedAt: cost.generatedAt,
    sections,
  };
}

/**
 * 触发浏览器打印（用户可"另存为 PDF"）。
 * @returns 是否真的发起了打印（无 DOM 环境返回 false，⛔ 不伪造结果）
 */
export function requestPrint(): boolean {
  if (typeof window === 'undefined' || typeof window.print !== 'function') return false;
  window.print();
  return true;
}

/**
 * 打印前建议切到日间主题（打印纸是白的，夜间主题会印出大面积深色）。
 * 返回是否发生了切换；主题令牌依旧只来自 `theme/tokens.ts`（⛔ 打印 CSS 不复制色值）。
 */
export function suggestDayTheme(currentPreset: string): 'day' | null {
  return currentPreset === 'day' ? null : 'day';
}

export function albumFileName(base: string, at?: Date): string {
  return stampedName(base, 'html', at);
}