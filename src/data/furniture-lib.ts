/**
 * 家具库（SPEC §C.1；60 条目 / 45 唯一类型，逐条对齐 OF §5.2，原 `装修设计.html` L533-561）。
 *
 * ⚠️ 本文件是 SPEC §C.2 **B3/B4 白名单**之一：
 * - `LIB[].color`（家具默认色）与 `FURN_PAINT`（图例中的中性内容色）都是**内容色**（ADR-10），
 *   不随主题变化，因此允许出现十六进制字面值；
 * - 主题令牌（UI 色）⛔ 不得出现在这里。
 *
 * 本文件同时提供 2D 图例/3D 模型共用的**取色与构造出口**：
 * `typeColor()`（原 L562）、`contentColor()`、`makeFurniture()`（原 `F()` 工厂 L566）。
 */
import { uid } from '@/utils/id';
import type { Furniture, FurnitureType, LibCategory, LibItem } from '@/types/furniture';

/** 6 分类 60 条目（顺序与原 `LIB` 完全一致，OF §5.1 的条目数：12/14/11/8/9/6） */
export const LIB: readonly LibCategory[] = [
  {
    cat: '卧室',
    items: [
      ['bed', '双人床 1.8m', 1800, 2000, '#c9d6df'],
      ['bed', '双人床 1.5m', 1500, 2000, '#d8c7dc'],
      ['bed', '单人床', 1200, 2000, '#e8d5b5'],
      ['crib', '婴儿床', 1250, 700, '#efe3d0'],
      ['nightstand', '床头柜', 450, 400, '#e8dccb'],
      ['wardrobe', '衣柜', 2000, 600, '#efe6d8'],
      ['wardrobe', '小衣柜', 1200, 550, '#efe6d8'],
      ['dresser', '梳妆台', 1000, 450, '#efe6d8'],
      ['desk', '书桌', 1200, 600, '#e2cfb4'],
      ['chair', '椅子', 450, 480, '#cfc6b8'],
      ['bookshelf', '书架', 800, 300, '#e2cfb4'],
      ['baycushion', '飘窗垫', 520, 1800, '#e7dccd'],
    ],
  },
  {
    cat: '客厅',
    items: [
      ['sofa', '三人沙发', 2400, 900, '#b7c4b0'],
      ['sofa', '双人沙发', 1700, 880, '#c3cbd6'],
      ['cornersofa', '转角沙发', 2800, 1700, '#b7c4b0'],
      ['armchair', '单人沙发', 850, 850, '#d6b99a'],
      ['beanbag', '懒人沙发', 800, 800, '#e0b98f'],
      ['coffeetable', '茶几', 1300, 650, '#e8dccb'],
      ['sidetable', '边几', 500, 500, '#d9c3a3'],
      ['tvstand', '电视柜', 2400, 400, '#e2cfb4'],
      ['rug', '地毯', 2400, 1700, '#d9cbb8'],
      ['shoecab', '鞋柜', 1000, 350, '#efe6d8'],
      ['shoecab', '玄关柜', 1400, 380, '#e6dccc'],
      ['floorlamp', '落地灯', 450, 450, '#3d3a34'],
      ['plant', '绿植', 500, 500, '#a9c39b'],
      ['plant', '大绿植', 700, 700, '#9dbb8c'],
    ],
  },
  {
    cat: '餐厨',
    items: [
      ['table', '餐桌', 1400, 800, '#e2cfb4'],
      ['table', '六人餐桌', 1800, 900, '#d8c2a2'],
      ['roundtable', '圆桌', 1000, 1000, '#e2cfb4'],
      ['chair', '餐椅', 450, 480, '#cfc6b8'],
      ['island', '岛台', 1800, 900, '#e9e5de'],
      ['barstool', '吧椅', 420, 420, '#6b5d4c'],
      ['counter', '橱柜台面', 1600, 600, '#e9e5de'],
      ['stove', '燃气灶', 750, 450, '#dcdcdc'],
      ['ksink', '水槽', 800, 450, '#e1e6ea'],
      ['fridge', '冰箱', 700, 700, '#dfe4e8'],
      ['cabinet', '餐边柜', 1600, 400, '#efe6d8'],
    ],
  },
  {
    cat: '卫浴',
    items: [
      ['toilet', '马桶', 400, 700, '#ffffff'],
      ['vanity', '浴室柜', 800, 500, '#eef1f3'],
      ['vanity', '双盆浴室柜', 1200, 500, '#eef1f3'],
      ['shower', '淋浴房', 900, 900, '#e4edf2'],
      ['bathtub', '浴缸', 1600, 750, '#eef3f6'],
      ['washer', '洗衣机', 600, 600, '#e6ebee'],
      ['waterheater', '电热水器', 800, 450, '#f4f4f2'],
      ['cabinet', '储物柜', 1000, 400, '#efe6d8'],
    ],
  },
  {
    cat: '家电',
    items: [
      ['tv', '65 寸电视', 1450, 80, '#1d1d1f'],
      ['tv', '55 寸电视', 1230, 80, '#1d1d1f'],
      ['fridge', '对开门冰箱', 910, 700, '#c9ced3'],
      ['aircon', '柜机空调', 500, 380, '#f6f7f8'],
      ['acwall', '挂机空调', 900, 250, '#f6f7f8'],
      ['dishwasher', '洗碗机', 600, 600, '#c9ced3'],
      ['ovencol', '蒸烤箱高柜', 600, 600, '#efe6d8'],
      ['dryer', '烘干机', 600, 600, '#e6ebee'],
      ['purifier', '空气净化器', 400, 300, '#f4f4f2'],
    ],
  },
  {
    cat: '书房 · 休闲',
    items: [
      ['desk', '长书桌', 1600, 700, '#d8c2a2'],
      ['officechair', '办公椅', 620, 620, '#4a4f55'],
      ['bookshelf', '大书架', 1600, 350, '#e2cfb4'],
      ['piano', '立式钢琴', 1500, 600, '#1f1d1b'],
      ['treadmill', '跑步机', 800, 1800, '#3a3a3c'],
      ['armchair', '阅读椅', 750, 800, '#c9a98a'],
    ],
  },
] as const satisfies readonly LibCategory[];

