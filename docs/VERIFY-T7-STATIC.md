# t7 独立验证报告（静态部分）— verifier

> **本文件由 verifier 新增，不是 t9 的交付文档**，仅为 t7 的验证证据留存。
> 快照时间：2026-10-20 16:00–16:11（Asia/Shanghai）。此时 t4/t5/t6 仍在运行，`src/**` 是**移动目标**
> （本次核对期间 `features/**` 至少新增/重写了 `scene3d/scene.ts`、`scene3d/materials.ts`、
> `scene3d/primitives.ts`、`scene3d/furniture/*`、`extras/lib/*`、`utils/measure.ts`、`data/presets/*`）。
> 因此本报告只对**t3 交付文件**下结论；涉及 t4/t5/t6 文件的条目已明确标注归属。

---

## 0. 进程通道亲测（不引用他人结论）

```
$ pwsh -Command: echo "probe-ok"; $LASTEXITCODE; [Environment]::OSVersion.VersionString
(no output)
[exit code: 3221225794]
```

结论：**原样复现** `STATUS_DLL_INIT_FAILED`（3221225794 = 0xC0000142），连 `echo` 都没有回显 →
失败发生在 pwsh 进程初始化阶段，任何"进程内跑命令"的路径（含 DSH runtime 绝对路径 `node.exe`）都不可达。
本轮所有结论均为 **DSH 内置 read/glob/grep 工具**得出的静态结论，无任何命令被执行。

补充证据（`glob`，证明 install 从未发生）：

```
pattern: decoration-studio/{pnpm-lock.yaml,package-lock.json,yarn.lock,node_modules/**,dist/**}
→ No files found
```

---

## A. 已验证（静态阅读 + 静态扫描，均可复现）

### A1. 契约一致性（SPEC §D / §F 冻结项 ⇄ `src/types/**`、`src/stores/**`）

**块级逐条对照结论**（字段名 / 联合成员 / 初值 / action 签名）：

| SPEC 块 | 结果 | 说明 |
| --- | --- | --- |
| §D.2 `types/plan.ts` | ✅ 逐字一致 | Wall/Win/Door/Slide/Room/DimChain/Lintel/Stair/VoidShape/PlanStructure/PlanLevel/Plan 全部同名同型 |
| §D.3 家具与材料 | ✅ 逐字一致 | `FurnitureType` 实际 **45** 个成员（人工计数）；LibItem 只读元组、Material/MaterialTex/MaterialKey 一致 |
| §D.4 `types/state.ts` | ✅ 逐字一致 | 含 `EditState.savedGridLayer`、`View3dOptions` 全部 6 字段 |
| §D.5 plan store | ✅ 签名一致 | 5 个常量 + 5 state + 16 getter + 14 action 全部在位；**未发现任何改名** |
| §D.6 layout store | ✅ 签名一致 | UNDO_LIMIT=150、4 组 state + 6 栈、9 getter + 25 action 全部在位 |
| §D.7 ui/theme/toast store | ⛔ 见 C-1 | 初值逐字一致（见 A2），但 `MIN_SCALE/MAX_SCALE/PX_MM` **未定义** |
| §D.8 持久化键 | ⚠️ 见 C-4 | 7 个键字面值全对；但 `huxing-lang`/`huxing-panes` 无读写方 |
| §F.3 三签名 | ⚠️ 见 C-5 | `SceneSignatures`/`signature` 语义一致；入参切片**类型名不同**（`PlanSlice` vs `PlanStoreSlice`） |
| §F.4 `Scene3DApi` | ✅ 逐字一致 | 9 个方法（enter/exit/shot/groundAt/flyToRoom/iso/top/walking/relabel）同名同签名 |

**定义位置偏移（不是改名，但会影响下游 import 路径）**：`stateKey/stateKeyOf`（SPEC 写在 `stores/layout.ts`）
实际定义在 `src/utils/persistence.ts:28-35`，由 `stores/layout.ts:33` 转出；`MIN_SCALE/MAX_SCALE/PX_MM/TAP_PX`
（SPEC 写在 `stores/ui.ts`）实际定义在 `src/composables/usePointerKind.ts`（仅 TAP_PX/COARSE）。
`LEGACY_STORE_KEY`/`THEME_STORE_KEY` 由 `STORAGE_KEYS` 取值 → **字面值相等**，仅定义点不同。

### A2. 冻结值闸门自检（`src/stores/contracts.spec.ts` 静态阅读）

