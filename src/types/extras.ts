/**
 * 亮点功能（features/extras）契约类型（SPEC §B + §G.1 阶段 2c）。
 * 只放类型，实现归 t6；t3 先定稿签名，保证三条并行线不会对不上。
 */
import type { MaterialKey } from './material';

/** 导出产物种类（P0-3 / P0-6 / P0-7 / P1-1） */
export type ExportKind = 'png' | 'svg' | 'dxf' | 'csv' | 'xlsx' | 'pdf' | 'json-plan' | 'json-layout';

/** 平面图校验问题（P0-4）：5 条规则（家具穿墙 / 压门洞 / 堵通道 / 房间无家具 / 尺寸异常） */
export interface ValidationIssue {
  id: string;
  rule: 'furniture-through-wall' | 'furniture-blocking-door' | 'blocked-passage' | 'empty-room' | 'dimension-anomaly';
  severity: 'info' | 'warn' | 'error';
  /** 关联对象 id（家具 id / 房间 id / 墙下标字符串） */
  targets: string[];
  /** 面向用户的说明（i18n key 或已翻译文本） */
  message: string;
  /** 点击告警后需要聚焦的世界坐标（mm），可空 */
  focus?: { x: number; y: number };
}

/** 工程量/报价单行（P0-3，计算口径见 OF §6.2） */
export interface CostRow {
  key: MaterialKey | 'total' | 'demolition';
  label: string;
  /** m² 或 m（拆除长度） */
  quantity: number;
  unit: 'm2' | 'm';
  /** 单价（元/单位） */
  price: number;
  /** 含 5% 损耗后的金额（元） */
  cost: number;
}

/** 多方案对比摘要（P0-5） */
export interface PlanDiffSummary {
  planId: string;
  planName: string;
  /** 使用面积（m²，排除 counted=false） */
  totalArea: number;
  /** 房间数 */
  roomCount: number;
  /** 家具件数 */
  furnitureCount: number;
  /** 地面材料金额（元） */
  flooringCost: number;
  /** 拆除墙体长度（m） */
  demolishedLength: number;
  /** 相对基准方案的差量（对比时填充） */
  delta?: Omit<PlanDiffSummary, 'planId' | 'planName' | 'delta'>;
}