/** 扁平条目表（`[type, name, w, d, color]`），供按名/按类型取色与 3D 模型分派使用 */
export const LIB_ITEMS: readonly LibItem[] = LIB.flatMap((category) => category.items);

/** 60 / 45 的契约断言依据（单测与 verify 可核对；改动 LIB 会让这两个数字变化） */
export const LIB_ITEM_COUNT = LIB_ITEMS.length;
export const LIB_TYPE_COUNT = new Set(LIB_ITEMS.map((item) => item[0])).size;

/**
 * 图例使用的**中性内容色**（原 `furnSVG` L1061-1165 内散落的字面值收敛到此处）。
 * 语义分组：床品 / 白瓷 / 金属 / 深色饰面 / 玻璃 / 织物等——它们都不随主题变化（ADR-10）。
 */
export const FURN_PAINT = {
  /** 图例统一描边（原 `ST` 常量 `#3d3a34`） */
  outline: '#3d3a34',
  /** 床垫底布（原 `#fbf8f2`） */
  sheet: '#fbf8f2',
  /** 纯白（枕/瓷/门扇/滑门/台盆） */
  white: '#ffffff',
  /** 灯罩暖光（原 `#fff6dd`） */
  lamp: '#fff6dd',
  /** 琴键象牙白（原 `#faf8f3`） */
  ivory: '#faf8f3',
  /** 椅面浅灰（原 `#f4f4f4`） */
  wash: '#f4f4f4',
  /** 深色五金（原 `#555`） */
  metal: '#555555',
  /** 中灰（原 `#666`） */
  metalMid: '#666666',
  /** 浅灰（原 `#888`） */
  metalLight: '#888888',
  /** 极浅灰（原 `#bbb`） */
  metalFaint: '#bbbbbb',
  /** 灰（原 `#999`） */
  gray: '#999999',
  /** 浅银（原 `#ccc`） */
  grayLight: '#cccccc',
  /** 拉手蓝灰（原 `#aab`） */
  handle: '#aaaabb',
  /** 灶面深灰（原 `#2f2f2f`） */
  charcoal: '#2f2f2f',
  /** 跑步机跑带（原 `#1c1c1e`） */
  nearBlack: '#1c1c1e',
  /** 电视柜正面（原 `#3a3a3a`） */
  frameDark: '#3a3a3a',
  /** 梳妆镜淡蓝（原 `#dfe9ee`） */
  glass: '#dfe9ee',
  /** 洁具内壁（原 `#eef4f7`） */
  porcelain: '#eef4f7',
  /** 烘干机内筒暖色（原 `#e9dccb`） */
  drumWarm: '#e9dccb',
  /** 洗衣机内筒冷色（原 `#cfdde4`） */
  drumCool: '#cfdde4',
  /** 花盆土色（原 `#8a6a4a`） */
  clay: '#8a6a4a',
} as const;

/** 该类型在库中**首次出现**的颜色（原 `typeColor`，L562） */
export function typeColor(type: FurnitureType): string {
  for (const category of LIB) {
    for (const item of category.items) {
      if (item[0] === type) return item[4];
    }
  }
  return '#eeeeee';
}

/**
 * 取内容色：优先 `colorFrom`（按**库内条目名**精确匹配，用于同名类型的不同配色，如 1.5m / 1.8m 双人床），
 * 其次按 `name` 精确匹配，最后回落该类型的默认色（原 `F()` 的 `color || typeColor(type)` 语义）。
 */
export function contentColor(type: FurnitureType, name: string, colorFrom?: string): string {
  if (colorFrom) {
    const hit = LIB_ITEMS.find((item) => item[0] === type && item[1] === colorFrom);
    if (hit) return hit[4];
  }
  const exact = LIB_ITEMS.find((item) => item[0] === type && item[1] === name);
  return exact ? exact[4] : typeColor(type);
}

/** 家具工厂（原 `F`，L566）：`rot` 规范到 0..359，`color` 缺省时按库取色 */
export function makeFurniture(
  type: FurnitureType,
  name: string,
  cx: number,
  cy: number,
  w: number,
  d: number,
  rot = 0,
  colorFrom?: string,
): Furniture {
  return {
    id: uid(),
    type,
    name,
    cx,
    cy,
    w,
    d,
    rot: ((Math.round(rot) % 360) + 360) % 360,
    color: contentColor(type, name, colorFrom),
  };
}