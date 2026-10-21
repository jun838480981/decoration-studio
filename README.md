# decoration-studio（装修设计工作台）

把单文件版 [`装修设计.html`](../装修设计.html)（3895 行）迁移为 **Vue 3 + Vite + TypeScript** 工程：
2D 平面编辑 / 3D 场景 / 多方案管理 / 算量与导出。

## 文档导航

| 文档 | 内容 |
| --- | --- |
| [`docs/SPEC.md`](docs/SPEC.md) | **施工图**：类型/store 冻结契约、主题令牌表、2D↔3D 接口、依赖清单、裁决记录 |
| [`docs/ORIGINAL-FEATURES.md`](docs/ORIGINAL-FEATURES.md) | 原 `装修设计.html` 的逐项功能盘点（带行号证据，含与 `.bak` 的差异清单） |
| [`docs/MIGRATION.md`](docs/MIGRATION.md) | **原功能 → 新模块**的完整对照表，含已保留/已改进/已替换/未迁移及理由 |
| [`docs/OSS-RESEARCH.md`](docs/OSS-RESEARCH.md) | 开源同类项目与可复用库调研（含实时核实的版本/许可证/活跃度） |
| [`docs/THIRD-PARTY.md`](docs/THIRD-PARTY.md) | 第三方依赖登记（许可证、用途、是否可再分发） |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | 后续迭代路线图、技术债与「不做」清单 |
| [`docs/VERIFY-T7-STATIC.md`](docs/VERIFY-T7-STATIC.md) | 一次独立静态验证的完整记录（含发现的问题） |

---

## 1. 快速开始（命令）

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

**当前验证状态**（2026-10-21 实测，全部通过）：

| 检查 | 结果 |
| --- | --- |
| `npx vue-tsc --noEmit -p tsconfig.json` | 0 错误 |
| `npx vitest run` | 203/203 通过 |
| `pnpm build` | 成功（290KB + 600KB，3D 独立分包） |
| `node scripts/verify.mjs` | 全部通过（20 项） |
| `npx eslint .` | 0 问题 |
| 浏览器实渲染 | 8/8（见 §1.1） |

### 1.1 浏览器实渲染验证（可选，但强烈建议）

`pnpm build` 之后，可用本地脚本验证「页面真的能渲染」——这是**唯一能发现装配缺陷**的检查：

```bash
node .tools/render-check.cjs
```

它会用本机 Chrome（不下载 Playwright 浏览器）起静态服务并断言 8 项：首屏可达、无 JS 错误、
2D 图元数量、主题令牌注入、3D canvas 存在且非空白、亮点入口可见、中英切换生效。

> 为什么需要它：本工程曾出现「`typecheck` + 203 单测 + `lint` + `verify` 全绿，但 3D 视图打不开」
> 的缺陷（`registerViewMount` 从未被调用）。只有浏览器实渲染能发现（见 `docs/MIGRATION.md` §12）。
>
> `.tools/` 已被 `.gitignore` 忽略（本地验证脚本，不入库）。

### 1.2 如果命令跑不起来：`pwsh` / `node` 启动失败的排查

本项目开发过程中遇到过一种**环境级故障**，记录下来供排查参考：

**症状**：任何命令都返回 `exit code 3221225794`（`0xC0000142` = `STATUS_DLL_INIT_FAILED`），
连 `echo hi`、`node -v`、绝对路径 `node.exe` 都无输出。这不是命令写错，而是**进程创建失败**。

**排查顺序**：

1. 先试最简命令（`echo hi`）——若也失败，就是环境问题，不要再怀疑命令语法。
2. 若处于沙箱/受限模式下，确认文件系统策略是否允许执行（本工程开发时切到 `danger-full-access` 后恢复）。
3. 重启 DSH / 终端宿主进程。该故障是 OS 级的，与项目代码无关。

**故障期间的替代方式**（若再次遇到）：改用 DSH 自带 runtime 的**绝对路径**调用，不依赖 `PATH`：

```text
node:  C:\Users\Admin\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe
pnpm:  C:\Users\Admin\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs
```

