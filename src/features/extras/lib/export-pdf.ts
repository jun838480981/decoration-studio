/**
 * PDF 图册（P1-1，**SPEC 明确为「可选、不作硬性验收项」**）。
 *
 * 本轮的裁决（写在代码里，避免下游误读）：
 * - `pdf-lib` / `@pdf-lib/fontkit` **没有安装**（SPEC §H.1：P1-1 未实现则整体不安装），
 *   因此这里**只提供接口与注入点**，⛔ 不伪造任何 PDF 字节流。
 * - 交付替代路径是 **P1-4 打印**：`print.ts` 的 `PrintAlbumModel` + `print.css` + `requestPrint()`，
 *   用户可以用"打印 → 另存为 PDF"得到同样的图册（封面/房间表/主材表/家具表/校验与对比）。
 * - 将来启用时**不需要改业务代码**：装齐依赖后实现一个 `PdfAlbumRenderer` 并注入
 *   `buildPdfAlbum(album, { renderer })` 即可；图册内容已经由 `print.ts` 定稿。
 * - ⛔ 红线 1：不自研 PDF 排版 / 字体子集化（那正是 pdf-lib + fontkit 的职责）。
 * - ⚠️ RISK-07：中文必须用 `@pdf-lib/fontkit` 做**子集化嵌入**（SIL OFL 1.1 字体，允许随 MIT 分发），
 *   否则产物乱码；字体体积预算登记在 `docs/THIRD-PARTY.md` §4。
 */
import { stampedName } from './download';
import type { PrintAlbumModel } from './print';

/** 是否具备 PDF 导出能力（当前为 `false`；UI 据此禁用按钮并给出打印替代） */
export const PDF_EXPORT_AVAILABLE = false;

/** 启用 P1-1 需要安装的依赖（SPEC §H.1 / §B.2 P1-1，全部 MIT） */
export const PDF_REQUIRED_DEPENDENCIES = [
  'pdf-lib@^1.17.1',
  '@pdf-lib/fontkit@^1.1.1',
  'svg2pdf.js@^2.8.1 + jspdf@^4.2.1（矢量图纸页，可选）',
] as const;

/** 字体资产口径（SPEC §H.2 / B.6：SIL OFL 1.1，允许随 MIT 产物分发） */
export const PDF_FONT_LICENSE_NOTE =
  'CJK 字体用 SIL OFL 1.1（Noto Sans SC / Source Han Sans），必须经 @pdf-lib/fontkit 子集化后嵌入；字体文件体积预算待评估（不是法务问题）。';

export type PdfFailureReason = 'not-implemented' | 'font-missing' | 'render-failed' | 'no-dom';

export type PdfResult =
  | { ok: true; blob: Blob; pageCount: number }
  | { ok: false; reason: PdfFailureReason; detail: string };

/** 渲染器契约：库到位后由调用方注入（⛔ 不让 extras 直接依赖尚未安装的包） */
export type PdfAlbumRenderer = (
  album: PrintAlbumModel,
  options: { fontSubsetUrl?: string; title: string },
) => Promise<Blob>;

export interface PdfOptions {
  renderer?: PdfAlbumRenderer;
  fontSubsetUrl?: string;
}

/**
 * 构建 PDF 图册。
 * 未注入 renderer 时返回 `{ ok:false, reason:'not-implemented' }`（⛔ 绝不返回假 PDF）。
 */
export async function buildPdfAlbum(album: PrintAlbumModel, options: PdfOptions = {}): Promise<PdfResult> {
  if (!options.renderer) {
    return {
      ok: false,
      reason: 'not-implemented',
      detail: `P1-1 未实现：未安装 ${PDF_REQUIRED_DEPENDENCIES.join(' / ')}；替代路径见 print.ts（打印 → 另存为 PDF）`,
    };
  }
  if (!options.fontSubsetUrl) {
    return {
      ok: false,
      reason: 'font-missing',
      detail: `中文 PDF 必须嵌入 OFL 字体子集（RISK-07）。${PDF_FONT_LICENSE_NOTE}`,
    };
  }
  try {
    const blob = await options.renderer(album, { fontSubsetUrl: options.fontSubsetUrl, title: album.title });
    return { ok: true, blob, pageCount: album.sections.length };
  } catch (error) {
    return {
      ok: false,
      reason: 'render-failed',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export function pdfFileName(base: string, at?: Date): string {
  return stampedName(base, 'pdf', at);
}