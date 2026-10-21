# 3D 墙体 / 地面分离 —— 复现与病因判定

> 任务：t10（只诊断，未修改 `src/**` 任何文件）
> 工程：`F:\LearnSpace\L1yuu_Space\decoration-studio`
> 结论：**captain 最初的「共面 Z-fighting」定位不成立**。实测到**两个相互独立的真实缺陷**，其中第二个才是用户所说「墙体和地面分离」的直接原因。

---

## 0. 一句话结论

| 编号 | 缺陷 | 一句话 | 影响 |
| --- | --- | --- | --- |
| **D-A** | 户型切换后 3D 场景不重建 | 2D 里切户型 → 再进 3D，画面仍是**上一个户型**的几何与标签 | 所有户型（单层也中招） |
| **D-B** | 复式户型「当前层」几何完全不建 | 复式 3D 里**当前层的地面与墙体一个都没有**，只画了另一层的墙（抬高在 y=2.9） | 所有 `multilevel` 户型 |

用户看到的「**墙体和地面分离**」= **D-B**：整层墙体悬在 y=2.9 m，而唯一的「地面」是 `lighting.ts` 的场景底板（y=-0.015），两者相差 **2.915 m**。

---

## 1. 复现步骤

### 1.1 环境与构建

```powershell
cd F:\LearnSpace\L1yuu_Space\decoration-studio
pnpm build
```

真实输出（节选）：

```
> decoration-studio@0.1.0 build F:\LearnSpace\L1yuu_Space\decoration-studio
> vue-tsc --noEmit -p tsconfig.json && vite build

vite v7.3.7 building client environment for production...
✓ 247 modules transformed.
dist/assets/three.module-Cmi4nve-.js  503.96 kB │ gzip: 130.05 kB
✓ built in 6.79s
[exit code: 0]
```

### 1.2 浏览器实拍

用本机 Chrome + `playwright-core` 加载 `dist/`（脚本：`.tools/final-isolated.cjs`、`.tools/isolate-defects.cjs`）。

```powershell
node .tools\final-isolated.cjs
node .tools\isolate-defects.cjs
```

> ⚠️ 关键经验：`chromium.launchPersistentContext(USER_DIR)` 同一 context 下的多个 page **共享 localStorage**，切户型会互相污染。最终取证脚本为每个场景单独 launch 一次 context（各自独立 `USER_DIR`）。

### 1.3 三条复现路径

| 路径 | 操作序列 | 暴露的缺陷 |
| --- | --- | --- |
| **P1 复式直入** | 打开页面 → 「户型」→ 打开「复式两层」→ 点「3D 场景」 | **D-B**（无切换残留，最干净） |
| **P2 切户型序列** | 三室两厅 → 进 3D → 回 2D → 切「复式两层」→ 再进 3D | **D-A**（旧几何残留）+ D-B |
| **P3 单层切单层** | 三室两厅 → 进 3D → 回 2D → 切「两室两厅一卫」→ 再进 3D | **仅 D-A**（用来把两个缺陷分开） |

---

## 2. 截图取证（≥3 视角）

全部位于 `.tools/`（已被 gitignore）。三视角 = 斜视 / 俯视 / **低角度平视**（压低相机直到接近水平，是暴露「悬空」最有效的视角）。

### 2.1 缺陷 D-B：复式墙体整体悬空

| 视角 | 复式（缺陷） | 三室两厅（对照，正常） |
| --- | --- | --- |
| 斜视 | [`.tools/.tmp-iso-C2-LOFT-iso-canvas.png`](.tools/.tmp-iso-C2-LOFT-iso-canvas.png) | [`.tools/.tmp-iso-C1-3B-iso-canvas.png`](.tools/.tmp-iso-C1-3B-iso-canvas.png) |
| 俯视 | [`.tools/.tmp-iso-C2-LOFT-top-canvas.png`](.tools/.tmp-iso-C2-LOFT-top-canvas.png) | [`.tools/.tmp-iso-C1-3B-top-canvas.png`](.tools/.tmp-iso-C1-3B-top-canvas.png) |
| **低角度平视** | [`.tools/.tmp-iso-C2-LOFT-eye2-canvas.png`](.tools/.tmp-iso-C2-LOFT-eye2-canvas.png) | [`.tools/.tmp-iso-C1-3B-eye2-canvas.png`](.tools/.tmp-iso-C1-3B-eye2-canvas.png) |
| 低角度放大 | [`.tools/.tmp-crop-loft-float.png`](.tools/.tmp-crop-loft-float.png) | — |

