/**
 * 持久化单一出口（SPEC §C.2 B6 / §D.8 / ADR-05）。
 *
 * ⛔ 组件不得直接读写 `localStorage`（ESLint B6 强制）；一切的键名与读写都经过这里，
 *    将来切 IndexedDB（P2-8）只需改本文件。
 * ⛔ 键名**逐字冻结**（SPEC §D.8），不得新增任何其它键。
 */
import { PRESETS } from '@/data/presets';
import { fixState } from '@/utils/normalize';
import type { PlanLibraryFile, SaveStatus } from '@/types/persistence';
import type { PlanState } from '@/types/state';

/** 全部持久化键（SPEC §D.8 🔒） */
export const STORAGE_KEYS = {
  /** 语言：`'en' | 'zh'`（原 L414-415） */
  lang: 'huxing-lang',
  /** 抽屉开合：`{ hideLib?: boolean; hidePanel?: boolean }` */
  panes: 'huxing-panes',
  /** 户型库：`PlanLibraryFile`（原 L608） */
  plans: 'huxing-plans-v1',
  /** 布置存档前缀：`huxing-state-v2-<planId>[-l<level>]`（原 L609/L891） */
  statePrefix: 'huxing-state-v2-',
  /** 旧键：**必须继续写入**以兼容回退（原 L983；OF §9.5 风险 5） */
  legacyState: 'huxing-design-v1',
  /** 主题预设（t3 新增，SPEC §D.8 唯一允许新增的键） */
  theme: 'huxing-theme-v1',
} as const;

/** 单层布置存档键（原 `stateKey`，L609） */
export function stateKey(planId: string): string {
  return `${STORAGE_KEYS.statePrefix}${planId}`;
}

/** 复式按层存档键（原 `stateKeyOf`，L891） */
export function stateKeyOf(planId: string, level: number, multi: boolean): string {
  return multi ? `${stateKey(planId)}-l${level | 0}` : stateKey(planId);
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function storage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    // 隐私模式 / 禁用 cookie 时访问 localStorage 会抛错
    return null;
  }
}

export function hasStorage(): boolean {
  return storage() !== null;
}

export function readRaw(key: string): string | null {
  const store = storage();
  if (!store) return null;
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

/** 读 JSON；解析失败或不存在时返回 `fallback`（⛔ 不抛错，坏数据由调用方用 `fixState` 修复） */
export function readJson<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (raw === null || raw === '') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: string; code?: number };
  return e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22;
}

export function writeRaw(key: string, value: string): SaveStatus {
  const store = storage();
  if (!store) return 'error';
  try {
    store.setItem(key, value);
    return 'ok';
  } catch (error) {
    return isQuotaError(error) ? 'quota' : 'error';
  }
}

export function writeJson(key: string, value: unknown): SaveStatus {
  try {
    return writeRaw(key, JSON.stringify(value));
  } catch {
    return 'error';
  }
}

export function removeKey(key: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    /* 忽略：删除失败不影响主流程 */
  }
}

export function readPlanLibrary(): PlanLibraryFile {
  return readJson<PlanLibraryFile>(STORAGE_KEYS.plans, { custom: [], current: '' });
}

export function writePlanLibrary(value: PlanLibraryFile): SaveStatus {
  return writeJson(STORAGE_KEYS.plans, value);
}

export function readPlanState(planId: string, level: number, multi: boolean): PlanState | null {
  return readJson<PlanState | null>(stateKeyOf(planId, level, multi), null);
}

/** 写某户型某层的布置存档（复制户型时逐层搬运，原 L2013-2021 的 `saveStateTo`） */
export function writePlanState(planId: string, level: number, multi: boolean, state: unknown): SaveStatus {
  return writeJson(stateKeyOf(planId, level, multi), state);
}

/**
 * 旧版（`.bak` 时代）布置存档迁移入口（原 `migrateLegacy`，L1911-1914；OF §4.3 第 3 条）。
 *
 * 语义（与原文逐字一致）：
 * 1. 读旧键 `huxing-design-v1`；
 * 2. 仅当 `huxing-state-v2-<PRESETS[0].id>` **尚不存在**时，把旧键内容写过去（首次迁移，不覆盖任何新数据）；
 * 3. ⛔ **不删除**旧键——新工程必须能回退到旧版本（ADR-05）。
 *
 * @returns 迁移后的 `PlanState`；无可迁移内容时返回 `null`（= 调用方按新装处理）。
 */
export function migrateLegacy(): PlanState | null {
  const legacyRaw = readRaw(STORAGE_KEYS.legacyState);
  if (legacyRaw === null || legacyRaw === '') return null;
  const target = stateKey(PRESETS[0]?.id ?? 'h3b');
  if (readRaw(target) !== null) return null;
  const status = writeRaw(target, legacyRaw);
  if (status !== 'ok') return null;
  return fixState(readJson<unknown>(STORAGE_KEYS.legacyState, null));
}

/** 删除某户型某层的布置存档（原 `delPlan` 里的逐层 `removeItem`，L2029 语义） */
export function removePlanState(planId: string, level: number, multi: boolean): void {
  removeKey(stateKeyOf(planId, level, multi));
}
