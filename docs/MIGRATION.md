# 迁移对照表（MIGRATION）

> 原单体 `装修设计.html`（3895 行，零构建、CDN 引入 three.js）→ `decoration-studio`（Vue3 + Vite + TypeScript，141 个源文件）。
>
> 本表的用途：**证明功能没有漏**，并让接手者能按「原行为 → 新位置」直接定位代码。
>
> 依据：`docs/ORIGINAL-FEATURES.md`（逐行通读原文件、带行号证据）与本仓库实际源码（行号为 2026-10-21 快照）。

---

## 0. 阅读方式

- **原位置**：`装修设计.html` 的行号（该文件是 `.bak` 的功能超集，见 `ORIGINAL-FEATURES.md` §9）。
- **新位置**：本仓库路径（相对仓库根）。
- **状态**：
  - ✅ 已保留 —— 行为等价迁移
  - 🔄 已改进 —— 迁移同时修复了原实现的问题
  - 🔀 已替换 —— 换成成熟库/框架能力，语义等价
  - ⛔ 未迁移 —— 明确不做，附理由
- **注意**：原实现是全局可变单例 + 手写 DOM；新实现是 Pinia store + 组件。因此「等价」指的是**用户可见行为**等价，不是代码逐行对应。

---

## 1. 工程骨架与构建

| 能力 | 原位置 | 新位置 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| 零构建单文件 | 全文件 | `vite.config.ts` / `package.json` | 🔀 | 改为 Vite 构建，产物可静态托管（`base: './'` 支持任意子路径） |
| three.js 引入 | L249-254 importmap + CDN | `package.json` 依赖 `three@0.160.1` | 🔀 | 从 CDN 改为 npm 锁定版本，可 tree-shaking、可离线构建 |
| 类型系统 | 无 | `src/types/**`（12 个文件） | 🔄 | 全量 TS 类型；`SPEC §D` 冻结契约有机器闸门（`src/stores/contracts.spec.ts`） |
| 应用入口 | L1012-1013 内联脚本 | `src/main.ts`（33 行） | ✅ | 启动顺序：pinia → i18n → theme → 载入户型 → mount → 3D 副作用导入 |
| 应用外壳 | L257-410 静态 HTML | `src/App.vue`（289 行） | ✅ | DOM 顺序遵循 SPEC §F.2；3D/亮点用「挂载位」解耦，避免并行开发互相踩线 |

---

## 2. 交互与工具栏（原 §1，12 组）

| 能力 | 原位置 | 新位置 | 状态 |
| --- | --- | --- | --- |
| 工具栏分组 | L258-344 | `src/components/ToolBar.vue`（217 行） | ✅ |
| 顶部栏（品牌/2D-3D 切换/文件菜单） | L258-290 | `src/components/AppHeader.vue`（214 行） | ✅ |
| 选择 / 移动 | L1102-1206 | `src/features/plan2d/editing.ts`（578 行） | ✅ |
| 测量 | L1102-1206 | `src/features/plan2d/editing.ts` + `layers/MeasureLayer.vue` | ✅ |
| 拆改墙体 | L1207-1215 | `src/features/plan2d/editing.ts` + `stores/layout.ts` 的 `toggleWall` | ✅ |
| 缩放 / 适应窗口 / 1:60 / 1:100 | L1592-1606 | `src/stores/ui.ts`（`zoomAt`/`fitView`/`setRatio`，`MIN_SCALE`/`MAX_SCALE`/`PX_MM`） | ✅ |
| 图层开关（6 项） | L1018-1019 | `src/stores/ui.ts` 的 `layers` + `toggleLayer` | ✅ |
| 2D / 3D 切换 | L859, L1404-1470 | `src/stores/ui.ts` 的 `setViewMode` + `App.vue` 挂载位 | 🔄 |
| 撤销 / 重做（双栈） | L1021-1029 | `src/stores/layout.ts`（布置栈 150）+ `src/stores/plan.ts`（结构栈 80） | ✅ |
| 全屏 | L1736-1757 | `@vueuse/core` 的 `useFullscreen` | 🔀 |
| 中英双语 | L414-444 `tr()` + `data-en` | `vue-i18n` + `src/features/extras/lib/i18n.ts`（460 行） | 🔀 |
| 多方案管理 | L854, L1902-1960 | `src/stores/plan.ts`（438 行）+ `src/components/PlanLibraryModal.vue` | ✅ |
| 结构编辑模式 | L862-865, L2154-2300 | `src/stores/ui.ts` 的 `edit` + `src/features/plan2d/editing.ts` | ✅ |
| 自动布置 | L976-981 | `src/utils/auto-furnish.ts`（149 行） | ✅ |
| 快捷键 | L1777-1810 | `src/composables/useShortcuts.ts`（160 行） | ✅ |
| 触屏适配（`pointer:coarse`） | L206-223, L1389-1403 | `src/composables/usePointerKind.ts` + `usePointerPanZoom.ts`（395 行） | ✅ |

