# 技术规格（SPEC）— decoration-studio

> **本文件是下游三路（2D / 3D / 亮点）的施工图。**凡标注「🔒 冻结」的类型、store 字段与函数签名，下游**只能使用、不能改名**；确需变更，先发消息给 `spec-lead` 定稿后再改。
>
> 依据：
> - 功能基线：`装修设计.html`（3895 行）→ 逐项证据见 [`ORIGINAL-FEATURES.md`](./ORIGINAL-FEATURES.md)（下称 **OF**）
> - 差异核对：`装修设计.html.bak`（2664 行）→ OF §9
> - 开源与选型：`oss-researcher` 的 [`OSS-RESEARCH.md`](./OSS-RESEARCH.md)（下称 **OSS**），重点为 §12「五个缺口的定点选型」与 §13「法务口径定案」；其中版本/许可证均为 2026-10-20 实时抓取（`registry.npmjs.org` / `api.github.com` / SourceForge REST），标 `【已核实】` 的可直接写入 `package.json`，标 `【未在线核实】` 的**必须先复核**。
> - 依赖与许可证**唯一台账**：[`THIRD-PARTY.md`](./THIRD-PARTY.md)（**t9 起由 spec-lead 接管**，ADR-16）
> - 目标工程目录：`F:\LearnSpace\L1yuu_Space\decoration-studio`；远程仓库与发布约定见 **J 节**
>
> 约定：`🔒` = 冻结契约；`⛔` = 禁止事项；`【待确认】` = 需人工核实，禁止当成已知事实。
>
> **修订记录（t12，2026-10-20，来源 `docs/VERIFY-T7-STATIC.md` §C）**：C-2/C-3/C-4/C-5/C-6/C-8 已裁定并回写本文件，
> 逐条「改前 → 改后」+ 给下游的返工清单见 **§K**。要点：① 矮墙**填充进装饰豁免**（ADR-17，不改 hex）；
> ② `pt2vec/vec2pt` 归属 `utils/geometry.ts`（ADR-18，新增 §D.9 定义位置权威表）；③ `huxing-lang`/`huxing-panes` **必须接线**（t6 / t3）；
> ④ 3D 切片类型名以代码为准（`PlanSlice/LayoutSlice/UiSlice`）；⑤ hex 白名单统一为 §C.3 的 **4 条权威清单**；
> ⑥ 契约扩张（`color-scheme`/`wall-low-stroke`/`room-label-halo`/`readState`/`RoomRow`/`SaveStatus`/`SCALE_BAR_STEPS`）**予以追认**。

---

## 目录

