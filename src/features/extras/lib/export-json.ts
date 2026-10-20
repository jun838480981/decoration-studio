/**
 * JSON 交换层（OF §7.2 / §7.3 的**文件**部分）。
 *
 * 职责边界（重要）：
 * - **户型**（结构 + 各层布置）的导出/导入语义在 `stores/plan`（`exportPlan` / `exportAll` / `importText`，
 *   SPEC §D.5 冻结签名）——本文件只负责"把 store 产物变成文本、把文本喂回 store、起文件名"。
 * - **布置**（家具层）的导入必须按原语义校验：`Array.isArray(s.furniture)` 否则判失败（OF §7.2 L2613-2621），
 *   成功后经 `layout.mutate()` 落进**撤销栈**（原 L2619 的 `commit(before)`）。
 * - ⛔ 不直读 `localStorage`（B6）：其它方案的布置经 `plan.readState()`（store 出口）。
 */
import { stampedName } from './download';
import type { LayoutStore } from '@/stores/layout';
import type { PlanFile, PlanSetFile } from '@/types/persistence';
import type { PlanState } from '@/types/state';

/** 布置导出格式标识（`types/persistence.ts` 的 `LayoutFile.fmt` 同值） */
export const LAYOUT_FMT = 'huxing-state-v2';

export interface LayoutExportFile {
  fmt: typeof LAYOUT_FMT;
  planId: string;
  planName?: string;
  level?: number;
  at: string;
  state: PlanState;
}

/** 布置存档 → 可下载文件结构（仅 `{furniture, rooms, demolished, measures}`，OF §7.2） */
export function buildLayoutFile(
  state: PlanState,
  planId: string,
  planName?: string,
  level?: number,
): LayoutExportFile {
  return {
    fmt: LAYOUT_FMT,
    planId,
    planName,
    level,
    at: new Date().toISOString(),
    state: {
      furniture: state.furniture,
      rooms: state.rooms,
      demolished: state.demolished,
      measures: state.measures,
    },
  };
}

export function prettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function layoutFileToText(file: LayoutExportFile): string {
  return prettyJson(file);
}

/** 户型文件（`stores/plan.exportPlan()` 的返回值）→ 文本 */
export function planFileToText(file: PlanFile): string {
  return prettyJson(file);
}

/** 全部户型打包（`stores/plan.exportAll()` 的返回值）→ 文本 */
export function planSetToText(set: PlanSetFile): string {
  return prettyJson(set);
}

/**
 * 解析布置 JSON（OF §7.2 的校验：必须有 `furniture` 数组）。
 * @returns `PlanState | null`；`null` = 文件格式不正确
 */
export function parseLayoutText(text: string): PlanState | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  // 兼容三种形态：裸 state、`{state:{...}}`、`{fmt:'huxing-state-v2', state:{...}}`
  const candidate = pickState(raw);
  if (!candidate || !Array.isArray(candidate.furniture)) return null;
  return candidate;
}

function pickState(raw: unknown): PlanState | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<PlanState> & { state?: unknown };
  if (Array.isArray(value.furniture)) return value as PlanState;
  const inner = value.state;
  if (inner && typeof inner === 'object' && Array.isArray((inner as Partial<PlanState>).furniture)) {
    return inner as PlanState;
  }
  return null;
}

/**
 * 导入布置文本到 store：`fixState` 清洗 → `mutate()` 入撤销栈（原 L2619 语义）。
 * @returns 是否导入成功（格式错误返回 false，⛔ 不抛错）
 */
export function importLayoutInto(layout: LayoutStore, text: string): boolean {
  const parsed = parseLayoutText(text);
  if (!parsed) return false;
  const cleaned = layout.fixState(parsed);
  layout.mutate(() => {
    layout.furniture = cleaned.furniture;
    layout.rooms = cleaned.rooms;
    layout.demolished = cleaned.demolished;
    layout.measures = cleaned.measures;
  });
  return true;
}

/** `<input type="file">` 拿到的文件 → 文本 */
export async function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('file-read-failed'));
    reader.readAsText(file);
  });
}

export function jsonFileName(base: string, at?: Date): string {
  return stampedName(base, 'json', at);
}