**该文件从未被执行**（无 node_modules / 无进程）；以下是对"断言文本 ⇄ SPEC"的静态比对：

| 断言 | SPEC 依据 | 结论 |
| --- | --- | --- |
| `STORAGE_KEYS` 全对象 + `LEGACY_STORE_KEY`/`PLAN_STORE_KEY`/`THEME_STORE_KEY` + `stateKey('h3b')` + `stateKeyOf('hloft',1,true)` + `stateKeyOf('h3b',0,false)` | §D.8 第 595-601 行 | ✅ 覆盖 7 个键（`statePrefix` 一项覆盖单层/复层两键），字面值全对 |
| `PRESET_ORDER` / `UNDO_STRUCT_LIMIT=80` / `PLAN_FMT` / `PLAN_SET_FMT` / `currentId='h3b'` / `level=0` / `structHistory=[]` / `isMulti=false` | §D.5 | ✅ 全对 |
| `UNDO_LIMIT=150` + 4 个 PlanState 字段 + undo/redo 栈 + canUndo/canRedo + `defaultState()` | §D.6 | ✅ 全对 |
| `ui.view{x0:0,y0:0,s:0.06}` / `viewMode='2d'` / `panes` / `view3d{6 字段}` / `edit{15 字段}` / `flags` / `layers` | §D.7 第 519-534 行 | ✅ **逐字段相等**（含 `savedGridLayer:null`、`hour:10`、`cut:2.8`） |
| `MIN_SCALE=0.012` / `MAX_SCALE=2` / `PX_MM≈25.4/96` | §D.7 第 520-521 行 | ✅ 断言值与 SPEC 相符；⚠️ 但常量本身不存在（C-1） |
| theme store 默认 `day` + `resolve('accent')===tokens.accent` + `setPreset('night')` | §D.7 第 581-588 行 | ✅ 断言与实现相符 |

**覆盖缺口（低）**：未断言 `TAP_PX`（§D.7 冻结常量）；`huxing-lang`/`huxing-panes` 只校验字面值，
不校验"确实被读写"。

### A3. 颜色白名单全仓扫描（`grep -n '#[0-9a-fA-F]{3,8}\b'`，按目录分组复现）

| 文件 | hex 命中 | 白名单判定 |
| --- | --- | --- |
| `src/theme/tokens.ts` | ~141（47×3） | ✅ SPEC §C.2 B3 |
| `src/theme/material-palette.ts` | ~57 | ✅ SPEC §E.8 T1 / G.3#12 |
| `src/data/materials.ts`（已由下游创建） | 16 | ✅ SPEC §C.2 B4 / G.3#12 |
| `src/data/furniture-lib.ts`（已由下游创建） | ~110（LIB 色 + `ST` 图例色板 L121-172） | ⚠️ 见 C-6（B4 允许，G.3#12 未列） |
| `src/theme/applyTheme.ts:54`、`src/theme/contrast.ts:69` | 各 1 处，**注释引用** | ✅ 路径在 `src/theme/**` 白名单内 |
| `src/features/plan2d/patterns.ts` | **0**（`buildDefs()` 仍是 `return ''` 占位，归 t4） | ✅ 文件存在；尚未产生内容色 |
| `src/stores/**`、`src/types/**`、`src/utils/**`、`src/composables/**`、`src/components/**`、`*.vue`、`*.css`、`index.html`、`scripts/**` | **0** | ✅ 无越界 |
| `src/features/scene3d/furniture/content-colors.ts:21,26` | 2 处，**注释引用**（`'#2a2724'`/`'#3c3a37'`） | ⛔ 见 C-7（非白名单路径，`verify.mjs` 会判违规；归 t5） |

### A4. 依赖合规

- `grep` §H.4 全清单（element-plus / naive-ui / konva / interactjs / moveable / martinez-polygon-clipping /
  rbush / file-saver / html-to-image / modern-screenshot / xlsx / postprocessing / three-bvh-csg /
  three-mesh-bvh / three-gpu-pathtracer / three-pathfinding / js-angusj-clipper / dexie / idb-keyval / zod /
  `@turf/*` / `@tarikjabiri/dxf` / write-excel-file / xlsx-js-style / `@cantoo/pdf-lib` / pdf-lib /
  `@pdf-lib/fontkit`）对 `package.json` 扫描 → **No matches found** ✅
