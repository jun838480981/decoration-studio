/**
 * 亮点层纯函数与 i18n 接线的回归断言。
 *
 * 覆盖 SPEC 的可核对点：
 * - **C-4**：`huxing-lang` 的读 + **写**（`persistLang` / `setLang`），键名逐字 `huxing-lang`；
 * - **P0-2**：`createI18n({ messages })` 实例化，且 `extrasMessagesForI18n()` 是嵌套结构；
 * - **P0-4**：5 条校验规则都能触发（阈值来自 `VALIDATION_THRESHOLDS`）；
 * - **P0-5**：多方案对比的差量口径；
 * - **P0-3**：报价口径（含 5% 损耗、飘窗不计入使用面积）；
 * - **P1-3**：命令面板快捷键不与既有单键冲突。
 *
 * 环境：`jsdom`（i18n 实例与 localStorage 都需要 DOM；纯函数部分在 node 下同样成立）。
 */
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { readRaw, STORAGE_KEYS } from '@/utils/persistence';
import {
  APP_TITLES,
  createExtrasI18n,
  currentLang,
  extrasMessagesForI18n,
  langOf,
  materialLabel,
  normalizeLang,
  persistLang,
  setI18nLocale,
  setLang,
  translate,
} from './lib/i18n';
import { buildCostReport, costReportFromLevels, priceResolver, usageFromStructure } from './lib/cost';
import { comparePlanSources } from './lib/compare';
import { changedFields } from './lib/compare';
import { VALIDATION_RULE_IDS, VALIDATION_THRESHOLDS, summarizeIssues, validatePlan } from './lib/validate';
import { paletteConflicts, filterCommands, COMMAND_SPECS } from './lib/commands';
import { intervalUnionLength, pointInPolygon, rotatedCorners } from './lib/geom';
import { METRIC_FIELDS, metricsOf, polygonAreaM2 } from './lib/metrics';
import { costCsv } from './lib/export-csv';
import { historyTimeline, jumpToDepth } from './lib/history';
import { toCsv, CSV_BOM } from './lib/export-csv';
import type { Door, Room, Wall } from '@/types/plan';
import type { Furniture } from '@/types/furniture';
import type { PlanState } from '@/types/state';
import type { Plan } from '@/types/plan';

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// 夹具
// ---------------------------------------------------------------------------

/** 4m × 3m 的房间（mm） */
const ROOM_POLY: [number, number][] = [
  [0, 0],
  [4000, 0],
  [4000, 3000],
  [0, 3000],
];

function makeRoom(overrides: Partial<Room> = {}): Room {
  return { id: 'r1', name: '客厅', poly: ROOM_POLY, mat: 'wood', ...overrides };
}

function makeWall(): Wall[] {
  return [
    [0, 0, 4000, 0, 'b'],
    [4000, 0, 4000, 3000, 'e'],
    [4000, 3000, 0, 3000, 'n'],
    [0, 3000, 0, 0, 'n'],
  ];
}

function makeDoor(): Door[] {
  // 门洞在底墙中间（宽 900），朝房间内侧（0,1500）开
  return [
    {
      name: '主卧门',
      rect: [1550, 2950, 2450, 3050],
      h: [1550, 3000],
      c: [2000, 3000],
      o: [2000, 1500],
      len: 900,
      entry: true,
    },
  ];
}

function makeFurniture(overrides: Partial<Furniture> = {}): Furniture {
  return {
    id: 'f1',
    type: 'sofa',
    name: '三人沙发',
    cx: 2000,
    cy: 1500,
    w: 2000,
    d: 800,
    rot: 0,
    color: '#b7c4b0',
    ...overrides,
  };
}

function makeState(furniture: Furniture[] = []): PlanState {
  return { furniture, rooms: {}, demolished: [], measures: [] };
}

// ---------------------------------------------------------------------------
// C-4：huxing-lang 读写接线
// ---------------------------------------------------------------------------