> **2D/3D 切换为什么算「改进」**：原实现用 `body.m3d` 类 + CSS 过渡，3D 组件常驻但隐式依赖 `window.View3D` 全局单例。新实现改为「挂载位 + `registerViewMount`」显式装配，并修复了**注册从未发生导致 3D 打不开**的真实缺陷（见 §9 修复记录）。

---

## 3. 2D 渲染管线（原 §2，8 层）

| 图层 | 原位置 | 新位置 | 状态 |
| --- | --- | --- | --- |
| 图层顺序（自下而上 10 层） | L356-368 | `src/features/plan2d/layers/shell.ts` + 11 个 `layers/*.vue` | ✅ |
| 房间多边形 | L1171-1194 | `layers/RoomLayer.vue` + `src/utils/geometry.ts` | ✅ |
| 材质图案 `buildDefs` | L1037-1058 | `src/features/plan2d/patterns.ts`（84 行，hex 白名单文件） | ✅ |
| 墙体 4 类 | L1207-1215 | `layers/WallLayer.vue` | ✅ |
| 门窗（平开/推拉/窗） | L1217-1252 | `layers/OpeningLayer.vue` | ✅ |
| 尺寸标注链 | L1264-1288 | `layers/DimLayer.vue` + `src/features/plan2d/dims.ts` | ✅ |
| 网格 | L1030-1036 | `layers/GridLayer.vue` | ✅ |
| 测量层 | L1102-1206 | `layers/MeasureLayer.vue` | ✅ |
| 选中框与拖拽手柄 | L1312-1336 | `layers/SelectionLayer.vue` | ✅ |
| 家具图例 SVG（45 类型） | L1060-1167 | `src/features/plan2d/furniture-svg.ts`（264 行） | ✅ |
| 房间标签 | L1290-1310 | `layers/LabelLayer.vue` | ✅ |
| 编辑态覆盖层 | L2154-2300 | `layers/EditLayer.vue` | ✅ |
| SVG 主画布 | L356-368 | `src/features/plan2d/PlanCanvas.vue`（193 行）+ `svg.ts`（380 行） | ✅ |

---

## 4. 3D 场景（原 §3，11 项）