- §H.1 运行时收敛集 13 项全部在 `dependencies`（`package.json:25-38`）✅；`pdf-lib`+`@pdf-lib/fontkit` 缺席，
  与 SPEC「P1-1 未实现则整体不安装」一致（`README.md:173` 亦如此声明）⚠️ 需 t6 交付时确认 PDF 确实未实现。
- 冻结版本：`three: "0.160.1"` ✅（ADR-01）、`polygon-clipping: "0.15.7"` ✅（禁 `^`，ADR-15）。
- 超范围 devDependencies（§H.3 未逐一列出）：`@types/node`、`@types/papaparse`、`eslint-config-prettier`、
  `jsdom`、`typescript-eslint` —— 均非 §H.4 禁列包，`README.md:176-177` 对 `jsdom` 有说明。**低**，建议 spec-lead 备案。
- `LICENSE` = MIT 全文 ✅（`LICENSE:1-21`，版权行 `Copyright (c) 2026 decoration-studio contributors`）。
- `.gitignore` 覆盖 `node_modules/`(1)、`dist/`(2)、`coverage/`(4)、`.env`/`.env.*`/`!.env.example`(28-30) ✅。
- **版本真实性未验证**：本机 `registry.npmjs.org` 被解析到非公网地址，`web_fetch` 返回
  `URL hostname "registry.npmjs.org" resolves to a non-public IP address` → C1/C2/C10 无法复核（见 B）。

### A5. `@/…` 别名可达性

`grep "from '@/"` 得到 30+ 个不同 specifier（覆盖 stores / theme / types / utils / composables / data / features），
逐条 `glob` 核对目标文件**全部存在**。唯一"文件存在但成员不存在"的是 C-1。

---

## B. 未验证（应执行命令原文 + 未执行原因）

原因统一为：**pwsh 进程通道 exit 3221225794（见 §0）+ 无 `node_modules` / 无 `pnpm-lock.yaml`（见 §0 glob）**。
⛔ 以下命令**一条都没有执行**，本报告不含任何伪造输出。

| # | 应执行命令原文 | 状态 |
| --- | --- | --- |
| B1 | `pnpm install`（替代：`C:\Users\Admin\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe C:\Users\Admin\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs install`） | 未验证 |
| B2 | `pnpm typecheck`（= `vue-tsc --noEmit -p tsconfig.json`） | 未验证（静态预判会因 C-1 失败） |
| B3 | `pnpm build`（= `vue-tsc --noEmit -p tsconfig.json && vite build`） | 未验证（同上） |
| B4 | `pnpm test`（= `vitest run`，含 `theme/contrast.spec.ts`、`tokens.spec.ts`、`stores/contracts.spec.ts`） | 未验证（预判至少因 C-1、C-2 失败） |
| B5 | `node scripts/verify.mjs`（`pnpm verify`，含 `--json`） | 未验证（静态推演：hex 扫描会因 C-7 报失败） |
| B6 | `pnpm lint`（`eslint .`） | 未验证（ESLint 9 扁平配置 + plugin API 的加载兼容性无法离线确认） |
| B7 | `pnpm dev` + Playwright 截图（`npx playwright test`）与"渲染后 CSS 变量取色 + `colorjs.io` 实跑对比度" | 未验证（无 Playwright 配置/用例文件，且无法起服务） |
| B8 | `pnpm licenses list` / `npx license-checker` | 未验证（无 node_modules） |
| B9 | `git init -b main` / `git add -A` / `git commit` / `git push -u origin main`（t10） | 未验证（已被 t10 判 failed） |
| B10 | `pnpm view @vueuse/core version license` / `pnpm view @types/three version`（SPEC 待确认 C1/C2） | 未验证；外网替代路径也被阻断（见 A4 末条） |

---

## C. 与 SPEC 不符 / 缺陷（带 `文件:行号`）

### C-1【blocker】`stores/ui.ts` 引入三个根本不存在的导出
- `src/stores/ui.ts:9` → `import { MIN_SCALE, MAX_SCALE, PX_MM, TAP_PX } from '@/composables/usePointerKind';`
- 但 `src/composables/usePointerKind.ts` 全文 37 行只导出 `COARSE`(8)、`TAP_PX`(14)、`PointerKind`(16)、`usePointerKind`(27)。
- 全仓复查：`grep "export (const|function|let) (MIN_SCALE|MAX_SCALE|PX_MM)\b"` → **No matches found**
  （即这三个常量在**任何**文件里都没有定义）。
