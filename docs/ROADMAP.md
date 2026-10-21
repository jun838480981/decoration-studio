# 后续迭代路线图（ROADMAP）

> 基于 `docs/OSS-RESEARCH.md`（实时核实的 GitHub/npm 数据）与当前实现现状。
>
> **原则**：优先复用成熟库，不重复造轮子（见 OSS-RESEARCH §5 的 12 条红线）。
> 凡是「自研」的，必须写清为什么没有库能替代。

---

## 0. 当前版本（v0.1.0）已完成的能力

| 分类 | 能力 | 状态 |
| --- | --- | --- |
| 2D | 平面图渲染（10 图层）、选择/测量/拆改、吸附、撤销重做、多方案、结构编辑 | ✅ |
| 3D | 程序化建筑与家具、鸟瞰/漫游、门开合、日照/夜景、剖切墙、房间标签、截图 | ✅ |
| 算量 | 房间面积、材料用量（5% 损耗）、报价单、拆墙长度、墙面面积 | ✅ |
| 主题 | 3 套预设 × 47 令牌、语义化、对比度单测（136 项）、3D 主题联动 | ✅ |
| 导出 | PNG、JSON（布置/户型/多方案）、CSV、XLSX、DXF、打印 | ✅ |
| 亮点 | 方案对比、平面图校验、历史面板、命令面板、主题切换 | ✅ |
| i18n | 中英双语（`vue-i18n`） | ✅ |
| 工程 | TS 严格模式、203 单测、20 项静态闸门、ESLint 0 问题、浏览器实渲染 8/8 | ✅ |

---

## 1. P0 —— 建议优先处理（影响正确性或可维护性）

### 1.1 PDF 矢量图册（当前**未实现**，仅有接口）

- **现状**：`src/features/extras/lib/export-pdf.ts` 中 `PDF_EXPORT_AVAILABLE = false`。
  依赖 `pdf-lib` / `@pdf-lib/fontkit` **未安装**（SPEC §H.1 规定「未实现则不安装」）。
  代码只提供 `buildPdfAlbum(album, { renderer })` 注入点，**不伪造任何 PDF 字节流**。
- **当前替代**：打印（`print.ts` + `print.css`），用户「打印 → 另存为 PDF」可得到同样的图册内容。
- **启用步骤**：
  1. `pnpm add pdf-lib@^1.17.1 @pdf-lib/fontkit@^1.1.1`（均 MIT）
  2. 准备 SIL OFL 1.1 中文字体（Noto Sans SC / Source Han Sans），做子集化嵌入
  3. 实现 `PdfAlbumRenderer` 并注入 `buildPdfAlbum`
  4. 把 `PDF_EXPORT_AVAILABLE` 改为 `true`，UI 自动启用按钮
- **成本**：中（1–2 人日）。**风险**：中文字体体积（需在 `THIRD-PARTY.md` §4 登记预算）。
- **注意**：⛔ 不要自研 PDF 排版或字体子集化——那正是 `pdf-lib` + `fontkit` 的职责。

### 1.2 端到端测试补齐（E2E）

- **现状**：单元测试 203 项覆盖 store 契约、主题对比度、组件接线；但**没有 E2E**。
- **本次教训**：3D 视图打不开的缺陷，`typecheck` + 203 单测 + `lint` + `verify` **全部通过**，
  只有浏览器实渲染能发现（见 `MIGRATION.md` §12 第 4 条）。
- **建议**：把 `.tools/render-check.cjs`（8 项断言）正式化为 `tests/e2e/*.spec.ts`，纳入 CI。
- **成本**：低（0.5 人日，脚本已存在，只需改为 Playwright Test 格式）。
- **依赖**：`@playwright/test`（已在 devDependencies）。

### 1.3 IndexedDB 持久化（替换 localStorage）

- **现状**：7 个键全部走 `localStorage`（`src/utils/persistence.ts`）。
- **问题**：`localStorage` 有 5MB 配额；多方案 + 大户型 + 3D 截图缓存会撞墙。
- **建议**：迁移到 IndexedDB，保留 `localStorage` 作为降级路径。
- **选型**：`dexie`（MIT）或 `idb-keyval`（MIT）——**需先在线核实版本与许可证**（OSS-RESEARCH §10 标注为未核实）。
- **成本**：低–中（1 人日，需写迁移脚本）。

---

## 2. P1 —— 性价比高的增强

### 2.1 真实 glTF 家具库

- **现状**：全部家具为**程序化几何**（`features/scene3d/furniture/*.ts`，1606 行）。
- **价值**：真实感是 3D 场景的第一感知；同类项目（Blueprint3D、Sweet Home 3D）都有模型库。
- **选型**：`three` 自带 `GLTFLoader` + `@gltf-transform/cli` 预处理（Draco/KTX2/量化）。
- **成本**：**高**——主要成本在**资产**（需 CC0/CC-BY 授权模型，如 Poly Haven、Kenney、Sketchfab CC0 分区）。
- **建议**：保留程序化模型作低端兜底，glTF 按需加载 + LOD。

### 2.2 PBR 材质库

- **现状**：地板纹理由 Canvas 程序化生成（`features/scene3d/materials.ts`，395 行）。
- **价值**：真实木纹/瓷砖/大理石质感。
- **选型**：CC0 贴图（ambientCG，已核实 CC0 可商用）+ KTX2 压缩。
- **成本**：中（资产 + 体积控制）。

### 2.3 画墙自动识别房间

