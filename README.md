# decoration-studio（装修设计工作台）

把单文件版 [`装修设计.html`](../装修设计.html)（3895 行）迁移为 **Vue 3 + Vite + TypeScript** 工程：
2D 平面编辑 / 3D 场景 / 多方案管理 / 算量与导出。规格与契约见 [`docs/SPEC.md`](docs/SPEC.md)，
原功能逐项盘点见 [`docs/ORIGINAL-FEATURES.md`](docs/ORIGINAL-FEATURES.md)。

> 本 README 的命令段落由 **t3（工程骨架）** 维护；`docs/MIGRATION.md` / `docs/ROADMAP.md` 由 t9 补齐。

---

## 1. 快速开始（命令)

在**工程根目录**（含 `package.json` 的那一层）执行：

```bash
pnpm install          # 安装依赖（按 SPEC §H.1 收敛集，单一安装轮次）
pnpm dev              # 开发服务器：http://localhost:5173
pnpm build            # 类型检查（vue-tsc）+ 生产构建，产物在 dist/
pnpm preview          # 预览生产构建：http://localhost:4173
pnpm test             # 单元测试（含主题对比度断言，colorjs.io 裁决）
pnpm typecheck        # 只做类型检查（src）
pnpm typecheck:node   # 只做类型检查（vite.config.ts / scripts）
pnpm lint             # ESLint（含 SPEC §C.2 的模块边界规则 B1–B9）
pnpm format           # Prettier 格式化
pnpm verify           # 工程自检（零依赖、与 CWD 无关；见 §4）
```

首次安装后可先跑 `pnpm verify`：它不依赖 `node_modules`，能在装依赖之前就发现目录/契约/白名单问题。

### 1.1 本机 `pwsh` 不可用时的替代方式（**必读**）

本会话（Windows）`pwsh` 工具**完全不可用**：任何命令都返回 `exit code 3221225794`
（`STATUS_DLL_INIT_FAILED`，DLL 初始化失败）。因此本项目**不假设**命令一定能跑通，规则如下
（SPEC §G.1.1）：

1. **替代路径**：改用 DSH 自带 runtime 的**绝对路径**调用 node/pnpm（不依赖 `PATH`）：

   ```text
   node:  C:\Users\Admin\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe
   pnpm:  C:\Users\Admin\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs
   ```

   例（先 `cd` 到工程根目录，再执行）：

   ```text
   C:\Users\Admin\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe ^
     C:\Users\Admin\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs install
   ```

   若连 `node.exe` 也无法启动（本会话即如此：`pwsh` 连进程都起不来），见下一条。

2. **标注「未验证」**：在报告/交付说明中明确写「**未验证**：`pwsh` 不可用（`STATUS_DLL_INIT_FAILED`），
   命令未能执行」，并附上**应执行的命令原文**。⛔ **不得伪造输出**，也不得以「看起来通过」代替证据。
   受影响的条目：`pnpm install / dev / build / test`、`pnpm-lock.yaml` 的实际版本、
   `pnpm licenses list` 的实机结果（SPEC 待确认项 C10 / C11）。

3. 全部脚本都**与 CWD 无关**：`package.json` 里没有任何 `cd`、也没有写死盘符；
   `scripts/verify.mjs` 用 `import.meta.url` 推导工程根目录，在任何目录下执行都指向本工程。

### 1.2 环境要求

- Node `^20.19.0 || >=22.12.0`（Vite 7 的要求，见 `package.json` 的 `engines`）
- pnpm（本仓库不提交 lockfile 之外的包管理器残留）

---

## 2. 目录结构（冻结，SPEC §C.1）