- 爆炸半径：`src/stores/ui.ts:27` 的再导出、`src/stores/index.ts:10-12`、`src/stores/contracts.spec.ts:12`
  全部级联失败 → `pnpm typecheck` / `pnpm build` / `pnpm test` / `pnpm dev` 均无法通过。
- 修复：在 `usePointerKind.ts` 或 `stores/ui.ts` 内按 SPEC §D.7 定义
  `MIN_SCALE = 0.012`、`MAX_SCALE = 2`、`PX_MM = 25.4 / 96`（值本身 SPEC 已冻结）。

### C-2【high】对比度断言表与 SPEC §E.3 的"矮墙填充为装饰"豁免冲突 → 闸门必红
- `src/theme/contrast.ts:78-84` 由 `PLAN_TOKEN_NAMES` 生成"每个 2D 令牌 on `canvas` ≥ 3"，
  过滤条件只排除 `DECORATIVE_TOKEN_NAMES`（`tokens.ts:124` = `border`/`plan-grid-minor`/`plan-grid-major`）
  与三枚 room-label 令牌，**没有排除 `wall-low` 填充**。
- 于是生成断言 `plan:wall-low on canvas ≥ 3`，而：
  - 日间 `wall-low = #e9e3d8`（`tokens.ts:164`）on `canvas = #f7f4ee`（`:136`）→ 手工 WCAG 2.1 计算 ≈ **1.16:1**
  - 夜间 `#2b313a`(`:217`) on `#1b1f27`(`:189`) ≈ **1.26:1**
  - 高对比 `#f2f2f2`(`:268`) on `#ffffff`(`:240`) ≈ **1.09:1**
- 但 SPEC §E.3 第 658 行明确：`--ds-wall-low | #e9e3d8 + 描边 #8f897d | 矮墙（**填充为装饰**，描边承载信息）| 描边 3.17:1`。
  即 SPEC 只要求描边达标，而 `wall-low-stroke`（`tokens.ts:165` / `:218` / `:269`）已在断言集里且达标。
- 后果：`src/theme/contrast.spec.ts:43-53`（"无失败项"+ 逐条 `it`）三套预设都会红；
  SPEC G.3 验收第 14 条（P0-1）不成立。
- 附：手工复核方法可信度自证——用同一套手算得到的
  `night/border-strong on surface = 3.422`（SPEC 写 3.42）、`night/border-strong on bg = 3.781`（SPEC 写 3.78），
  与 SPEC 手算值吻合到 0.01，故 `wall-low ≈1.1–1.3` 距离阈值 3 有 2 倍以上余量，**不是算错**。
  （裁决者仍是 `colorjs.io`；本条为**手工近似**，未实跑。）
- 修复：把 `wall-low` 加入装饰豁免（或加进 `contrast.ts:78-84` 的排除名单），保留 `wall-low-stroke` 的 ≥3 断言；
  若 spec-lead 认为填充也必须达标，则 SPEC §E.3 的 `wall-low` hex 必须换深 —— 二选一需裁决。

### C-3【medium】SPEC §D.1 冻结的两个转换函数不在 `types/geometry.ts`
- SPEC §D.1（第 296-297 行）把 `pt2vec` / `vec2pt` 写在 `types/geometry.ts` 的冻结块里；
  实际 `src/types/geometry.ts` 只有类型（27 行，无这两个导出），实现放在 `src/utils/geometry.ts:12-19`。
- 但 SPEC §C.1 第 202 行又规定 `types/` "**只放类型，零运行时代码**" —— SPEC 内部自相矛盾；
  t3 选了 §C.1 并在 `types/geometry.ts:4-7` 注释说明。
- 风险：下游若照 §D.1 写 `import { pt2vec } from '@/types/geometry'` 会直接编译失败。
- 需 spec-lead 裁决并改一处 SPEC（或在 `types/geometry.ts` 加 re-export）。

### C-4【medium】§D.8 的两个键目前是"死键"（无任何读写方）
- `huxing-lang`（`src/utils/persistence.ts:14`）、`huxing-panes`（`:16`）除定义与断言外，
  全仓 `grep "STORAGE_KEYS\.(panes|lang)|huxing-lang|huxing-panes|useStorage"` 只命中
  `persistence.ts` 与 `contracts.spec.ts` —— `stores/ui.ts` 的 `panes` 从不落盘，全仓无 `vue-i18n` 初始化。