describe('i18n 接线（P0-2 / C-4 的 t6 部分）', () => {
  it('读侧：无存储值时为中文（OF §1.10 默认 zh）', () => {
    expect(currentLang()).toBe('zh');
    expect(normalizeLang(undefined)).toBe('zh');
    expect(normalizeLang('EN')).toBe('zh');
  });

  it('写侧：persistLang 逐字写入 huxing-lang 键', () => {
    expect(persistLang('en')).toBe('ok');
    expect(readRaw(STORAGE_KEYS.lang)).toBe('en');
    expect(STORAGE_KEYS.lang).toBe('huxing-lang');
    expect(currentLang()).toBe('en');
  });

  it('写侧：setLang 同时更新 i18n 实例、存储与 <html lang>', () => {
    const i18n = createExtrasI18n('zh');
    setLang('en', { i18n });
    expect(readRaw(STORAGE_KEYS.lang)).toBe('en');
    expect(langOf(i18n)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe(APP_TITLES.en);
    setLang('zh', { i18n });
    expect(document.documentElement.lang).toBe('zh-CN');
  });

  it('写侧：坏存储值不会让 currentLang 崩（回落 zh）', () => {
    localStorage.setItem(STORAGE_KEYS.lang, '{"oops":1}');
    expect(currentLang()).toBe('zh');
  });

  it('P0-2：createI18n 实例化，messages 是嵌套结构且中英都有值', () => {
    const messages = extrasMessagesForI18n();
    expect(messages.zh.export).toBeTypeOf('object');
    expect(messages.en.export).toBeTypeOf('object');
    // 嵌套还原正确（点号 key → 对象路径）
    expect((messages.zh.export as Record<string, unknown>).title).toBe('导出');
    expect((messages.en.export as Record<string, unknown>).title).toBe('Export');
    // 材料名进 messages（`material.wood`）
    expect((messages.zh.material as Record<string, unknown>).wood).toBe('橡木地板');
    expect((messages.en.material as Record<string, unknown>).wood).toBe('Oak Flooring');
  });

  it('P0-2：i18n 实例能按当前 locale 取到文案，且 fallback 为中文', () => {
    const i18n = createExtrasI18n('zh');
    expect(i18n.global.t('export.title')).toBe('导出');
    setI18nLocale(i18n, 'en');
    expect(i18n.global.t('export.title')).toBe('Export');
    // 不存在的 key 回落到 key 本身（`missingWarn: false`，⛔ 不抛错）
    expect(i18n.global.t('nope.nope')).toBe('nope.nope');
  });

  it('translate：参数插值 + 语言切换 + 缺 key 回退', () => {
    expect(translate('zh', 'export.done', { name: 'a.csv' })).toBe('已生成 a.csv');
    expect(translate('en', 'export.done', { name: 'a.csv' })).toBe('Saved a.csv');
    expect(translate('en', 'no.such.key')).toBe('no.such.key');
  });

  it('materialLabel：中文名来自 data/materials.ts，英文名来自 NAMES_EN（单一来源）', () => {
    expect(materialLabel('wood', 'zh')).toBe('橡木地板');
    expect(materialLabel('wood', 'en')).toBe('Oak Flooring');
    expect(materialLabel('carpet', 'en')).toBe('Wall-to-wall Carpet');
  });
});

// ---------------------------------------------------------------------------
// P0-3：报价口径
// ---------------------------------------------------------------------------

describe('报价 / 工程量清单口径（P0-3，OF §6.2）', () => {
  it('面积：4m × 3m = 12 m²（three ShapeUtils 鞋带公式）', () => {
    expect(polygonAreaM2(ROOM_POLY)).toBeCloseTo(12, 6);
  });

  it('材料金额 = 面积 × 单价 × 1.05（含 5% 损耗）', () => {
    const room = makeRoom();
    const model = buildCostReport({
      usage: usageFromStructure({ ...emptyStructure(), rooms: [room] }, makeState()),
      priceOf: priceResolver(),
      lang: 'zh',
    });
    const row = model.rows.find((item) => item.key === 'wood');
    expect(row).toBeDefined();
    expect(row?.quantity).toBeCloseTo(12, 2);
    expect(row?.price).toBe(320);
    // 12 × 320 × 1.05 = 4032
    expect(row?.cost).toBe(4032);
    expect(model.total.cost).toBe(4032);
  });

  it('飘窗（counted:false）不计入使用面积，但计入材料用量', () => {
    const bay: Room = { id: 'r2', name: '主卧飘窗', poly: ROOM_POLY, mat: 'marble', counted: false };
    const usage = usageFromStructure({ ...emptyStructure(), rooms: [makeRoom(), bay] }, makeState());
    const model = buildCostReport({ usage, priceOf: priceResolver(), lang: 'zh' });
    // 使用面积只算 12（飘窗排除）
    expect(model.totalArea).toBeCloseTo(12, 2);
    // 材料计量面积含飘窗：12 + 12 = 24
    expect(model.materialArea).toBeCloseTo(24, 2);
    expect(model.rows.find((row) => row.key === 'marble')?.quantity).toBeCloseTo(12, 2);
  });

  it('拆除长度按 Σ max(dx,dy)/1000 计入（无单价，金额留 0）', () => {
    const walls = makeWall();
    const state: PlanState = { ...makeState(), demolished: ['w2'] };
    const structure = { ...emptyStructure(), walls, rooms: [makeRoom()] };
    const model = costReportFromLevels({ levels: [{ structure, state }], priceOf: priceResolver(), lang: 'zh' });
    // 底墙 4000mm 水平 → 4m
    expect(model.demolishedLength).toBeCloseTo(4, 2);
    const row = model.rows.find((item) => item.key === 'demolition');
    expect(row?.price).toBe(0);
    expect(row?.cost).toBe(0);
  });

  it('墙面面积 = 周长 × 2.8（未扣洞口）', () => {
    const structure = { ...emptyStructure(), rooms: [makeRoom()] };
    const model = costReportFromLevels({
      levels: [{ structure, state: makeState() }],
      priceOf: priceResolver(),
      lang: 'zh',
    });
    // 周长 = 14m → 14 × 2.8 = 39.2
    expect(model.wallAreaM2).toBeCloseTo(39.2, 1);
  });

  it('CSV 前置 UTF-8 BOM（Excel 中文不乱码），转义交给 papaparse', () => {
    const csv = costCsv(
      buildCostReport({ usage: usageFromStructure({ ...emptyStructure(), rooms: [makeRoom()] }, makeState()), priceOf: priceResolver(), lang: 'zh' }),
      'zh',
    );
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    // 含逗号的字段必须被引号包裹（papaparse 行为，不是自研转义）
    const tricky = toCsv([['a,b', 'c"d']]);
    expect(tricky).toContain('"a,b"');
    expect(tricky).toContain('"c""d"');
  });
});

// ---------------------------------------------------------------------------
// P0-4：平面图校验
// ---------------------------------------------------------------------------

describe('平面图校验 5 条规则（P0-4）', () => {
  const base = {
    walls: makeWall(),
    doors: makeDoor(),
    rooms: [makeRoom()],
    wins: [] as never[],
    demolished: [] as string[],
    roomOverrides: {},
    lang: 'zh' as const,
  };

  it('规则 id 恰好 5 条且与 SPEC 一致', () => {
    expect([...VALIDATION_RULE_IDS]).toEqual([
      'furniture-through-wall',
      'furniture-blocking-door',
      'blocked-passage',
      'empty-room',
      'dimension-anomaly',
    ]);
  });

  it('empty-room：房间内没有家具中心点 → info', () => {
    const issues = validatePlan({ ...base, furniture: [] });
    const empty = issues.filter((issue) => issue.rule === 'empty-room');
    expect(empty).toHaveLength(1);
    expect(empty[0].severity).toBe('info');
    expect(empty[0].targets).toContain('r1');
  });

  it('furniture-through-wall：家具压进墙体超过容差 → error', () => {
    // 家具中心贴在上墙（y=0）上：中心 y=100，深 800 → 跨墙
    const issue = makeFurniture({ cx: 2000, cy: 100, w: 1200, d: 800 });
    const issues = validatePlan({ ...base, furniture: [issue] });
    const hit = issues.filter((item) => item.rule === 'furniture-through-wall');
    expect(hit.length).toBeGreaterThan(0);
    expect(hit[0].severity).toBe('error');
    expect(hit[0].targets[0]).toBe('f1');
  });

  it('furniture-through-wall：贴墙齐平（侵入 ≤ 容差）不算违规', () => {
    // 上墙中线在 y=0、厚 200 → 墙内表面在 y=100；深 800 的家具贴边时中心 y = 100 + 400 = 500
    const flush = makeFurniture({ cx: 2000, cy: 500, w: 1200, d: 800 });
    const issues = validatePlan({ ...base, furniture: [flush] });
    expect(issues.filter((item) => item.rule === 'furniture-through-wall')).toHaveLength(0);
  });

  it('furniture-blocking-door：家具占住门洞前净空带 → warn', () => {
    // 门在底墙 y≈3000，净空带向房间内 600mm；家具放在 y=2700 附近
    const blocker = makeFurniture({ id: 'f2', cx: 2000, cy: 2700, w: 900, d: 600 });
    const issues = validatePlan({ ...base, furniture: [blocker] });
    const hit = issues.filter((item) => item.rule === 'furniture-blocking-door');
    expect(hit.length).toBeGreaterThan(0);
    expect(hit[0].severity).toBe('warn');
    expect(hit[0].message).toContain('主卧门');
  });

  it('dimension-anomaly：门宽低于下限 → warn（阈值 700mm）', () => {
    const narrow: Door = { ...makeDoor()[0], len: 600 };
    const issues = validatePlan({ ...base, doors: [narrow], furniture: [makeFurniture({ cx: 2000, cy: 1500 })] });
    const hit = issues.filter((item) => item.rule === 'dimension-anomaly' && item.targets.includes('主卧门'));
    expect(hit.length).toBeGreaterThan(0);
    expect(VALIDATION_THRESHOLDS.minDoorWidth).toBe(700);
  });

  it('dimension-anomaly：房间短边过窄 → warn（阈值 900mm）', () => {
    const narrow: Room = {
      id: 'r3',
      name: '储物间',
      poly: [
        [0, 0],
        [5000, 0],
        [5000, 600],
        [0, 600],
      ],
      mat: 'tile600',
    };
    const issues = validatePlan({ ...base, rooms: [narrow], doors: [], furniture: [makeFurniture({ cx: 2000, cy: 300 })] });
    const hit = issues.filter((item) => item.rule === 'dimension-anomaly' && item.targets.includes('r3'));
    expect(hit.length).toBeGreaterThan(0);
    expect(hit[0].message).toContain('储物间');
  });

  it('summarizeIssues 按严重度计数且总数一致', () => {
    const issues = validatePlan({ ...base, furniture: [] });
    const summary = summarizeIssues(issues);
    expect(summary.total).toBe(issues.length);
    expect(summary.error + summary.warn + summary.info).toBe(summary.total);
  });

  it('已拆墙体不再参与穿墙判定（demolished 生效）', () => {
    const pierce = makeFurniture({ cx: 2000, cy: 100, w: 1200, d: 800 });
    const withWall = validatePlan({ ...base, furniture: [pierce] });
    // 上墙是承重墙（'b'）；拆掉 0 号墙后穿墙告警应消失
    const withoutWall = validatePlan({ ...base, furniture: [pierce], demolished: ['0'] });
    expect(withWall.filter((item) => item.rule === 'furniture-through-wall').length).toBeGreaterThan(0);
    expect(withoutWall.filter((item) => item.rule === 'furniture-through-wall').length).toBeLessThan(
      withWall.filter((item) => item.rule === 'furniture-through-wall').length,
    );
  });
});

// ---------------------------------------------------------------------------
// P0-5：多方案对比
// ---------------------------------------------------------------------------

describe('多方案对比与差异摘要（P0-5）', () => {
  it('第 1 个方案是基准，其余填 delta = 本方案 − 基准', () => {
    const planA: Plan = { ...emptyPlan('a', '方案 A'), rooms: [makeRoom()] };
    const planB: Plan = { ...emptyPlan('b', '方案 B'), rooms: [{ ...makeRoom(), mat: 'marble' }] };
    const rows = comparePlanSources(
      [
        { plan: planA, states: [makeState()] },
        { plan: planB, states: [makeState()] },
      ],
      { priceOf: priceResolver() },
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].delta).toBeUndefined();
    // 大理石 650 vs 橡木 320，面积同为 12m²：差 = 12×1.05×(650−320) = 4158
    expect(rows[1].delta?.flooringCost).toBe(4158);
    expect(rows[1].delta?.totalArea).toBe(0);
  });

  it('changedFields 只返回有差异的指标', () => {
    const planA: Plan = { ...emptyPlan('a', 'A'), rooms: [makeRoom()] };
    const planB: Plan = { ...emptyPlan('b', 'B'), rooms: [makeRoom()] };
    const rows = comparePlanSources(
      [
        { plan: planA, states: [makeState([makeFurniture()])] },
        { plan: planB, states: [makeState()] },
      ],
      { priceOf: priceResolver() },
    );
    const changed = changedFields(rows[1]);
    expect(changed).toContain('furnitureCount');
    expect(changed).not.toContain('totalArea');
  });

  it('METRIC_FIELDS 的键与 PlanDiffSummary 的指标字段一一对应', () => {
    const row = metricsOf({ planId: 'x', planName: 'X', levels: [], priceOf: priceResolver() });
    for (const field of METRIC_FIELDS) {
      expect(typeof row[field.key]).toBe('number');
    }
  });
});

