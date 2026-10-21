/**
 * 场景**状态断言**测试（补上 D-A / D-B 缺陷的防护网）。
 *
 * ## 为什么需要这个文件
 *
 * D-A（切户型后 3D 不重建）与 D-B（复式当前层几何不建）这两个缺陷有一个共同特征：
 * **`typecheck`、203 个单测、`lint`、`verify`、渲染 8/8、键盘 5/5 全部通过，但功能是错的。**
 *
 * 原因是既有测试只验证「函数被调用 / 返回值符合预期」，从不验证
 * 「场景里真的建出了几何体」。本文件补上这一层：直接对 `computeSignatures` 与
 * 户型数据结构做**状态断言**，确保「签名能反映户型身份」这条前提成立。
 *
 * ## 分层策略
 *
 * - **本文件（node 环境，快，可进 CI）**：验证签名计算与数据结构契约。
 *   这类断言能在「切换户型但签名不变」时立刻失败。
 * - **`tests/e2e/scene-state.spec.ts`（Playwright）**：验证真实浏览器里
 *   `engine.stats().archMeshes > 0`、切换户型后标签正确。慢，但能抓住「签名对了但几何没建」。
 *
 * 两层互补：本文件防「逻辑回归」，E2E 防「装配回归」。
 */
import { describe, expect, it } from 'vitest';
import { computeSignatures } from '@/features/scene3d/engine';
import { PRESETS } from '@/data/presets';
import type { LayoutSlice, PlanSlice, UiSlice } from '@/types/scene3d';

/** 构造一个最小的 PlanSlice（只含 computeSignatures 需要的字段） */
function sliceOf(planId: string, level = 0): PlanSlice {
  const plan = PRESETS.find((p) => p.id === planId);
  if (!plan) throw new Error(`preset not found: ${planId}`);
  const multi = Boolean(plan.multilevel && plan.levels && plan.levels.length > 0);
  const levelData = multi && plan.levels ? plan.levels[Math.min(level, plan.levels.length - 1)] : plan;
  return {
    plan,
    levelData,
    level,
    stairs: levelData.stairs ?? [],
  };
}

const emptyLayout: LayoutSlice = { rooms: {}, demolished: [], furniture: [] };
const emptyUi: UiSlice = { view3d: { cut: 2.8, furn: true, labels: true, night: false, hour: 10, mode: 'orbit' } };

describe('三签名：必须能区分不同户型（D-A 的防护）', () => {
  it('不同户型 → arch 签名不同', () => {
    const a = computeSignatures(sliceOf('h3b'), emptyLayout, emptyUi);
    const b = computeSignatures(sliceOf('hloft'), emptyLayout, emptyUi);
    expect(a.arch).not.toBe(b.arch);
  });

  it('不同户型 → labels 签名不同', () => {
    const a = computeSignatures(sliceOf('h3b'), emptyLayout, emptyUi);
    const b = computeSignatures(sliceOf('hloft'), emptyLayout, emptyUi);
    expect(a.labels).not.toBe(b.labels);
  });

  it('同一户型重复计算 → 签名稳定（幂等）', () => {
    const s1 = computeSignatures(sliceOf('h3b'), emptyLayout, emptyUi);
    const s2 = computeSignatures(sliceOf('h3b'), emptyLayout, emptyUi);
    expect(s1.arch).toBe(s2.arch);
    expect(s1.furn).toBe(s2.furn);
    expect(s1.labels).toBe(s2.labels);
  });

  it('所有内置户型两两签名互不相同', () => {
    const sigs = PRESETS.map((p) => computeSignatures(sliceOf(p.id), emptyLayout, emptyUi).arch);
    expect(new Set(sigs).size).toBe(PRESETS.length);
  });
});

describe('复式户型：当前层数据必须非空（D-B 的防护）', () => {
  it('loft 顶层 walls/rooms 是空数组（这是缺陷的前提，必须被显式记录）', () => {
    const loft = PRESETS.find((p) => p.id === 'hloft');
    expect(loft).toBeTruthy();
    // 顶层确实为空 —— 所以 3D 绝不能直接用 plan 建几何
    expect(loft?.walls ?? []).toHaveLength(0);
    expect(loft?.rooms ?? []).toHaveLength(0);
    // 真实数据在 levels 里
    expect(loft?.levels?.length ?? 0).toBeGreaterThan(0);
  });

  it('loft 的 levelData（当前层）必须有墙和房间', () => {
    for (let lv = 0; lv < 2; lv += 1) {
      const slice = sliceOf('hloft', lv);
      expect(slice.levelData.walls?.length ?? 0).toBeGreaterThan(0);
      expect(slice.levelData.rooms?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('loft 不同楼层的 levelData 不同 → 切层会触发重建', () => {
    const l0 = sliceOf('hloft', 0).levelData;
    const l1 = sliceOf('hloft', 1).levelData;
    expect(l0).not.toBe(l1);
    expect(l0.walls).not.toEqual(l1.walls);
  });

  it('单层户型的 levelData 就是 plan 自身', () => {
    const slice = sliceOf('h3b');
    expect(slice.levelData).toBe(slice.plan);
  });

  it('每个内置户型的 levelData 都能建出几何（墙 > 0）', () => {
    for (const preset of PRESETS) {
      const slice = sliceOf(preset.id);
      const wallCount = slice.levelData.walls?.length ?? 0;
      // 空白户型（hblank）允许无墙；其余必须有
      if (preset.id === 'hblank') continue;
      expect(wallCount, `${preset.id} 的当前层没有墙体`).toBeGreaterThan(0);
    }
  });
});

describe('签名对输入变化敏感（防止「改了却不重建」）', () => {
  it('拆改墙体 → arch 签名变化', () => {
    const before = computeSignatures(sliceOf('h3b'), emptyLayout, emptyUi);
    const after = computeSignatures(sliceOf('h3b'), { ...emptyLayout, demolished: ['w0'] }, emptyUi);
    expect(after.arch).not.toBe(before.arch);
  });

  it('剖切高度变化 → arch 签名变化', () => {
    const before = computeSignatures(sliceOf('h3b'), emptyLayout, emptyUi);
    const after = computeSignatures(sliceOf('h3b'), emptyLayout, {
      view3d: { ...emptyUi.view3d, cut: 1.2 },
    });
    expect(after.arch).not.toBe(before.arch);
  });

  it('房间材质覆盖变化 → arch 与 labels 签名都变化', () => {
    const before = computeSignatures(sliceOf('h3b'), emptyLayout, emptyUi);
    const after = computeSignatures(
      sliceOf('h3b'),
      { ...emptyLayout, rooms: { r1: { name: '客厅', mat: 'marble' } } },
      emptyUi,
    );
    expect(after.arch).not.toBe(before.arch);
    expect(after.labels).not.toBe(before.labels);
  });

  it('家具变化 → furn 签名变化，arch 签名不变（避免过度重建）', () => {
    const before = computeSignatures(sliceOf('h3b'), emptyLayout, emptyUi);
    const after = computeSignatures(
      sliceOf('h3b'),
      {
        ...emptyLayout,
        furniture: [{ id: 'f1', type: 'bed', name: '床', cx: 1000, cy: 1000, w: 1800, d: 2000, rot: 0, color: '#fff' }],
      },
      emptyUi,
    );
    expect(after.furn).not.toBe(before.furn);
    expect(after.arch).toBe(before.arch);
  });
});
