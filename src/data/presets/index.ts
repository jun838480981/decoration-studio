/**
 * 内置户型预设（SPEC §C.1 / §D.5；原 `PRESETS`，`装修设计.html` L854）。
 *
 * 顺序**冻结**：`['h3b','h2b','h3c','h4d','h1a','hloft','hblank']`（SPEC §D.5 `PRESET_ORDER`），
 * 与 `stores/plan.ts` 的 `PRESETS[0]`（默认打开的户型）一致。
 *
 * 每个内置户型 `builtin: true`：用户一改就 `ensureCustom()` 存副本（OF §1.11 的「内置保护」）。
 */
import { P_3B } from './three-bed';
import { P_2B } from './two-bed';
import { P_3C } from './three-bed-c';
import { P_4D } from './four-bed';
import { P_1A } from './one-bed';
import { P_LOFT } from './loft';
import { P_BLANK } from './blank';
import type { Plan } from '@/types/plan';

/** 空白户型（`hblank`；也是 `stores/plan.ts` 在极端情况下的兜底返回值） */
export const BLANK_PLAN: Plan = P_BLANK;

/** 7 个内置户型，顺序与 `PRESET_ORDER` 逐字一致 */
export const PRESETS: Plan[] = [P_3B, P_2B, P_3C, P_4D, P_1A, P_LOFT, P_BLANK];

export { P_3B, P_2B, P_3C, P_4D, P_1A, P_LOFT, P_BLANK };