**低角度平视图里肉眼即可判定**：复式户型的整层墙体（带窗洞的那一圈）**悬在半空**，下方是空气，家具单独散落在地面上；三室两厅同机位则墙体牢牢坐在地面上。放大图 `.tmp-crop-loft-float.png` 把这一空隙放大了 2 倍。

### 2.2 缺陷 D-A：切户型后 3D 不重建

| 状态 | 截图 |
| --- | --- |
| 切前：三室两厅在 3D | [`.tools/.tmp-iso-C3-SEQ-before-3b-3d-canvas.png`](.tools/.tmp-iso-C3-SEQ-before-3b-3d-canvas.png) |
| 切后：2D 已切成复式，再进 3D（**仍是三室两厅的几何**） | [`.tools/.tmp-iso-C3-SEQ-after-loft-3d-canvas.png`](.tools/.tmp-iso-C3-SEQ-after-loft-3d-canvas.png) |
| 点一次「剖切」强制重建后（才变正确） | [`.tools/.tmp-iso-C3-SEQ-after-cut-toggle-canvas.png`](.tools/.tmp-iso-C3-SEQ-after-cut-toggle-canvas.png) |
| 单层切单层（P3）同样陈旧 | [`.tools/.tmp-iso2-X3-twobed-3d-canvas.png`](.tools/.tmp-iso2-X3-twobed-3d-canvas.png) |
| 全新页面直接进复式（P1，无残留） | [`.tools/.tmp-iso2-Z1-loft-3d-fresh-canvas.png`](.tools/.tmp-iso2-Z1-loft-3d-fresh-canvas.png) |

---

## 3. 病因判定（四选一）

### 3.1 总表

| 候选 | 判定 | 关键证据 |
| --- | --- | --- |
| **(a) Z-fighting / 共面深度冲突** | ❌ **不成立** | 地面 × 墙体重叠面积≈0；静止 4 帧逐字节相同；地面与底板相差 15 mm |
| **(b) 墙体底部悬空（`yb` 错）** | ✅ **成立，但原因不是 `yb` 参数** | 复式下墙体 `minY=2.9`，`yb` 传的是 0 —— 是**建错了层**，不是 `yb` 算错 |
| **(c) 地面 poly 与墙矩形有真实间隙** | ❌ **不成立** | 数据与基线 `.html` 逐字一致；未覆盖边都是「房间开放边界」 |
| **(d) 其他** | ✅ **成立（真正根因）** | **D-A 场景未随户型切换重建** + **D-B 复式当前层几何未建** |

### 3.2 (a) Z-fighting：排除

**证据 1 —— 地面与墙体在平面上几乎不重叠**（`.tools/overlap-audit.mts`）：

```powershell
node "<vite-node.mjs>" .tools\overlap-audit.mts
```

```
=========== P_3B 三室两厅两卫 ===========
  房间地面多边形 × 墙体矩形 的重叠总面积: 0.1559 m²
  最大单处重叠: 房间 laundry × 墙 #31 = 0.1290 m²
  地面 ShapeGeometry y=0.000 vs 场景底板（lighting.ts ground）y=-0.015 → 高差 15 mm

=========== P_2B 两室两厅一卫 ===========
  房间地面多边形 × 墙体矩形 的重叠总面积: 0.0000 m²
  ⇒ 无任何重叠：地面与墙体在平面上互不相交，y=0 处不存在共面表面
```

墙矩形本来就落在房间多边形**外侧**（墙厚 200-240 mm，房间 poly 贴墙内表面）。因此「地面平面与墙体底面在 y=0 共面」这个前提不成立。P_3B 那 0.13 m² 是洗衣阳台与墙 #31 的局部重叠，量级不足以造成全屋性分离。

**证据 2 —— 静止画面逐字节相同（Z-fighting 的典型特征是逐帧跳变）**：