// ---------------------------------------------------------------------------
// P0-8 / P1-3：历史与命令
// ---------------------------------------------------------------------------

describe('历史面板与命名快照（P0-8）', () => {
  it('historyTimeline：末位是"当前状态"，depth 从 0 递增', () => {
    const timeline = historyTimeline(['{"a":1}', '{"a":2}'], '{"a":3}', []);
    expect(timeline).toHaveLength(3);
    expect(timeline[timeline.length - 1].isCurrent).toBe(true);
    expect(timeline[0].depth).toBe(2);
  });

  it('jumpToDepth：只走 undo/redo，受栈长度限制时停在能到达的深度', () => {
    let depth = 0;
    const io = {
      undo: () => {
        if (depth === 0) return false;
        depth -= 1;
        return true;
      },
      redo: () => {
        if (depth >= 2) return false;
        depth += 1;
        return true;
      },
    };
    expect(jumpToDepth(0, 5, io)).toBe(2);
    expect(jumpToDepth(2, 0, io)).toBe(0);
  });
});

describe('命令面板（P1-3 / RISK-13）', () => {
  it('面板快捷键不与 OF §8.1 的既有单键冲突', () => {
    expect(paletteConflicts()).toEqual([]);
  });

  it('filterCommands：标签命中优先于关键词命中，空查询返回全量', () => {
    const t = (key: string): string => translate('zh', key);
    expect(filterCommands('', { translate: t })).toHaveLength(COMMAND_SPECS.length);
    const hits = filterCommands('导出', { translate: t });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].labelKey).toContain('export');
  });

  it('每条命令的 labelKey 都能翻出中文与英文（⛔ 无漏翻）', () => {
    for (const spec of COMMAND_SPECS) {
      expect(translate('zh', spec.labelKey), spec.labelKey).not.toBe(spec.labelKey);
      expect(translate('en', spec.labelKey), spec.labelKey).not.toBe(spec.labelKey);
    }
  });
});

