/**
 * store 出口（barrel）。下游统一 `import { useXxxStore } from '@/stores'`。
 * 五个 store 的分工见 ADR-06：3 个业务（plan / layout / ui）+ 2 个横切（theme / toast）。
 */
export { usePlanStore, PRESET_ORDER, UNDO_STRUCT_LIMIT, PLAN_FMT, PLAN_SET_FMT, PLAN_STORE_KEY } from './plan';
export { useLayoutStore, UNDO_LIMIT, LEGACY_STORE_KEY, stateKey, stateKeyOf } from './layout';
export {
  useUiStore,
  layers,
  MIN_SCALE,
  MAX_SCALE,
  PX_MM,
  TAP_PX,
  SCALE_BAR_STEPS,
} from './ui';
export { useThemeStore, THEME_STORE_KEY } from './theme';
export { useToastStore, TOAST_DEFAULT_TTL } from './toast';

export type { PlanStore } from './plan';
export type { LayoutStore, RoomRow } from './layout';
export type { UiStore } from './ui';
export type { ToastItem } from './toast';