| 能力 | 原位置 | 新位置 | 状态 |
| --- | --- | --- | --- |
| 渲染器/相机/控制器初始化 | L2703-2795 | `src/features/scene3d/engine.ts`（721 行） | ✅ |
| 程序化建筑（墙/窗/门/楼板/天花） | L3495-3559 | `src/features/scene3d/architecture.ts`（452 行） | ✅ |
| 程序化家具（46 个 case） | L2954-3439 | `src/features/scene3d/furniture/*.ts`（6 个分组文件，1606 行） | ✅ |
| 材质与 Canvas 贴图 | L2853-2930 | `src/features/scene3d/materials.ts`（395 行） | 🔄 |
| 几何工具 | L2859-2900 | `src/features/scene3d/primitives.ts`（414 行） | ✅ |
| 剖切墙 / 全高墙 | L3400-3420 | `src/features/scene3d/scene.ts` + `architecture.ts` | ✅ |
| 鸟瞰 / 漫游（指针锁定 + WASD） | L3672-3740 | `src/features/scene3d/camera.ts`（271 行）+ `walk.ts`（115 行） | ✅ |
| 触屏摇杆 | L1389-1403 | `walk.ts` + `Scene3D.vue` | ✅ |
| 门开合动画与拾取 | L3745-3800 | `src/features/scene3d/picking.ts`（248 行） | ✅ |
| 日照 / 夜景 | L3603-3616 | `src/features/scene3d/lighting.ts`（118 行） | 🔄 |
| CSS2D 房间标签 | L3690-3710 | `src/features/scene3d/labels.ts`（76 行） | ✅ |
| 增量重建（三签名） | L3585-3591 | `engine.ts` 的 `sync()` + `computeSignatures` | ✅ |
| 3D 截图导出 | L3860 | `Scene3D.vue` 的 `shot()` | ✅ |
| 3D 视口组件 | L257-410（内嵌） | `src/features/scene3d/Scene3D.vue`（593 行） | ✅ |

> **材质与光照为什么算「改进」**：原实现有 40+ 处 `mat('#...')` 硬编码散布在 3D 建模代码里，改主题要改几十处。新实现把 3D 材质基色收敛到 `src/theme/material-palette.ts`（唯一来源），并让背景/地面/曝光/半球光/太阳色/`envK` **随主题联动**（ADR-08：夜景只覆盖光照，不覆盖材质）。`features/scene3d/**` 内禁止出现任何十六进制字面值，由 `scripts/verify.mjs` 机器校验。

---

## 5. 数据模型与持久化（原 §4）

| 能力 | 原位置 | 新位置 | 状态 |
| --- | --- | --- | --- |
| 户型结构模型 | L390-415 | `src/types/plan.ts`（87 行，SPEC §D.2 冻结） | ✅ |
| 家具模型 | L566 | `src/types/furniture.ts`（77 行） | ✅ |
| 布置状态 | L390-415 | `src/types/state.ts`（72 行） | ✅ |
| localStorage 7 键 | L414, L1446, L608-609, L891, L983 | `src/utils/persistence.ts`（127 行，`STORAGE_KEYS` 逐字冻结） | ✅ |
| 旧键迁移 `huxing-design-v1` | L1911-1914 | `persistence.ts` 的 `migrateLegacy` | ✅ |
| 坏数据兜底 `fixState` | L988-994 | `src/utils/normalize.ts`（216 行） | ✅ |
| 导入校验 `normalizePlan` | L1916-1960 | `src/utils/normalize.ts` | ✅ |
| 房间状态同步 `syncRoomState` | L996-1000 | `src/stores/layout.ts` 的 `syncRoomState` | ✅ |
| UI 状态（不持久化） | L1018-1020, L862-865, L2694 | `src/stores/ui.ts`（280 行，初值冻结 + 机器闸门） | ✅ |
| 隐私模式/配额静默失败 | 全文 try/catch | `persistence.ts` 统一 `try/catch` | ✅ |

---

## 6. 家具库（原 §5）

| 项 | 原位置 | 新位置 | 状态 |
| --- | --- | --- | --- |
| 6 分类 / **60 条目** / **45 唯一类型** | L533-561 | `src/data/furniture-lib.ts`（194 行） | ✅ 数量逐条一致 |
| 条目结构 `[type,名称,宽,深,色]` | L532 | `src/types/furniture.ts` 的 `LibItem` | ✅ |
| 取色 `typeColor()` | L562 | `furniture-lib.ts` 的 `typeColor` | ✅ |
| 工厂 `F()` | L566 | `furniture-lib.ts` 的 `makeFurniture` | ✅ |
| 家具库面板与拖放 | L533-561 + 拖放逻辑 | `src/components/FurnitureLibrary.vue`（278 行） | ✅ |
| 贴墙吸附 | L1620-1660 | `src/features/plan2d/editing.ts` + `src/utils/geometry.ts` 的 `snapRects` | ✅ |

