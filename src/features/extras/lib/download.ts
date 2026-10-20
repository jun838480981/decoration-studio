/**
 * 浏览器下载与文件名工具（原 `download(name, blob)`，装修设计.html L1879）。
 *
 * SPEC §H.4 明确「不装 `file-saver`」：既有下载语义（`URL.createObjectURL` + 1s 后 `revokeObjectURL`）
 * 已足够，这里把它收敛成单一出口，供 SVG/PNG/CSV/XLSX/DXF/JSON 全部导出复用。
 * ⛔ 不引入任何依赖。
 */

export type DownloadFailure = 'no-dom' | 'blocked';

export interface DownloadResult {
  ok: boolean;
  reason?: DownloadFailure;
  name: string;
}

/** 去掉文件系统非法字符（原实现直接拼中文名，跨平台会踩坑） */
export function safeFileName(name: string, fallback = 'export'): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

/** 是否具备浏览器下载能力（SSR / 单测下安全降级，⛔ 不抛错） */
export function canDownload(): boolean {
  return typeof document !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
}

/**
 * 触发下载（原 L1879 语义：`createObjectURL` → `a.click()` → 1s 后 `revokeObjectURL`）。
 * @returns 结构化结果；无 DOM 环境返回 `{ ok: false, reason: 'no-dom' }`，⛔ 不静默吞掉
 */
export function downloadBlob(name: string, blob: Blob): DownloadResult {
  const safe = safeFileName(name);
  if (!canDownload()) return { ok: false, reason: 'no-dom', name: safe };
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = safe;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } catch {
    URL.revokeObjectURL(url);
    return { ok: false, reason: 'blocked', name: safe };
  }
  // 原 L1879：1s 后再 revoke，避免部分浏览器（Safari）还没开始读取就失效
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true, name: safe };
}

export function downloadText(name: string, text: string, mime: string): DownloadResult {
  return downloadBlob(name, new Blob([text], { type: mime }));
}

/** 时间戳后缀（`2026-10-20-1607`），避免同名文件互相覆盖 */
export function stamp(at: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}`;
}

/** `base` + 时间戳 + 扩展名（`base` 可含中文，如「户型装修方案」） */
export function stampedName(base: string, ext: string, at: Date = new Date()): string {
  return `${base}-${stamp(at)}.${ext.replace(/^\./, '')}`;
}