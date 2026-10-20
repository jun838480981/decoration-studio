/**
 * 类型出口（barrel）。下游只 `import type { … } from '@/types'` 即可，避免跨目录相对路径。
 */
export type * from './geometry';
export type * from './plan';
export type * from './furniture';
export type * from './material';
export type * from './state';
export type * from './persistence';
export type * from './theme';
export type * from './scene3d';
export type * from './plan2d';
export type * from './extras';