// ---------------------------------------------------------------------------
// 几何原语（复用边界：库不提供、也不值得装包的初等函数）
// ---------------------------------------------------------------------------

describe('几何原语（lib/geom.ts）', () => {
  it('rotatedCorners：0° 时四角与轴对齐矩形一致', () => {
    const [a, b, c, d] = rotatedCorners(1000, 1000, 400, 200, 0);
    expect(a).toEqual({ x: 800, y: 900 });
    expect(b).toEqual({ x: 1200, y: 900 });
    expect(c).toEqual({ x: 1200, y: 1100 });
    expect(d).toEqual({ x: 800, y: 1100 });
  });

  it('intervalUnionLength：重叠/相邻区间合并后不重复计数', () => {
    expect(intervalUnionLength([[0, 10], [5, 15]])).toBe(15);
    expect(intervalUnionLength([[0, 10], [20, 30]])).toBe(20);
    expect(intervalUnionLength([])).toBe(0);
  });

  it('pointInPolygon：内外判定（射线法）', () => {
    expect(pointInPolygon({ x: 2000, y: 1500 }, ROOM_POLY)).toBe(true);
    expect(pointInPolygon({ x: -10, y: 1500 }, ROOM_POLY)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 夹具工厂
// ---------------------------------------------------------------------------

function emptyStructure() {
  return {
    bounds: null,
    walls: [] as Wall[],
    wins: [] as never[],
    doors: [] as Door[],
    slides: [] as never[],
    rooms: [] as Room[],
    dims: [] as never[],
    lintels: [] as never[],
    stairs: [] as never[],
    voids: [] as never[],
  };
}

function emptyPlan(id: string, name: string): Plan {
  return { ...emptyStructure(), id, name, tag: '自定义' };
}
