/**
 * 内置名称的中英对照表（SPEC §C.1 `data/names-en.ts`；来源 `装修设计.html` L418-437 的 `NAMES_EN`）。
 *
 * 语义（OF §1.10，**这是特性不是 bug**）：只翻译**内置**名称；
 * 用户自己改过的房间名 / 家具名不在表内 → 原样显示（见 `nameIn()`）。
 *
 * 计数：原实现源码实际写了 **91** 条（OF §1.10 记作 86 条，属文档手工计数偏差；
 * 以源码逐条提取的结果为准，`names-en.spec.ts` 断言条数与键唯一性）。
 *
 * ⛔ 本文件不含任何色值（SPEC §C.2 B3）；⛔ 不在此追加 UI 文案（那属于 vue-i18n messages，
 * 见 `features/extras/lib/i18n.ts` 的 `extrasMessagesForI18n()`）。
 */
import type { Lang } from '@/types/extras';

/** 中文原名 → 英文译名（91 条，与源码逐条一致） */
export const NAMES_EN: Readonly<Record<string, string>> = {
  '主卧室': 'Master Bedroom',
  '主卫浴': 'Master Bath',
  '小孩房': "Kids' Room",
  '客卫浴': 'Guest Bath',
  '洗衣阳台': 'Laundry Balcony',
  '子女房': "Children's Room",
  '厨房': 'Kitchen',
  '餐厅': 'Dining',
  '过道': 'Hallway',
  '客厅': 'Living Room',
  '休闲阳台': 'Leisure Balcony',
  '主卧飘窗': 'Master Bay Window',
  '子女房飘窗': "Children's Bay Window",
  '橡木地板': 'Oak Flooring',
  '胡桃木地板': 'Walnut Flooring',
  '800 地砖': '800 Tile',
  '600 地砖': '600 Tile',
  '大理石': 'Marble',
  '300 防滑砖': '300 Anti-slip Tile',
  '水磨石': 'Terrazzo',
  '满铺地毯': 'Wall-to-wall Carpet',
  '卧室': 'Bedroom',
  '餐厨': 'Dining & Kitchen',
  '卫浴': 'Bathroom',
  '家电': 'Appliances',
  '书房 · 休闲': 'Study & Leisure',
  '双人床 1.8m': 'Double Bed 1.8m',
  '双人床 1.5m': 'Double Bed 1.5m',
  '双人床': 'Double Bed',
  '单人床': 'Single Bed',
  '婴儿床': 'Crib',
  '床头柜': 'Nightstand',
  '衣柜': 'Wardrobe',
  '小衣柜': 'Small Wardrobe',
  '梳妆台': 'Dresser',
  '书桌': 'Desk',
  '椅子': 'Chair',
  '书架': 'Bookshelf',
  '飘窗垫': 'Bay Cushion',
  '三人沙发': '3-Seat Sofa',
  '双人沙发': 'Loveseat',
  '转角沙发': 'Corner Sofa',
  '单人沙发': 'Armchair',
  '懒人沙发': 'Beanbag',
  '茶几': 'Coffee Table',
  '边几': 'Side Table',
  '电视柜': 'TV Stand',
  '地毯': 'Rug',
  '鞋柜': 'Shoe Cabinet',
  '玄关柜': 'Entry Cabinet',
  '落地灯': 'Floor Lamp',
  '绿植': 'Plant',
  '大绿植': 'Large Plant',
  '餐桌': 'Dining Table',
  '六人餐桌': '6-Seat Dining Table',
  '圆桌': 'Round Table',
  '餐椅': 'Dining Chair',
  '岛台': 'Kitchen Island',
  '吧椅': 'Bar Stool',
  '橱柜台面': 'Kitchen Counter',
  '燃气灶': 'Gas Stove',
  '水槽': 'Sink',
  '冰箱': 'Fridge',
  '餐边柜': 'Sideboard',
  '马桶': 'Toilet',
  '浴室柜': 'Vanity',
  '双盆浴室柜': 'Double Vanity',
  '淋浴房': 'Shower',
  '淋浴区': 'Shower Area',
  '浴缸': 'Bathtub',
  '洗衣机': 'Washer',
  '洗衣池': 'Laundry Sink',
  '电热水器': 'Water Heater',
  '储物柜': 'Storage Cabinet',
  '65 寸电视': '65" TV',
  '55 寸电视': '55" TV',
  '对开门冰箱': 'French-door Fridge',
  '柜机空调': 'Floor AC',
  '挂机空调': 'Wall AC',
  '洗碗机': 'Dishwasher',
  '蒸烤箱高柜': 'Oven Tower',
  '烘干机': 'Dryer',
  '空气净化器': 'Air Purifier',
  '长书桌': 'Long Desk',
  '办公椅': 'Office Chair',
  '大书架': 'Large Bookshelf',
  '立式钢琴': 'Upright Piano',
  '跑步机': 'Treadmill',
  '阅读椅': 'Reading Chair',
  '茶桌': 'Tea Table',
  '休闲椅': 'Lounge Chair',
};

/** 表内条数（测试与文档核对用） */
export const NAMES_EN_COUNT = 91;

/**
 * 内置名称本地化：英文界面下查表，查不到（= 用户自定义名称）**原样返回**。
 * 对应原实现 `nm(s)`（L438）：`LANG === 'en' ? (NAMES_EN[s] ?? s) : s`。
 */
export function nameIn(name: string, lang: Lang): string {
  if (lang !== 'en') return name;
  return NAMES_EN[name] ?? name;
}

/** 是否为内置名称（有译名） */
export function hasEnglishName(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(NAMES_EN, name);
}
