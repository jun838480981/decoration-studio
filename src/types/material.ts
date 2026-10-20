/**
 * 材料类型（SPEC §D.3 🔒 冻结）。
 * `sw` 是**内容色板**（ADR-10）：不随主题变化，唯一允许出现 hex 的例外文件是 `data/materials.ts`。
 */

export type MaterialKey =
  | 'wood'
  | 'walnut'
  | 'tile800'
  | 'tile600'
  | 'marble'
  | 'antislip'
  | 'terrazzo'
  | 'carpet';

export interface MaterialTex {
  /** 图案在 x 方向的重复尺度（mm） */
  sx: number;
  /** 图案在 y 方向的重复尺度（mm） */
  sy: number;
  base: string;
  grout?: string;
  /** 粗糙度（3D 用） */
  rough: number;
}

export interface Material {
  key: MaterialKey;
  name: string;
  /** 单价（元/m²，口径见 OF §6.3） */
  price: number;
  /** 色板（内容色） */
  sw: string;
  tex: MaterialTex;
}