```text
decoration-studio/
├─ index.html            vite.config.ts        tsconfig.json / tsconfig.node.json
├─ eslint.config.js      .prettierrc.json      .gitignore        LICENSE (MIT)
├─ scripts/verify.mjs    与 CWD 无关的工程自检入口
├─ docs/                 SPEC.md / ORIGINAL-FEATURES.md / OSS-RESEARCH.md / THIRD-PARTY.md
└─ src/
   ├─ main.ts  App.vue   入口与应用外壳（**骨架**，不是业务视图）
   ├─ types/            纯类型：geometry / plan / furniture / material / state / persistence /
   │                    theme / scene3d / plan2d / extras（零运行时代码）
   ├─ theme/             tokens.ts（**唯一色值来源**）/ material-palette.ts（**3D 取色唯一来源**）/
   │                    contrast.ts（colorjs.io 断言）/ applyTheme.ts / useTheme.ts / base.css
   ├─ stores/           plan / layout / ui / theme / toast（SPEC §D 🔒 冻结签名）
   ├─ utils/            persistence.ts（**唯一存储出口**）/ normalize.ts / geometry.ts / id.ts /
   │                    scenePort.ts（3D 端口，依赖倒置）
   ├─ composables/      usePointerKind.ts（COARSE / TAP_PX 单点定义）/ useResizeFit.ts
   ├─ data/presets/     内置户型（**占位**，t4 实现 7 个内置户型）
   └─ features/         plan2d/（t4）· scene3d/（t5）· extras/（t6）——本轮只放契约占位
```

**模块边界由 ESLint 强制**（`eslint.config.js` ↔ SPEC §C.2 B1–B9）：

| 规则 | 内容 |
| --- | --- |
| B1 | `features/plan2d` 与 `features/scene3d` **互不 import**（两条并行线解耦） |
| B2 | `features/**` 之间不得互相 import；跨特性只能经 `stores/**` / `types/**` / `utils/**` / `theme/**` |
| B3/B4 | hex 色值只允许出现在 `theme/**`、`features/plan2d/patterns.ts`、`data/materials.ts`、`data/furniture-lib.ts` |
| B5 | `stores/**` 不得 import `features/**` 与 `.vue`（store 必须能在 Node 下单测） |
| B6 | 组件不得直接读写 `localStorage`（只能经 `utils/persistence.ts`） |
| B7 | 组件不得直接 `addEventListener`（用 `@vueuse/core`） |
| B9 | SVG **呈现属性**不得写 `var(--ds-*)`，必须用 `theme.resolve()` 的字面值 |

---

## 3. 主题体系（t3 交付的核心）

- **唯一色值来源**：`src/theme/tokens.ts`。三套预设 `day / night / contrast`，令牌键集合完全一致
  （`src/theme/tokens.spec.ts` 会断言），每套 **47 项**（`color-scheme` + 26 项 UI 语义 + 21 项 2D 图纸）。
- **CSS 变量**：`--ds-` + 令牌名（如 `--ds-text-muted`）；切换主题时由
  `theme/applyTheme.ts` 一次性写入 `:root`，并同步 `<meta name="theme-color">` 与 `color-scheme`。
- **取色两种姿势**：
  - 样式里用变量：`color: var(--ds-text-muted)`；
  - 需要**字面值**（SVG 呈现属性 / canvas / 3D / 导出）用 `theme.resolve('accent')` → `'#9c4f28'`
    （⛔ 绝不能写 `fill="var(--ds-accent)"`：SVG 属性不支持 `var()`，导出会丢色，RISK-06）。
- **对比度守门**：`src/theme/contrast.ts` 用 `colorjs.io` 计算 WCAG 2.1 比值，
  `src/theme/contrast.spec.ts` 对三套预设 × 每组组合逐条断言（正文 ≥4.5:1、图形/边界 ≥3:1），
  装饰性令牌（`border`、网格细/主线、`wall-low` 矮墙**填充**）按 SPEC §E.2/§E.3/ADR-17 明确豁免
  并在代码里标注；豁免清单是**封闭 4 项**（`src/theme/tokens.ts` 的 `DECORATIVE_TOKEN_NAMES`），
  矮墙承载语义的是描边 `wall-low-stroke`，它照常断言 ≥3:1。
  相对原实现修复的两处不达标：`--muted` 3.78:1 → `text-muted` 5.71:1；白字压 `--accent` 4.30:1 → 5.89:1。
