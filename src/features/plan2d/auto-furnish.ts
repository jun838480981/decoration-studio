/**
 * 自动布置（2D 侧入口，SPEC §C.1 / §A12）。
 *
 * 规则引擎的**实现**在 `utils/auto-furnish.ts`（纯函数）：
 * 冻结契约 `stores/layout.ts#autoFurnish()` 需要它，而 SPEC §C.2 **B5** 禁止 `stores/**` import `features/**`。
 * 这里只做 2D 侧的语义入口，避免出现两份规则（⛔ 不要在本文件里复制关键词表）。
 */
export { autoFurnishFurniture as autoFurnish } from '@/utils/auto-furnish';