```
########## C4 Z-fighting 判据（静止多帧 / 微动相机）##########
  静止 4 帧 md5: 4f4af4a24fc2 / 4f4af4a24fc2 / 4f4af4a24fc2 / 4f4af4a24fc2
  逐字节全同: true
  帧间 meanL1: 0, 0, 0
  相机微动 1px: meanL1=3.39 差异格=286 (6.98%)
```

静止相机下 4 帧完全一致，**没有任何闪烁条纹**；微动 1 px 才产生 6.98% 的差异，属正常视差，不是深度冲突的剧烈跳变。

**证据 3 —— 单层户型墙体底部与地面本来就精确贴合**：

```
  墙体 minY 集合: 0.000, 2.100, 2.400
  地面 y 集合: 0.000
  => 墙底 - 地面 = 0.0000 m
```

### 3.3 (b) 墙体底部悬空：成立（但根因是「建错了层」）

`.tools/audit-engine-input.mts` 用引擎**实际传入的参数**跑 `buildArchitecture()`：

```powershell
node "<vite-node.mjs>" .tools\audit-engine-input.mts
```

```
########## 复式 P_LOFT（levelData = levels[0]，与 plan 不同）##########
  顶层 plan.walls=0 rooms=0 stairs=0（顶层结构为空，是迁移后的既定语义）
  levels[0](一层) walls=25 rooms=7 stairs=1
  levels[1](二层) walls=26 rooms=8 stairs=1

  [A. structure = plan.plan（引擎当前口径，level=0）]
    房间地面 mesh 数: 0  ← 没有任何房间地面！
    墙体 mesh 数: 52   墙体 minY 集合: 2.9, 5, 5.3   墙体 maxY: 5.7
    地面 y 集合: (无)
    ⇒ 无房间地面；墙体最低在 y=2.9，而场景底板（lighting.ts ground）在 y=-0.015
       ⇒ 墙体底部与地面之间悬空 2.915 m

  [B. structure = levelData = levels[0]（正确口径，level=0）]
    房间地面 mesh 数: 7 → r1, r2, r3, r4, r5, r6, r7
    墙体 mesh 数: 102   墙体 minY 集合: 0, 2.1, 2.4, 2.9, 5, 5.3   墙体 maxY: 5.7
    地面 y 集合: 0
    ⇒ 墙底 - 地面 = 0.0000 m
```

**这就是 D-B 的量化形态**：引擎传给 `buildArchitecture()` 的是 `structure: plan.plan`（顶层 `Plan`），而复式户型的顶层 `walls/rooms/stairs` **全为空**，真实结构在 `plan.levels[level]`。结果：

- 当前层的 **7 块地面 + 25 面墙 一块都没建**；
- `buildOtherLevels()` 反而把**另一层**的墙画了出来，抬高到 `elev = 2.9`；
- 场景里唯一的「地面」是 `lighting.ts` 的 160×160 底板（`y = -0.015`）；
- ⇒ 墙脚离可见地面 **2.915 m**，正是「墙体和地面分离」。

剖切 1.2 m 时同样成立（`0 地面 / 36 墙 / minY 2.9 / maxY 4.1`）。

### 3.4 (c) 地面 poly 与墙矩形有真实间隙：排除

`.tools/edge-audit.mts`（把门/推拉门/过梁也算作边界构件）：

```powershell
node "<vite-node.mjs>" .tools\edge-audit.mts
```

```
=========== P_3B 三室两厅两卫 ===========
  边界构件: walls=48 wins=12 doors=6 slides=2 lintels=2
  [未覆盖] dining(餐厅) 1/8
      (2180,5796)->(2420,5796) H 最近=606.0mm
  [未覆盖] hall(过道) 1/6
      (6083,6610)->(4820,6610) H 最近=2903.0mm
  合计未覆盖边: 6 / 66
```

这 6 条边**不是间隙**，是「房间多边形的开放边界」：

- `hall → living`（2903 mm）：过道与客厅之间**本来就没有墙**；
- `dining` 的 240×596 缺口：餐厅与厨房之间的凹口；
- 飘窗 4 条边：是审计脚本把 240 mm 宽的过梁矩形误判成竖向构件（分类启发式瑕疵）。

**数据侧佐证**：`P_3B` 的餐厅多边形与功能基线**逐字一致**：