- [A. 原功能保留清单与不保留项](#a-原功能保留清单与不保留项)
- [B. 新增亮点功能清单（P0 / P1 / P2）](#b-新增亮点功能清单p0--p1--p2)
- [C. 目录结构与模块边界](#c-目录结构与模块边界)
- [D. TypeScript 核心类型与 Pinia Store 契约 🔒](#d-typescript-核心类型与-pinia-store-契约-)
- [E. 颜色令牌表（含对比度）](#e-颜色令牌表含对比度)
- [F. 2D 与 3D 的接口契约 🔒](#f-2d-与-3d-的接口契约-)
- [G. 实施顺序与技术风险](#g-实施顺序与技术风险)
- [H. 依赖清单（含许可证与冻结版本策略）](#h-依赖清单含许可证与冻结版本策略)
- [I. 迁移期技术决议（Architecture Decision Records）](#i-迁移期技术决议architecture-decision-records)
- [J. 发布与仓库约定（含一个必读环境坑）](#j-发布与仓库约定captain-决策-2026-10-20含一个必读环境坑)
- [K. t12 裁决记录与返工交接（C-2/C-3/C-4/C-5/C-6/C-8）](#k-t12-裁决记录与返工交接c-2c-3c-4c-5c-6c-8)

---

## A. 原功能保留清单与不保留项

### A.1 保留清单（100% 必须在新工程可用）

OF 第 1–8 节的每一项都在保留范围内。下表把能力映射到目标模块；「验收锚点」列是给 `reviewer` / `verifier` 的**可核对行号**。

| # | 能力 | 目标模块 | 验收锚点（OF 行号） |
| --- | --- | --- | --- |
| A1 | 选择 / 移动 / 旋转手柄 / 尺寸手柄 / 双击旋转 / 方向键微调 | `features/plan2d` + `stores/ui` | OF §1.2, §2.7 |
| A2 | 测量（拖动 + 两点、吸附、Shift 正交锁、Esc/右键清除） | `features/plan2d/MeasureLayer.vue` | OF §1.3, §2.6 |
| A3 | 拆改非承重墙（承重/外墙拒绝） | `stores/layout.toggleWall` | OF §1.4 |
| A4 | 缩放 / 适应窗口 / 1:60 / 1:100 / 比例尺 / 状态栏比例读数 | `composables/usePointerPanZoom` + `stores/ui` | OF §1.5 |
| A5 | 图层开关 6 项（dims / labels / furn / grid / bearing / wallSnap） | `stores/ui.layers` | OF §1.6 |
| A6 | 2D / 3D 切换（含交叉淡入 + 相机对齐动画） | `stores/ui.viewMode` + `Scene3DApi` | OF §1.7, §3.1 |
| A7 | 撤销 / 重做（布置 150 步 + 结构 80 步两套独立栈） | `stores/layout` + `stores/plan` | OF §1.8 |
| A8 | 全屏（标准 + webkit 前缀 + 独立 App 隐藏按钮） | `@vueuse/core%useFullscreen` | OF §1.9 |
| A9 | 中英双语（`NAMES_EN` 86 条 + 全部 `data-en` 文案 + 不改用户自定义名称） | `vue-i18n` | OF §1.10 |
| A10 | 多方案管理（7 内置 + 新建/复制/改名/删除/缩略图/切层/导入导出） | `stores/plan` + `PlanLibraryModal.vue` | OF §1.11 |
| A11 | 户型结构编辑（画墙/房间/门窗/删除 + 吸附 + 正交 + 编辑网格 + 预览 + 面板） | `features/plan2d/editing.ts` | OF §1.12 |
| A12 | 自动布置家具（按房间名 + 面积） | `features/plan2d/autoFurnish.ts` | OF §1.13 |
| A13 | 2D 渲染 10 层（网格/房间/家具/墙/门窗/标签/尺寸/测量/选中/编辑预览） | `features/plan2d/layers/*` | OF §2.1–§2.8 |
| A14 | 材质图案 8 种 + 网格 pattern | `features/plan2d/patterns.ts` | OF §2.2 |
| A15 | 家具图例 SVG 45 类型 | `features/plan2d/furniture-svg.ts` | OF §2.8 |
| A16 | 3D 程序化建筑（墙/窗/门/推拉门/天花/踢脚线/墙棱线/过梁/楼梯/楼板） | `features/scene3d/architecture.ts` | OF §3.2 |
| A17 | 3D 程序化家具 45 类型 | `features/scene3d/furniture/*` | OF §3.3 |
| A18 | 剖切墙（2.8 / 1.2 两档） | `features/scene3d/architecture.ts` | OF §3.4 |
| A19 | 鸟瞰 / 漫游（指针锁定 + WASD + Shift + E 开门 + Esc 解锁） | `features/scene3d/walk.ts` | OF §3.5, §8.1 |
| A20 | 触屏摇杆漫游 + 拖动转向 + 点门开关 | `features/scene3d/walk.ts` | OF §3.6 |
| A21 | 门开合动画（缓动 `dt*6`）+ 三处触发 | `features/scene3d/architecture.ts` | OF §3.7 |
| A22 | 日照滑块 7:00–18:00 + 夜景 | `features/scene3d/lighting.ts` | OF §3.8 |
| A23 | CSS2D 房间标签 + 3D 房间列表飞行 | `features/scene3d/labels.ts` | OF §3.9 |
| A24 | 3D 按需重建（三签名脏检查） | `features/scene3d/engine.ts` | OF §3.10 |
| A25 | 数据模型与 5 个 localStorage 键（**键名逐字保留**） | `stores/*` + `utils/persistence.ts` | OF §4.1, §4.2 |
| A26 | 迁移 / 修复逻辑（`migrateLegacy` / `fixState` / `syncRoomState` / `normalizePlan`） | `utils/persistence.ts` + `utils/normalize.ts` | OF §4.3 |
| A27 | 家具库 6 分类 60 条目 + 45 类型 + 拖放/轻点两种放置 | `data/furniture-lib.ts` + `FurnitureLibrary.vue` | OF §5 |
| A28 | 材料表 8 种 + 面积/报价口径（鞋带公式、5% 损耗、墙面积 ×2.8、拆除长度） | `utils/measure.ts` | OF §6 |
| A29 | 导入导出：PNG（2D 3200px / 3D 截图）、布置 JSON、户型 JSON、全部户型打包 | `features/extras/export*` | OF §7 |
| A30 | 键盘 20 项 + 3D 漫游 5 项 + 触屏 13 项 | `composables/useShortcuts` | OF §8 |

### A.2 明确不保留项（含理由）

> 判定标准：**保留它会阻碍架构目标、或本身就是缺陷**。凡「不保留」的功能，都用语义等价或更强的实现替代，不产生功能缺口。

| # | 不保留的东西 | 原证据 | 替代方案 | 理由 |
| --- | --- | --- | --- | --- |
| X1 | three.js 走 CDN importmap | L249-254 | npm `three` 依赖 | 离线不可用；无法锁版本 / tree-shaking / 类型；`setView` 已为此写降级提示（L2560） |
| X2 | 全局可变结构数组 `WALLS/WINS/DOORS/SLIDES/ROOMS` 与 `usePlan()` 就地覆写（L882-888） | OF §4.1 | `stores/plan` 的 `computed` 结构视图 | 隐式全局副作用：切换楼层时临时覆写全局数组（L3463-3476），无法测试、无法并行、易出层级错绘 |
| X3 | `window.View3D` 全局对象（L3892） | OF §3.10 | 组件 ref + `Scene3DApi` 接口（F 节） | 全局单例导致生命周期不可控、无法做多实例、单元测试需打桩 |
| X4 | `applyStaticLang()` 直接改写 DOM 文案（L440-446） | OF §1.10 | `vue-i18n` | DOM 直改与 Vue 虚拟 DOM 冲突，切换语言后会与 patch 打架 |
| X5 | 原生 `confirm()` / `prompt()`（L1439, L2036, L2129, L2622） | OF §1.11 | 应用内 `ConfirmDialog.vue` / `PromptDialog.vue` | iOS 独立 PWA 下不可靠、不可主题化、不可自动化测试 |
| X6 | 硬编码的尺寸链（`.bak` L798-802）、入户标识坐标（L770-771）、窗台高（L2309）、过梁（L2306）、世界原点（L1514）、漫游入口（L2565） | OF §9.2 D6–D9, D15, D16 | 现行版本的数据驱动实现（L1264-1288 / L1239-1250 / L484-491 / L632+L3523 / L2691 / L3650-3659） | 对「非默认户型」与「导入户型」全部失效；迁移到多户型后是**必错**逻辑 |
| X7 | `#toast` 单定时器（L2548-2549） | OF §0.1 | 队列化 `useToastStore` | 并发提示互相吞掉，用户看不到后一条 |
| X8 | `Object.assign(d.rooms, s.rooms \|\| {})` 就地修改默认表（L990） | OF §4.3 | 纯函数 `fixState(raw): PlanState` | 隐式别名，OF §10 U1 未定论的风险点 |
| X9 | `clearGroup()` 只 `dispose` geometry、不释放 material/texture；`matCache` / `floorMats` 永不释放（L3442, L2798, L2819） | OF §3.1 | `MaterialRegistry` 统一持有与 `dispose()` | 真实内存泄漏；Vue 组件反复挂载/卸载会持续吃显存 |
| X10 | `setTimeout(..., 60/80)` 魔法延时串接（L2005, L2023, L2043, L2284-2286） | OF §1.11, §1.12 | `await nextTick()` / 显式 Promise | 竞态来源；入口不一致（如内置户型进编辑态要延迟 80ms） |
| X11 | `localStorage` 写入失败静默吞掉（L1023 的 `catch(e){}`） | OF §4.3 | 保存失败**可见**提示 + 降级策略 | 配额超限（5MB）时用户会以为已保存，实际丢数据 |
| X12 | 默认主题里两处 WCAG 不达标的取值：`--muted:#8a8174`（3.78:1）、白字压 `--accent:#b5653a`（4.30:1） | L13, L35 | E 节新令牌（5.71:1 / 5.89:1） | 正文对比度 < 4.5:1 |

**保留但需修正实现的语义**（不是不保留）：`fixState` 的「默认房间表打底、存档覆盖新增房间」语义保留（OF §4.3 第 5 条）；`NAMES_EN` 的「用户改过的名称原样显示」语义保留（L417 注释，这是特性不是 bug）。

---

## B. 新增亮点功能清单（P0 / P1 / P2）

> 优先级定义：**P0** = 迁移期内必须完成（架构级，越晚改越贵）；**P1** = 紧随其后、同迭代交付；**P2** = 只留接口与路线图，不在本轮实现。
> 依据列指 `OSS-RESEARCH.md` 的对应小节。所有 npm 版本与许可证来自 OSS 的实时抓取（标 `【已核实】`）。

### B.1 P0

| ID | 亮点功能 | 复用库 / 开源项目 | 许可证 | 复用量级 | 为何不自研 |
| --- | --- | --- | --- | --- | --- |
| **P0-1** | **主题体系：深浅双主题（日间 / 夜间）+ 完整令牌表 + 对比度 CI 守门** | `@material/material-color-utilities`（M3/HCT 种子色 → tonal palette，主题生成引擎）+ `colorjs.io`（WCAG 2.1 / APCA 权威实现，跑 CI 断言） | M3 库 **Apache-2.0** `【已核实】`（v0.4.0，Google 官方）；`colorjs.io` **MIT** `【已核实】`（v0.7.1） | 两个都是直接依赖 | **职责分工（三者不重叠）**：① 三套预设的 hex 由本 SPEC E 节**定稿**（保真 + 可审计 + 可回归）；② M3 引擎负责**派生与扩展**（由 E 节 `accent` 种子生成 hover/active/soft/tonal 色阶、为「一键换主题色」提供生成能力）；③ `colorjs.io` 只做**裁决**（CI 对比度断言）。⛔ 不自研色彩空间/对比度数学（OSS §5 红线 7、§12 缺口 5） |
| **P0-2** | **正式国际化**（替换 `tr()` + `data-en` DOM 改写） | `vue-i18n` | **MIT** `【已核实】` v11.4.16 | 直接依赖 | 复数、日期、懒加载、语言检测、`<i18n-t>` 插值——框架能力（OSS §5 红线 12） |
| **P0-3** | **工程量清单 / 报价单导出（CSV + XLSX）** | `exceljs`（xlsx，**动态 `import()` 按需加载**）+ `papaparse`（CSV 生成与解析） | `exceljs` **MIT** `【已核实】` v4.4.0；`papaparse` **MIT** `【已核实】` v5.7.0 | 直接依赖 | OOXML 容器/共享字符串/样式索引、CSV 引号转义/BOM/分隔符嗅探（OSS §5 红线 2、3）。**注意事项**：`exceljs` npm 最后发布 2023-10-19 `【已核实】`，体积大且 Vite 下历史上偶需 `buffer` polyfill → **必须动态 import**；轻量替代 `write-excel-file`（**MIT** v4.1.1 `【已核实】`，只写不读）；样式 + Apache-2.0 场景用 `xlsx-js-style`（v1.2.0）。⛔ **禁用** npm 上的 `xlsx@0.18.5`（2022-03 后停更、新版只在 SheetJS 自有 CDN 分发，OSS §4.3/§12 缺口 1） |
| **P0-4** | **平面图自动校验 + 可点击告警列表**（5 条规则：家具穿墙 / 家具压门洞 / 堵塞通道 / 房间无家具 / 尺寸异常） | 自研规则引擎；几何事实判断**优先用 three 自带 `three/addons/math/OBB.js` + `Box3`（零新增依赖）**；确需真布尔时用 `polygon-clipping`（**精确锁 `0.15.7`，禁写 `^`**）；按需再评估 `@turf/*` 子包 | three 本体 **MIT**（已在依赖）；`polygon-clipping` **MIT** `【已核实】` v0.15.7 | 规则引擎自研；几何原语优先复用已有依赖 | **自研理由**：**不存在"装修规范校验"现成库**（OSS §12 缺口 3 结论），阈值（门洞前净空、通道净宽）、违规分级、尺寸异常规则全是业务资产。**必须复用库的部分**：旋转家具的 OBB 相交（three 自带，优先）、多边形布尔（避免退化边/自交/浮点鲁棒性坑，红线 8）。补充结论：`polygon-clipping` 最后发布 2023-12 且未过 1.0 → **精确锁版本**（captain 已要求；OSS §4.2/§12） |
| **P0-5** | **多方案并排对比 + 差异摘要** | 自研（Pinia + 既有面积/报价口径），无第三方 | — | — | **自研理由**：OSS §6 #10 明确「不用第三方」；对比维度（面积/材料/报价/家具数量/拆改长度）全部是本项目专有口径（OF §6） |
| **P0-6** | **2D 导出 SVG**（矢量交付，零依赖）+ 保留 PNG / 3D 截图 | 自研（直接序列化渲染后的 SVG 节点），零依赖 | — | — | **自研理由**：SVG DOM 已在手（OF §2），克隆 + 注入令牌字面值 + 序列化即得矢量图；引库收益为负（`html-to-image` / `modern-screenshot` 反而引入跨浏览器字体/外链坑，OSS §4.3/§12 缺口 4） |
| **P0-7** | **DXF 导出**（CAD 交付：墙体/门窗/家具/尺寸各占图层） | `dxf-writer` | **MIT** `【已核实】` v1.18.4 | 直接依赖 | ⛔ 不自研 DXF 文本格式（群码、图层表、块表、单位）。与 `@tarikjabiri/dxf`（MIT v2.9.0）**二选一**；**captain 指定 `dxf-writer`**（OSS §12 缺口 4） |
| **P0-8** | **历史面板 + 命名快照**（可命名、可跳转、可对比；替换"无 UI 的快照栈"） | 自研（Pinia），无第三方 | — | — | **自研理由**：撤销/重做语义是本项目业务资产（OSS §5 反例清单）；必须保留**布置栈 150 / 结构栈 80 双栈隔离**（OF §1.8、§9.5 风险 2），第三方历史库无法表达"结构修改要重算 bounds + 重映射 demolished" |
| **P0-9** | **3D 材质基色 / 背景 / 曝光 / 光照与主题联动**（架构级硬性要求） | three 本体（无新增依赖） + `src/theme/material-palette.ts` 统一 token 表 | three **MIT**（已在依赖） | 集中表 + 联动函数 | **规格约束（captain，2026-10-20）**：原文 3D 侧有 **40+ 处**硬编码 `mat('#...')`（`装修设计.html` L2902–3423），`toneMappingExposure` 在 L3612、`scene.background` / 地面色 / 半球光 / 太阳色 / `envK` 在 L3603-3616。**这些必须全部走统一 token 表并随主题联动**，否则「配色优化」在 3D 侧等于没做，评审直接打回。详见 E.8 |

### B.2 P1

| ID | 亮点功能 | 复用库 / 开源项目 | 许可证 | 复用量级 | 说明 / 自研理由 |
| --- | --- | --- | --- | --- | --- |
| **P1-1** | **报价单 / 图册 PDF**（封面 + 户型图 + 房间面积表 + 主材表 + 家具表 + 合计）—— **P1-可选，不作硬性验收项** | `pdf-lib` + `@pdf-lib/fontkit`（中文子集嵌入）；矢量图纸页可叠加 `svg2pdf.js` + `jspdf`；声明式排版备选 `pdfmake` | 均 **MIT** `【已核实】`（pdf-lib 1.17.1 / fontkit 1.1.1 / svg2pdf.js 2.8.1 / jspdf 4.2.1 / pdfmake 0.3.12） | 每组「二选一」；外加一份 OFL 字体资产 | **降级理由是体积与工时成本（中/高），不是法务问题**（captain 明确）：中文字体用 **SIL OFL 1.1**（Noto Sans SC / Source Han Sans），**允许随 MIT 产物一同分发**。t6 **视成本选择性实现**。⛔ 不自研 PDF 排版（红线 1）；未嵌字体会乱码，必须用 `@pdf-lib/fontkit` 子集化并在 `THIRD-PARTY.md` 记录字体体积预算 |
| **P1-2** | **高对比主题**（第三套预设） | 复用 P0-1 机制（M3 派生 + colorjs.io 断言） | 同 P0-1 | 仅多一张令牌表 | 机制零成本，hex 已在 E.5 定稿；对可访问性是高价值低成本的补齐 |
| **P1-3** | **命令面板（Ctrl/⌘+K）+ 快捷键帮助面板** | `@vueuse/core`（`useMagicKeys`） | **MIT** `【已核实】`（同仓库 `@vueuse/components` / `router` / `math` 均为 v15.0.0；`@vueuse/core` 本体 `【待确认】`） | 直接依赖 | 键盘监听/解绑交给库，避免手写 `addEventListener` 泄漏（B7）。⛔ 不得抢走既有快捷键（`P`/`E`/`T`/`1`/`2`/`V`/`M`/`X`/`F`/`R`），守卫语义沿用 OF §8.1 |
| **P1-4** | **打印友好样式**（`@media print` 分页 + 图册 PNG 序列） | 自研 CSS，零依赖 | — | — | **自研理由**：与 P1-1 解耦——PDF 若因成本未实现，仍能提供可打印/可另存 PDF 的交付物，避免功能空档 |

### B.3 P2（本轮只留接口，不实现）

| ID | 亮点功能 | 复用库 | 许可证 | 阻塞原因 |
| --- | --- | --- | --- | --- |
| **P2-1** | 真实 glTF 家具库替换程序化几何（含**用户自带 GLB 导入**这一低成本变体） | three 自带 `GLTFLoader` +（可选）`@gltf-transform/core` `/extensions` `/functions` | three **MIT**（已依赖）；gltf-transform **MIT** `【已核实】` v4.5.1 | 本版**不引入 3D 模型资产**（captain 确认：当前不存在"资产不能开源"的阻塞点，纯成本问题；资产授权登记见 THIRD-PARTY §4）。⛔ 不自研 glTF 解析（红线 4） |
| **P2-2** | PBR 材质库（墙漆 / 木地板 / 瓷砖 / 大理石一键切换） | three 材质 + ambientCG **CC0** 贴图（未来资产来源已在 `THIRD-PARTY.md` §4 留痕） | 贴图 **CC0-1.0** `【已核实】` | 需资产体积控制（KTX2 压缩）与选型；与主题色阶联动（墙漆色 = 主题 tonal） |
| **P2-3** | 照片级路径追踪出图 | `three-gpu-pathtracer` + `three-mesh-bvh` | 均 **MIT** `【已核实】`（v0.0.27 / v0.9.16） | 需 GPU 算力 + 渐进式降噪 + 低端降级；与 three 版本的兼容性 `【待确认】` |
| **P2-4** | 墙体真 CSG 开洞（替换"墙分段近似"） | `three-bvh-csg` | **MIT** `【已核实】` v0.0.18 | 需改造墙体数据模型与重建脏标记；与 three 0.160 的兼容性 `【待确认】`（ADR-01） |
| **P2-5** | **画完墙自动识别房间**（生成房间多边形 + 面积/周长 + 默认命名） | `polygon-clipping`（**精确锁 `0.15.7`**）+ `earcut` | MIT / **ISC** `【已核实】`（v3.2.4） | **本版降级为 P2**（captain 裁决）。现状是人工房间 `RM()`（OF §4.1）；实现约束见 ADR-07（只生成未覆盖区域、绝不覆盖已命名房间、必须进结构撤销栈） |
| **P2-6** | 3D 后处理画质档位（SSAO / Bloom / DoF / SMAA） | `postprocessing`（pmndrs） | **Zlib**（非 MIT，需在 `THIRD-PARTY.md` 单列）`【已核实】` v6.39.5 | peer 依赖 `three >= 0.168 < 0.187`，与 ADR-01 锁定的 three 0.160.x **冲突**；升 three 需先做视觉回归 |
| **P2-7** | 通道连通性 / 净宽深度分析 | `three-pathfinding`（navmesh + A*）或 `js-angusj-clipper`（布尔 + offset） | 均 **MIT** `【已核实】`（v1.3.0 / v1.3.1） | 仅当 P0-4 的简化净宽/净空规则不够时启用（captain 指示：**不要一上来就装重库**）。`js-angusj-clipper` 为 WASM/Asm.js 端口，需验证 Vite 下 `.wasm` 资产加载 |
| **P2-8** | IndexedDB 持久化 + `zod` 导入运行时校验 | `dexie` 或 `idb-keyval`；`zod` | 【未在线核实】（预期 MIT/ISC，`THIRD-PARTY.md` §2） | 与迁移保真冲突（localStorage 键必须继续可读写，OF §4.2）；P0 阶段先把持久化收敛到 `utils/persistence.ts` 留缝 |
| **P2-9** | WebXR 漫游 / OBJ·GLB 导出 / `.sh3d` 互操作 / DXF 深化 | three 内置 WebXR 与 `OBJExporter`；`.sh3d` 为 zip+`Home.xml`（**无现成库**） | three MIT；`.sh3d` 需与 Sweet Home 3D（GPLv2）做**格式互操作的法务确认**（THIRD-PARTY §3） | 非本轮优先级；`.sh3d` 需先厘清格式互操作是否触及 GPL |

### B.4 「禁止重复造轮子」红线（PR 中出现自研即打回）

沿用 OSS §5 的 12 条与 §12 的定点结论，在**本工程内**取其中最相关的 8 条：

1. ⛔ 不自研 PDF 排版 → P1-1 用 `pdf-lib`（或 `pdfmake` / `svg2pdf.js`+`jspdf`）。
2. ⛔ 不自研 xlsx 写出 → P0-3 用 `exceljs`（轻量替代 `write-excel-file`）。
3. ⛔ 不自研 CSV 解析/生成 → P0-3 用 `papaparse`。
4. ⛔ 不自研 3D 场景控制 → 继续用 three addons `OrbitControls` / `PointerLockControls`（OF §3.1）。
5. ⛔ 不自研色彩空间 / 对比度数学 → P0-1 用 `colorjs.io`（断言）+ `@material/material-color-utilities`（生成）。
6. ⛔ 不自研多边形布尔 / 三角化 / OBB 相交 → **先**用 three 自带 `three/addons/math/OBB.js` + `Box3`（零新增依赖）；确需布尔时用 `polygon-clipping`（精确锁 `0.15.7`）；三角化用 `earcut`。
7. ⛔ 不自研国际化 / 状态管理 / 键盘监听 → `vue-i18n` / `pinia` / `@vueuse/core`。
8. ⛔ 不自研 glTF 解析（P2-1 时）→ three `GLTFLoader`；⛔ 不自研 DXF 文本格式（P0-7）→ `dxf-writer`。

**同时明确必须自研的（业务资产，无库可替代）**：户型数据模型、吸附与对齐规则、报价与算量口径、撤销/重做语义、2D↔3D 同步策略、家具目录结构、平面图校验规则与阈值、方案对比口径（OSS §5 反例清单、§12 缺口 3）。

### B.5 编辑内核：自研决策（必须写死在规格里）

> **决策：2D/3D 编辑内核自研，不寻找、不依赖任何"现成的户型/装修编辑器"库。**

| 候选 | 许可证 | 裁决 | 理由 |
| --- | --- | --- | --- |
| [`smplrspace/floorplan.js`](https://github.com/smplrspace/floorplan.js)（npm `floorplan.js@0.1.1`） | **无 license 字段** | ❌ **不可依赖、不可拷代码** | 无 license = 默认保留全部权利；且 2022-02 后停更（OSS §2.3） |
| [`cvdlab/react-planner`](https://github.com/cvdlab/react-planner) | MIT | ❌ **不可直接依赖** | React 专用；npm `react-planner@2.0.6` 最后发布 2019-11-03（停更 7 年）。**仅借鉴**其 layers/lines/areas/items/holes 数据模型与工具状态机 |
| [`furnishup/blueprint3d`](https://github.com/furnishup/blueprint3d) | **MIT** | ✅ **只借鉴分层，禁止整包移植** | 1987★，但 README 自陈"原型产物、从未重构"、依赖 grunt+jquery，2021-01 停更。可抄的是它的四层骨架（core / floorplanner / items / model / three）——与本 SPEC C 节目录结构同构 |
| [`ekymo/homeRoughEditor`](https://github.com/ekymo/homeRoughEditor) / [`nicosandller/easy-floorplan`](https://github.com/nicosandller/easy-floorplan) | MIT | ✅ 只读思路 | 活跃 MIT 同类实现，可参考墙体绘制状态机与 SVG DOM 组织 |

**为什么必须自研**：① 我们的数据模型（`walls/wins/doors/slides/rooms/dims/lintels/stairs/voids`，OF §4.1）与"多方案 + 逐层存档"（OF §1.11）是项目专有资产，没有库能匹配；② 需要保真的交互语义有 30 项快捷键 + 13 项触屏手势（OF §8），换成库必然漂移；③ 一旦引入开源编辑器内核，其许可证将决定整个 MIT 项目的分发边界。

### B.6 法务口径（captain 决策，2026-10-20，**不依赖用户答复**）

> **项目定位已定：开源、以 MIT 发布**（用户拍板）。口径不变——MIT 混入 GPL 同样会被传染。

| 类别 | 裁决 | 涉及 |
| --- | --- | --- |
| ✅ 允许依赖与借鉴（保留许可证与版权声明） | MIT / ISC / Apache-2.0 / BSD / **Zlib** / CC0 | `three`、`pinia`、`vue-i18n`、`@vueuse/*`、`colorjs.io`、`@material/material-color-utilities`(Apache-2.0)、`exceljs`、`papaparse`、`dxf-writer`、`pdf-lib`、`polygon-clipping`、`earcut`、`postprocessing`(Zlib)、three 生态 |
| ❌ 禁止进入依赖树 / 零代码拷贝（只读思路） | **GPL-2.0 / GPL-3.0 / AGPL-3.0**，以及**所有无 license 字段的仓库** | Sweet Home 3D(GPLv2)、ExportToHASS(GPL-3.0)、FloorplanToBlender3d(GPL-3.0)、DeepFloorplan(GPL-3.0)、wallgraph(AGPL-3.0)、`pkozul/ha-floorplan`、`smplrspace/floorplan.js`、`oodavid/SVG-Floorplan-Editor`、`andsilver/floorplan-angular`、`pegasus1982/threejs-3d-building-configurator`、`Open-Location-Stack/floorplan-editor` |
| ✅ 资产 | 中文 PDF 字体走 **SIL OFL 1.1**（Noto Sans SC / Source Han Sans）——**允许随 MIT 产物分发**；贴图资产用 **CC0**（ambientCG） | 字体授权**不是** PDF 降级的原因（原因是体积与工时）；`@pdf-lib/fontkit` 子集化后的体积预算需评估 |
| 📋 登记 | 唯一的依赖与许可证台账是 [`THIRD-PARTY.md`](./THIRD-PARTY.md)（`oss-researcher` 出模板，**t9 起由 spec-lead 接管维护**）；本 SPEC 的依赖清单以该表为准 | 安装后需把"建议锁定版本"回填为 `pnpm-lock.yaml` 实际版本；并补 `pnpm licenses list` / `license-checker` 实机结果（**pwsh 不可用时标注"未验证"，禁止伪造输出**） |

---

## C. 目录结构与模块边界

### C.1 目录树（🔒 冻结；新增文件须落在既有目录）

```
decoration-studio/
├─ index.html
├─ package.json
├─ vite.config.ts
├─ tsconfig.json / tsconfig.node.json
├─ .gitignore  .prettierrc  eslint.config.js
├─ README.md
├─ THIRD-PARTY.md                     # 依赖名/版本/许可证/用途登记（OSS §3 行动建议）
├─ docs/
│  ├─ ORIGINAL-FEATURES.md            # t1 产出（已完成）
│  ├─ SPEC.md                         # 本文件
│  ├─ OSS-RESEARCH.md                 # t2 产出
│  ├─ MIGRATION.md                    # t9 产出
│  └─ ROADMAP.md                      # t9 产出
├─ scripts/verify.mjs                 # 与 CWD 无关的验证入口（t3）
├─ public/
│  ├─ fonts/                          # P1-1 用的 OFL 中文字体子集
│  └─ textures/                       # P2-3 用的 CC0 贴图（预留）
└─ src/
   ├─ main.ts
   ├─ App.vue
   ├─ types/                          # 只放类型，零运行时代码
   │  ├─ geometry.ts                  # Pt / Vec2 / Rect / Bounds
   │  ├─ plan.ts                      # Wall / Win / Door / Slide / Room / DimChain / Lintel / Stair / VoidShape / PlanStructure / PlanLevel / Plan
   │  ├─ furniture.ts                 # FurnitureType / Furniture / LibItem / LibCategory
   │  ├─ material.ts                  # MaterialKey / Material
   │  ├─ state.ts                     # PlanState / Measure / Tool / LayerFlags / Selection / ViewTransform / EditState / View3dOptions / RoomOverride
   │  ├─ persistence.ts               # PlanFile / PlanSetFile / PlanLibraryFile / LayoutFile
   │  ├─ theme.ts                     # ThemeTokens / ThemePresetId / ContrastPair
   │  └─ index.ts                     # re-export
   ├─ data/
   │  ├─ materials.ts                 # MATS 8 种（key/name/price/sw/tex）
   │  ├─ furniture-lib.ts             # 6 分类 60 条目 / 45 类型
   │  ├─ names-en.ts                  # NAMES_EN 86 条（供 vue-i18n 装载）
   │  └─ presets/
   │     ├─ index.ts                  # PRESETS 顺序：h3b, h2b, h3c, h4d, h1a, hloft, hblank
   │     ├─ three-bed.ts              # P_3B（含 defaultFurniture 工厂）
   │     ├─ one-bed.ts  two-bed.ts  three-bed-c.ts  four-bed.ts
   │     ├─ loft.ts                   # P_LOFT（二层 + 楼梯 + 挑空）
   │     └─ blank.ts                  # P_BLANK
   ├─ theme/
   │  ├─ tokens.ts                    # THEMES: Record<ThemePresetId, ThemeTokens>（唯一色值来源）
   │  ├─ material-palette.ts          # 3D 中性材质基色令牌（**唯一来源**；⛔ scene3d/ 内不得写死 hex，见 E.8 T1/T2）
   │  ├─ contrast.ts                  # WCAG 计算（colorjs.io 封装）+ 断言表
   │  └─ applyTheme.ts                # 写 CSS 变量 + 读取解析后色值
   ├─ stores/
   │  ├─ plan.ts  layout.ts  ui.ts  theme.ts  toast.ts
   │  └─ index.ts
   ├─ utils/
   │  ├─ geometry.ts                  # area/perim/bbox/aabb/snapRects/pushOut/snapMove/snapPoint/inAnyRoom
   │  ├─ measure.ts                   # 面积/周长/材料用量/报价/拆除长度（OF §6 口径）
   │  ├─ normalize.ts                 # normalizePlan / stripPlan / fixState（纯函数）
   │  ├─ persistence.ts               # 5 个 localStorage 键 + migrateLegacy + 配额告警
   │  └─ id.ts                        # uid()（布置）/ newPlanId()（户型）
   ├─ composables/
   │  ├─ usePointerPanZoom.ts  useShortcuts.ts  useResizeFit.ts
   │  └─ usePointerKind.ts            # COARSE / TAP 单点定义
   ├─ features/
   │  ├─ plan2d/                      # ← plan2d-dev 独占
   │  │  ├─ PlanCanvas.vue
   │  │  ├─ layers/ GridLayer.vue RoomLayer.vue FurnitureLayer.vue WallLayer.vue
   │  │  │         OpeningLayer.vue LabelLayer.vue DimLayer.vue MeasureLayer.vue
   │  │  │         SelectionLayer.vue EditLayer.vue
   │  │  ├─ furniture-svg.ts          # furnSVG 45 类型
   │  │  ├─ patterns.ts               # buildDefs 8 图案 + grid
   │  │  ├─ editing.ts                # 结构编辑状态机
   │  │  ├─ dims.ts                   # 尺寸链 + autoDims
   │  │  ├─ auto-furnish.ts           # autoFurnish 规则
   │  │  ├─ room-detect.ts            # P2-5 自动识别房间（本版不实现，仅留占位签名）
   │  │  └─ export-svg.ts             # P0-6
   │  ├─ scene3d/                     # ← scene3d-dev 独占
   │  │  ├─ Scene3D.vue
   │  │  ├─ engine.ts                 # 渲染器/场景/主循环/生命周期/dispose
   │  │  ├─ architecture.ts  materials.ts  primitives.ts
   │  │  │  lighting.ts  camera.ts  walk.ts  picking.ts  labels.ts
   │  │  └─ furniture/ index.ts beds.ts seating.ts storage.ts tables.ts
   │  │                bath.ts kitchen.ts appliances.ts leisure.ts
   │  └─ extras/                      # ← features-dev 独占
   │     ├─ PlanCompare.vue  CostReport.vue  ValidationPanel.vue
   │     ├─ CommandPalette.vue  HistoryPanel.vue  ExportMenu.vue
   │     └─ lib/ export-csv.ts export-xlsx.ts export-pdf.ts validate.ts
   └─ components/                     # 跨特性共享的纯 UI（t3 创建，下游只读不改契约）
      ├─ AppHeader.vue  ToolBar.vue  FurnitureLibrary.vue  PropertyPanel.vue
      ├─ PlanLibraryModal.vue  FloorSwitcher.vue  ToastHost.vue  SelectionFab.vue
      └─ dialogs/ ConfirmDialog.vue  PromptDialog.vue
```

### C.2 模块边界规则（用 ESLint `no-restricted-imports` 强制）

| # | 规则 | 理由 |
| --- | --- | --- |
| B1 | `features/plan2d/**` ⛔ 不得 import `features/scene3d/**`，反之亦然 | 两条并行开发线必须完全解耦（t4 / t5 同时开工） |
| B2 | `features/**` 之间 ⛔ 不得互相 import；跨特性只能经 `stores/**` / `types/**` / `utils/**` / `theme/**` | 避免形成隐式依赖网 |
| B3 | **主题令牌**的十六进制只能出现在 `theme/**`（`tokens.ts`、`material-palette.ts`；`applyTheme.ts` / `contrast.ts` 内的注释引用亦在白名单内）——权威清单见 §C.3 | 单一色值来源（E 节要求） |
| B4 | **内容色**（非主题色）只允许出现在 `data/furniture-lib.ts`（家具默认色 `LIB[].color`）、`data/materials.ts`（材料色板 `sw`）、`features/plan2d/patterns.ts`（地板图案纹样）三处；**3D 中性材质基色不在例外之列**，必须放进 `theme/material-palette.ts`（见 E.8） | 原实现在 L2902-3423 有 ~40 处 `mat('#...')` 硬编码（OSS §7.6 / captain 规格约束），不集中则改主题要改 40 处 |
| B5 | `stores/**` ⛔ 不得 import `features/**` 与 `.vue` 文件 | store 必须可在 Node 下单测 |
| B6 | 组件 ⛔ 不得直接读写 `localStorage`，只能经 `utils/persistence.ts` | 便于 P2 切 IndexedDB |
| B7 | 组件 ⛔ 不得直接 `addEventListener`，一律用 `@vueuse/core` 的 `useEventListener` / `useResizeObserver` | 自动解绑，防泄漏（原实现有 6 处裸监听：L1761, L1832, L1839, L1875-1876, L2602, L2608-2609） |
| B8 | `features/scene3d/**` ⛔ 不得写入 `stores/layout` 以外的地方；三维拖拽结束后必须 `layout.commit(before)` | 与原契约一致（L2772），保证进撤销栈 |
| B9 | 组件内 ⛔ 不得写 `var(--ds-*)` 到 SVG **呈现属性**（如 `fill="var(--ds-...)"`） | SVG 属性不支持 `var()`，且会导致导出 SVG/PNG 丢色（见 F.6） |

### C.3 hex 白名单（**权威清单，🔒 冻结** —— C-6 统一口径）

> 此前该清单在 SPEC B4 / G.3#12 / README / `verify.mjs` / `eslint.config.js` 之间口径不一（`data/furniture-lib.ts` 只在部分处出现）。
> **以下 4 条为唯一权威**，任何工具、文档、评审都必须与此一致：

| # | 路径 | 性质 | 为什么豁免 |
| --- | --- | --- | --- |
| W1 | `src/theme/**` | 主题令牌 | `tokens.ts`（UI + 2D 令牌）、`material-palette.ts`（3D 中性材质基色 + 场景联动）；`applyTheme.ts` / `contrast.ts` 只在注释里引用 hex |
| W2 | `src/features/plan2d/patterns.ts` | 内容色 | 地板图案纹样（8 种材料的 pattern 描线色），是**内容**不是 UI 主题（ADR-10） |
| W3 | `src/data/materials.ts` | 内容色 | 材料色板 `MATS[].sw`（用户可选的材料外观，随材料走） |
| W4 | `src/data/furniture-lib.ts` | 内容色 | 家具库默认色 `LIB[].color` + 家具图例描边色板 `ST`（用户可改色，属用户数据域，ADR-10） |

**各消费方应有的形态（改前 → 改后）**

| 消费方 | 当前状态（2026-10-20 静态核对） | 应改成 |
| --- | --- | --- |
| `eslint.config.js:20-25` `HEX_WHITELIST` | ✅ 已含 4 条（`src/theme/**`、`patterns.ts`、`materials.ts`、`furniture-lib.ts`） | **无需改动** |
| `scripts/verify.mjs:132-137` `HEX_WHITELIST` | ✅ 行为已含 4 条 | 仅 `:433` 的**检查名文案**漏列 → 改为 `hex 白名单：十六进制只出现在 theme/**、patterns.ts、data/materials.ts、data/furniture-lib.ts`（行为不变，见 §K 第 3 条） |
| `README.md:95`（B3/B4 行） | ✅ 已含 `data/furniture-lib.ts` | **无需改动**（t7 C-6 的该项判断已过时，README 期间已被更新） |
| `README.md:115`（装饰豁免列举） | ⚠️ 只列 `border`、网格细/主线 | 补 `wall-low`（填充）→ 与 E.3 的装饰豁免清单一致（见 §K 第 4 条） |
| SPEC `§C.2 B4` / `§G.3#12` | B4 已含 furniture-lib；G.3#12 **漏列** | G.3#12 已在本轮补齐（见下方） |

> ⛔ **不要为这条清单新增文件或新工具**：`eslint.config.js`（AST 层）+ `scripts/verify.mjs`（整行原文层）两道闸门已足够；
> 它们口径不同是**有意为之**（C-7 记录了这个差异：注释里的 hex 会被 `verify.mjs` 命中、不会被 ESLint 命中）。

---

## D. TypeScript 核心类型与 Pinia Store 契约 🔒

### D.1 基础几何（**类型**在 `types/geometry.ts`，**转换函数**在 `utils/geometry.ts`）

> **C-3 裁决（2026-10-20）**：§C.1 的「`types/**` 只放类型、零运行时代码」是更强的架构约束，**保留不回退**；
> 因此 `pt2vec` / `vec2pt` 的**归属改为 `src/utils/geometry.ts`**（= 实际实现位置）。
> ⛔ 下游**不得**写 `import { pt2vec } from '@/types/geometry'` —— 该文件不导出它们，会直接编译失败。

```ts
// src/types/geometry.ts —— 纯类型，零运行时代码（§C.1）
/** 紧凑二元组：用于可序列化数据（墙/房间/多边形），与 localStorage 结构逐字对齐（OF §4.1） */
export type Pt = [x: number, y: number];
/** 具名对象：用于交互数学（测量端点、吸附结果） */
export interface Vec2 { x: number; y: number }
/** 轴对齐矩形：[x0, y0, x1, y1]（mm）。原实现大量使用该裸元组，保留以降低迁移风险 */
export type Rect = [x0: number, y0: number, x1: number, y1: number];
export interface Bounds { x: number; y: number; w: number; h: number }

// src/utils/geometry.ts —— 运行时转换函数（C-3 后的**权威归属**）
export type PointLike = readonly [number, number];   // `Pt` 的只读视图，便于传 readonly 数组
export function pt2vec(p: PointLike): Vec2;
export function vec2pt(v: Vec2): Pt;
```

### D.2 户型（`types/plan.ts`）

```ts
export type WallKind = 'b' | 'e' | 'n' | 'low';
export type Wall = [x0: number, y0: number, x1: number, y1: number, kind: WallKind];
/** [x0,y0,x1,y1, 窗台高m?, 窗顶高m?]，缺省 0.9 / 2.4（OF §2.4、§3.2） */
export type Win = [x0: number, y0: number, x1: number, y1: number, sill?: number, head?: number];
export interface Door { name: string; rect: Rect; h: Pt; c: Pt; o: Pt; len: number; entry: boolean }
export interface Slide { rect: Rect; v: boolean }
export interface Room {
  id: string; name: string; poly: Pt[]; mat: MaterialKey;
  at?: Pt;          // 标签锚点；缺省不画标签
  counted?: false;  // 飘窗：排除出使用面积（OF §6.2）
}
export interface DimChain { h: boolean; at: number; segs: number[]; start?: number }
export type Lintel = [x0: number, y0: number, x1: number, y1: number, height: number];
export interface Stair { x: number; y0: number; y1: number; dir: 1 | -1 }
export interface VoidShape { poly: Pt[] }

/** 单层结构：单层户型与复式某一层共用（OF §4.3 第 10 条） */
export interface PlanStructure {
  bounds?: Bounds | null;
  walls: Wall[]; wins: Win[]; doors: Door[]; slides: Slide[]; rooms: Room[];
  dims: DimChain[]; lintels: Lintel[]; stairs: Stair[]; voids: VoidShape[];
}
export type FurnitureFactory = () => Furniture[];
export interface PlanLevel extends PlanStructure { name: string; elev: number; furniture?: FurnitureFactory | null }
export interface Plan extends PlanStructure {
  id: string; name: string; tag: string; builtin?: boolean;
  multilevel?: boolean; levels?: PlanLevel[];
  furn?: FurnitureFactory;   // 仅内置户型的内存字段，不序列化（OF §7.3 stripPlan 白名单）
}
```

### D.3 家具与材料

```ts
export type FurnitureType =
  | 'bed' | 'crib' | 'nightstand' | 'wardrobe' | 'dresser' | 'desk' | 'chair' | 'bookshelf' | 'baycushion'
  | 'sofa' | 'cornersofa' | 'armchair' | 'beanbag' | 'coffeetable' | 'sidetable' | 'tvstand' | 'rug'
  | 'shoecab' | 'floorlamp' | 'plant'
  | 'table' | 'roundtable' | 'island' | 'barstool' | 'counter' | 'stove' | 'ksink' | 'fridge' | 'cabinet'
  | 'toilet' | 'vanity' | 'shower' | 'bathtub' | 'washer' | 'waterheater'
  | 'tv' | 'aircon' | 'acwall' | 'dishwasher' | 'ovencol' | 'dryer' | 'purifier'
  | 'officechair' | 'piano' | 'treadmill';   // 45 项，与 OF §5.1 去重类型数一致

export interface Furniture {
  id: string; type: FurnitureType; name: string;
  cx: number; cy: number;   // 中心（mm，户型坐标系）
  w: number; d: number;     // 宽 / 深（mm）
  rot: number;              // 0..359，平面顺时针
  color: string;            // 内容色（来自家具库或用户改色）
}
export type LibItem = readonly [type: FurnitureType, name: string, w: number, d: number, color: string];
export interface LibCategory { cat: string; items: LibItem[] }

export type MaterialKey = 'wood' | 'walnut' | 'tile800' | 'tile600' | 'marble' | 'antislip' | 'terrazzo' | 'carpet';
export interface MaterialTex { sx: number; sy: number; base: string; grout?: string; rough: number }
export interface Material { key: MaterialKey; name: string; price: number; sw: string; tex: MaterialTex }
```

### D.4 运行状态（`types/state.ts`）

```ts
export interface RoomOverride { name: string; mat: MaterialKey }
export interface Measure { a: Vec2; b: Vec2 }
/** = 一个户型（某层）的布置存档；localStorage 的 `huxing-state-v2-*` 值结构（OF §4.3） */
export interface PlanState { furniture: Furniture[]; rooms: Record<string, RoomOverride>; demolished: string[]; measures: Measure[] }

export type Tool = 'select' | 'measure' | 'demolish';
export type EditMode = 'wall' | 'room' | 'door' | 'win' | 'erase';
export type SnapMode = 'grid' | 'corner' | 'off';
export interface LayerFlags { dims: boolean; labels: boolean; furn: boolean; grid: boolean; bearing: boolean; wallSnap: boolean }
export type Selection = { kind: 'furn'; id: string } | { kind: 'room'; id: string } | null;
export interface ViewTransform { x0: number; y0: number; s: number }
export interface EditState {
  on: boolean; mode: EditMode; kind: WallKind;
  thick: number; doorW: number; winW: number; grid: number;
  snap: SnapMode; ortho: boolean;
  pts: Vec2[]; drag: EditDrag | null; hover: Vec2 | null; rawHover: Vec2 | null; axis: 'h' | 'v' | null;
  savedGridLayer: boolean | null;   // 替代原 edit._grid（L2285 / L2297）
}
export type EditDrag = { a: Vec2; b: Vec2 | null; axis?: 'h' | 'v' | null };
export interface View3dOptions { cut: number; furn: boolean; labels: boolean; night: boolean; hour: number; mode: 'orbit' | 'walk' }
```

### D.5 `usePlanStore`（`stores/plan.ts`）

```ts
export const PRESET_ORDER = ['h3b', 'h2b', 'h3c', 'h4d', 'h1a', 'hloft', 'hblank'] as const;
export const UNDO_STRUCT_LIMIT = 80;      // L2155
export const PLAN_FMT = 'huxing-plan-v1'; // L607
export const PLAN_SET_FMT = 'huxing-plan-v1-set';
export const PLAN_STORE_KEY = 'huxing-plans-v1'; // L608

export const usePlanStore = defineStore('plan', () => {
  // ---- state ----
  const presets = ref<Plan[]>(PRESETS);
  const custom = ref<Plan[]>([]);
  const currentId = ref<string>('h3b');      // 'h3b' = PRESETS[0].id
  const level = ref<number>(0);
  const structHistory = ref<string[]>([]);   // 结构撤销栈（替代 planHist，L866）

  // ---- getters ----
  const allPlans: ComputedRef<Plan[]>;
  const plan: ComputedRef<Plan>;
  const isMulti: ComputedRef<boolean>;
  /** 单层返回 plan 自身，复式返回 levels[level]（替代 levelOf + usePlan，L878-888） */
  const levelData: ComputedRef<PlanStructure & Partial<PlanLevel>>;
  const levelName: ComputedRef<string>;
  const walls: ComputedRef<Wall[]>;
  const wins: ComputedRef<Win[]>;
  const doors: ComputedRef<Door[]>;
  const slides: ComputedRef<Slide[]>;
  const rooms: ComputedRef<Room[]>;
  const dims: ComputedRef<DimChain[]>;
  const lintels: ComputedRef<Lintel[]>;
  const stairs: ComputedRef<Stair[]>;
  const voids: ComputedRef<VoidShape[]>;
  /** 已含复式其它层（切换后显示的是当前层），替代 levelOf(p,0) 的缩略图语义 */
  const bounds: ComputedRef<Bounds>;         // = levelData.bounds ?? plan.bounds ?? boundsOf(levelData)
  const findPlan: (id: string) => Plan | null;

  // ---- actions ----
  function loadFromStorage(): void;                       // 读 huxing-plans-v1（L1902-1907）
  function saveLibrary(): void;                           // 写 {custom, current}（L1908）
  function switchTo(id: string, lv?: number): Promise<void>;  // L1962-1976
  function switchLevel(i: number): void;                  // L1787 / L2626
  function ensureCustom(): Plan;                          // L1991-1999
  function newBlankPlan(): Plan;                          // L2000-2007
  function duplicatePlan(id: string): Plan | null;        // L2008-2025（逐层复制存档）
  function deletePlan(id: string): void;                  // L2026-2040
  function renamePlan(id: string, name: string): void;    // L2041-2046
  /** 结构修改：压 structHistory → 改结构 → 重算 bounds → syncRoomState → 持久化（L2154-2160） */
  function planEdit(mutator: () => void): void;
  function planUndo(): boolean;                           // L2141-2153
  function exportPlan(id: string): PlanFile;              // L2055-2063
  function exportAll(): PlanSetFile;                      // L2064-2072
  function importText(txt: string): number;               // L2073-2096；返回导入条数，0 表示失败
  return { /* 全量导出 */ };
});
```

**契约要点**

- `levelData` **必须是 computed**，⛔ 不得像原实现那样覆写全局 `WALLS/ROOMS`（X2 不保留项）。
- `switchTo` 必须在切换前 `await` 当前存档落盘，并按原语义：先 `endEdit()` → `save()` → 若在 3D 先回 2D → 重置 undo/redo/选中 → `fitView` → toast（OF §1.11）。
- `structHistory` 上限 **80**；`planEdit` 后必须 `layout.syncRoomState()`（原 L2158）。
- `bounds` 变更后**必须**重新 `fitView()`（原 `planEdit` 里 `BOUNDS = boundsOf(...)`，L2157）。

### D.6 `useLayoutStore`（`stores/layout.ts`）

```ts
export const UNDO_LIMIT = 150;                 // L1025
export const LEGACY_STORE_KEY = 'huxing-design-v1';   // L983（必须继续写入以兼容回退，OF §9.5 风险 5）

/** C-8 追认：房间行的公开形状（**定义在 `utils/measure.ts`**，由 `stores/layout.ts` 转出 `export type { RoomRow }`） */
export interface RoomRow { id: string; name: string; mat: MaterialKey; area: number; counted: boolean }

/** C-8 追认：写入结果（定义在 `types/persistence.ts`，等于 SPEC 原文的 'ok'|'quota'|'error'） */
export type SaveStatus = 'ok' | 'quota' | 'error';

// ⚠️ 定义位置以 §D.9 为准：stateKey / stateKeyOf 实际定义在 `utils/persistence.ts`，
//    由 `stores/layout.ts` **转出**（不是定义点）。

export const useLayoutStore = defineStore('layout', () => {
  // ---- state（= PlanState） ----
  const furniture = ref<Furniture[]>([]);
  const rooms = ref<Record<string, RoomOverride>>({});
  const demolished = ref<string[]>([]);
  const measures = ref<Measure[]>([]);
  const undoStack = ref<string[]>([]);
  const redoStack = ref<string[]>([]);
  // ⚠️ 以下是**实现内部记账，不是公开契约**（C-8 更正 verifier 的判断：它们**不在** `return` 块里）：
  //    currentPlanId / currentLevel / currentMulti —— `save()`/`loadFor()` 需要知道"当前是哪个户型哪一层"，
  //    原实现读全局 `PLAN.id`/`lv`，X2 取消全局后必须显式记录。下游 ⛔ 不得依赖这三个 ref。

  // ---- getters（面积/报价口径见 OF §6.2，逐条对齐） ----
  const getF: (id: string) => Furniture | undefined;
  const snapRects: ComputedRef<Rect[]>;        // 未拆墙 + 窗（L908）
  const totalArea: ComputedRef<number>;        // Σ area(room)，排除 counted===false（L1344）
  const roomRows: ComputedRef<RoomRow[]>;      // C-8 追认：改用冻结的 RoomRow 形状（原为内联字面量类型）
  const materialBreakdown: ComputedRef<{ key: MaterialKey; area: number; cost: number }[]>;  // ×1.05（L1372）
  const flooringCost: ComputedRef<number>;
  const demolishedLength: ComputedRef<number>;  // Σ max(dx,dy)/1000（L1375）
  const canUndo: ComputedRef<boolean>;
  const canRedo: ComputedRef<boolean>;

  // ---- actions ----
  function snapshot(): string;                            // = JSON.stringify(state)（L1024）
  function commit(before: string): void;                  // 压栈 + 清 redo + save（L1025）
  function mutate(fn: () => void): void;                  // snapshot → fn → commit（L1026）
  function undo(): boolean;                               // L1027
  function redo(): boolean;                               // L1028
  function save(): Promise<SaveStatus>;                   // ⚠️ 不再静默吞错（X11 不保留项）；C-8 追认改用命名类型
  function loadFor(planId: string, lv: number, multi: boolean): void;
  function defaultState(): PlanState;
  function fixState(raw: unknown): PlanState;             // 纯函数（X8）
  function syncRoomState(): void;                         // L996-1000
  function autoFurnish(): void;                           // L911-974（规则见 OF §1.13）
  function addItem(item: LibItem, x: number, y: number): Furniture;
  function pushOut(f: Furniture): void;                   // L1543-1555
  function toggleWall(id: string): 'removed' | 'restored' | 'blocked-bearing' | 'blocked-exterior';
  function clearLayout(): boolean;
  function rotateSelection(delta: number): void;
  function deleteSelection(): void;
  function duplicateSelection(): Furniture | null;
  function nudgeSelection(dx: number, dy: number): void;
  function bringToFront(id: string): void;
  function sendToBack(id: string): void;
  function selectRoom(id: string): void;                  // ui 联动由调用方负责
  function renameRoom(id: string, name: string): void;
  function setRoomMaterial(id: string, mat: MaterialKey): void;
  function pushMeasure(a: Vec2, b: Vec2): void;
  function clearMeasures(): void;
  function readState(planId: string, lv: number, multi: boolean): PlanState;   // C-8 追认：复式逐层读档（与 loadFor / save 对称）
  return { /* 全量导出 */ };
});
```

**契约要点**

- `save()` 必须**同时**写 `stateKeyOf(...)` 与 `LEGACY_STORE_KEY`（L1023 原语义），并在 `QuotaExceededError` 时返回 `'quota'` 供 UI 提示。
- `toggleWall` 的四种返回值对应原 toast 分支（L1565-1569）。
- `syncRoomState()` 语义：只保留当前户型仍存在的房间 id，用户改过的名称/材质优先保留（L996-1000）。

### D.7 `useUiStore`（`stores/ui.ts`）

```ts
export const layers = reactive<LayerFlags>({ dims: true, labels: true, furn: true, grid: false, bearing: false, wallSnap: true }); // L1018-1019 默认值冻结
export const MIN_SCALE = 0.012, MAX_SCALE = 2;   // L1606（**取值冻结**；定义点见 §D.9 = `stores/ui.ts`）
export const PX_MM = 25.4 / 96;                  // L1002（**取值冻结**；定义点见 §D.9 = `stores/ui.ts`）
export const TAP_PX = COARSE ? 9 : 4;            // L1004（COARSE 来自 `composables/usePointerKind.ts`）
export const SCALE_BAR_STEPS = [100, 200, 500, 1000, 2000, 5000] as const;   // C-8 追认（原 L1594-1596）

export const useUiStore = defineStore('ui', () => {
  const tool = ref<Tool>('select');
  const selection = ref<Selection>(null);
  const measureA = ref<Vec2 | null>(null);
  const measureCur = ref<Vec2 | null>(null);
  const flags = reactive<LayerFlags>({ ...layers });
  const view = reactive<ViewTransform>({ x0: 0, y0: 0, s: 0.06 });       // 初值冻结（L1020）
  const edit = reactive<EditState>({ on: false, mode: 'wall', kind: 'n', thick: 200, doorW: 900, winW: 1500, grid: 100, snap: 'grid', ortho: true, pts: [], drag: null, hover: null, rawHover: null, axis: null, savedGridLayer: null }); // L862-865 默认值冻结
  const viewMode = ref<'2d' | '3d'>('2d');
  const view3d = reactive<View3dOptions>({ cut: 2.8, furn: true, labels: true, night: false, hour: 10, mode: 'orbit' }); // L2694 默认值冻结
  const panes = reactive<{ hideLib: boolean; hidePanel: boolean }>({ hideLib: false, hidePanel: false });
  const switching = ref(false);

  const is3D: ComputedRef<boolean>;
  const ratio: ComputedRef<number>;      // 1/(view.s*PX_MM)（L1592）
  const ratioLabel: ComputedRef<string>;
  const scaleBar: ComputedRef<{ len: number; label: string }>;   // L1594-1596

  function setTool(t: Tool): void;
  function select(sel: Selection): void;
  function toggleLayer(k: keyof LayerFlags): void;
  function applyView(): void;
  function fitView(stageW: number, stageH: number): void;
  function zoomAt(nextScale: number, anchorX: number, anchorY: number): void;
  function zoomCenter(factor: number): void;
  function setRatio(r: number, stageW: number, stageH: number): void;   // 1:60 / 1:100（L1611）
  function startEdit(): void;            // L2278-2293（内置户型 → ensureCustom）
  function endEdit(): void;              // L2294-2301
  function setEditMode(m: EditMode): void;
  function setEditKind(k: WallKind): void;
  function setEditParam(k: 'thick' | 'doorW' | 'winW' | 'grid', v: number): void;
  function setSnap(m: SnapMode): void;
  function toggleOrtho(): void;
  function openDrawer(which: 'lib' | 'panel' | null, open?: boolean): void;   // L1448-1462
  async function setViewMode(m: '2d' | '3d'): Promise<void>;                  // L2558-2567
  function set3dOption<K extends keyof View3dOptions>(k: K, v: View3dOptions[K]): void;
  return { /* 全量导出 */ };
});
```

`useToastStore`（`stores/toast.ts`）：

```ts
export interface ToastItem { id: number; message: string; kind: 'info' | 'warn' | 'danger'; ttl: number }
export const useToastStore = defineStore('toast', () => {
  const items = ref<ToastItem[]>([]);
  function push(message: string, kind?: ToastItem['kind'], ttl?: number): number;  // 默认 ttl 1800ms（L2549）
  function dismiss(id: number): void;
  return { items, push, dismiss };
});
```

`useThemeStore`（`stores/theme.ts`）：

```ts
export type ThemePresetId = 'day' | 'night' | 'contrast';
export const THEME_STORE_KEY = 'huxing-theme-v1';
export const useThemeStore = defineStore('theme', () => {
  const presetId = ref<ThemePresetId>('day');
  const tokens: ComputedRef<ThemeTokens>;
  function setPreset(id: ThemePresetId): void;
  function applyCssVars(el?: HTMLElement): void;                  // 写 --ds-*
  function resolve(name: keyof ThemeTokens): string;               // 解析后的字面值，供 SVG 属性 / 3D / canvas 使用
  return { presetId, tokens, setPreset, applyCssVars, resolve };
});
```

### D.8 持久化键（🔒 逐字冻结，OF §4.2）

| 键 | 归属 store | 结构 | 读写接线（**C-4 裁定：不留白**） |
| --- | --- | --- | --- |
| `huxing-lang` | vue-i18n 初始化（`features/extras/lib/i18n.ts`） | `'en' \| 'zh'` | 🟡 **半接线（已读、未写）→ 归属 t6（features-dev）**。`i18n.ts:26-27` 的 `currentLang()` 已 `readRaw(STORAGE_KEYS.lang)`；**缺**"语言切换时写回"与 `createI18n({messages})` 实例化（`i18n.ts:307` 仍是待办）。原实现 L2660 会写该键 → 属 OF §1.10 的**基线功能**，必须补写侧 |
| `huxing-panes` | `ui.panes` | `{ hideLib?: boolean; hidePanel?: boolean }` | ❌ **完全未接线（无读无写）→ 归属 t3（scaffold-dev）**。`stores/ui.ts:91/223-224/272` 只在内存维护；`utils/persistence.ts:18` 只有键名。读写点就在 t3 交付文件内，且 `readJson`/`writeJson` 已现成，零跨特性依赖 |
| `huxing-plans-v1` | `plan` | `PlanLibraryFile = { custom: Plan[]; current: string }` | ✅ 已接线（`plan.loadFromStorage/saveLibrary`） |
| `huxing-state-v2-<planId>` | `layout`（单层） | `PlanState` | ✅ 已接线（`layout.save/loadFor`） |
| `huxing-state-v2-<planId>-l<level>` | `layout`（复式每层） | `PlanState` | ✅ 已接线（同上，经 `stateKeyOf`） |
| `huxing-design-v1` | `layout`（旧键，**必须继续写**） | `PlanState` | ✅ 已接线（`layout.save` 双写） |
| `huxing-theme-v1`（**新增**，唯一允许新增的键） | `theme` | `ThemePresetId` | ✅ 已接线（`stores/theme.ts`） |

⛔ 禁止新增任何其它 localStorage 键；⛔ 禁止持久化 `ui.flags` / `ui.tool` / `ui.selection`（原实现不持久化，保真）。

### D.9 定义位置权威表（🔒 —— 防"照 SPEC import 却编译失败"）

> 来源：t7 静态验证 A1「定义位置偏移」+ C-3。**取值/签名冻结不变，仅澄清定义点。**
> 规则：下游 `import` 一律按本表；表里写"转出"的，定义点在别处、由该文件 re-export（两种写法都能 import 成功）。

| 成员 | **定义点（权威）** | 转出 / 再导出 | 备注 |
| --- | --- | --- | --- |
| `Pt` / `Vec2` / `Rect` / `Bounds` | `src/types/geometry.ts` | — | 纯类型，零运行时代码（§C.1、C-3） |
| `pt2vec` / `vec2pt` / `PointLike` | **`src/utils/geometry.ts`** | — | **C-3 裁决**：不在 `types/` |
| `stateKey` / `stateKeyOf` | **`src/utils/persistence.ts`** | `stores/layout.ts`（`export { stateKey, stateKeyOf }`） | 两处 import 均可用 |
| `STORAGE_KEYS` | `src/utils/persistence.ts` | — | 键名字面值唯一来源（B6） |
| `MIN_SCALE` / `MAX_SCALE` / `PX_MM` | **`src/stores/ui.ts`**（按 SPEC §D.7 取值） | `stores/ui.ts` 再导出 | ⚠️ 当前实现从 `composables/usePointerKind` import 且那三个常量**尚未定义** → C-1 返工项，见 §K 第 2 条 |
| `COARSE` / `TAP_PX` | `src/composables/usePointerKind.ts` | `stores/ui.ts`（`export { … TAP_PX }`） | `stores/ui.ts` 的再导出契约保留 |
| `LEGACY_STORE_KEY` / `PLAN_STORE_KEY` / `THEME_STORE_KEY` | 取值自 `STORAGE_KEYS` | 各自 store | 字面值相等即可（t7 A1） |
| `SaveStatus` | `src/types/persistence.ts` | — | C-8 追认 |
| `RoomRow` | **`src/utils/measure.ts`** | `stores/layout.ts`（`export type { RoomRow }`） | C-8 追认 |
| `PlanSlice` / `LayoutSlice` / `UiSlice` / `SceneSignatures` / `Scene3DApi` | `src/types/scene3d.ts` | — | C-5 裁定；实现在 `features/scene3d/`，注册通道 `utils/scenePort.ts` |

---

## E. 颜色令牌表（含对比度）

### E.1 目标与实测方法

- 目标：**正文文字 ≥ 4.5:1**、**大字（≥18.66px bold 或 ≥24px）与图形/UI 边界 ≥ 3:1**（WCAG 2.1 SC 1.4.3 / 1.4.11）。
- 下表比值为按 WCAG 2.1 相对亮度公式 `(L1+0.05)/(L2+0.05)` 计算所得。
  ⚠️ **这些数值由 spec-lead 手工计算，必须由 `verifier` 用 `colorjs.io` 的 `contrast()` 程序化复核**（`theme/contrast.ts` 的断言表是唯一裁决者；若复核与下表有出入，以复核结果为准并回写本表）。
- 现状基线（不保留，见 X12）：`--muted:#8a8174` 在 `#fffdf9` 上 = **3.78:1（不达标）**；白字压 `--accent:#b5653a` = **4.30:1（不达标）**。
- **令牌总数口径（🔒 C-8 追认）**：三套预设的键集合**完全一致**，每套 **47 项** = `color-scheme`（1）+ UI 语义（25）+ 2D 图纸（21）。
  下表 E.2/E.4/E.5 是**显式给出 hex 的条目**；未显式列出的条目由**语义等价派生值**补齐（如各 `*-soft` 配套底、夜间/高对比的 2D 图纸令牌、`color-scheme` 的关键字值），
  实现里逐条标注「派生」（见 `theme/tokens.ts`）。`color-scheme` 是 **CSS 关键字**（`light` / `dark`），不是色值，**不参与任何对比度断言**。

### E.2 主题 A：日间（默认，`presetId = 'day'`）

| 令牌 | hex | 用途 | 对比度（对谁） | 目标 | 结论 |
| --- | --- | --- | --- | --- | --- |
| `--ds-color-scheme` | `light`（**CSS 关键字，非色值**） | 原生控件配色（`color-scheme`）；随预设取 `light` / `dark` | — | 不适用（**不参与对比度断言**，因为它不是颜色） | ✅ C-8 追认 |
| `--ds-bg` | `#f2ede4` | 应用底色 | — | — | 背景 |
| `--ds-surface` | `#fffdf9` | 面板 / 卡片 / 工具栏 | — | — | 表面（正文基准） |
| `--ds-surface-2` | `#faf6ef` | 内嵌块（`.stats` / 缩略图底） | — | — | 次级表面 |
| `--ds-canvas` | `#f7f4ee` | 2D 画布 / 3D 室外地面 | — | — | 画布基准（图形对比基准） |
| `--ds-border` | `#e0d8c9` | 装饰性分隔线（1px） | 1.39:1 on surface | 豁免（装饰性，不承载信息） | ⚠️ 仅装饰，**不得**用于输入框/控件边界 |
| `--ds-border-strong` | `#93856c` | 输入框、控件边界、需要被看见的分隔 | 3.56:1 on surface / 3.10:1 on bg / 3.29:1 on canvas | ≥3:1（图形） | ✅ |
| `--ds-focus-ring` | `#2f5d62` | 键盘焦点环（2px + 2px offset） | 7.22:1 on surface | ≥3:1 | ✅ |
| `--ds-text` | `#241f1a` | 正文 / 标题 | **16.07:1** on surface / **14.01:1** on bg | ≥4.5:1 | ✅ |
| `--ds-text-secondary` | `#574f45` | 次要文字（说明、房间面积小字） | **7.92:1** on surface / **6.90:1** on bg | ≥4.5:1 | ✅ |
| `--ds-text-muted` | `#6d6459` | 三级文字（提示、`<small>`） | **5.71:1** on surface / **4.98:1** on bg / **5.29:1** on canvas | ≥4.5:1 | ✅ |
| `--ds-on-accent` | `#ffffff` | 主色按钮上的文字 | **5.89:1** on `--ds-accent` | ≥4.5:1 | ✅ |
| `--ds-accent` | `#9c4f28` | 主色（按钮、金额、选中） | **5.80:1** on surface / **5.05:1** on bg / **5.37:1** on canvas | ≥4.5:1（作为文字时） | ✅ |
| `--ds-accent-hover` | `#83401f` | 主色 hover / 按下 | 白字 **7.72:1** | ≥4.5:1 | ✅ |
| `--ds-accent-active` | `#6d3416` | 主色 active | 白字 ≥7.7:1（更深） | ≥4.5:1 | ✅ |
| `--ds-accent-soft` | `#f6e7db` | 主色浅底（chip.on / 选中底色） | accent 文字其上 **4.87:1**；正文其上 **13.51:1** | ≥4.5:1 | ✅ |
| `--ds-accent-2` | `#2f5d62` | 强调色（进行中测量、对角吸附提示） | **7.22:1** on surface / **6.68:1** on canvas | ≥4.5:1（文字）/ ≥3:1（图形） | ✅ |
| `--ds-accent-2-soft` | `#e3ecec` | 强调色浅底 | accent-2 文字其上 ≈6.3:1 | ≥4.5:1 | ✅【待复核】 |
| `--ds-success` | `#2e6b41` | 成功 / 校验通过 | **6.27:1** on surface | ≥4.5:1 | ✅ |
| `--ds-success-soft` | `#e2efe6` | 成功浅底 | — | — | 配套底 |
| `--ds-warning` | `#8a5a00` | 警告 / 校验提醒 | **5.83:1** on surface | ≥4.5:1 | ✅ |
| `--ds-warning-soft` | `#f8ecd6` | 警告浅底 | — | — | 配套底 |
| `--ds-danger` | `#b3372a` | 危险 / 删除 / 校验错误 | **5.91:1** on surface；白字其上 **6.00:1** | ≥4.5:1 | ✅ |
| `--ds-danger-soft` | `#fbe4e0` | 危险浅底 | — | — | 配套底 |
| `--ds-info` | `#2f5d62` | 信息 | **7.22:1** on surface | ≥4.5:1 | ✅ |
| `--ds-info-soft` | `#e3ecec` | 信息浅底 | — | — | 配套底 |

### E.3 2D 图纸专用令牌（图形，目标 ≥3:1，基准 `--ds-canvas`）

> 这些令牌**必须**在 `theme/tokens.ts` 中定义并写入 SVG 呈现属性（见 B9 / F.6）。

| 令牌 | hex | 用途 | 对比度 on `#f7f4ee` | 目标 | 结论 |
| --- | --- | --- | --- | --- | --- |
| `--ds-plan-grid-minor` | `#e5dfd3` | 编辑网格细线 | 1.22:1 | 装饰（豁免，**不得**承载信息） | ⚠️ |
| `--ds-plan-grid-major` | `#d8d0c1` | 编辑网格主线 | 1.44:1 | 同上 | ⚠️ |
| `--ds-wall-bearing` | `#26241f` | 承重墙 | **14.12:1** | ≥3:1 | ✅ |
| `--ds-wall-bearing-hl` | `#b8412c` | 承重墙高亮（`bearing` 图层开） | **4.99:1** | ≥3:1 | ✅ |
| `--ds-wall-exterior` | `#8f897d` | 外墙 | **3.17:1** | ≥3:1 | ✅（原值保留） |
| `--ds-wall-partition` | `#8b8375` | 非承重墙 | **3.41:1** | ≥3:1 | ✅（**原 `#a7a195` 仅 2.34:1，不达标，必须替换**） |
| `--ds-wall-low` | `#e9e3d8`（**填充**） | 矮墙**填充**（仅视觉面） | 1.16:1 on canvas | **装饰豁免**（见下方权威清单） | ⚠️ 不承载信息，⛔ 不得单独承载"矮墙"语义 |
| `--ds-wall-low-stroke` | `#8f897d`（**描边**） | 矮墙**描边**（承载"矮墙"语义） | **3.17:1** on canvas | ≥3:1 | ✅ **C-2 裁定：只校验描边** |
| `--ds-wall-demolished` | `#c65b3a` | 已拆墙体描边 | **3.86:1** | ≥3:1 | ✅ |
| `--ds-window` | `#4f7394` | 窗框 / 分格线 | **4.54:1** | ≥3:1 | ✅ |
| `--ds-door` | `#3d3a34` | 门扇 / 开启弧 | **10.32:1** | ≥3:1 | ✅ |
| `--ds-door-entry` | `#9c4f28`（= accent） | 入户门 + 入户标识 | **5.37:1** | ≥3:1 | ✅ |
| `--ds-dim-line` | `#7d7160` | 尺寸标注线 / 文字 | **4.34:1** | ≥3:1（图形） | ✅ |
| `--ds-measure` | `#9c4f28`（= accent） | 已落库测量线 | **5.37:1** | ≥3:1 | ✅（原 `#b5653a` 3.91:1，也可达标；统一用 accent 更一致） |
| `--ds-measure-pending` | `#2f5d62` | 进行中测量线 / 起点 | **6.68:1** | ≥3:1 | ✅ |
| `--ds-snap-grid` | `#c65b3a` | 网格吸附提示（圆环/贯穿线） | **3.86:1** | ≥3:1 | ✅ |
| `--ds-snap-corner` | `#2f5d62` | 墙角吸附提示 | **6.68:1** | ≥3:1 | ✅ |
| `--ds-room-label` | `#241f1a` | 房间名（房间图案之上） | 最差 ≈**8.42:1**（橡木地板 `#dcc09a`） | ≥4.5:1 | ✅ |
| `--ds-room-label-sub` | `#574f45` | 房间面积小字 | 最差 ≈**4.62:1**（橡木地板） | ≥4.5:1 | ✅（**原 `#7d7366` 在地毯上仅 2.71:1，不达标，必须替换**） |
| `--ds-room-label-halo` | `#fbf9f4` | 房间标签文字的**描边光晕**（原 L1258-1260 的 `stroke` + `paint-order="stroke"`） | 对 `--ds-room-label` **15.52:1**；对 `--ds-room-label-sub` **7.65:1** | ≥4.5:1（作为文字底衬） | ✅ C-8 追认；主题间**不变**（ADR-10：画在内容色图案上） |
| `--ds-room-void` | `#b5653a` @6% 填充 / `#b5653a` 描边 | 挑空区 | 描边 3.91:1 | ≥3:1 | ✅ |

> **装饰豁免清单（权威，🔒 冻结 —— C-2 / C-6 统一口径）**
>
> 以下 **4 项**不承载信息，**豁免** ≥3:1 的图形对比要求，也**不参与** `contrast.ts` 的断言生成：
> `border`、`plan-grid-minor`、`plan-grid-major`、**`wall-low`（仅填充；`wall-low-stroke` 照常断言）**。
>
> - 对应实现：`theme/tokens.ts` 的 `DECORATIVE_TOKEN_NAMES` **必须逐字包含这 4 项**。
>   ⚠️ 当前实现只含前 3 项 → 这是 **C-2 的返工项**（见 §K 第 1 条）。
> - ⛔ 这 4 项不得用于输入框/控件边界，不得单独承载语义。
> - 依据（可复核）：原实现矮墙本就是「浅色填充 + 深色描边」两件套（`装修设计.html` L1210-1211：`fill=#e9e3d8` + `stroke=#8f897d`），
>   承载"矮墙"这一信息的一直是**描边**；若把填充压到 3:1（≈`#93856c` 或更深），它会与非承重墙 `wall-partition`（`#8b8375`，3.41:1）撞色，
>   破坏 OF §2.3 的墙体色阶层级。**因此选"填充豁免"，不改 hex。**

### E.4 主题 B：夜间（`presetId = 'night'`）

| 令牌 | hex | 对比度 | 结论 |
| --- | --- | --- | --- |
| `--ds-bg` | `#171a21` | — | 背景 |
| `--ds-surface` | `#1f232b` | — | 表面 |
| `--ds-surface-2` | `#262b34` | — | 次级表面 |
| `--ds-canvas` | `#1b1f27` | — | 画布 |
| `--ds-border` | `#333a45` | 装饰 | ⚠️ 豁免 |
| `--ds-border-strong` | `#6b7686` | **3.42:1** on surface / **3.78:1** on bg | ✅ |
| `--ds-text` | `#eef1f5` | **13.90:1** on surface / **15.37:1** on bg | ✅ |
| `--ds-text-secondary` | `#c2c8d2` | **9.36:1** on surface | ✅ |
| `--ds-text-muted` | `#97a0ad` | **5.96:1** on surface / **6.59:1** on bg | ✅ |
| `--ds-accent` | `#e08b5c` | **6.01:1** on surface | ✅ |
| `--ds-accent-hover` | `#f0a077` | **7.50:1** on surface | ✅ |
| `--ds-on-accent` | `#1b1f27` | **7.50:1** on `--ds-accent`（深色底上用深字，非白字） | ✅ |
| `--ds-accent-soft` | `#3a2a20` | accent 文字其上 ≈5.0:1 | ✅【待复核】 |
| `--ds-success` | `#6fbf8b` | **7.13:1** on surface | ✅ |
| `--ds-warning` | `#e0b062` | **7.92:1** on surface | ✅ |
| `--ds-danger` | `#ef8073` | **6.00:1** on surface | ✅ |
| `--ds-info` | `#7fb3b8` | **6.78:1** on surface | ✅ |
| `--ds-accent-2` | `#7fb3b8`（= info） | **6.78:1** | ✅ |
| 2D 图纸令牌 | 由 `--ds-accent / --ds-accent-2 / --ds-border-strong` 派生；承重墙改用 `#eef1f5`，外墙 `#8a93a0`，非承重墙 `#5f6875` | 均在 `#1b1f27` 上 ≥3:1 | ✅【待复核】 |

> 夜间主题**必须**同步 3D：场景背景、地面色、`toneMappingExposure`（原夜景 1.25 / 日间 1.05，L3612）、`envK=0.15`（L3613）。3D 既有的独立「夜景」开关（`ui.view3d.night`）**保留且与主题解耦**——两者可同时开，互不覆盖（ADR-08）。3D 侧材质基色与主题的联动**强制要求**见 **E.8**。

### E.5 主题 C：高对比（`presetId = 'contrast'`）

| 令牌 | hex | 对比度 on `#ffffff` | 结论 |
| --- | --- | --- | --- |
| `--ds-bg` / `--ds-surface` / `--ds-canvas` | `#ffffff` | — | 纯白底 |
| `--ds-surface-2` | `#f2f2f2` | — | 次级表面 |
| `--ds-border` / `--ds-border-strong` | `#000000` | **21:1** | ✅ |
| `--ds-focus-ring` | `#000000` | **21:1** | ✅ |
| `--ds-text` | `#000000` | **21:1** | ✅ |
| `--ds-text-secondary` | `#1a1a1a` | **17.41:1** | ✅ |
| `--ds-text-muted` | `#3d3d3d` | **10.86:1** | ✅ |
| `--ds-accent` | `#7a2f0c` | **9.38:1**（作为文字）；白字其上 **9.38:1** | ✅ |
| `--ds-accent-hover` | `#5c2208` | ≥11:1 | ✅ |
| `--ds-on-accent` | `#ffffff` | **9.38:1** | ✅ |
| `--ds-accent-soft` | `#ffe8dc` | accent 文字其上 ≈8.3:1 | ✅【待复核】 |
| `--ds-accent-2` / `--ds-info` | `#14343a` | **13.27:1** | ✅ |
| `--ds-success` | `#14532d` | **9.11:1** | ✅ |
| `--ds-warning` | `#6b3f00` | **8.99:1** | ✅ |
| `--ds-danger` | `#8f1d14` | **8.92:1** | ✅ |

### E.6 旧变量 → 新令牌映射（迁移对照）

| 原 `:root` 变量（L13-14） | 新令牌 | 变化 |
| --- | --- | --- |
| `--bg:#f3efe7` | `--ds-bg:#f2ede4` | 微降明度以提升白字/边框对比 |
| `--paper:#f7f4ee` | `--ds-canvas:#f7f4ee` | 同名同值 |
| `--panel:#fffdf9` | `--ds-surface:#fffdf9` | 同名同值 |
| `--line:#e3dccf` | `--ds-border:#e0d8c9` + **新增** `--ds-border-strong:#93856c` | 装饰线与控件边界分离（原实现混用，不满足 3:1） |
| `--ink:#2b2824` | `--ds-text:#241f1a` | 加深，留出主题化余量 |
| `--muted:#8a8174` | `--ds-text-muted:#6d6459` + **新增** `--ds-text-secondary:#574f45` | **修复 3.78:1 → 5.71:1**；补二级文字层级 |
| `--accent:#b5653a` | `--ds-accent:#9c4f28` + `--ds-accent-hover:#83401f` | **修复白字 4.30:1 → 5.89:1** |
| `--accent-soft:#f3e3d8` | `--ds-accent-soft:#f6e7db` | 微调，保证 accent 文字其上 ≥4.5:1 |
| `--teal:#2f5d62` | `--ds-accent-2:#2f5d62` / `--ds-info:#2f5d62` | 拆成"强调色"与"信息色"两个语义位（可分别主题化） |
| 散落硬编码（`#b3372a` L37、`#f2ece2` L32、`#faf6ef` L105 等） | `--ds-danger` / `--ds-accent-soft` / `--ds-surface-2` | 全部收敛到令牌 |

### E.7 对比度守门测试（P0-1 验收条件）

`src/theme/contrast.ts` 必须导出可测的断言表，`vitest` 中逐条 `expect(ratio).toBeGreaterThanOrEqual(min)`：

```ts
export interface ContrastPair { id: string; fg: keyof ThemeTokens; bg: keyof ThemeTokens; min: number; kind: 'text' | 'large' | 'graphic' }
export const CONTRAST_ASSERTIONS: Record<ThemePresetId, ContrastPair[]>;
export function contrastRatio(fg: string, bg: string): number;   // 基于 colorjs.io
```

最低必测组合（三套主题各跑一遍）：

1. `text` on `surface` ≥ 4.5；2. `text` on `bg` ≥ 4.5；3. `text-secondary` on `surface` ≥ 4.5；
4. `text-muted` on `surface` ≥ 4.5；5. `text-muted` on `bg` ≥ 4.5；6. `on-accent` on `accent` ≥ 4.5；
7. `accent` on `surface` ≥ 4.5（accent 作为文字）；8. `accent` on `accent-soft` ≥ 4.5（chip）；
9. `border-strong` on `surface` ≥ 3；10. `border-strong` on `bg` ≥ 3；11. `focus-ring` on `surface` ≥ 3；
12. `success / warning / danger / info` on `surface` ≥ 4.5；13. 全套 2D 图纸令牌 on `canvas` ≥ 3（图形）。

**断言生成规则（🔒 冻结 —— C-2 裁定，实现须与此逐字一致）**

```ts
// theme/contrast.ts
PLAN_TOKEN_NAMES
  .filter(n => !DECORATIVE_TOKEN_NAMES.includes(n))   // ← 必须含 'wall-low'
  .filter(n => !['room-label','room-label-sub','room-label-halo'].includes(n))
  .map(n => [`plan:${n}`, n, 'canvas', 3, 'graphic'])
```

- `DECORATIVE_TOKEN_NAMES` 的权威内容 = E.3 的**装饰豁免清单**（`border` / `plan-grid-minor` / `plan-grid-major` / `wall-low`）。
- 房间标签三枚令牌**不**对 canvas 断言，改为：`room-label on room-label-halo ≥ 4.5`、`room-label-sub on room-label-halo ≥ 4.5`
  （底衬是**内容色地板图案**，不是 canvas；halo 才是它们真正的底衬 —— ADR-10）。
- `color-scheme` **不生成任何断言**（CSS 关键字，非颜色）；它不在 `PLAN_TOKEN_NAMES` 内，天然排除。
- ⛔ 对装饰豁免项生成 ≥3 断言会使 `contrast.spec.ts` 三套全红、G.3#14（P0-1 验收）**不可能成立**。

### E.8 3D 与主题联动（**强制要求**，captain 规格约束 2026-10-20）

> **背景事实**：原文 3D 侧有 **40+ 处**硬编码颜色 `mat('#...')`，散布在 `装修设计.html` **L2902–3423**（家具与建筑材质）；`renderer.toneMappingExposure` 在 **L3612**（日 1.05 / 夜 1.25）；`scene.background`、`ground.material.color`、`hemi.intensity`、`sun.color/intensity`、`envK` 在 **L3603-3616**。
> **若不收敛，则"配色优化"在 3D 侧等于没做**——切换主题时只有 UI 变色、3D 场景原样，评审会直接打回。

| # | 强制要求 | 验收方式 |
| --- | --- | --- |
| T1 | 新建 `src/theme/material-palette.ts`，是 **3D 材质基色的唯一来源**，按语义分组导出：`wood.oak / wood.walnut`、`metal.base / metal.chrome / metal.hardware / metal.black`、`surface.ceramic / mirror / glass / frame / cap / wall / skirt / edge`、`light.glow / light.screen`、`fabric.*` | 文件存在且被 `features/scene3d/**` 引用 |
| T2 | `features/scene3d/**`（含 `furniture/*.ts`、`architecture.ts`、`materials.ts`）⛔ **不得出现任何十六进制字面值**；一律经 `deps.palette.xxx` 或 `theme` 令牌取色 | 全仓 grep 十六进制：仅允许白名单文件（`theme/**`、`features/plan2d/patterns.ts`、`data/materials.ts`） |
| T3 | 以下项**必须随 `theme.presetId` 变化**：`scene.background`、`ground.material.color`、`renderer.toneMappingExposure`、`hemi.intensity`、`sun.color`、`sun.intensity`、`envK`、`wallMat / capMat / frameMat / skirtMat / edgeMat` | 切换主题后 3D 截图必须产生可测差异（非空 diff） |
| T4 | 更新机制：`theme.setPreset()` → `applyCssVars()` + `scene.applyTheme(tokens)`；**只更新材质/光照/曝光，不重建几何**；材质更新后需置 `needsUpdate` 并刷新 `envMapIntensity`（对应原 L3613 的就地刷新） | 切换主题耗时应 < 100ms，且不触发 `buildArch/buildFurn` |
| T5 | `.rlabel`（CSS2D 房间标签）是 **DOM**，其颜色/背景/边框**必须来自 `--ds-*` 变量**（与 2D 一致） | 3D 标签在深浅主题下均可读 |
| T6 | 家具**内容色**（用户的 `Furniture.color`、`MATS[].sw`、贴图色彩）**不随主题变**（ADR-10） | 切主题后家具自定义色保持不变 |
| T7 | 与 `ui.view3d.night` 的关系按 **ADR-08**：`view3d.night` 覆盖"光照/曝光/背景"，但**不覆盖材质基色**；两者可同时开启 | 组合矩阵（主题 day/night × 夜景 开/关）四项均表现合理 |

---

## F. 2D 与 3D 的接口契约 🔒

### F.1 单一事实来源

| 状态 | 归属 | 2D 读取 | 3D 读取 | 可写方 |
| --- | --- | --- | --- | --- |
| 户型结构（walls/wins/doors/slides/rooms/dims/lintels/stairs/voids/bounds） | `usePlanStore` | ✅ | ✅ | `plan.planEdit` / `importText` / `switchTo` |
| 当前户型 id / 楼层 | `usePlanStore` | ✅ | ✅ | `switchTo` / `switchLevel` |
| 布置（furniture / rooms 覆盖 / demolished / measures） | `useLayoutStore` | ✅ | ✅ | `layout.*`（含 3D 拖拽后 `commit`） |
| 工具 / 选中 / 图层 / 视图变换 / 编辑态 / viewMode / view3d 选项 | `useUiStore` | ✅ | ✅（仅 `view3d` 与 `selection`） | `ui.*` |
| 主题令牌 | `useThemeStore` | ✅ | ✅ | `setPreset` |

⛔ **禁止**：2D 组件持有结构数据副本；3D 组件持有 `furniture` 副本；任何一方直接改对方组件内部状态（原实现靠全局数组暗通，X2 不保留项）。

### F.2 重建触发矩阵（替代原 `renderAll()`，OF §0.3 / §2）

| 2D 图层 | 依赖（watch 源） | 是否含 `state.furniture` |
| --- | --- | --- |
| `GridLayer` | `ui.flags.grid` | 否 |
| `RoomLayer` | `plan.rooms`、`layout.rooms`、`plan.stairs`、`plan.voids`、`ui.edit.on` | **否** |
| `FurnitureLayer` | `layout.furniture`、`ui.flags.furn` | 是（唯一） |
| `WallLayer` | `plan.walls`、`layout.demolished`、`ui.flags.bearing` | **否** |
| `OpeningLayer` | `plan.wins`、`plan.doors`、`plan.slides`、`plan.bounds`、`plan.doors(entry)` | **否** |
| `LabelLayer` | `plan.rooms`、`layout.rooms`、`ui.flags.labels` | **否** |
| `DimLayer` | `plan.dims`、`plan.walls`、`ui.flags.dims` | **否** |
| `MeasureLayer` | `layout.measures`、`ui.measureA`、`ui.measureCur`、`ui.view.s` | **否** |
| `SelectionLayer` | `ui.selection`、`layout.furniture`、`ui.view.s` | 部分是（按 id 查） |
| `EditLayer` | `ui.edit.*`、`ui.view`、`plan.walls`、`plan.rooms`（吸附源） | **否** |

**硬约束**：拖动家具时，**只有** `FurnitureLayer` 与 `SelectionLayer` 允许重算。这是对原实现「`renderAll` 全量重建」的明确改进（原实现每次拖动都走 `renderFurn()+renderSel()`，L1749；但 `renderAll()` 会连带重建全部图层）。

### F.3 3D 重建契约（三签名，逐字保留原语义，L3585-3591）

```ts
// types/scene3d.ts —— 依赖倒置：接口定义在 types/（纯类型），实现在 features/scene3d/，
//                    注册通道在 utils/scenePort.ts（B5 规定 stores/** ⛔ import features/**）
export interface PlanSlice { plan: Plan; level: number; stairs: readonly unknown[] }
export interface LayoutSlice { rooms: Record<string, RoomOverride>; demolished: readonly string[]; furniture: readonly Furniture[] }
export interface UiSlice { view3d: View3dOptions }

// features/scene3d/engine.ts
export interface SceneSignatures { arch: string; furn: string; labels: string }
export function computeSignatures(
  plan: PlanSlice, layout: LayoutSlice, ui: UiSlice
): SceneSignatures;
// arch   = JSON.stringify([layout.rooms, layout.demolished, ui.view3d.cut, plan.plan.id, plan.level, plan.stairs.length])
// furn   = JSON.stringify(layout.furniture)
// labels = JSON.stringify([layout.rooms, ui.view3d.cut, plan.plan.id, plan.level])
```

> **C-5 裁定**：入参类型名以代码为准 = **`PlanSlice` / `LayoutSlice` / `UiSlice`**（`src/types/scene3d.ts:16/22/28`），
> 原文的 `PlanStoreSlice / LayoutStoreSlice / UiStoreSlice` **作废**（改前 → 改后：`*StoreSlice` → `*Slice`）。
> 三签名的**内容**与切片**字段**在原文与代码间逐字一致，仅类型名不符；下游按本块 import 即可。

- `Scene3D.vue` 用 `watch` 监听上述源（`{ deep: true }` 仅在 `furniture` 上），签名变化才调用 `buildArch()` / `buildFurn()` / `buildLabels()`。
- 3D **不活跃**（未进入 3D）时，收到变化只标记 `dirty`，不重建；`enter()` 时强制 `force = true`。
- ⛔ 3D ⛔ 不得调用任何 2D 渲染函数；2D ⛔ 不得调用 `Scene3D` 内部函数（**取消原 `window.View3D?.sync()` 的反向依赖**，L1340）。

### F.4 `Scene3DApi`（组件暴露给外部的唯一接口）

```ts
// features/scene3d/Scene3D.vue  →  defineExpose
export interface Scene3DApi {
  /** 进入 3D：从当前 2D 视口位姿交叉淡入（原 L3670-3689） */
  enter(ctx: { view: ViewTransform; stageW: number; stageH: number }): Promise<void>;
  /** 退出 3D：压平为正俯视后淡出（原 L3690-3706） */
  exit(): Promise<void>;
  /** 3D 截图（原 shot()，L3888） */
  shot(): void;
  /** 屏幕坐标 → 地面户型坐标 + 该处每个 mm 的屏幕像素（原 groundAt，L3728-3741） */
  groundAt(clientX: number, clientY: number): { x: number; y: number; s: number } | null;
  flyToRoom(roomId: string): void;      // 原 L3660-3667
  iso(): void;                          // 原 isoWhole()，L3634
  top(): void;                          // 原 topWhole()，L3635
  walking(): boolean;                   // 原 L3892（键盘守卫用，L1779）
  relabel(): void;                      // 语言切换后重建 CSS2D 标签（原 relang，L3890）
}
```

**调用方**：`useUiStore.setViewMode()`、`AppHeader`（`截图/斜视/俯视`）、`composables/useShortcuts`（键盘守卫）、`FurnitureLibrary`（3D 落点）。

### F.5 跨视图共享的行为契约

| 行为 | 契约 | 原证据 |
| --- | --- | --- |
| 家具库拖到 3D 地面 | `FurnitureLibrary` → `scene.groundAt(x,y)` → `layout.addItem(item, p.x, p.y)` | L1836, L1861-1862 |
| 3D 内拖动已选中家具 | `scene3d` 调 `layout` 的 `snapMove(f, x, y)` 写 `f.cx/cy`（拖动中只挪模型），松手 `layout.commit(before)` | L2754-2774 |
| 3D 点击选中 | `ui.select({kind:'furn'|'room', id})` 或 `ui.select(null)` | L2786-2788 |
| 门开关 | 纯 3D 内部状态（`door.open`），**不进 store、不进撤销栈** | L3543, L3882 |
| 2D 点房间 → 3D 飞行 | `ui.select({kind:'room'})` 后若 `ui.is3D` 调 `scene.flyToRoom(id)` | L930, L1415 |
| 进入 3D 时 | 强制 `ui.setTool('select')`、清空测量起点、暂停 2D 交互 | L2563 |
| 编辑模式下 | 3D 相关入口不可用（`only3d` 隐藏），`Scene3D` 保持 dirty 不重建 | L120 |

### F.6 导出契约（高风险点，必须遵守）

| 规则 | 说明 |
| --- | --- |
| **R-EXP-1** | 2D 图层渲染的颜色必须是**解析后的字面值**（`theme.resolve('accent')` → `'#9c4f28'`），写进 SVG **呈现属性**（`fill` / `stroke`）。⛔ 禁止 `fill="var(--ds-accent)"`（SVG 属性不支持 `var()`，且会导致导出丢色）。 |
| **R-EXP-2** | 字体族与字号沿用属性写法（原 `font-family` 在 `<svg>` 上，L356），导出时需内联为 `font-family="…"` 以保字形一致。 |
| **R-EXP-3** | PNG 导出流程保留原语义：克隆图层组 → 设 `viewBox=plan.bounds` → 宽 3200px → 清空选中层 → **背景矩形用 `theme.resolve('canvas')`**（替换原硬编码 `#f7f4ee`，L1886-1888）→ `Image` → `canvas` → `toBlob`。 |
| **R-EXP-4** | 3D 截图依赖 `preserveDrawingBuffer: true`（L2705），⛔ 不得为性能关闭。 |
| **R-EXP-5** | 新增 SVG 导出（P0-6）复用同一套「克隆 + 内联令牌字面值 + 命名空间 `xmlns`」，文件头写 `<!-- generated by decoration-studio; units: mm -->`。 |

### F.7 事件与生命周期契约

| 项 | 契约 | 原证据 |
| --- | --- | --- |
| 渲染循环 | `Scene3D` 挂载**不**启动 `requestAnimationFrame`；`enter()` 启动，`exit()` 后 `cancelAnimationFrame`；`onUnmounted` 必须无条件停循环 | L3678, L3703, L3874 |
| Resize | 2D：`useResizeObserver` 于 `<svg>`/stage，首次尺寸 `fitView()`、后续保持中心（原 L2652-2657）；3D：同一个 observer 更新 `renderer.setSize` / `camera.aspect` | L2652-2657, L2790-2793 |
| 全屏/横竖屏 | 由 `@vueuse/core%useFullscreen` + `useEventListener('fullscreenchange')` 处理 | L2602 |
| 越界手势 | 必须阻止 iPad Safari 整页缩放：在 `document` 上 `preventDefault` `gesturestart/change/end` | L1761 |
| 页面级拖拽 | 家具库用 pointer 事件（⛔ 不用 HTML5 DnD），窗口级 `pointerup/pointercancel` 必须解绑 | L1821-1876 |
| 指针类型 | `COARSE` / `TAP_PX` 由 `composables/usePointerKind.ts` 单点定义，⛔ 不得在组件内重复 `matchMedia` | L1003-1004 |

---

## G. 实施顺序与技术风险

### G.1 实施顺序（与共享任务表对齐）

| 阶段 | 任务 | 交付 | 出口条件（Gate） |
| --- | --- | --- | --- |
| 0 | **t1（本任务）** | `docs/ORIGINAL-FEATURES.md` + `docs/SPEC.md` | ✅ 本文件 D/E/F 三节契约冻结；下游可照做 |
| 1 | **t3 scaffold-dev** | 工程骨架 + `types/**` + `stores/**`（签名与 D 节逐字一致，内部可为空实现）+ `theme/**`（E 节令牌 + M3 生成 + 对比度断言测试）+ 主题空壳组件占位 | `pnpm build` 通过；`pnpm test` 中对比度断言全绿；类型全部可 `import`。⚠️ **命令不可执行时的替代路径或标注见下方「执行环境」** |
| 2a | **t4 plan2d-dev**（依赖 t3） | `features/plan2d/**` + `components/FurnitureLibrary/PropertyPanel` | OF §1–§2 逐项可用；快捷键表 30 项对齐；`localStorage` 读写与旧数据互通（用真实旧存档验证） |
| 2b | **t5 scene3d-dev**（依赖 t3，与 2a 并行） | `features/scene3d/**` | OF §3 逐项可用；三签名重建生效；组件卸载后无泄漏（`renderer.info.memory` 归零 + 监听器数归零） |
| 2c | **t6 features-dev**（依赖 t3，与 2a/2b 并行） | `features/extras/**` + **P0 全部（P0-1…P0-9）+ P1-2/P1-3/P1-4**；**P1-1（PDF）视成本选择性实现** | OF §7 导入导出保真；P0 每项有可解析产物；P1-1 若未实现需在交付说明中写明并保留 `export-pdf.ts` 接口占位 |
| 3 | **t7 verifier** | 独立验证报告 | 构建可复现、双视图可渲染、主题对比度实测、导出产物可解析、OF 抽查 ≥10 条 |
| 4 | **t8 reviewer** | 分级问题清单 | blocker/high 全部有归属与修复建议 |
| 5 | **t9 spec-lead** | `README.md` / `MIGRATION.md` / `ROADMAP.md`；按需补一次**中文**提交 | 文档命令与 `package.json` 一致；blocker 闭环说明；附 `git log -1 --format=%H%n%s`（见 J3） |
| 6 | **t10 scaffold-dev（发布）** | `git init -b main`、首次中文提交、`git push -u origin main`（依赖 t1 + t3） | 推送成功且 remote 指向 J1；**先按 J4 排查 `.gitconfig` 的 `insteadOf` 重写** |

**建议的日内顺序（2a/2b/2c 内部）**

- t4：`geometry.ts` → `patterns.ts` → `furniture-svg.ts` → 图层组件（Grid→Room→Wall→Opening→Furniture→Label→Dim）→ `PlanCanvas` 交互（pan/zoom/select）→ 测量 → 拆改 → 图例/拖放 → 撤销/持久化 → 结构编辑 → 快捷键。
- t5：`engine.ts`（生命周期/dispose 优先，先立规矩）→ `materials.ts`（材质缓存 + Canvas 贴图）+ 从 `theme/material-palette.ts` 取色 → `primitives.ts` → `architecture.ts` → `furniture/*`（按分组，先 bed/seating/storage 验证模式）→ `camera.ts` → `lighting.ts`（含 P0-9 主题联动）→ `picking.ts` → `labels.ts` → `walk.ts`。
- t6：`validate.ts`（P0-4）→ `export-csv/xlsx`（P0-3）→ `PlanCompare`（P0-5）→ `export-svg`（P0-6）→ `export-dxf`（P0-7）→ `HistoryPanel`（P0-8）→ 3D 主题联动收口（P0-9，与 t5 联调）→ `CommandPalette`（P1-3）→ 打印样式（P1-4）→ `export-pdf`（P1-1，**可选**）。`room-detect`（P2-5）本版不实现。

### G.1.1 执行环境（**影响验收条件写法，必读**）

本会话 **`pwsh` 工具完全不可用**：任何命令都返回 `exit code 3221225794`（`STATUS_DLL_INIT_FAILED` = DLL 初始化失败），captain 已实测确认。因此：

1. **任何"运行命令"的验收项都不得预设一定能跑。**必须二选一处理：
   - **替代路径**：改用 DSH 自带 runtime 的绝对路径调用 node/pnpm，例如
     `C:\Users\Admin\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe` 与
     `...\pnpm\bin\pnpm.mjs`（`node.exe <pnpm.mjs> install`）；若该路径在本机仍不可用，继续下一条。
   - **标注未验证**：在报告/交付说明中明确写「**未验证**：`pwsh` 不可用（`STATUS_DLL_INIT_FAILED`），命令未能执行」，并附上**应执行的命令原文**，不要伪造输出。
2. 下游（t3 起的 `pnpm install/dev/build`、t7 的构建与截图验证）若同样跑不动，**必须在交付说明中如实标注**，不得以"看起来通过"代替证据。
3. `docs/THIRD-PARTY.md` 的 `pnpm licenses list` / `license-checker` 实机结果同理：**执行不了就标注未验证**。

### G.2 技术风险登记（按严重度）

| ID | 风险 | 严重度 | 触发条件 | 缓解措施 | 责任 |
| --- | --- | --- | --- | --- | --- |
| RISK-01 | **store 契约漂移**：三路并行时有人改了字段名/动作签名，导致合并冲突与语义分叉 | **blocker** | 任一方「顺手改名」 | D 节标记 🔒；⛔ 改名；变更须 spec-lead 定稿；t3 先把 `types/**` 与 `stores/**` 签名落地并加类型测试 | 全体 |
| RISK-02 | **three.js 内存泄漏**：原实现 `clearGroup()` 只 `dispose` geometry（L3442），material/texture 与 `matCache`/`floorMats` 永不释放 | **blocker** | 反复切换方案/编辑结构 | `MaterialRegistry` 统一持有并 `dispose()`；`onUnmounted` 释放 renderer/labelRenderer/geometry/material/texture；验收用 `renderer.info.memory.geometries/textures` 归零 | t5 |
| RISK-03 | **Vue 化后丢掉渲染层语义**：原 `renderAll()` 含 `renderOpenings/renderDims` 之外的全部层，容易漏 watcher | high | 直接套用 `watchEffect` 全量重算或漏项 | 按 F.2 矩阵逐行实现并写单测（每个图层一个"依赖变更→重算 1 次"的断言） | t4 |
| RISK-04 | **硬编码复活**：D6–D9/D15/D16 六处已数据驱动的逻辑被写成常量 | high | 照抄 `.bak` 或凭印象实现 | OF §9.2/§9.5 风险 1 为验收项；reviewer 专项核对 | t4/t5 |
| RISK-05 | **`state.demolished` 索引语义错位**：存的是墙体数组下标，结构编辑会重排 | high | 画墙/删墙/加门窗后 | 迁移 `cutWall` / `remapDemolished` / `eraseWall` 等价实现；写"加门窗后 demolished 索引仍指向同一段墙"的单测 | t4 |
| RISK-06 | **导出丢色**：SVG 属性写 `var(--ds-*)` 导致 PNG/SVG 空白或全黑 | high | 组件里图省事用 CSS 变量 | B9 + F.6 R-EXP-1（强制字面值）；导出前用 `theme.resolve()` 展开 | t4/t6 |
| RISK-07 | **中文 PDF 乱码**：未嵌入 CJK 字体子集 | high | P1-1 直接用默认字体 | `@pdf-lib/fontkit` + OFL 字体子集；产物必须人工打开确认 | t6 |
| RISK-08 | **`exceljs` 维护停滞**（npm 最后发布 2023-10-19 `【已核实】`） | medium | 需要新特性/安全修复 | 备选 `xlsx-js-style`（Apache-2.0）；导出产物用 Excel + LibreOffice 双端验证；`THIRD-PARTY.md` 登记 | t6 |
| RISK-09 | **three 版本锁定 0.160.x 带来陈旧风险**，且阻断 P2-6 `postprocessing`（peer `three >= 0.168 < 0.187`） | medium | 想做后处理/新特性 | ADR-01 显式接受：先保视觉保真；升级作为独立任务，前置条件=视觉回归对照（色调映射/阴影/色彩空间） | t5 |
| RISK-10 | **localStorage 5MB 配额**：大户型 + 多方案 + 截图会超限，原实现静默失败 | medium | 大量方案 | X11：`save()` 返回 `'quota'` 并 toast；P2-8 切 IndexedDB（`utils/persistence.ts` 已收敛） | t3/t4 |
| RISK-11 | **触屏/桌面双路径被统一掉**（`COARSE`/`TAP_PX`/摇杆/热区放大） | medium | 用桌面浏览器开发，忽略触屏分支 | `usePointerKind` 单点定义；OF §8.2 的 13 项触屏交互列为验收项 | t4/t5 |
| RISK-12 | **自动识别房间（P2-5）覆盖人工房间** | medium | 用户已手工命名后再点"识别" | ADR-07：只对未覆盖区域生成，绝不改动已命名房间；必须可撤销（进结构栈） | t6（P2 阶段） |
| RISK-13 | **命令面板与既有快捷键冲突**（`Ctrl+K`、`P`、`E`、`T`、`1/2`） | low | 面板抢键 | `useMagicKeys` 精确判定 + `input/select/textarea` 与漫游态守卫（沿用 L1778-1779 语义） | t6 |
| RISK-14 | **对比度表为手算值**，可能与程序化计算有偏差 | low | — | E.1 已声明：以 `colorjs.io` 复核为准并回写本表；verifier 必测 | t7 |
| RISK-15 | **`@vueuse/core` 本体版本未被在线核实** | low | 直接写死版本 | H 节标注 `【待确认】`；落地时 `pnpm view` 复核后再锁 | t3 |
| RISK-16 | **`window.prompt` 替换为应用内对话框**改变交互细节（原为同步阻塞） | low | 改名流程 | 保留"取消不改名"语义；`PromptDialog` 需支持 Enter 确认 / Esc 取消 | t3/t4 |
| RISK-17 | **装饰豁免清单与断言生成器不同步 → 对比度闸门必红**（t7 实测：`wall-low` 填充 1.09–1.26:1 被拿去断言 ≥3） | **blocker** | 新增/调整 2D 令牌时忘记同步 `DECORATIVE_TOKEN_NAMES` | ADR-17 把豁免固定为**封闭 4 项**；§E.7 写明生成规则；`verify.mjs` 的"对比度断言表覆盖 §E.7 组合"检查加一条：断言集**不含**豁免项、**含** `wall-low-stroke` | t3（返工）+ t7（复验） |
| RISK-18 | **"照 SPEC import 却编译失败"**（定义位置漂移：`pt2vec`、`stateKey`、`MIN_SCALE` 等） | medium | 文档写归属、代码放别处 | §D.9「定义位置权威表」为唯一查询入口；t7 复验时逐条 `glob` 核对 §D.9 的每个定义点 | 全体 + t7 |

### G.3 验收清单（交给 t7 / t8）

**保真度（对照 OF）**
1. OF §1.2–§1.13 共 12 组交互逐项手动走查（含 `P`/`E`/`1`·`2`/`Enter`/`Esc`）。
2. OF §2 的 10 个图层逐一开关，确认只重算该层。
3. OF §3 的 11 个 3D 能力逐项可用（含剖切 1.2/2.8、日照 7:00 与 18:00 两端、夜景、门开关、摇杆）。
4. **§D.8 的键**（C-4 裁定后口径）：7 行键的**字面值**全部冻结且由 `contracts.spec.ts` 覆盖；其中 **5 个已具备完整读写方**
   （`huxing-plans-v1`、`huxing-state-v2-<id>`、`huxing-state-v2-<id>-l<lv>`、`huxing-design-v1`、`huxing-theme-v1`）；
   `huxing-lang` = **已读未写**（补写侧 → t6），`huxing-panes` = **无读无写**（全量接线 → t3）。
   两条接线须在对应交付后复核"确实被读写"；⛔ 接线完成前**不得**据此判 t3/t6 交付失败，也**不得**把"5 个键"当作当前既成事实。
   另：用 `.bak` 时代造出的旧存档能正常加载（`huxing-design-v1` 迁移路径）。
5. OF §5 的 60 条目 / 45 类型在库中齐全，2D 图例与 3D 模型一一对应。
6. OF §6.2 的 8 条计算口径逐条用固定样本比对（面积、5% 损耗、墙面积 ×2.8、拆除长度、开间进深）。
7. OF §7 的四类导出产物可解析（PNG 非空、JSON 可 `JSON.parse`、户型往返一致）。
8. OF §8 的快捷键与触屏表逐项。

**工程质量**
9. `pnpm install`（清空依赖）+ `pnpm build` 可复现；`pnpm test` 全绿（含对比度断言）。⚠️ **若 `pwsh` 不可用**：改用 G.1.1 的 node/pnpm 绝对路径执行；两法皆不可行时**标注"未验证"**并给出应执行的命令原文，**不得伪造输出**。
10. 3D 组件反复挂载/卸载 20 次后 `renderer.info.memory` 不增长、监听器数不增长。
11. `THIRD-PARTY.md` 覆盖所有直接依赖与许可证；⛔ 无 GPL/AGPL/无 license 代码进入产物（B.6 / OSS §13）；**t9 时回填 lock 实际版本**（ADR-16）。
12. 全仓 `grep` 十六进制色值，仅允许出现在 §C.3 的 **4 条权威白名单**：`src/theme/**` + `src/features/plan2d/patterns.ts` + `src/data/materials.ts` + **`src/data/furniture-lib.ts`**。
13. **3D 主题联动实测**（E.8）：切换日间↔夜间，3D 截图必须产生非空 diff；切换耗时应 < 100ms 且不触发 `buildArch/buildFurn`。
14. **P0-1 的主题断言**：三套预设 × E.7 的必测组合全部通过（`colorjs.io` 程序化计算，非肉眼判断）。
    ⚠️ **C-2 之后**：断言集**不含**装饰豁免项（`border` / `plan-grid-minor` / `plan-grid-major` / `wall-low`），
    但**必须含** `wall-low-stroke on canvas ≥ 3`；房间标签三枚令牌改断言 `on room-label-halo`（≥4.5）。

---

## H. 依赖清单（含许可证与冻结版本策略）

### H.1 运行时依赖（**已收敛的最终集**）

> 版本列含义：【核实版本】= 2026-10-20 `registry.npmjs.org` 实时抓取；**实际安装版本一律以 `pnpm-lock.yaml` 为准**。台账与再分发判定见 [`THIRD-PARTY.md`](./THIRD-PARTY.md)（**t9 起由 spec-lead 接管**）。

| 包 | 版本策略 | 许可证 | 用途 / 备注 |
| --- | --- | --- | --- |
| `vue` | `^3.5`（工程基线） | MIT | 框架 |
| `pinia` | `^4.1.0`（核实版本） | MIT | 状态管理（ADR-06 三业务 + 两横切 store） |
| `vue-i18n` | `^11.4.16`（核实版本） | MIT | 国际化（替代 `tr()` + `data-en`，X4） |
| `@vueuse/core` | **`【待确认】`**（同仓库子包已核实 v15.0.0） | MIT（子包已核实；core 本体待确认） | 事件/全屏/存储/快捷键（B7） |
| `three` | **锁定 `0.160.x`**（ADR-01） | MIT | 3D 内核；⛔ 不升到 0.186 除非先过视觉回归 |
| `@types/three` | 与 three 同小版本 `【待确认】` | MIT（DefinitelyTyped） | 类型 |
| `colorjs.io` | `^0.7.1`（核实版本） | MIT | 对比度**断言权威**（P0-1） |
| `@material/material-color-utilities` | `^0.4.0`（核实版本） | **Apache-2.0**（保留 NOTICE） | M3/HCT 主题**生成引擎**（P0-1） |
| `papaparse` | `^5.7.0`（核实版本） | MIT | CSV（P0-3） |
| `exceljs` | `^4.4.0`（核实版本），**动态 `import()`** | MIT | XLSX（P0-3）；体积大、Vite 下偶需 buffer polyfill |
| `dxf-writer` | `^1.18.4`（核实版本） | MIT | DXF 导出（P0-7，captain 指定） |
| `polygon-clipping` | **精确锁定 `0.15.7`，禁写 `^`** | MIT | 仅当真布尔必要时（P0-4/P2-5）；已核实无已知安全公告 |
| `earcut` | `^3.2.4`（核实版本） | ISC | 三角化（P2-5） |
| `pdf-lib` + `@pdf-lib/fontkit` | `^1.17.1` / `^1.1.1`（核实版本） | MIT / MIT | **P1-可选**（P1-1）；未实现则整体不安装 |

### H.2 资产

| 资产 | 许可证 | 用途 | 状态 |
| --- | --- | --- | --- |
| 中文字体子集（Noto Sans SC / Source Han Sans） | **SIL OFL 1.1** | P1-1 PDF 嵌入 | ✅ 允许随 MIT 产物分发；**体积预算待评估**（不是法务问题） |
| ambientCG PBR 贴图 | **CC0-1.0** | P2-2 PBR 材质库的**未来来源** | 本版不引入，仅在 `THIRD-PARTY.md` §4 留痕 |
| glTF 家具模型 | 待确认 | P2-1 | **本版不引入**（captain 确认无阻塞点） |

### H.3 开发依赖

`vite`、`@vitejs/plugin-vue`、`typescript`、`vue-tsc`、`vitest`、`@vue/test-utils`、`@playwright/test`、`eslint` + `eslint-plugin-vue`、`prettier`（版本以工程基线为准；均 `【待确认】`）。

### H.4 明确**不引入**（收敛"二选一"的结论，避免下游各自发挥）

| 候选 | 裁决 | 理由 |
| --- | --- | --- |
| `martinez-polygon-clipping` | ❌ 不装 | 与 `polygon-clipping` 同一问题的备选；**只选一个**（且优先不装，先用 three 自带 OBB/Box3） |
| `@turf/*` 子包（`boolean-intersects` / `boolean-point-in-polygon` / `line-intersect` / `area`） | ❌ 本版不装 | 家具量级 ≤ 数百件，three `OBB`/`Box3` + 既有 `aabb()` 足够；引 GeoJSON 表达会与现有 `Pt[]` 数据模型打架。⚠️ 若确需，**按子包装，⛔ 不装 `@turf/turf` 全家桶** |
| `rbush` | ❌ 不装 | 家具数量小，无需空间索引 |
| `three-pathfinding` / `js-angusj-clipper` | ⏸ 推迟到 P2-7 | captain 指示：**不要一上来就装重库**；先用 P0-4 的简化净宽/净空规则 |
| `interactjs` / `moveable` | ❌ 不装 | **见 ADR-13**：手势层是本项目强耦合业务规则（吸附阈值、`TAP_PX`、双指锚点、触屏抽屉拖拽），且既有实现已验证（OF §1.2/§8.2）。红线 11 针对的是"新写一个通用手势引擎"，而本工程是**迁移既有实现** + `@vueuse/core` 补事件生命周期 |
| `html-to-image` / `modern-screenshot` | ❌ 不装 | PNG 走既有 SVG→canvas 路径（F.6 R-EXP-3），引库反而带来跨浏览器字体/外链坑 |
| `xlsx`(SheetJS CE, npm `0.18.5`) | ⛔ **禁止** | npm 版本 2022-03 后停更，新版只在 SheetJS 自有 CDN 分发 |
| `write-excel-file` / `xlsx-js-style` | ⏸ 备选 | `exceljs` 若因体积或 Vite polyfill 不可用，按此顺序替换 |
| `@cantoo/pdf-lib` | ⏸ 备选 | `pdf-lib` 停更影响安全/兼容时无缝替换（API 兼容） |
| `@tarikjabiri/dxf` | ⏸ 备选 | 与 `dxf-writer` 二选一，已按 captain 指定选 `dxf-writer` |
| `file-saver` | ❌ 不装 | 既有 `download(name, blob)`（L1879）已实现 |
| `element-plus` / `naive-ui` | ❌ 不装 | **ADR-02**：定制暖色调体系 + 令牌单一来源，组件库会引入样式污染与双轨主题 |
| `konva` | ❌ 不装 | 2D 保持 SVG（OF §2 全部图层已按 SVG 实现） |
| `kolena`/`culori`/`chroma-js`/`wcag-contrast`/`color-contrast-checker`/`a11y-color-contrast`/`@adobe/leonardo-contrast-colors` | ❌ 不装 | `colorjs.io` 已覆盖对比度断言；M3 已覆盖生成。多装 = 多一套色值真相 |

### H.5 明确推迟（P2，写入 ROADMAP，本版不实现）

`postprocessing`（**Zlib**，v6.39.5，peer `three >= 0.168 < 0.187` → 与 ADR-01 冲突）、`three-mesh-bvh`、`three-bvh-csg`、`three-gpu-pathtracer`、`three-pathfinding`、`js-angusj-clipper`、`@gltf-transform/*`（MIT v4.5.1）、`dexie`/`idb-keyval`、`zod`——版本与许可证见 `THIRD-PARTY.md` §1/§2。

> ⛔ **法务红线**（与 B.6 一致，以 [`THIRD-PARTY.md`](./THIRD-PARTY.md) 为准）：本项目**开源、以 MIT 发布**；MIT 混入 GPL 同样被传染。Sweet Home 3D（GPLv2）、ExportToHASS（GPL-3.0）、FloorplanToBlender3d / DeepFloorplan（GPL-3.0）、wallgraph（AGPL-3.0），以及**所有无 license 仓库**——**只读思路，零代码拷贝**。

---

## I. 迁移期技术决议（Architecture Decision Records）

| ID | 决议 | 理由 / 代价 |
| --- | --- | --- |
| **ADR-01** | **three 锁定 `0.160.x`**，不升到最新（`0.186.1` `【已核实】`） | 视觉保真优先：ACESFilmic 曝光、PCFSoft 阴影强度、`RoomEnvironment` PMREM、材质默认值在换版本后会有肉眼可见差异，而"功能保真"是 t8 的评审维度。代价：失去 P2-6 `postprocessing`（peer three≥0.168）；升级单列为 P2 任务，前置条件=双版本截图对照通过 |
| **ADR-02** | **不引入 UI 组件库**（不用 Element Plus / Naive UI） | 现有 UI 是定制暖色调体系（OF §0.1 + E 节令牌），组件库会带来样式污染、主题令牌双轨、bundle 膨胀；且现有手写 UI 已完整（弹窗/菜单/toast/chip 全有 CSS）。**自研理由成立**：这不是通用能力缺失，而是"已有且需要保真"。行为原语（键盘/全屏/存储/事件）交给 `@vueuse/core`，不重复造 |
| **ADR-03** | **主题 = 确定性令牌表（本 SPEC 定稿）+ M3 生成引擎 + `colorjs.io` 断言**，三者职责不重叠 | 迁移需要**确定性 hex**（可审计、可回归、可写进本 SPEC），所以三套预设的取值不由生成器决定；但 `@material/material-color-utilities`（Apache-2.0）**是 P0 必装依赖**，负责由 `accent` 种子派生 hover/active/soft/tonal 色阶，并为「一键换主题色」提供扩展能力；`colorjs.io` 只做 CI 裁决。代价：多一个 Apache-2.0 依赖（需保留 NOTICE） |
| **ADR-04** | **`colorjs.io` 只用于对比度计算与测试**，不作为运行时样式引擎 | 体积与依赖最小化；主题切换靠 CSS 变量一次写入（`applyCssVars`），不需要运行时色彩运算 |
| **ADR-05** | **持久化继续用 localStorage，键名逐字保留**；IndexedDB 推迟 | 迁移的第一原则是可回退：新工程必须能读 `.bak` 时代的存档。`utils/persistence.ts` 单一出口为 P2-8 留缝；配额失败改为可见提示（X11） |
| **ADR-06** | **层级收敛为 3 个业务 store + 2 个横切 store**（plan / layout / ui + theme / toast） | 原实现是 1 个全局 `state` + 6 个全局可变数组 + `ui` 对象（OF §4.1/§4.4）。按"结构 / 布置 / 交互"三轴切分，保证 2D 与 3D 只能经 store 通信（F.1） |
| **ADR-07** | **自动识别房间（P2-5）是显式命令，且只在未被覆盖的区域生成** | 现有模型是人工房间（`RM()` 预设）。自动生成若覆盖人工命名会破坏用户数据；约束为：仅对未被任何现有房间多边形覆盖的封闭区域生成、生成后仍可改名/换材质、整体进结构撤销栈 |
| **ADR-08** | **3D「夜景」开关与主题「夜间」解耦** | 二者语义不同：主题夜间影响全部 UI 与令牌；`opt.night` 只影响 3D 光照/曝光/自发发光（L3603-3616）。解耦后允许"日间 UI + 3D 夜景"（做效果图很常用）。实现上：`lighting.apply()` 同时读 `theme.presetId` 与 `ui.view3d.night`，显式优先级 = `view3d.night` 覆盖主题 |
| **ADR-09** | **`Scene3D` 不主动轮询 store**：靠 `watch` + 签名脏检查（F.3），未激活时只置 dirty | 原实现每帧 `updateSel()`（L3883）但几何重建靠 `sync()` 手动调用；改为响应式 + 签名，去掉 2D→3D 的反向调用 |
| **ADR-10** | **三类颜色严格分离**：① 主题令牌（UI + 3D 中性材质基色）随主题变；② 内容色板（家具库默认色 `LIB[].color`、材料色板 `MATS[].sw`、地板图案纹样）不随主题变；③ 用户数据色（`Furniture.color`）永不随主题变 | 家具颜色是用户数据（可改色、可导出）；UI 与 3D 中性材质必须联动主题（captain 规格约束）。3D 侧硬编码散布在 L2902–3423 的 40+ 处 `mat('#...')` 是**主要风险源**，必须收敛到 `theme/material-palette.ts`（见 E.8 T1/T2） |
| **ADR-11** | **编辑内核自研**，不寻找/不依赖任何现成"户型编辑器"库 | 见 B.5：`smplrspace/floorplan.js` 无 license（⛔）、`react-planner` React 专用且 npm 停更 7 年（❌ 不可直接依赖）；仅借鉴 `furnishup/blueprint3d`（MIT）的**分层骨架**，⛔ 禁止整包移植（README 自陈未重构、grunt+jquery、2021 停更）。理由：数据模型、多方案逐层存档、30 项快捷键 + 13 项触屏手势均为项目专有资产；引入开源内核还会让其许可证决定本 MIT 项目的分发边界 |
| **ADR-12** | **法务口径按最严处理，不等待用户答复**：项目**开源、以 MIT 发布**；只允许 MIT / ISC / Apache-2.0 / BSD / Zlib / CC0；GPL / AGPL 与**无 license 字段**仓库**只读思路、零代码拷贝** | MIT 混入 GPL 同样被传染。完整清单与再分发判定见 `THIRD-PARTY.md`（captain 决策 2026-10-20）。**非代码资产**：中文字体走 **SIL OFL 1.1**（允许随 MIT 产物分发）、贴图走 **CC0** |
| **ADR-13** | **手势层：迁移既有实现 + `@vueuse/core` 补事件生命周期，⛔ 不引入 `interactjs` / `moveable`** | 对 OSS §5 红线 11 的**有意偏离并记录理由**：红线针对"新写一个通用手势引擎"；本工程是**迁移已验证的实现**（OF §1.2/§1.5/§8.2），且手势与业务规则强耦合——吸附阈值 `10/view.s`、`TAP_PX`（桌面 4 / 触屏 9）、双指中点锚定缩放、家具库 `touch-action:pan-y` 与横向拖放区分、触屏抽屉拖出自动收起（L1821-1853）。换库必然造成行为漂移，而"交互保真"是评审硬指标。**若 t8 reviewer 判定应换库，需由 captain 裁决后再改**（届时首选 `interactjs`） |
| **ADR-14** | **依赖收敛为单一选择集**（H.4），下游不得自行安装备选包 | 避免"二选一"被并行开发各自实现（`polygon-clipping` vs `martinez-*`、`dxf-writer` vs `@tarikjabiri/dxf`、`pdf-lib` vs `@cantoo/pdf-lib`、`exceljs` vs `write-excel-file` 等）。需替换时先改 SPEC 的 H.4 并同步 `THIRD-PARTY.md` |
| **ADR-15** | **平面图校验（P0-4）优先零新增依赖**：几何事实判断先用 three 自带 `OBB.js` + `Box3`，布尔作为最后手段 | captain 明确指示"避免 features-dev 一上来就装 `polygon-clipping`"。`polygon-clipping` 最后发布 **2023-12** 且仍在 `0.15.x` 未过 1.0 → 若确需，**精确锁定 `0.15.7`（禁 `^`）**；通道连通性（navmesh）推迟到 P2-7 再评估 `three-pathfinding` / `js-angusj-clipper` |
| **ADR-16** | **依赖与许可证台账 = `docs/THIRD-PARTY.md`，唯一权威**；本 SPEC 的依赖清单以它为准 | 由 `oss-researcher` 出模板，**t9 起由 spec-lead 接管**。t3 装完依赖后需把"建议锁定版本"回填为 `pnpm-lock.yaml` 实际版本，并补 `pnpm licenses list` / `license-checker` 实机结果；**执行不了就标注"未验证"，禁止伪造输出** |
| **ADR-17** | **矮墙"填充为装饰、描边承载语义"**（t12 / C-2 裁定）：`wall-low`（填充）进装饰豁免，只断言 `wall-low-stroke on canvas ≥ 3` | **二选一的取舍**：① 填充豁免（采纳）；② 把填充 hex 压到 ≥3:1（否决）。否决理由：`#f7f4ee` 画布上要 3:1 需要 ≈`#93856c` 或更深，会与非承重墙 `wall-partition`（`#8b8375`，3.41:1）撞色，破坏 OF §2.3 的墙体色阶层级；且原实现本就是"浅填充 + 深描边"两件套（`装修设计.html` L1210-1211），承载信息的一直是描边。**装饰豁免是封闭集合**（`border`/`plan-grid-minor`/`plan-grid-major`/`wall-low`），不得再扩 |
| **ADR-18** | **§C.1「`types/**` 零运行时代码」优先于 §D.1 的写法便利**（t12 / C-3 裁定）：转换函数归属 `utils/geometry.ts` | 两条规则冲突时以"目录职责纯净"为准，因为它保护的是可测试性与依赖方向（B5）。代价：`types/geometry.ts` 不能顺手放 3 行工具函数，下游必须多记一个 import 路径 → 用 §D.9「定义位置权威表」兜住 |

---

## J. 发布与仓库约定（captain 决策 2026-10-20，含一个必读环境坑）

| # | 约定 | 说明 |
| --- | --- | --- |
| J1 | **远程仓库** | `https://github.com/jun838480981/decoration-studio.git`（用户已新建）。项目**以 MIT 开源发布** |
| J2 | **提交信息一律中文** | 用户明确要求。例：`文档：补充迁移对照表与路线图`、`功能：实现 2D 平面编辑器图层`。⛔ 不使用英文 commit message |
| J3 | **仓库初始化与首次推送不在 t1 / t9 的验收范围内** | captain 已另建发布任务 **t10（assignee = scaffold-dev，依赖 t1 + t3）**，负责 `git init -b main`、首次中文提交与 `git push -u origin main`。**t9 只按需补一次中文提交**，并在报告中附 `git log -1 --format=%H%n%s` 作为证据；⛔ **不要重新 `git init`、不要改 remote、不要 force push** |
| J4 | ⚠️ **本机 git 环境坑（必须写进 README 与 SPEC）** | 本机全局 `.gitconfig` 存在 `[url "github.com.cnpmjs.org"] insteadOf = github.com`，会把 github 的 git 流量**重写到早已停服的镜像**。注意 `git config --get url.github.com.cnpmjs.org.insteadOf` **看不到它**（键名形式不同），必须用 `git config --get-regexp '^url\.'` 查询。**任何 clone / push 失败先排查这一条，而不是先怀疑网络**。修复方式（由 t10 执行）：`git config --global --unset url."github.com.cnpmjs.org".insteadOf`（或按需改为正确的镜像/直连） |
| J5 | **MIT 许可证** | 仓库根目录需有 `LICENSE`（MIT 全文）+ `THIRD-PARTY.md`（台账，ADR-16）。法务口径见 B.6 / OSS §13，**已定案，无需再写"待用户确认"** |
| J6 | 提交前自检 | 前端产物内含 MIT/ISC/BSD/Zlib 的许可证全文与版权声明；Apache-2.0 依赖（`@material/material-color-utilities`）保留其 NOTICE；**GPL / AGPL / 无 license 代码零进入**（B.6） |

---

## K. t12 裁决记录与返工交接（C-2 / C-3 / C-4 / C-5 / C-6 / C-8）

> 来源：`docs/VERIFY-T7-STATIC.md` 的 §C（t7 独立验证，2026-10-20 16:00–16:11 快照）。
> 本任务**只改 `docs/SPEC.md`**（`src/**` 有在飞返工，未触碰；`VERIFY-T7-STATIC.md` 是 verifier 的证据文件，未改）。
> 每条给出「改前 → 改后」与落点。

### K.1 逐条裁决

| 条目 | 严重度 | 裁决（**二选一已定，不留白**） | 改前 → 改后 | SPEC 落点 |
| --- | --- | --- | --- | --- |
| **C-2** | high | **把 `wall-low`（填充）加入装饰豁免**，只校验 `wall-low-stroke on canvas ≥ 3`。**不改 hex**。理由见 ADR-17（改 hex 会与 `wall-partition` 撞色、破坏墙体色阶层级；原实现本来就是浅填充+深描边） | `--ds-wall-low \| #e9e3d8 + 描边 #8f897d \| … \| ≥3:1（描边）` → **拆成两行**：`--ds-wall-low`（填充，1.16:1，**装饰豁免**）+ `--ds-wall-low-stroke`（描边，3.17:1，≥3:1）；并新增**装饰豁免清单（权威 4 项）** 与 **§E.7 断言生成规则** | §E.3（wall-low 两行 + 豁免清单块）、§E.7（生成规则块）、§G.3#14、新增 ADR-17 / RISK-17 |
| **C-3** | medium | **归属改为 `utils/geometry.ts`**（保留 §C.1「types 零运行时代码」） | `§D.1 基础几何（types/geometry.ts）`+`export const pt2vec/vec2pt` → `§D.1 基础几何（类型在 types/geometry.ts，转换函数在 utils/geometry.ts）`，并从代码块里移除这两个导出、补 `PointLike`/`utils` 路径与 ⛔ 警告 | §D.1、新增 §D.9、新增 ADR-18 |
| **C-4** | medium | **要求真正接线**（不采用"标注不读写"）：`huxing-panes` → **t3**（无读无写，全量补）；`huxing-lang` → **t6**（已读未写，补写侧 + `createI18n` 实例化）；并同步修订 G.3#4 口径 | §D.8 表 `归属 store \| 结构` → 增加「**读写接线（C-4 裁定）**」列，逐键标 ✅已接线 / 🟡半接线 / ❌未接线 + 归属任务；G.3#4「OF §4.2 的 5 个键…」→「7 行键字面值冻结；**5 个已有读写方**，`huxing-lang`（t6，补写侧）/`huxing-panes`（t3，全量）待接线，接线前不得据此判失败」 | §D.8、§G.3#4 |
| **C-5** | low-med | **以代码为准**：`PlanSlice / LayoutSlice / UiSlice` | `computeSignatures(plan: PlanStoreSlice, layout: LayoutStoreSlice, ui: UiStoreSlice)` → `(plan: PlanSlice, layout: LayoutSlice, ui: UiSlice)`，并补三切片的字段定义、文件位置 `types/scene3d.ts:16/22/28` 与依赖倒置说明 | §F.3、§D.9 |
| **C-6** | low | **统一为 §C.3 的 4 条权威白名单**；工具与文档的改法写成给 scaffold-dev 的清单（本任务不代改代码） | §C.2 B3 `theme/tokens.ts 是唯一…` → `theme/**…权威清单见 §C.3`；新增 **§C.3 hex 白名单（权威清单，🔒）** 含 4 条 + 各消费方「当前状态/应改成」对照表；§G.3#12 白名单**补 `data/furniture-lib.ts`** | §C.2 B3、新增 §C.3、§G.3#12 |
| **C-8** | low | **追认扩张**为正式契约（t7 的若干判断需修正，见 K.2） | 新增/更新：`color-scheme`（§E.2 首行，CSS 关键字、不参与断言）、`wall-low-stroke`（§E.3）、`room-label-halo`（§E.3，15.52:1 / 7.65:1）；`plan.readState(...)`（§D.5 action）；`RoomRow` + `SaveStatus`（§D.6，并把 `save()` 改为 `Promise<SaveStatus>`）；`SCALE_BAR_STEPS`（§D.7）；`roomRows` 改用 `RoomRow`；令牌总数口径=**每套 47 项**（26 项 UI 含 `color-scheme` + 21 项 2D 图纸） | §E.2/§E.3/§D.5/§D.6/§D.7/§D.9 |

### K.2 对 t7 判断的四处**更正**（3 处事实修正 + 1 处精度更正）

| # | t7 原判断 | 实际证据 | 本文裁决 |
| --- | --- | --- | --- |
| K2-1 | 「`currentPlanId/currentLevel/currentMulti` …**且都出现在 return 里，即公开 API**」 | `src/stores/layout.ts:55-57` 定义；`return` 块（`:388-430`）**不含**这三项；同文件 `:53-54` 注释明写「**非冻结的内部记账**」 | **不是公开契约**。§D.6 里以注释形式备案为"实现内部记账"，并 ⛔ 下游不得依赖 |
| K2-2 | C-6「`README.md:95` 沿用不含 furniture-lib 的旧口径」 | `README.md:95` **已包含** `data/furniture-lib.ts`（该文件在快照后被更新过） | README:95 **无需改动**；§C.3 已记录该更正 |
| K2-3 | C-4 建议「t3 侧把 `ui.panes` 接持久化（**或在代码里写明归属 t4/t6 的 TODO**）」 | — | 采纳"必须接线"，并把归属**明确到任务**（`huxing-panes`→t3、`huxing-lang`→t6），**不接受**"只留 TODO" |
| K2-4 | C-4「`huxing-lang` / `huxing-panes` **全仓无读写方**（除定义与断言）」 | `src/features/extras/lib/i18n.ts:7,11,26-27`：`currentLang()` 已 `readRaw(STORAGE_KEYS.lang)` → **`huxing-lang` 有读方**（该文件在 t7 快照期间被新增，故快照未捕获）；`huxing-panes` 确为无读无写 | 精确化：`huxing-lang` = **已读未写**（缺写侧 + i18n 实例化）；`huxing-panes` = **完全未接线**。§D.8 已按此标注 |

### K.3 给 scaffold-dev（t3）的返工清单 —— **本任务不代改 `src/**`**

| # | 文件:行 | 改动 | 依据 |
| --- | --- | --- | --- |
| 1 | `src/theme/tokens.ts:124` | `DECORATIVE_TOKEN_NAMES` 增加 `'wall-low'`（最终为 `['border','plan-grid-minor','plan-grid-major','wall-low']`）。**唯一必要改动**——`contrast.ts:78-84` 的过滤器已按该数组工作，改完 `wall-low` 自动退出断言、`wall-low-stroke` 仍在断言集内 | C-2 / ADR-17 / §E.3 / §E.7 |
| 2 | `src/stores/ui.ts:9` + `src/composables/usePointerKind.ts` | 按 SPEC §D.7 **取值**定义并导出 `MIN_SCALE = 0.012`、`MAX_SCALE = 2`、`PX_MM = 25.4 / 96`；**定义点按 §D.9 = `src/stores/ui.ts`**，`usePointerKind.ts` 只保留 `COARSE` / `TAP_PX`（`stores/ui.ts` 的再导出契约不变） | C-1（captain 已派返工）+ §D.9 |
| 3 | `scripts/verify.mjs:433` | 检查名文案补 `data/furniture-lib.ts`（**行为已正确，仅文案**） | C-6 / §C.3 |
| 4 | `README.md:115` | 装饰豁免列举补 `wall-low`（填充） | C-2 / §C.3 |
| 5 | （可选，低）`scripts/verify.mjs:139` | hex 扫描按**整行原文**匹配，注释里的 hex 会误报（C-7，归 t5 清内容）。若判定"注释里不该出现 hex"成立则无需改脚本；若要脚本更稳，改为**剥离注释后再匹配**（两道闸门口径差异见 §C.3 末注） | C-7 / §C.3 |
| 6 | `src/stores/ui.ts`（`panes`，:91 / :223-224 / :272） | **接线 `huxing-panes`**（C-4 裁定）：启动时用 `readJson(STORAGE_KEYS.panes, {hideLib:false,hidePanel:false})` 初始化 `panes`；`openDrawer()` 改完两字段后 `writeJson(STORAGE_KEYS.panes, panes)`。⛔ 不得新增键、不得改动 `panes` 的两字段名与初值 | C-4 / §D.8 |

**给 t6（features-dev）的返工清单**

| # | 文件 | 改动 | 依据 |
| --- | --- | --- | --- |
| 7 | `src/features/extras/lib/i18n.ts` | **补 `huxing-lang` 的写侧**：语言切换时 `writeRaw(STORAGE_KEYS.lang, lang)`；并按 `i18n.ts:307` 的注释完成 `createI18n({ messages })` 实例化（把现有平铺 key 还原成嵌套结构）。读侧 `currentLang()`（:26-27）已具备，不要重写 | C-4 / §D.8 / OF §1.10 |

> ⚠️ 上表 1–2 项会**改变测试结果**：改完全部通过；不改则 `pnpm test` 必红（`wall-low` 断言）或 `typecheck` 必红（`MIN_SCALE` 未定义）。

### K.4 本任务未做（明确边界）

1. ⛔ 未改任何 `src/**`（t4/t5/t6 与 scaffold-dev 的返工在飞）。
2. ⛔ 未改 `docs/VERIFY-T7-STATIC.md`（verifier 的证据文件）。
3. ⛔ 未判定 C-1 / C-7 的实现修复方式（C-1 归 scaffold-dev 返工、C-7 归 t5）；仅在 §D.9 与 §K.3 提供**口径对齐**。
4. ⛔ 未执行任何命令（本会话进程通道不可用），本文件全部结论为**静态阅读 + 交叉核对源码**得出，无任何命令输出被引用。

---

## 附：待确认项汇总（禁止当成已知事实）

| # | 待确认 | 归属 | 处理方式 |
| --- | --- | --- | --- |
| C1 | `@vueuse/core` 本体版本与许可证 | t3 | `pnpm view @vueuse/core version license` 复核后锁定 |
| C2 | `@types/three` 与 three 0.160 对应的版本 | t3 | 同上 |
| C3 | `dexie` / `idb-keyval` / `zod` 的版本与许可证 | P2-8 | 需要时再核实（`THIRD-PARTY.md` §2 目前标"未在线核实"，⛔ 不得据此写 `package.json`） |
| C4 | P1-1 用哪个 OFL 字体、子集化后的体积 | t6 | 字体授权**已明确**（Noto Sans SC / Source Han Sans 均 SIL OFL 1.1，允许随 MIT 产物分发）；**待确认的只是具体文件与体积预算**，记录到 `THIRD-PARTY.md` §4 |
| C5 | `exceljs` 是否仍维护（npm 最后发布 2023-10-19） | t6 | 跟踪 issue；备选 `xlsx-js-style` |
| C6 | `postprocessing` / `three-mesh-bvh` / `three-bvh-csg` 与 three 0.160 的兼容性 | P2 | 需要时逐个核实 peer 范围 |
| C7 | E 节中标注 `【待复核】` 的对比度数值，**以及 t12 新增的 3 条手算值**（`wall-low` 填充 1.16:1、`room-label-halo` 对 `room-label` 15.52:1 / 对 `room-label-sub` 7.65:1） | t7 | 用 `colorjs.io` 程序化复核并回写本表；**裁决者始终是 `colorjs.io`，不是本表手算**（E.1 已声明）。注：`wall-low` 填充按 C-2 走**装饰豁免**，其数值只用于说明，不构成断言 |
| C8 | OF §10 的 12 项（U1–U12） | 全体 | 以 OF §10 为准，验证而非猜测 |
| C9 | 本机 git 的 `insteadOf` 重写是否已被清除（J4） | t10 | `git config --get-regexp '^url\.'` 复核；未清除前不要判断推送失败是网络问题 |
| C10 | `pnpm-lock.yaml` 落地后的**实际**依赖版本 | t3 → t9 | 回填 `THIRD-PARTY.md` §1 的"建议锁定版本"，并补 `pnpm licenses list` / `license-checker` 实机结果；**pwsh 不可用则标注"未验证"**（G.1.1） |
| C11 | `exceljs` 在 Vite 下是否真需 `buffer` polyfill；`@vueuse/core`、`@types/three` 的实际版本 | t3 | 以安装解析结果为准；若 `exceljs` 不可用则按 H.4 顺序换 `write-excel-file` / `xlsx-js-style` |