- **现状**：房间是**人工定义**的多边形（`src/data/presets/*.ts`）。
- **价值**：用户画完墙后自动生成房间区域 + 面积/周长/命名，省事且数据自洽。
- **选型**：`polygon-clipping`（已装，精确锁 `0.15.7`）做多边形布尔 + `earcut`（已装）三角化。
- **成本**：中。**注意**：`polygon-clipping` 最后发布于 2023-12 且未过 1.0，若成风险可整体切到 `martinez-polygon-clipping`（二选一，不要都装）。

### 2.4 3D 后处理画质档位

- **现状**：无后处理，仅 PCFSoft 阴影 + ACESFilmic 色调映射。
- **价值**：SSAO / Bloom / DoF / SMAA 显著提升观感。
- **选型**：`postprocessing`（pmndrs）——**许可证是 Zlib 不是 MIT**，且 peer 要求 `three >=0.168 <0.187`。
  当前锁 `three@0.160.1`，**升级 three 才能用**。
- **成本**：低（接入）但**需先升级 three**（中风险，需回归 3D 全部功能）。

### 2.5 导入 Sweet Home 3D `.sh3d` 工程

- **现状**：无。
- **价值**：与主流开源室内设计工具互操作。
- **成本**：高。`.sh3d` 是 zip + `Home.xml`，**无现成库需自研解析**；且 SH3D 本体为 GPLv2，
  格式互操作需法务确认（本项目 MIT 开源，只做格式读写不引入其代码是可行的，但需审慎）。
- **建议**：暂不立项。

---

## 3. P2 —— 需要资产、算力或架构级投入

### 3.1 照片级路径追踪出图

- **选型**：`three-gpu-pathtracer`（MIT）。
- **成本**：中–高（需降噪/渐进式显示；低端 GPU 需降级到后处理方案）。

### 3.2 墙体真实 CSG 开洞

- **现状**：门窗洞口靠「墙分段近似」（`architecture.ts` 的 `lintels`）。
- **选型**：`three-bvh-csg`（MIT）。
- **成本**：中（需与现有 `WALLS/WINS/DOORS` 数据模型兼容改造，注意重建开销）。

### 3.3 WebXR / VR 漫游

- **选型**：three 内置 WebXR。
- **成本**：中。**价值**：中（"到房子里走一圈"的沉浸需求）。

### 3.4 导出 OBJ / GLB

- **选型**：three 自带 `OBJExporter` / `GLTFExporter`。
- **成本**：低。适合作为快速胜利项。

### 3.5 分享链接 + 水印

- **成本**：中（需后端或 URL 压缩编码）。**价值**：中。

---

## 4. 技术债与风险登记

| # | 项 | 风险等级 | 说明 |
| --- | --- | --- | --- |
| 1 | `polygon-clipping@0.15.7` 停更于 2023-12，未过 1.0 | 中 | 已精确锁版本（不用 `^`）；备选 `martinez-polygon-clipping` |
| 2 | `esbuild` 被 `pnpm.overrides` 锁在 `0.25.10` | 低 | 0.28.2 在 Windows 上有临时文件句柄缺陷；升级时需重新验证构建 |
| 3 | `three@0.160.1` 较旧 | 中 | 升级可解锁 `postprocessing`，但需回归 3D 全部功能 |
| 4 | 无 E2E 测试 | 高 | 见 §1.2，已有 3D 打不开的先例 |
| 5 | `localStorage` 5MB 配额 | 中 | 见 §1.3 |
| 6 | PDF 未实现（仅打印替代） | 低 | 属 P1-可选，SPEC 已明确不作硬性验收 |
| 7 | 中文字体未随包分发 | 低 | 启用 PDF 时需引入 OFL 字体并登记体积 |

---

## 5. 明确的「不做」清单（避免重复造轮子）

以下能力**必须**使用现成库，禁止自研（完整 12 条见 `OSS-RESEARCH.md` §5）：

| 禁区 | 必须使用 |
| --- | --- |
| PDF 排版 / 字体子集化 | `pdf-lib` + `@pdf-lib/fontkit` |
| Excel/xlsx 写出 | `exceljs` |
| CSV 解析/生成 | `papaparse` |
| glTF/GLB 解析与优化 | `GLTFLoader` + `@gltf-transform/*` |
| 3D 相机控制 | three 自带 `OrbitControls` / `PointerLockControls` |
| PBR 光照/材质/环境贴图 | three 材质 + `RoomEnvironment` + PMREM |
| 色彩空间转换 / 主题色阶 / 对比度 | `@material/material-color-utilities` + `colorjs.io` |
| 多边形布尔与三角化 | `polygon-clipping` / `martinez-polygon-clipping` + `earcut` |
| CSG 实体布尔 | `three-bvh-csg` |
| 空间加速结构（BVH） | `three-mesh-bvh` |
| 国际化 / 状态管理 / 路由 | `vue-i18n` / `pinia` / `vue-router` |

**应当自研的**（业务资产，没有库能替代）：户型数据模型、吸附与对齐规则、报价与算量口径、
撤销/重做语义、2D↔3D 同步策略、家具目录结构。这些**必须自研且必须有测试**。

---

## 6. 建议的下一步顺序

1. **E2E 测试正式化**（§1.2，成本最低、价值最高——已有 3D 缺陷先例）
2. **IndexedDB 迁移**（§1.3，数据安全）
3. **PDF 图册**（§1.1，装依赖 + 字体子集化）
4. **three 升级 + 后处理**（§2.4，观感提升明显）
5. **glTF 家具库**（§2.1，需先解决资产授权与体积）