```
装修设计.html:515: {id:'dining', name:'餐厅', poly:[[2420,5190],[4820,5190],[4820,7960],[2420,7960],[2420,7400],[2180,7400],[2180,5796],[2420,5796]], mat:'tile800', at:[3900,5520]},
```

`src/data/presets/three-bed.ts` 的 `dining` 与之一字不差。既然基线 `.html` 也是这个数据，它不可能是本次迁移引入的缺陷。

### 3.5 (d) 其他：两个真实缺陷（真正根因）

#### D-A：户型切换后 3D 场景不重建

**现象量化**（`.tools/isolate-defects.cjs`，隔离 context）：

```
########## X 单层 → 单层：三室两厅 3D → 2D → 切两室两厅 → 3D ##########
[X1-threebed-3d] md5=3cfd92e3e3b2
  3D标签(11): 主卧室12.4m² | 主卫浴3.2m² | 小孩房9.3m² | 客卫浴2.9m² | 洗衣阳台2.9m²
  房间列表(12): 主卧室12.4m² | 主卫浴3.2m² | 小孩房9.3m² | 客卫浴2.9m²

[X3-twobed-3d] md5=0b9c617bde9d
  3D标签(11): 主卧室12.4m² | 主卫浴3.2m² | 小孩房9.3m² | 客卫浴2.9m² | 洗衣阳台2.9m²
  房间列表(9): 主卧10.2m² | 厨房5.1m² | 卫生间4.2m² | 客厅12.2m²

  ⇒ 3D 标签是否仍为三室两厅（未重建）: true
  ⇒ 房间列表是否已切成两室两厅（store 正常）: true
```

**「房间列表变了、3D 标签和几何没变」** 是最硬的判据：房间列表由 `store.rooms` 实时派生（`.ds3d__room`），标签与几何由引擎的三签名决定。数据层已切换，渲染层没有 —— 说明是**重建判定失效**，不是数据错。

`md5` 从 `3cfd92e3e3b2 → 0b9c617bde9d` 有变化，但那只是入场相机动画的落点差异，几何并未替换。

**代码级根因**（两处叠加，都在 `src/features/scene3d/engine.ts`）：

```ts
// engine.ts L450-475  sync()
const next = computeSignatures(plan, layout, ui);
const archChanged = force || next.arch !== sigArch;
sigArch = next.arch;              // ← ① 先把签名写掉
sigFurn = next.furn;
sigLabels = next.labels;
if (!isActive() && !force) {
  // 3D 不活跃：只记 dirty，不重建（SPEC §F.3）
  dirty = archChanged || furnChanged || labelsChanged;
  return;                          // ← ② 之后才 return
}
```

3D 不活跃（在 2D 里切户型）时，`sync()` **先把 `sigArch` 更新成新户型的签名，却什么都没建**。等再次 `enter()`：

```ts
// engine.ts L678-679  enter()
await nextFrame();
await syncStaged();                // ← ③ 没有 force
```

```ts
// engine.ts L487-520  syncStaged()
const archChanged = next.arch !== sigArch;   // ④ 此刻 next.arch === sigArch → false
if (archChanged) { buildArchitectureNow(); ... }   // ⑤ 跳过重建
```

→ **永不重建**。

对照功能基线（`装修设计.html.bak` L2367-2371），原实现的顺序恰好相反：

```js
function sync(force){
  if (!inited || (!active && !force)) return;      // ← 先 return，签名根本不动
  const a = JSON.stringify([...]);
  if (force || a !== sigArch){ sigArch = a; buildArch(); }
  ...
}
```

且原 `enter()` 用的是 **`sync(true)`**（`.bak` L2442）：

```js
async function enter(){
  init(); active = true;
  ...
  sync(true);     // ← 强制重建
```

迁移后变成 `syncStaged()`（无 force），两处偏差叠加，缺陷才显现。

**因果验证**：在陈旧态下点一次「剖切」按钮（改 `ui.view3d.cut`，该值在三签名内），签名立刻变化 → 强制重建 → 画面才正确：

```
---- T1 因果验证：点「剖切」按钮（进入 arch 签名）----
  剖切按钮文案: "全高墙"
[t1d-loft-3d-AFTER-CUT-TOGGLE]
  3D标签(7): 客厅18.5m² | 餐厅10.9m² | 厨房4.8m² | 卫生间3.5m² | 楼梯间8.8m²
  → 标签是否变成复式房间: true
  重建前后画面差异: meanL1=106.57 差异格=2248 (54.88%)
```