- **3D 与主题联动**（SPEC §E.8 强制）：`src/theme/material-palette.ts` 是 3D 中性材质基色**唯一来源**
  （`wood/metal/surface/light/fabric` 五组）+ 场景级参数（背景/地面/曝光/半球光/太阳/envK）。
  `resolveSceneTheme(presetId, night)` 按 ADR-08 组合「主题」与「3D 夜景开关」：
  **夜景只覆盖光照/曝光/背景，不覆盖材质基色**。⛔ `features/scene3d/**` 里不得出现任何 hex。

用法示例：

```ts
import { useTheme } from '@/theme/useTheme';

const { presetId, tokens, setPreset, resolve, cssVar } = useTheme();
const wallStroke = resolve('wall-bearing');   // '#26241f'（SVG 呈现属性用字面值）
const panelBg = cssVar('surface');            // '--ds-surface'（样式里用变量）
```

---

## 4. 工程自检 `pnpm verify`

`node scripts/verify.mjs`（等价于 `pnpm verify`；`--json` 输出机器可读结果）检查：

1. 必需文件/目录齐全（配置、入口、`types/`、`stores/`、`theme/`、三路 `features/`）；
2. `package.json` 依赖 = SPEC §H 收敛集，且**没有** §H.4 明确不引入的包（element-plus / konva /
   interactjs / martinez-polygon-clipping / xlsx / @turf 全家桶 等一律不得出现）；
   `three` 必须精确锁 `0.160.1`、`polygon-clipping` 必须精确锁 `0.15.7`（ADR-01 / ADR-15）；
3. 脚本齐全且**与 CWD 无关**（无 `cd`、无写死盘符）；
4. `@` 别名在 `vite.config.ts` 与 `tsconfig.json` 中指向一致；
5. 主题令牌：三套预设键集合一致、全部是合法 hex、运行时清单与类型联合**双向一致**；
6. 3D 材质基色表存在且被 `features/scene3d` 引用，场景联动字段齐全；
7. **hex 白名单**扫描（越界即失败）与 **SVG 呈现属性不得写 CSS 变量**扫描；
8. SPEC §D 的**冻结标识**是否仍在（改名即失败 → RISK-01 的机器闸门）；
9. 对比度断言表是否覆盖 §E.7 的必测组合，且确实用 `colorjs.io`（红线 5）；
10. 持久化键逐字冻结（`huxing-lang` / `huxing-panes` / `huxing-plans-v1` / `huxing-state-v2-<id>[-l<lv>]` /
    `huxing-design-v1` / `huxing-theme-v1`）。

> 读写接线现状（SPEC §D.8 / C-4 裁定）：`huxing-panes` 已由 `stores/ui.ts` 全量接线
> （启动 `loadPanes()` 读、`openDrawer()` 写）；`huxing-lang` 读侧在 `features/extras/lib/i18n.ts`、
> 写侧仍归 t6。

> **数值对比度断言不在 `verify.mjs` 里**：那由 `pnpm test`（`colorjs.io`）裁决，避免出现两套色彩数学。

---

## 5. 依赖范围（SPEC §H.1 / ADR-14）

**单一安装轮次**：t3 一次装齐收敛集，下游不得自行安装备选包。

| 包 | 版本策略 | 用途 | 归属 |
| --- | --- | --- | --- |
| `vue` / `pinia` | `^3.5` / `^4.1.0` | 框架 / 状态（ADR-06：3 业务 + 2 横切 store） | t3 |
| `@vueuse/core` | `^15.0.0`（同仓库子包已核实 `【待确认】`，SPEC C1） | 事件/全屏/存储/快捷键（B7） | t3/t6 |
| `three` | **精确 `0.160.1`**（ADR-01，不随大流升级） | 3D 内核 | t5 |
| `colorjs.io` | `^0.7.1` | 对比度**裁决**（只用于断言，ADR-04） | t3 |
| `@material/material-color-utilities` | `^0.4.0`（Apache-2.0，保留 NOTICE） | 主题**派生**（tonal 色阶 / 一键换主题色） | t3 |
| `vue-i18n` | `^11.4.16` | 国际化（替换 `tr()` + `data-en`，X4） | t4/t6 |
| `papaparse` / `exceljs` | `^5.7.0` / `^4.4.0`（**动态 import**） | CSV / XLSX（P0-3） | t6 |
| `dxf-writer` | `^1.18.4` | DXF 导出（P0-7） | t6 |
| `polygon-clipping` | **精确 `0.15.7`**（禁 `^`） | 仅当真布尔必要时（P0-4/P2-5，ADR-15） | t6 |
| `earcut` | `^3.2.4` | 三角化（P2-5） | P2 |