- SPEC §D.8 表格（第 596-597 行）把二者分别归属 `vue-i18n 初始化` 与 `ui.panes`；
  SPEC A25 / G.3 第 4 条要求"5 个键在内存中实际出现"。当前实际只有 3/5（plans / state-v2 / legacy）。
- 修复：t3 侧把 `ui.panes` 接持久化（或在代码里写明归属 t4/t6 的 TODO）；`huxing-lang` 的归属需显式指定。

### C-5【low-medium】§F.3 的切片类型名不同
- SPEC §F.3 第 805 行：`computeSignatures(plan: PlanStoreSlice, layout: LayoutStoreSlice, ui: UiStoreSlice)`；
  实际 `src/types/scene3d.ts:16/22/28` 定义的是 `PlanSlice` / `LayoutSlice` / `UiSlice`。
- `SceneSignatures`、三签名内容（`features/scene3d/index.ts:15-19`）与 SPEC 逐字一致，
  仅类型名与冻结文本不符；下游若按 SPEC 名 import 会失败。`computeSignatures` 本体仍未实现（属 t5）。

### C-6【low】hex 白名单在 SPEC 内部与工具间三处口径不一致
- SPEC §C.2 B4（第 275 行）允许 `data/furniture-lib.ts`；SPEC G.3 第 12 条（第 945 行）的白名单只有
  `tokens.ts + material-palette.ts + patterns.ts + materials.ts`（漏了 furniture-lib）。
- 工具侧：`scripts/verify.mjs:132-137` 与 `eslint.config.js:20-25` **都包含** `src/data/furniture-lib.ts`，
  但 `verify.mjs:433` 的检查名与 `README.md:95` 的表格沿用"不含 furniture-lib"的旧口径 → 名义↔行为不一致。
- 需 spec-lead 统一（建议以 B4 为准并把 G.3#12/README 补上）。

### C-7【low，归 t5】注释里的 hex 会被 `verify.mjs` 判违规
- `src/features/scene3d/furniture/content-colors.ts:21,26` 在**注释**里写了 `'#2a2724'` / `'#3c3a37'`。
- `verify.mjs:139` 的正则 `/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/` 按**整行原文**匹配
  （不做 AST 过滤），`:43-44` 只按路径白名单放行 → 该文件不在白名单 → **`node scripts/verify.mjs` 会报违规并 exit 1**。
  （同一现象在核对期间也出现过：`scene3d/primitives.ts:340`，随后被 t5 改写；说明这是滚动出现的。）
- ESLint 侧的 `no-restricted-syntax` 用的是 `Literal[value=/^#…$/]`（`eslint.config.js:27`），**注释不会命中** ——
  两道闸门口径不一致。修复：t5 去掉注释里的裸 hex（或 verify.mjs 改为剥离注释后再匹配）。

### C-8【低】新增（非改名）项，需要 spec-lead 追认并回写 SPEC
`types/theme.ts` 多出 3 枚令牌 `color-scheme` / `wall-low-stroke` / `room-label-halo`（`tokens.ts:28-78` 共 47 项，
SPEC §E 显式给出 hex 的条目数是 24/17/15）；`stores/plan.ts:275` 多出 `readState()`；
`stores/layout.ts:35` 多出 `RoomRow`、`:54-56` 多出 `currentPlanId/currentLevel/currentMulti`（且都出现在 return 里，
即公开 API）；`stores/ui.ts:40` 多出 `SCALE_BAR_STEPS`；`types/persistence.ts:47` 多出 `SaveStatus`。
这些**不影响**已冻结项，属契约扩张。

---

## D. 一句话结论

- **对 t3**：冻结字段名/签名层面 scaffold-dev 的"逐字一致"基本成立（未发现任何改名）；
  但"**工程可构建**"层面的自述**不成立** —— C-1 一个真实存在的导入错误就足以让
  `typecheck/build/test` 全部无法通过，且 `verify.mjs` 的"冻结标识存在性"检查（`verify.mjs:206-243`）
  是**子串匹配**，`MIN_SCALE` 恰好以子串形式出现在 `ui.ts` 里，**抓不到**这个问题。
- **对我方**：C-2（对比度闸门必红）与 C-1 都不是"看起来像问题"，而是可以静态证明的失败；
  建议在 shell 恢复后**第一轮**就跑 `pnpm install && pnpm typecheck && pnpm test && node scripts/verify.mjs`，
  预期会依次暴露 C-1、C-2、C-7。
- **未验证清单**见 §B，一条都没有被"假装通过"。