#### D-B：复式当前层几何未建

代码位置：

```ts
// engine.ts L401-421  buildArchitectureNow()
buildArchitecture(archGroups, {
  structure: plan.plan,            // ← 传顶层 Plan（复式下 walls/rooms 为空）
  ...
  levels: plan.plan.levels ?? null,
  level: plan.level,
  ...
});
```

`deps.readPlan()` 的类型是 `PlanSlice & { ... }`，其 `plan: Plan` 是**顶层** `Plan`；而 store 的「当前层结构」是 `plan.levelData`（`stores/plan.ts` L81-88：复式返回 `p.levels[index]`）。2D 侧用的就是 `levelData`，3D 侧却用了 `plan.plan` —— 两者在复式下不等价。

单层户型下 `levelData === plan`，所以**缺陷只在复式暴露**；这也解释了为什么「单独测三室两厅一切正常」。

---

## 4. 影响范围

### 4.1 哪些户型

| 户型 | D-A（切户型陈旧） | D-B（当前层未建） |
| --- | --- | --- |
| 全部 7 个内置户型 | ✅ 受影响（只要「先进 3D → 回 2D → 切户型 → 再进 3D」） | ❌ 单层户型不受影响 |
| `hloft` 复式两层 | ✅ | ✅ **必然受影响**（顶层结构为空） |

### 4.2 哪些视角最明显

D-B 的「悬空」在**低角度平视**下最刺眼，且已量化：

```
=== C2 复式（悬空）===
  pattern: structure -> sky(>=12px) -> ground
  floating_columns: 37 / 181
  sky_gap_px: { min: 48, median: 77, max: 127 }

=== C1 三室两厅（对照）===
  floating_columns: 0 / 181
  sky_gap_px: { min: null, median: null, max: null }
```

复式低角度画面中 **37/181 列**出现「结构 → 天空（48-127 px）→ 地面」的三段式；对照户型 **0/181**。这是像素级的「悬空」证明，不依赖主观判断。

- **低角度平视（最明显）**：墙脚与地面之间露出整条天空，肉眼直接可辨。
- **斜视 / 俯视（有欺骗性）**：相机在上方，2.9 m 高的墙体投影后看起来仍像围合房间，容易误判为「正常」——这也解释了为什么最初只从斜视看时容易归因到 Z-fighting。
- D-A 则在**任何视角**都表现为「标签与几何对不上」，且与视角无关。

### 4.3 复式各层

`buildOtherLevels()` 只画「非当前层」，所以：

- 当前层 = 0（一层）时：画的是**二层**墙（y=2.9→5.7），一层地面/墙体全缺；
- 当前层 = 1（二层）时：画的是**一层**墙（y=0→2.8），二层地面/墙体全缺。

两种情况都会「悬空」，只是悬空高度不同。

---

## 5. 对 captain 初始定位的纠正

| captain 的初步定位 | 实测结论 |
| --- | --- |
| 普通房间用 `ShapeGeometry`（零厚度平面，y=0） | ✅ 属实（`architecture.ts` L291-303） |
| `wallBox()` 从 `y=0` 起建 | ✅ 属实（L144：`wallBox(ctx, w, 0, ...)`） |
| 两者在 y=0 共面 → Z-fighting | ❌ **不成立**：重叠面积 0.0000 m²（P_2B）/ 0.1559 m²（P_3B，局部）；静止 4 帧逐字节相同；地面与场景底板相差 15 mm |
| 视觉表现为墙脚交界闪烁 | ❌ **未观测到**：静止帧 md5 完全一致，无条纹 |
| 缺陷只在特定操作序列暴露 | ✅ 属实，但序列的作用是**触发 D-A**（不重建），而不是「制造 Z-fighting」 |
| 「不要改地面厚度或加 polygonOffset，那是治错病」 | ✅ **同意**。D-B 的正解是让引擎读当前层结构；D-A 的正解是恢复 `force` 语义 |

**新增（captain 未提及）**：`structure: plan.plan` 应改为当前层结构（`levelData`）。这是「墙地分离」的**直接**原因，优先级高于 D-A。

---

