/**
 * 自动布置家具的**纯规则引擎**（OF §1.13；原 `装修设计.html` L911-974）。
 *
 * ⚠️ 关于文件位置（有意偏差，已在交付说明中登记）：
 * SPEC §A12 把规则映射到 `features/plan2d/auto-furnish.ts`，但冻结契约 `stores/layout.ts#autoFurnish()`
 * 也必须能调用它，而 SPEC §C.2 **B5** 禁止 `stores/**` import `features/**`。
 * 因此引擎放在 `utils/`（纯函数、零 store 依赖），`features/plan2d/auto-furnish.ts` 只做 2D 侧再导出。
 *
 * 规则（逐条对齐原实现，⛔ 不要"顺手优化"关键词——房间名是用户数据）：
 * - 卧室类 `/卧|寝室|睡房|主卧|次卧|儿童房|小孩房|子女房|老人房|客卧/`：床 + 床头柜×2 + 衣柜；
 *   儿童房且面积 >8m² 追加书桌 + 椅子；
 * - 书房 `/书房|工作间|studio/i`：书桌 + 椅子 + 大书架；
 * - 客厅：地毯 + 三人沙发 + 电视柜 + 茶几（宽 >4200 加单人沙发）+ 绿植；
 * - 餐厅：餐桌 + 四把餐椅 + 餐边柜（宽 >4000）；
 * - 厨房：橱柜台面 + 燃气灶 + 水槽 + 冰箱（宽 >2700 再加一段台面）；
 * - 卫浴：面积 ≥3.2m² 放淋浴房 + 马桶 + 浴室柜；
 * - 阳台：洗衣/生活阳台放洗衣机 + 洗衣池，否则面积 >5m² 放茶桌 + 两张休闲椅；都放绿植；
 * - 过道/玄关：最小边 ≥1400mm 放鞋柜；
 * - 其他面积 >4m²：放绿植。
 *
 * 两条通用约束（原 `put`）：任一边 <200mm 直接丢弃；放置后 `pushOut()` 防穿墙。
 *
 * ⚠️ 已知待确认项 **U6**（OF §10）：纯英文房间名（如 "Bedroom"）不会命中中文关键词，
 * 因此英文户型自动布置会退化为「只放绿植」。这里**保持原语义**（不做猜测），仅在此注明。
 */
import { makeFurniture } from '@/data/furniture-lib';
import { bbox, pushOut } from '@/utils/geometry';
import type { Rect } from '@/types/geometry';
import type { Furniture, FurnitureType } from '@/types/furniture';
import type { Room } from '@/types/plan';

/** 卧室类关键词（原 L921） */
const BEDROOM = /卧|寝室|睡房|主卧|次卧|儿童房|小孩房|子女房|老人房|客卧/;
/** 儿童房关键词（原 L922） */
const KID_ROOM = /儿童|小孩|子女/;
/** 书房关键词（原 L935） */
const STUDY = /书房|工作间|studio/i;
/** 客厅关键词（原 L939） */
const LIVING = /客厅|起居室|会客/;
/** 餐厅关键词（原 L946） */
const DINING = /餐厅|饭厅/;
/** 厨房关键词（原 L952） */
const KITCHEN = /厨房/;
/** 卫浴关键词（原 L958） */
const BATH = /卫|浴|洗手间|厕所/;
/** 阳台关键词（原 L962） */
const BALCONY = /阳台/;
/** 洗衣阳台关键词（原 L963） */
const LAUNDRY = /洗衣|生活/;
/** 过道 / 玄关关键词（原 L966） */
const HALLWAY = /过道|走廊|玄关|门厅|入户/;

/**
 * 按房间名 + 面积生成一套家具（原 `autoFurnish`，L911-974）。
 * @param rooms 当前层的房间（名称与多边形来自户型结构）
 * @param rects 贴边吸附源（未拆墙 + 窗）；用于 `pushOut()` 防穿墙
 * @returns 家具数组，**地毯置底**（原 L973）
 */