**纪律**：若命令确实无法执行，在报告里明确写「**未验证**」并附应执行的命令原文，
⛔ **不得伪造输出**，也不得以「看起来通过」代替证据。

> 当前状态（2026-10-21）：环境已恢复，上表六项检查均已**实机执行通过**。

### 1.3 环境要求

- Node `^20.19.0 || >=22.12.0`（Vite 7 的要求，见 `package.json` 的 `engines`）
- pnpm（`corepack enable` 可启用）
- 浏览器实渲染验证需要本机 Chrome（`C:\Program Files\Google\Chrome\Application\chrome.exe`）

---

## 2. 目录结构（SPEC §C.1）

```text
decoration-studio/
├─ index.html            vite.config.ts        tsconfig.json / tsconfig.node.json
├─ eslint.config.js      .prettierrc.json      .gitignore        LICENSE (MIT)
├─ scripts/verify.mjs    与 CWD 无关的工程自检入口（20 项静态闸门）
├─ docs/                 SPEC / ORIGINAL-FEATURES / MIGRATION / OSS-RESEARCH / THIRD-PARTY / ROADMAP
└─ src/
   ├─ main.ts  App.vue   入口与应用外壳（装配 header/toolbar/2D/3D 挂载位/面板/弹窗）
   ├─ types/            纯类型：geometry / plan / furniture / material / state / persistence /
   │                    theme / scene3d / plan2d / extras（零运行时代码）
   ├─ theme/            tokens.ts（**唯一色值来源**）/ material-palette.ts（**3D 取色唯一来源**）/
   │                    contrast.ts（colorjs.io 断言）/ applyTheme.ts / useTheme.ts / base.css
   ├─ stores/           plan / layout / ui / theme / toast（SPEC §D 🔒 冻结签名 + 契约闸门测试）
   ├─ utils/            persistence.ts（**唯一存储出口**）/ normalize.ts / geometry.ts / measure.ts /
   │                    auto-furnish.ts / id.ts / scenePort.ts（3D 端口，依赖倒置）
   ├─ composables/      usePointerKind.ts（COARSE / TAP_PX 单点定义）/ usePointerPanZoom.ts /
   │                    useShortcuts.ts / useResizeFit.ts / useViewMounts.ts / useAppLang.ts 等
   ├─ data/             家具库（60 条目 / 45 类型）/ 材料表（8 种）/ 内置户型（7 个）/ 英文名映射
   ├─ components/       AppHeader / ToolBar / FurnitureLibrary / PropertyPanel / PlanLibraryModal /
   │                    FloorSwitcher / SelectionFab / ToastHost / dialogs
   └─ features/
      ├─ plan2d/         2D 平面编辑器：11 个图层组件 + PlanCanvas + 编辑/尺寸/图例/图案
      ├─ scene3d/        3D 场景：engine / architecture / furniture（6 分组）/ camera / walk /
      │                  lighting / picking / labels / materials / primitives + Scene3D.vue
      └─ extras/         亮点层：报价单 / 方案对比 / 平面图校验 / 历史面板 / 主题切换 /
                         命令面板 / 导出菜单（CSV·XLSX·DXF·PDF 接口·打印）
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

## 3. 主题体系

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

**单一安装轮次**：一次装齐收敛集，后续不得自行安装备选包。

| 包 | 版本策略 | 用途 |
| --- | --- | --- |
| `vue` / `pinia` | `^3.5` / `^4.1.0` | 框架 / 状态（ADR-06：3 业务 + 2 横切 store） |
| `@vueuse/core` | `^15.0.0` | 事件/全屏/存储/快捷键（B7） |
| `three` | **精确 `0.160.1`**（ADR-01，不随大流升级） | 3D 内核 |
| `colorjs.io` | `^0.7.1` | 对比度**裁决**（只用于断言，ADR-04） |
| `@material/material-color-utilities` | `^0.4.0`（Apache-2.0，保留 NOTICE） | 主题**派生**（tonal 色阶 / 一键换主题色） |
| `vue-i18n` | `^11.4.16` | 国际化（替换 `tr()` + `data-en`，X4） |
| `papaparse` / `exceljs` | `^5.7.0` / `^4.4.0`（**动态 import**） | CSV / XLSX（P0-3） |
| `dxf-writer` | `^1.18.4` | DXF 导出（P0-7） |
| `polygon-clipping` | **精确 `0.15.7`**（禁 `^`，最后发布 2023-12 且未过 1.0） | 仅当真布尔必要时（ADR-15） |
| `earcut` | `^3.2.4` | 三角化（P2-5） |

- ⛔ **不装**：`pdf-lib`（P1-1 未实现则整体不安装）、`postprocessing`（与 three 0.160 peer 冲突）、
  `@turf/*` 全家桶、`rbush`、`file-saver`、`html-to-image`、UI 组件库、`xlsx`(SheetJS CE)。
- **`pnpm.overrides`**：`esbuild` 锁定 `0.25.10`。原因：`esbuild@0.28.2` 在 Windows 上处理较大模块图时，
  `vite:esbuild-transpile` 删除临时文件会报 `Access is denied`（文件句柄竞争），属工具链缺陷。
- 依赖台账唯一权威：`docs/THIRD-PARTY.md`（含许可证与是否可再分发）。
- `devDependencies` 中的 `jsdom` 由 `@vue/test-utils` 推出（组件测试需要 DOM 环境）。

---

## 6. 实现状态

**全部计划内的功能已实现并通过验证**（详见 `docs/MIGRATION.md` 的逐项对照表）：

| 模块 | 内容 | 状态 |
| --- | --- | --- |
| 规格 | `docs/ORIGINAL-FEATURES.md` / `docs/SPEC.md`（契约冻结 + 裁决记录 §K） | ✅ |
| 工程骨架 | 类型、store 契约、主题令牌系统（3 预设 × 47 令牌） | ✅ |
| 2D 平面编辑器 | 11 个图层组件、编辑/测量/拆改、吸附、撤销重做、多方案、结构编辑、自动布置 | ✅ |
| 3D 场景 | 程序化建筑与家具（46 类型）、鸟瞰/漫游、门开合、日照/夜景、剖切、标签、截图 | ✅ |
| 亮点层 | 报价单（CSV/XLSX/DXF/打印）、方案对比、平面图校验、历史面板、主题切换、命令面板 | ✅ |
| 收尾 | `docs/MIGRATION.md` / `docs/ROADMAP.md` / 本 README | ✅ |

### 6.1 明确未实现的一项（避免误读）

**PDF 矢量图册**：`src/features/extras/lib/export-pdf.ts` 中 `PDF_EXPORT_AVAILABLE = false`，
依赖 `pdf-lib` / `@pdf-lib/fontkit` **未安装**（SPEC §H.1 规定「未实现则不安装」）。
代码只提供 `buildPdfAlbum(album, { renderer })` 注入点，**不伪造任何 PDF 字节流**。

替代路径是**打印**（`print.ts` + `print.css`）：用户「打印 → 另存为 PDF」可得到同样的图册内容。
启用步骤见 `docs/ROADMAP.md` §1.1。

### 6.2 已知技术债

见 `docs/ROADMAP.md` §4。最值得注意的三条：

1. **无 E2E 测试** —— 曾出现「四项自动化检查全绿但 3D 打不开」的缺陷，只有浏览器实渲染能发现。
2. `localStorage` 5MB 配额 —— 多方案 + 大户型可能撞墙，建议迁 IndexedDB。
3. `three@0.160.1` 较旧 —— 升级才能用 `postprocessing`，但需回归 3D 全部功能。

---

## 7. 许可证

本项目以 **MIT** 发布（见 `LICENSE`）。依赖许可证一律 MIT / ISC / Apache-2.0 / BSD / Zlib / CC0；
⛔ GPL / AGPL 与**无 license 字段**的仓库只读思路、零代码拷贝（SPEC §B.6 / ADR-12）。
第三方依赖登记见 `docs/THIRD-PARTY.md`。