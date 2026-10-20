/**
 * 家具图例（45 类型的 SVG 片段，SPEC §A15 / OF §2.8；原 `furnSVG(t,w,d,c)`，`装修设计.html` L1060-1167）。
 *
 * 契约（🔒 签名来自原实现，⛔ 不要改名/改参数顺序）：
 * ```ts
 * furnSVG(type: FurnitureType, w: number, d: number, color: string): string
 * ```
 * 三处复用（原实现一致）：家具库缩略图、图纸内家具、拖拽幽灵图。
 *
 * 颜色规则（ADR-10）：
 * - `color`（用户数据色 / 家具库默认色）**不随主题变**；
 * - 图例内部的中性内容色（床品白、五金灰、瓷白…）收敛在 `data/furniture-lib.ts` 的 `FURN_PAINT`
 *   唯一来源（本文件是 SPEC §C.2 B3 白名单**之外**的文件，⛔ 不得出现十六进制字面值）；
 * - 明暗派生用 `shade()`（原 L1035 的语义：k>1 向白靠、k<1 向黑靠），属于内容色运算，不影响主题。
 */
import { FURN_PAINT } from '@/data/furniture-lib';
import type { FurnitureType } from '@/types/furniture';

/** 图例统一描边（原 `ST`，L1061） */
const ST = `stroke="${FURN_PAINT.outline}" stroke-width="1" vector-effect="non-scaling-stroke"`;
/** 虚线（原 `DASH`，L1066） */
const DASH = 'stroke-dasharray="4 3"';

/** 矩形（原 `rc`，L1062） */
function rc(x: number, y: number, w: number, h: number, f: string, ex = ''): string {
  return `<rect x="${x}" y="${y}" width="${Math.max(0, w)}" height="${Math.max(0, h)}" fill="${f}" ${ST} ${ex}/>`;
}

/** 椭圆（原 `ec`，L1063） */
function ec(cx: number, cy: number, rx: number, ry: number, f: string, ex = ''): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${Math.max(0, rx)}" ry="${Math.max(0, ry)}" fill="${f}" ${ST} ${ex}/>`;
}

/** 直线（原 `ln`，L1064） */
function ln(x1: number, y1: number, x2: number, y2: number, ex = ''): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${ST} ${ex}/>`;
}

/** 路径（原 `pa`，L1065） */
function pa(d: string, f = 'none', ex = ''): string {
  return `<path d="${d}" fill="${f}" ${ST} ${ex}/>`;
}

/** 颜色明暗派生（原 `shade`，L1035）：`k > 1` 向白靠，`k < 1` 向黑靠 */
export function shade(hex: string, k: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = Number.parseInt(h, 16);
  if (!Number.isFinite(n)) return hex;
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const factor = (v: number): number => Math.max(0, Math.min(255, Math.round(k > 1 ? v + (255 - v) * (k - 1) * 2 : v * k)));
  return `#${rgb.map((v) => factor(v).toString(16).padStart(2, '0')).join('')}`;
}

/** 不显示名称标签的类型（原 `NOLABEL`，L1170） */
export const FURN_LABEL_EXCLUDED: readonly FurnitureType[] = ['plant', 'floorlamp', 'sidetable', 'barstool', 'beanbag'];

const P = FURN_PAINT;

/**
 * 单个家具的 SVG 片段（**局部坐标**：以中心为原点，宽 `w` 沿 x、深 `d` 沿 y）。
 * 调用方负责 `translate(cx cy) rotate(rot)`。
 */
