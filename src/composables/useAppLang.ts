/**
 * 语言状态的**共享单点**（2D / 3D / 亮点三路共用）。
 *
 * 为什么需要它（而不是各特性自己读 `huxing-lang`）：
 * - SPEC §C.2 **B1/B2** 禁止 `features/**` 互相 import，`plan2d` ⛔ 不能 import
 *   `features/extras/lib/i18n.ts` 的 `currentLang()`；而 2D 的家具名/房间名、3D 的 CSS2D 标签
 *   都要跟着语言切换**立即重渲染**（原实现 `setLang()` 手动重建全部 DOM，L2659-2665）。
 * - `composables/**` 是三路都能依赖的中立层（与 `usePointerKind` / `useResizeFit` 同一定位），
 *   所以语言用一个模块级 `ref` + 一个写入口收敛，跨特性不再需要互相调用。
 *
 * 契约：
 * - 读：`huxing-lang`（键名只在 `utils/persistence.ts` 定义，B6）；
 * - 写：`setAppLang()` → 更新 `ref` + 写回存储（写失败静默降级，隐私模式不崩）；
 * - 兼容：原实现默认 `zh`（OF §1.10），非法值一律回落 `zh`。
 *
 * ⛔ 本文件不得出现十六进制色值 / UI 文案表（文案表在 `features/extras/lib/i18n.ts`）。
 */
import { readonly, ref, type Ref } from 'vue';
import { readRaw, STORAGE_KEYS, writeRaw } from '@/utils/persistence';
import type { Lang } from '@/types/extras';

/** 默认语言（OF §1.10：无存储值时中文） */
export const DEFAULT_APP_LANG: Lang = 'zh';

/** 规范化（只认 `'en'`，其余一律中文） */
export function normalizeAppLang(value: unknown): Lang {
  return value === 'en' ? 'en' : DEFAULT_APP_LANG;
}

/** 读存储中的语言（模块初始化用） */
function loadLang(): Lang {
  return normalizeAppLang(readRaw(STORAGE_KEYS.lang));
}

const langRef = ref<Lang>(loadLang());

/** 当前语言（只读视图：写入口只有 `setAppLang`，避免多处写导致 DOM 与存储不同步） */
export function useAppLang(): Readonly<Ref<Lang>> {
  return readonly(langRef);
}

/** 切换语言（原 `setLang(l)` 的写侧，L2660）；返回实际生效的语言 */
export function setAppLang(next: Lang): Lang {
  const value = normalizeAppLang(next);
  langRef.value = value;
  writeRaw(STORAGE_KEYS.lang, value);
  return value;
}

/** 中英互切（原 `#langBtn.onclick`，L2666） */
export function toggleAppLang(): Lang {
  return setAppLang(langRef.value === 'en' ? 'zh' : 'en');
}