---

## 7. 报价与算量（原 §6）

| 项 | 原位置 | 新位置 | 状态 |
| --- | --- | --- | --- |
| 材料表 **8 种** | L522-531 | `src/data/materials.ts`（95 行） | ✅ |
| 面积（鞋带公式，排除飘窗） | L1368 | `src/utils/measure.ts` 的 `totalArea` | ✅ |
| 材料用量（含 5% 损耗） | L1369-1373 | `measure.ts` 的 `materialBreakdown` + `LOSS_FACTOR` | ✅ |
| 地面材料合计 | L1372-1373 | `src/stores/layout.ts` 的 `flooringCost` | ✅ |
| 拆墙长度 | L1375 | `measure.ts` 的 `demolishedLength` | ✅ |
| 墙面面积估算（周长 × 2.8） | L1483 | `measure.ts` 的 `wallArea` | ✅ |
| 房间面积表 | L1362-1388 | `src/components/PropertyPanel.vue`（684 行） | ✅ |
| 报价单面板 | L1362-1388 | `src/features/extras/CostReport.vue`（179 行）+ `lib/cost.ts`（249 行） | 🔄 |

> **报价单为什么算「改进」**：原实现只是右侧面板里的一个静态表格。新实现拆出独立组件，支持 **CSV / XLSX / PDF / 打印** 四种导出，且金额口径与 store 单一来源（`flooringCost`）。

---

## 8. 导入导出（原 §7）

| 能力 | 原位置 | 新位置 | 状态 |
| --- | --- | --- | --- |
| 导出图片（SVG → PNG 3200px） | L1879-1897 | `src/features/plan2d/export-svg.ts` + `src/features/extras/lib/export-svg.ts` | ✅ |
| 布置 JSON 导出/导入 | L1879-1897 | `src/features/extras/lib/export-json.ts`（105 行） | ✅ |
| 户型 JSON 导出/导入 | L1916-1960 | `export-json.ts` + `src/utils/normalize.ts` | ✅ |
| 多方案打包导出 | L1902-1960 | `export-json.ts` 的 `exportAll` | ✅ |
| 3D 截图 | L3860 | `Scene3D.vue` 的 `shot()` | ✅ |
| **CSV 导出**（新增） | — | `src/features/extras/lib/export-csv.ts`（85 行，`papaparse`） | 🆕 |
| **XLSX 导出**（新增） | — | `export-xlsx.ts`（198 行，`exceljs`） | 🆕 |
| **DXF 导出**（新增） | — | `export-dxf.ts`（203 行，`dxf-writer`） | 🆕 |
| **PDF / 打印**（新增） | — | `export-pdf.ts`（62 行）+ `print.ts`（132 行） | 🆕 |

---

## 9. 新增亮点功能（原版没有，对标同类开源项目）

> 选型依据：`docs/OSS-RESEARCH.md`（实时核实 GitHub/npm 数据）。原则是**优先复用成熟库**，不重复造轮子。