export function furnSVG(type: FurnitureType, w: number, d: number, color: string): string {
  const x = -w / 2;
  const y = -d / 2;
  const m = Math.min(w, d);
  switch (type) {
    case 'bed': {
      let s = rc(x, y, w, d, P.sheet, 'rx="30"') + rc(x, y, w, Math.min(90, d * 0.05), shade(color, 0.62), 'rx="20"');
      const ph = Math.min(360, d * 0.18);
      const py = y + 150;
      if (w >= 1300) {
        const pw = (w - 240) / 2;
        s += rc(x + 80, py, pw, ph, P.white, 'rx="70"') + rc(x + 160 + pw, py, pw, ph, P.white, 'rx="70"');
      } else {
        s += rc(x + 80, py, w - 160, ph, P.white, 'rx="70"');
      }
      const by = py + ph + 110;
      const bh = y + d - 15 - by;
      s += rc(x + 15, by, w - 30, bh, color, 'rx="40"') + pa(`M${x + 15} ${by + 300}H${x + w - 15}`, 'none', DASH);
      s += pa(
        `M${x + w - 15 - Math.min(420, w * 0.3)} ${by}L${x + w - 15} ${by}L${x + w - 15} ${by + Math.min(420, w * 0.3)}Z`,
        shade(color, 1.12),
      );
      return s;
    }
    case 'sofa':
    case 'armchair': {
      const b = d * 0.24;
      const a = Math.min(200, w * 0.13);
      const n = type === 'armchair' ? 1 : w > 2200 ? 3 : 2;
      const cw = (w - 2 * a) / n;
      const dk = shade(color, 0.85);
      let s = rc(x, y, w, d, dk, 'rx="60"');
      for (let i = 0; i < n; i += 1) s += rc(x + a + i * cw, y + b, cw, d - b - 40, color, 'rx="40"');
      return s + rc(x, y, w, b, dk, 'rx="50"') + rc(x, y, a, d, dk, 'rx="50"') + rc(x + w - a, y, a, d, dk, 'rx="50"');
    }
    case 'cornersofa': {
      const k = Math.min(950, d * 0.56, w * 0.4);
      const b = 220;
      const dk = shade(color, 0.85);
      let s = pa(`M${x} ${y}H${x + w}V${y + k}H${x + k}V${y + d}H${x}Z`, dk);
      const cw = (w - b - 200) / 2;
      s +=
        rc(x + b, y + b, cw, k - b - 30, color, 'rx="40"') +
        rc(x + b + cw, y + b, cw, k - b - 30, color, 'rx="40"') +
        rc(x + b, y + k, k - b - 30, d - k - 200, color, 'rx="40"');
      return (
        s +
        rc(x, y, w, b, dk, 'rx="50"') +
        rc(x, y, b, d, dk, 'rx="50"') +
        rc(x + w - 200, y, 200, k, dk, 'rx="50"') +
        rc(x, y + d - 200, k, 200, dk, 'rx="50"')
      );
    }
    case 'nightstand':
      return rc(x, y, w, d, color, 'rx="30"') + `<circle r="${m * 0.24}" fill="${P.lamp}" ${ST}/>` + `<circle r="${m * 0.08}" fill="${shade(color, 0.8)}" ${ST}/>`;
    case 'wardrobe': {
      let s = rc(x, y, w, d, color) + ln(x + 50, 0, x + w - 50, 0);
      for (let hx = x + 160; hx < x + w - 100; hx += 180) s += ln(hx - 45, -d * 0.28, hx + 45, d * 0.28, 'opacity=".6"');
      return s;
    }
    case 'cabinet':
    case 'shoecab':
      return rc(x, y, w, d, color) + ln(x, y + d, x + w, y);
    case 'dresser':
      return rc(x, y, w, d, color, 'rx="20"') + rc(x + w * 0.2, y, w * 0.6, 55, P.glass) + ec(0, d / 2 + 180, 160, 140, shade(color, 0.9));
    case 'desk':
      return rc(x, y, w, d, color, 'rx="20"') + rc(-w * 0.18, y + 50, w * 0.36, 45, P.metal) + rc(-w * 0.14, y + d * 0.45, w * 0.28, d * 0.28, P.wash, 'rx="10"');
    case 'chair':
      return rc(x + 25, y + d * 0.16, w - 50, d * 0.84 - 10, color, 'rx="60"') + rc(x, y, w, d * 0.2, shade(color, 0.78), 'rx="40"');
    case 'bookshelf': {
      let s = rc(x, y, w, d, color);
      for (let bx = x + 400; bx < x + w - 50; bx += 400) s += ln(bx, y, bx, y + d);
      return s;
    }
    case 'baycushion':
      return (
        rc(x, y, w, d, color, 'rx="60"') +
        rc(x + 60, y + 80, w - 120, Math.min(300, d * 0.2), P.white, 'rx="60"') +
        rc(x + 60, y + d - 80 - Math.min(300, d * 0.2), w - 120, Math.min(300, d * 0.2), P.white, 'rx="60"')
      );
    case 'coffeetable':
      return rc(x, y, w, d, color, 'rx="80"') + rc(x + 60, y + 60, w - 120, d - 120, shade(color, 1.06), 'rx="50"');
    case 'tvstand':
      return rc(x, y, w, d, color) + rc(x + w * 0.15, y + 30, w * 0.7, 55, P.frameDark);
    case 'rug':
      return rc(x, y, w, d, color, 'rx="40" fill-opacity=".6"') + rc(x + 90, y + 90, w - 180, d - 180, 'none', 'rx="30" stroke-dasharray="3 3" opacity=".6"');
    case 'plant': {
      let s = `<circle r="${m / 2}" fill="${color}" fill-opacity=".85" ${ST}/>`;
      for (let k = 0; k < 8; k += 1) {
        s += `<ellipse cx="0" cy="${-m * 0.27}" rx="${m * 0.1}" ry="${m * 0.21}" transform="rotate(${k * 45})" fill="${shade(color, 0.8)}" ${ST}/>`;
      }
      return s + `<circle r="${m * 0.1}" fill="${P.clay}" ${ST}/>`;
    }
    case 'table':
      return rc(x, y, w, d, color, 'rx="30"') + rc(x + 50, y + 50, w - 100, d - 100, 'none', 'rx="20" opacity=".4"');
    case 'roundtable':
      return ec(0, 0, w / 2, d / 2, color) + ec(0, 0, w / 2 - 50, d / 2 - 50, 'none', 'opacity=".4"');
    case 'counter':
      return rc(x, y, w, d, color) + ln(x, y + d - 40, x + w, y + d - 40, DASH);
    case 'stove': {
      let s = rc(x, y, w, d, P.charcoal, 'rx="20"');
      const r = m * 0.26;
      const pts: [number, number][] = w / d > 1.4
        ? [
            [-w / 4, 0],
            [w / 4, 0],
          ]
        : [
            [-w / 4, -d / 4],
            [w / 4, -d / 4],
            [-w / 4, d / 4],
            [w / 4, d / 4],
          ];
      pts.forEach(([px, py]) => {
        s += `<circle cx="${px}" cy="${py}" r="${r}" fill="none" stroke="${P.metalFaint}" stroke-width="1" vector-effect="non-scaling-stroke"/><circle cx="${px}" cy="${py}" r="${r * 0.45}" fill="${P.metalMid}"/>`;
      });
      return s;
    }
    case 'ksink':
      return (
        rc(x, y, w, d, color, 'rx="20"') +
        rc(x + w * 0.06, y + d * 0.18, w * 0.42, d * 0.66, P.white, 'rx="50"') +
        rc(x + w * 0.52, y + d * 0.18, w * 0.42, d * 0.66, P.white, 'rx="50"') +
        `<circle cx="0" cy="${y + d * 0.09}" r="22" fill="${P.gray}"/>`
      );
    case 'fridge':
      return (
        rc(x, y, w, d, color, 'rx="30"') +
        ln(x, y + d * 0.14, x + w, y + d * 0.14) +
        ln(0, y + d * 0.14, 0, y + d) +
        rc(-70, y + d * 0.5, 40, d * 0.25, P.handle) +
        rc(30, y + d * 0.5, 40, d * 0.25, P.handle)
      );
    case 'toilet':
      return rc(x + w * 0.04, y, w * 0.92, d * 0.27, color, 'rx="30"') + ec(0, y + d * 0.27 + d * 0.36, w * 0.47, d * 0.36, color) + ec(0, y + d * 0.27 + d * 0.4, w * 0.3, d * 0.24, P.porcelain);
    case 'vanity':
      return rc(x, y, w, d, color, 'rx="20"') + ec(0, y + d * 0.57, Math.min(w * 0.32, 260), d * 0.28, P.white) + `<circle cx="0" cy="${y + d * 0.17}" r="26" fill="${P.gray}"/>`;
    case 'shower':
      return rc(x, y, w, d, color) + ln(x, y, x + w, y + d, DASH) + ln(x + w, y, x, y + d, DASH) + `<circle r="45" fill="${P.white}" ${ST}/>`;
    case 'bathtub':
      return rc(x, y, w, d, color, 'rx="40"') + rc(x + 80, y + 80, w - 160, d - 160, P.white, `rx="${m * 0.33}"`) + `<circle cx="${x + w - 260}" cy="0" r="35" fill="${P.grayLight}" ${ST}/>`;
    case 'washer':
    case 'dryer':
      return (
        rc(x, y, w, d, color, 'rx="30"') +
        rc(x, y, w, d * 0.14, shade(color, 0.9)) +
        `<circle cy="${d * 0.06}" r="${m * 0.34}" fill="${P.white}" ${ST}/><circle cy="${d * 0.06}" r="${m * 0.24}" fill="${type === 'dryer' ? P.drumWarm : P.drumCool}" ${ST}/>`
      );
    case 'crib': {
      let s = rc(x, y, w, d, color, 'rx="20"') + rc(x + 45, y + 45, w - 90, d - 90, P.white, 'rx="20"');
      for (let sx = x + 90; sx < x + w - 60; sx += 90) s += ln(sx, y, sx, y + 45, 'opacity=".5"') + ln(sx, y + d - 45, sx, y + d, 'opacity=".5"');
      return s;
    }
    case 'beanbag':
      return ec(0, 0, w / 2, d / 2, color) + ec(-w * 0.04, -d * 0.06, w * 0.3, d * 0.28, shade(color, 1.12), 'opacity=".9"');
    case 'sidetable':
      return ec(0, 0, w / 2, d / 2, color) + ec(0, 0, w * 0.12, d * 0.12, 'none', 'opacity=".5"');
    case 'floorlamp':
      return `<circle r="${m * 0.5}" fill="${P.lamp}" fill-opacity=".85" ${ST}/>` + `<circle r="${m * 0.32}" fill="none" ${ST} ${DASH}/>` + `<circle r="${m * 0.07}" fill="${color}" ${ST}/>`;
    case 'island':
      return rc(x, y, w, d, color) + ln(x, y + d - 250, x + w, y + d - 250, DASH);
    case 'barstool':
      return `<circle r="${m / 2}" fill="${color}" ${ST}/><circle r="${m * 0.3}" fill="${shade(color, 1.15)}" ${ST}/>`;
    case 'waterheater':
      return rc(x, y, w, d, color, `rx="${d / 2}" ${DASH}`) + ln(x + w * 0.2, 0, x + w * 0.8, 0, DASH);
    case 'tv':
      return rc(x, y, w, d, color, 'rx="10"') + rc(x + w * 0.3, y + d, w * 0.4, Math.min(40, d), P.metalMid);
    case 'aircon':
      return rc(x, y, w, d, color, 'rx="30"') + ln(x + 40, y + d * 0.72, x + w - 40, y + d * 0.72) + ln(x + 40, y + d * 0.86, x + w - 40, y + d * 0.86);
    case 'acwall': {
      let s = rc(x, y, w, d, color, `rx="30" ${DASH}`);
      [0.25, 0.5, 0.75].forEach((k) => {
        s += ln(x + w * k, y + d, x + w * k, y + d + 200, `${DASH} opacity=".6"`);
      });
      return s;
    }
    case 'dishwasher':
      return rc(x, y, w, d, color, 'rx="15"') + ln(x, y + d - 70, x + w, y + d - 70) + rc(x + w * 0.3, y + d - 45, w * 0.4, 25, P.metalLight);
    case 'ovencol':
      return rc(x, y, w, d, color) + ln(x, y, x + w, y + d) + ln(x + w, y, x, y + d);
    case 'purifier':
      return rc(x, y, w, d, color, 'rx="60"') + rc(x + 45, y + 45, w - 90, d - 90, 'none', `rx="40" ${DASH}`);
    case 'officechair': {
      let s = '';
      for (let k = 0; k < 5; k += 1) {
        s += `<line x1="0" y1="0" x2="0" y2="${m * 0.48}" transform="rotate(${k * 72 + 36})" stroke="${P.metal}" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
      }
      return (
        s +
        rc(x + w * 0.12, y + d * 0.22, w * 0.76, d * 0.66, color, 'rx="80"') +
        rc(x + w * 0.15, y + d * 0.04, w * 0.7, d * 0.16, shade(color, 0.78), 'rx="40"') +
        rc(x + w * 0.02, y + d * 0.3, w * 0.1, d * 0.45, shade(color, 0.7), 'rx="30"') +
        rc(x + w * 0.88, y + d * 0.3, w * 0.1, d * 0.45, shade(color, 0.7), 'rx="30"')
      );
    }
    case 'piano': {
      let s = rc(x, y, w, d * 0.55, color, 'rx="10"') + rc(x + 40, y + d * 0.55, w - 80, d * 0.4, shade(color, 1.4), 'rx="10"');
      const kx = x + 90;
      const kw = w - 180;
      const kd = d * 0.2;
      s += rc(kx, y + d * 0.55, kw, kd, P.ivory);
      for (let i = 1; i < 26; i += 1) s += ln(kx + (kw * i) / 26, y + d * 0.55, kx + (kw * i) / 26, y + d * 0.55 + kd, 'opacity=".5"');
      return s;
    }
    case 'treadmill':
      return rc(x, y, w, d, color, 'rx="50"') + rc(x + 90, y + 320, w - 180, d - 400, P.nearBlack, 'rx="25"') + rc(x, y, w, 230, shade(color, 1.4), 'rx="40"');
    default:
      return rc(x, y, w, d, color);
  }
}

/** 家具是否显示名称（原 `renderFurn` 的 `Math.min(w,d) >= 380 && !NOLABEL.includes(type)`，L1201-1202） */
export function furnShowsLabel(type: FurnitureType, w: number, d: number): boolean {
  return Math.min(w, d) >= 380 && !FURN_LABEL_EXCLUDED.includes(type);
}

/** 家具名称标签字号（原 L1200：`max(80, min(170, min(w,d)*.2))`） */
export function furnLabelSize(w: number, d: number): number {
  return Math.max(80, Math.min(170, Math.min(w, d) * 0.2));
}