- ⛔ **不装**：`pdf-lib`（P1-1 未实现则整体不安装）、`postprocessing`（与 three 0.160 peer 冲突）、
  `@turf/*` 全家桶、`rbush`、`file-saver`、`html-to-image`、UI 组件库、`xlsx`(SheetJS CE)。
- 依赖台账唯一权威：`docs/THIRD-PARTY.md`（t9 起由 spec-lead 接管，ADR-16）；lock 实际版本待安装后回填。
- `devDependencies` 中的 `jsdom` 由 SPEC §H.3 的 `@vue/test-utils` 推出（组件测试需要 DOM 环境）；
  若判定超范围可删除，`pnpm test` 仍可跑（现有用例都在 `node` 环境）。

---

## 6. 本轮的边界与下一步

| 阶段 | 任务 | 内容 | 状态 |
| --- | --- | --- | --- |
| t1 | spec-lead | `docs/ORIGINAL-FEATURES.md` / `docs/SPEC.md` | ✅ 已完成 |
| **t3** | **scaffold-dev** | **工程骨架 + `types/**` + `stores/**` 签名 + `theme/**`（令牌/派生/断言）+ 三路契约占位** | ✅ 本次交付 |
| t4 | plan2d-dev | `features/plan2d/**`（10 图层、编辑、测量、拆改、自动布置、导出 SVG）+ `components/FurnitureLibrary/PropertyPanel` | 待开工 |
| t5 | scene3d-dev | `features/scene3d/**`（程序化建筑/家具、剖切、漫游、日照、标签、三签名重建、主题联动） | 待开工 |
| t6 | features-dev | `features/extras/**`（P0-1…P0-9、P1-2/P1-3/P1-4；P1-1 PDF 视成本可选） | 待开工 |
| t7 / t8 | verifier / reviewer | 独立验证报告 / 分级问题清单 | 待开工 |
| t9 | spec-lead | `README`/`MIGRATION`/`ROADMAP` 收口 + lock 版本回填 | 待开工 |
| t10 | scaffold-dev | `git init -b main` + 首次**中文**提交 + 首次推送（先排查 `.gitconfig` 的 `insteadOf` 重写） | 待开工 |

### 6.1 本骨架**没有**实现的东西（避免误读）

- 没有任何业务视图：`App.vue` 只是外壳 + 主题令牌预览（用于人眼核对换肤与 `resolve()` 字面值）。
- `stores/**` 的动作**签名齐全但对业务语义留空**：涉及几何口径的 getter（面积/报价/拆除长度）、
  `autoFurnish`、`pushOut`、`migrateLegacy`、`planEdit` 的 bounds 重算、4 种导入形态等，
  都在代码里以 `TODO(t4)` 明确标注，当前不抛错、不破坏用户数据。
- `data/presets` 是空占位（`PRESETS = []`），`features/**` 只有契约常量与 3 个签名占位。
- 依赖安装与构建：**未验证**（见 §1.1；本会话 `pwsh` 与 `node.exe` 都无法启动）。

---

## 7. 许可证

本项目以 **MIT** 发布（见 `LICENSE`）。依赖许可证一律 MIT / ISC / Apache-2.0 / BSD / Zlib / CC0；
⛔ GPL / AGPL 与**无 license 字段**的仓库只读思路、零代码拷贝（SPEC §B.6 / ADR-12）。