| 功能 | 新位置 | 复用的库 | 说明 |
| --- | --- | --- | --- |
| 多方案并排对比 + 差异摘要 | `src/features/extras/PlanCompare.vue`（222 行）+ `lib/compare.ts` | 无（业务逻辑自研） | 选中 2+ 方案并排比对面积/材料/家具差异 |
| 平面图自动校验 | `src/features/extras/ValidationPanel.vue` + `lib/validate.ts`（361 行） | `three` 自带 `OBB.js`/`Box3` | 家具穿墙/压门洞/遮挡通道/房间无家具/尺寸异常；点击告警可定位 |
| 撤销历史面板 | `src/features/extras/HistoryPanel.vue`（157 行）+ `lib/history.ts` | 无 | 可视化历史栈，可跳转 |
| 主题切换（日间/夜间/高对比） | `src/features/extras/ThemeSwitch.vue` + `src/theme/tokens.ts`（273 行） | `@material/material-color-utilities` + `colorjs.io` | 3 套预设 × 47 令牌；对比度用 colorjs.io 做**单测断言** |
| 命令面板（Ctrl+K） | `src/features/extras/CommandPalette.vue`（324 行）+ `lib/commands.ts` | 无 | 键盘驱动全部操作 |
| 导出菜单 | `src/features/extras/ExportMenu.vue`（430 行） | 见 §8 | 统一入口 |
| 3D 主题联动 | `src/features/extras/lib/scene-theme.ts`（106 行） | 无 | 3D 背景/曝光/光照随主题切换 |

---

## 10. 配色体系（本次迁移的核心目标之一）

| 项 | 原实现 | 新实现 | 状态 |
| --- | --- | --- | --- |
| 色彩定义 | 单套 `:root`（L12-14），3 个色值 | `src/theme/tokens.ts`：**3 套预设 × 47 令牌**，逐项带 hex 与对比度 | 🔄 |
| 语义化 | 无（直接用 `--accent` 等） | 语义令牌：`--ds-bg/surface/border/text/text-muted/accent/success/warning/danger/info/...` | 🔄 |
| 深色模式 | 无 | `night` 预设 + `data-theme` | 🆕 |
| 对比度校验 | 无 | `src/theme/contrast.ts`（114 行）+ `contrast.spec.ts`（56 行），**136 项断言** | 🆕 |
| 3D 配色 | 40+ 处硬编码 `mat('#...')` | `src/theme/material-palette.ts`（164 行）唯一来源 | 🔄 |

**修复的真实配色缺陷**（实跑 colorjs.io 才暴露，原注释是估算值）：

| 令牌 | 原值 | 问题 | 新值 | 结果 |
| --- | --- | --- | --- | --- |
| `--muted`（日间） | `#8a8174` | 3.78:1，低于 WCAG AA 4.5:1 | `#6d6459` | **5.71:1** ✅ |
| 白字压 `--accent` | `#b5653a` | 4.30:1，低于 4.5:1 | `#9c4f28` | **5.89:1** ✅ |
| `wall-partition`（夜间） | `#5f6875` | **2.93:1**，低于 3:1（原注释误写 3.14:1） | `#68717f` | **3.35:1** ✅ |

---

## 11. 明确未迁移（附理由）

| 项 | 原位置 | 理由 |
| --- | --- | --- |
| `window.View3D` 全局单例 | L3861 | 反模式；改为 `utils/scenePort.ts` 注册表 + `useViewMounts` 挂载位 |
| 手写 `tr(zh,en)` + `data-en` DOM 改写 | L414-444 | 改用 `vue-i18n`；`data-en` 属性属 jQuery 时代做法 |
| `body.m3d` 类名驱动视图切换 | L120 | 改用 store 状态 + 组件挂载位，避免隐式全局状态 |
| 单文件 3895 行结构 | 全文件 | 拆为 141 个模块（见 §13 目录对照） |
| 直接 `document.querySelector` 操作 | 全文 | 改为 Vue 响应式渲染 + 组件 ref |

---

## 12. 迁移中修复的真实缺陷（原版没有，或本工程实现初期引入）