export function autoFurnishFurniture(rooms: readonly Room[], rects: readonly Rect[]): Furniture[] {
  const out: Furniture[] = [];

  const put = (
    type: FurnitureType,
    name: string,
    cx: number,
    cy: number,
    w: number,
    d: number,
    rot = 0,
    colorFrom?: string,
  ): Furniture | null => {
    if (w < 200 || d < 200) return null;
    const item = makeFurniture(type, name, Math.round(cx), Math.round(cy), Math.round(w), Math.round(d), rot, colorFrom);
    pushOut(item, rects);
    out.push(item);
    return item;
  };

  for (const room of rooms) {
    const [x0, y0, x1, y1] = bbox(room.poly);
    const w = x1 - x0;
    const h = y1 - y0;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const a = (w * h) / 1e6;
    const name = room.name || '';
    const horiz = w >= h;

    if (BEDROOM.test(name)) {
      const kid = KID_ROOM.test(name);
      if (horiz) {
        const bw = Math.min(kid ? 1500 : 1800, w - 500);
        const bd = Math.min(kid ? 1900 : 2000, h - 1400);
        put('bed', kid ? '单人床' : '双人床', cx, y0 + bd / 2 + 60, bw, bd, 0);
        if (w - bw > 1100) {
          put('nightstand', '床头柜', cx - bw / 2 - 280, y0 + 280, 450, 400);
          put('nightstand', '床头柜', cx + bw / 2 + 280, y0 + 280, 450, 400);
        }
        put('wardrobe', '衣柜', cx, y1 - 330, Math.min(2000, w - 500), 600, 0);
      } else {
        const bw = Math.min(kid ? 1500 : 1800, h - 500);
        const bd = Math.min(kid ? 1900 : 2000, w - 1400);
        put('bed', kid ? '单人床' : '双人床', x0 + bd / 2 + 60, cy, bw, bd, 270);
        if (h - bw > 1100) {
          put('nightstand', '床头柜', x0 + 280, cy - bw / 2 - 280, 450, 400, 270);
          put('nightstand', '床头柜', x0 + 280, cy + bw / 2 + 280, 450, 400, 270);
        }
        put('wardrobe', '衣柜', x1 - 330, cy, Math.min(2000, h - 500), 600, 270);
      }
      if (kid && a > 8) {
        put('desk', '书桌', horiz ? x1 - 400 : cx, horiz ? cy : y1 - 400, 1200, 600, horiz ? 270 : 180);
        put('chair', '椅子', horiz ? x1 - 900 : cx, horiz ? cy : y1 - 900, 450, 480, horiz ? 270 : 180);
      }
    } else if (STUDY.test(name)) {
      put('desk', '书桌', cx, y0 + 380, Math.min(1400, w - 600), 600, 0);
      put('chair', '椅子', cx, y0 + 980, 450, 480, 180);
      put('bookshelf', '大书架', x1 - 200, cy, Math.min(1600, h - 600), 350, 90);
    } else if (LIVING.test(name)) {
      put('rug', '地毯', cx, cy - 60, Math.min(2600, w - 700), Math.min(1800, h - 2400), 0);
      put('sofa', '三人沙发', cx, y1 - 520, Math.min(2400, w - 700), 900, 180);
      put('tvstand', '电视柜', cx, y0 + 220, Math.min(2400, w - 700), 400, 0);
      put('coffeetable', '茶几', cx, cy - 60, Math.min(1300, w - 1500), 650, 0);
      if (w > 4200) put('armchair', '单人沙发', x0 + 560, cy - 60, 850, 850, 90);
      put('plant', '绿植', x1 - 350, y0 + 350, 500, 500);
    } else if (DINING.test(name)) {
      const tw = Math.min(1600, w - 1300);
      const td = Math.min(900, h - 1600);
      put('table', '餐桌', cx, cy, tw, td, 0);
      if (tw >= 1000) {
        put('chair', '餐椅', cx - tw / 2 - 320, cy, 450, 480, 270);
        put('chair', '餐椅', cx + tw / 2 + 320, cy, 450, 480, 90);
      }
      if (td >= 700) {
        put('chair', '餐椅', cx, cy - td / 2 - 320, 450, 480, 180);
        put('chair', '餐椅', cx, cy + td / 2 + 320, 450, 480, 0);
      }
      if (w > 4000) put('cabinet', '餐边柜', cx, y1 - 220, Math.min(1600, w - 1600), 400, 180);
    } else if (KITCHEN.test(name)) {
      put('counter', '橱柜台面', x0 + 320, cy, Math.min(h - 600, 3200), 600, 270);
      put('stove', '燃气灶', x0 + 320, cy - Math.min(900, h * 0.28), 750, 450, 270);
      put('ksink', '水槽', x0 + 320, cy + Math.min(900, h * 0.28), 800, 450, 270);
      if (w > 2700) put('counter', '橱柜台面', cx + 400, y1 - 320, Math.min(w - 1300, 2400), 600, 180);
      put('fridge', '冰箱', x1 - 400, y0 + 420, Math.min(700, w - 900), Math.min(700, h - 900), 0);
    } else if (BATH.test(name)) {
      if (a >= 3.2) {
        const sw = Math.min(900, w * 0.5);
        const sh = Math.min(900, h * 0.45);
        put('shower', '淋浴房', x1 - sw / 2 - 20, y0 + sh / 2 + 20, sw, sh, 0);
      }
      put('toilet', '马桶', x0 + 380, cy + Math.min(400, h * 0.12), 400, 700, 270);
      put('vanity', '浴室柜', cx + Math.min(200, w * 0.1), y1 - 270, Math.min(900, w - 700), 500, 180);
    } else if (BALCONY.test(name)) {
      if (LAUNDRY.test(name)) {
        put('washer', '洗衣机', x0 + 350, cy - 400, 600, 600, 270);
        put('vanity', '洗衣池', x0 + 350, cy + 400, 600, 500, 270);
      } else if (a > 5) {
        put('roundtable', '茶桌', cx, cy, 600, 600);
        put('armchair', '休闲椅', cx, cy - 900, 750, 750, 0);
        put('armchair', '休闲椅', cx, cy + 900, 750, 750, 180);
      }
      put('plant', '绿植', x1 - 400, y1 - 400, 500, 500);
    } else if (HALLWAY.test(name)) {
      if (Math.min(w, h) >= 1400) {
        put('shoecab', '鞋柜', horiz ? cx : x0 + 220, horiz ? y0 + 220 : cy, Math.min(1000, Math.max(w, h) - 400), 350, horiz ? 0 : 270);
      }
    } else if (a > 4) {
      put('plant', '绿植', cx, cy, 500, 500);
    }
  }

  // 地毯垫在最底层（原 L973）
  return out.filter((f) => f.type === 'rug').concat(out.filter((f) => f.type !== 'rug'));
}