## 6. 复现脚本清单（均在 `.tools/`，已被 gitignore）

| 脚本 | 作用 |
| --- | --- |
| `.tools/final-isolated.cjs` | 隔离 context 的三视角实拍 + 切换序列 + Z-fighting 判据 |
| `.tools/isolate-defects.cjs` | 把 D-A / D-B 分离（P1/P2/P3 三条路径） |
| `.tools/audit-engine-input.mts` | 用引擎真实入参跑 `buildArchitecture()`，量地面/墙包围盒 |
| `.tools/geom-audit.cjs.mts` | 全户型地面/墙体包围盒 + 边贴合检查 |
| `.tools/overlap-audit.mts` | 地面多边形 × 墙体矩形重叠面积（排除 Z-fighting） |
| `.tools/edge-audit.mts` | 地面边 vs 墙/窗/门/过梁 覆盖检查（排除真实间隙） |
| `.tools/measure-float4.py` | 像素级「结构→天空→地面」三段式检测（量化悬空） |
| `.tools/repro-wall-floor-cause.cjs` | 因果验证（改 `cut` 强制重建） |

运行方式：

```powershell
# 浏览器侧
node .tools\final-isolated.cjs
node .tools\isolate-defects.cjs

# Node 侧（几何审计，需 vite-node）
node "node_modules\.pnpm\vite-node@3.2.4_@types+node@22.20.5\node_modules\vite-node\vite-node.mjs" .tools\audit-engine-input.mts
node "node_modules\.pnpm\vite-node@3.2.4_@types+node@22.20.5\node_modules\vite-node\vite-node.mjs" .tools\overlap-audit.mts
node "node_modules\.pnpm\vite-node@3.2.4_@types+node@22.20.5\node_modules\vite-node\vite-node.mjs" .tools\edge-audit.mts

# 像素测量
& "C:\Users\Admin\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe" .tools\measure-float4.py ".tools\.tmp-iso-C2-LOFT-eye2-canvas.png"
```

---

## 7. 修复方向（供后续任务参考，本次**未**改 `src/**`）

1. **D-B（优先）**：`engine.ts` 的 `buildArchitectureNow()` 把 `structure: plan.plan` 换成**当前层结构**。
   `EngineDeps.readPlan()` 目前只暴露 `plan: Plan`；需要在 `Scene3D.vue` 的 `readPlan` 里补上 `levelData`（或等价字段），并让 `PlanSlice` 带上它。
   `buildOtherLevels()` 依赖 `levels` + `level`，这部分语义可保持不变。
2. **D-A**：恢复基线的 `force` 语义，二选一或都做：
   - `sync()` 在 `!isActive() && !force` 分支里**先 return，再更新签名**（与 `.bak` L2368 对齐）；或
   - `enter()` 调 `syncStaged(true)`，首次进入强制重建（与 `.bak` L2442 的 `sync(true)` 对齐）。
3. **不要**给地面加厚度、**不要**加 `polygonOffset` —— 证据见 §3.2。

**验收建议**：切换序列（P2/P3）下，每次进 3D 都应重建；复式低角度平视图的 `floating_columns` 应为 **0/181**（当前 37/181）。

---

## 8. 未验证 / 限制

- 只在 **headless Chrome + SwiftShader**（软件渲染）下验证；真机 GPU 的深度精度更高，Z-fighting 判据（静止帧一致）结论不受影响，但未在真机复测。
- 只测了 `day` 主题；`night` / `contrast` 主题未逐项实拍（不影响病因判定，D-A/D-B 与主题无关）。
- 复式**二层**（`level=1`）的实拍未单独取证，仅通过 `audit-engine-input.mts` 的几何数据确认（`levels[1]` 口径下 8 块地面、墙体 minY 含 0）。
- 漫游模式（`walk`）未复测。
- 未修改 `src/**`：`git status --porcelain -- src` 输出为空（见 §9）。

---

## 9. 未修改 `src/**` 的证明

```powershell
cd F:\LearnSpace\L1yuu_Space\decoration-studio
git status --porcelain -- src
git diff --stat
```

真实输出：

```
--- diff stat vs HEAD ---
--- src changes (should be empty) ---
(end)
```

（两条命令均无输出，即工作区与 HEAD 一致，`src/**` 未被改动。）