| # | 缺陷 | 影响 | 修复 |
| --- | --- | --- | --- |
| 1 | `stores/ui.ts` 引用了**从未定义**的 `MIN_SCALE`/`MAX_SCALE`/`PX_MM` | `typecheck`/`build`/`test` 全部失败 | 在 `stores/ui.ts` 按 SPEC §D.7 规范位置真实定义（`0.012`/`2`/`25.4/96`） |
| 2 | 3D 模块 18 处 TypeScript 错误（`Wall` 5 元组被当 `number[]`、`tick`/`groundAt`/`colors` 未定义等） | 无法编译 | 修正类型与缺失符号 |
| 3 | `types/plan.ts` 未转出 `Furniture` | `data/presets/three-bed.ts` 编译失败 | 补 `export type { Furniture }` |
| 4 | **`registerViewMount('scene3d', ...)` 从未被调用** | **3D 视图打不开**（`<canvas>` 从不创建），而 typecheck/203 测试/lint/verify **全部通过** | 在 `features/scene3d/index.ts` 模块顶层自注册；`main.ts` 副作用导入 |
| 5 | `verify.mjs` 的 hex 闸门按整行原文匹配 | 把注释里的来源色值、CSS 选择器 `#fab` 误判为违规，逼人删掉有价值的注释 | 改为先剥离注释与 `#id` 选择器；新增**两向自测**防闸门退化 |
| 6 | `verify.mjs` 的 import 守卫把注释里的示例代码当真实 import | 误报「`useXxxStore` 未定义」 | 剥离注释后扫描；647 个导入名全部可解析 |
| 7 | 测试用例直接改 `level.rooms = []` 后不恢复 | 后续用例继承空状态，假失败 | `try/finally` 还原 |
| 8 | 报价单合计与 store 的 `flooringCost` 取整口径不一致 | 显示 25076 vs 25077 | 明确为「展示层取整到整元」，测试按 1 元容差比对 |
| 9 | esbuild 0.28.2 在 Windows 上处理较大模块图时报 `Access is denied` | 构建失败（代码本身无错） | `pnpm.overrides` 锁定 `esbuild@0.25.10` |

> 第 4 条是最值得记录的一条：**四项自动化检查全绿，但功能实际不可用**。只有浏览器实渲染（`.tools/render-check.cjs`，8 项断言）能发现。

---

## 13. 目录对照速查

| 原实现（单文件内区块） | 新实现（目录） | 文件数 |
| --- | --- | --- |
| `:root` 变量 + 样式（L12-215） | `src/theme/` | 7 |
| 类型定义（散落） | `src/types/` | 12 |
| 状态与历史（L1018-1029） | `src/stores/` | 7 |
| 几何/测量/持久化工具（散落） | `src/utils/` | 7 |
| 家具库/材料/户型预设（L522-561, L854+） | `src/data/` | 10 |
| 2D SVG 渲染（L1030-1336） | `src/features/plan2d/` | 24 |
| 3D 场景（L2703-3860） | `src/features/scene3d/` | 22 |
| 工具栏/面板/弹窗（L257-410） | `src/components/` | 13 |
| 亮点功能（原无） | `src/features/extras/` | 29 |
| 组合式函数（散落） | `src/composables/` | 8 |

---

## 14. 验证证据

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 类型 | `npx vue-tsc --noEmit -p tsconfig.json` | 0 错误 |
| 单测 | `npx vitest run` | 203/203 通过（6 个 spec 文件） |
| 构建 | `pnpm build` | 成功，290KB + 600KB（3D 独立分包） |
| 静态闸门 | `node scripts/verify.mjs` | 全部通过（20 项检查） |
| 代码规范 | `npx eslint .` | 0 问题 |
| **浏览器实渲染** | `node .tools/render-check.cjs` | **8/8**：首屏 200、无 JS 错误、2D 图元 591 个、主题令牌注入、3D canvas 904×819 非空白、亮点入口可见、中英切换生效 |

> `.tools/` 为本地验证脚本目录（已被 `.gitignore` 忽略，不入库）。

---

## 15. 源文件处置

- 仓库内保留 `装修设计.html.bak`（2664 行）作为**迁移基准**，供追溯。
- 现行 `装修设计.html`（3895 行）是 `.bak` 的**严格功能超集**（见 `ORIGINAL-FEATURES.md` §9 的逐区块否定式核对），其全部能力已并入本工程并记录在本表；该文件本身不随仓库发布。
