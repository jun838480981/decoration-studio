# 开源同类项目与可复用库调研（OSS-RESEARCH）

- 任务：`t2` / `t-oss-research`（团队 decoration-studio）
- 作者：`oss-researcher`
- 写作时间：2026-10-20（Asia/Shanghai），所有联网数据为**同一时间点**抓取
- 目的：让团队**不重复造轮子**——先找现成项目/库，再谈自研；同时为「Vue3 + Vite + TS 迁移 + 配色体系优化 + 亮点功能补齐」提供可直接落地的选型依据
- 产出位置：`decoration-studio/docs/OSS-RESEARCH.md`

---

## 0. 核实等级声明（请先读这一节）

本会话 `web_search` **不可用**（缺 `DEEPSEEK_API_KEY`），但 `web_fetch` **可用**。因此我没有停留在"基于记忆猜"，而是实时拉取了权威数据源：

| 数据源 | 用途 | 结果 |
| --- | --- | --- |
| `https://registry.npmjs.org/-/v1/search` 与 `/{pkg}/latest` | npm 包版本 / 许可证 / 月下载量 | ✅ 可用，已核实 27 个包 |
| `https://api.github.com/search/repositories`、`/repos/{owner}/{repo}` | star / license / 语言 / 最后 push | ✅ 可用，已核实 20+ 仓库 |
| `https://sourceforge.net/rest/p/sweethome3d/` | Sweet Home 3D 官方项目元数据（许可证/活跃度/代码库） | ✅ 可用 |
| `https://en.wikipedia.org/api/rest_v1/...` | 补充说明 | ❌ fetch failed（本机网络不可达） |
| `https://www.sweethome3d.com/features/` | 功能清单 | ⚠️ 页面为 JS 渲染，正文被截断，仅取到站点结构 |

**标记体系（全文强制遵守）：**

- `【已核实】`：2026-10-20 通过上述 API 实时返回的字段（版本/许可证/star/license/最后提交）。
- `【基于既有知识、未经在线核实】`：我**没有**在线确认，**不得**据此写进 `package.json` 或据此判断许可证合规。
- 文中**没有任何编造的 star 数、版本号或链接**。所有链接均为我本次实际请求过的 URL；未经核实的只说"候选检索词"，不编链接。
- 数据会漂移（star、版本、许可证都可能变）。**落地前请按 §9 附录 A 复核**。

---

## 1. 迁移基线的能力快照（`装修设计.html`，3895 行）

先明确"我们已有什么"，才能定义"缺什么"。以下均通过阅读根目录 `装修设计.html` 得出（行号为该文件行号）。

| 能力域 | 现状 | 实现要点（证据） |
| --- | --- | --- |
| 3D 内核 | three.js `0.160.0`（CDN importmap，非 npm） | L249-252 importmap；L2682-2687 引入 `OrbitControls / PointerLockControls / RoundedBoxGeometry / RoomEnvironment / CSS2DRenderer` |
| 3D 画质 | PCFSoft 阴影（平板 2048 / 桌面 4096）、ACESFilmic 色调映射 | L2705-2728、L3612 |
| 3D 内容 | **全程序化建模**（box/cyl/lathe/torus 拼家具），无外部模型资产 | L2859-3445；地板贴图由 canvas pattern 生成 L2853 |
| 3D 交互 | 鸟瞰/漫游、门可开关、房间飞行跳转、时间轴日照 7:00-18:00、夜景 | L301-306、L330、L3612、L3652 |
| 2D 编辑器 | SVG 平面：墙/房间/门/窗/推拉门/楼梯/挑空，承重墙拆改、尺寸标注、测量、网格、图层、贴墙吸附 | L274-320、L1171-1340、L2154-2510 |
| 交互基建 | 自研 pointer 事件（含双指捏合、`pointer:coarse` 触屏适配） | L1003-1004、L1644-1810 |
| 历史 | 快照式 undo/redo（上限 150 步） | L1021-1029 |
| 方案库 | 内置 7 个户型 + 自定义户型：新建/复制/改名/删除/缩略图/多层 | L854、L1990-2140 |
| 持久化 | `localStorage`（方案 + 每方案每层 state），`try/catch` 静默失败 | L983、L1902-1913、L2049 |
| 导入导出 | 布置 JSON、户型 JSON、PNG（SVG→canvas 3200px 宽）、3D 截图 | L334-341、L1879-1897 |
| 算量报价 | 房间面积（鞋带公式）、地面材料×单价×1.05 损耗、拆墙长度、墙面积估算 | L902-905、L1362-1388 |
| 国际化 | 自研 `tr(zh,en)` + `data-en` 属性 + `NAMES_EN` 映射，中英双语 | L414-444 |
| 配色 | 单套 `:root` 变量（暖米色 + 陶土橙 `#b5653a` + 墨绿 `#2f5d62`），**无深色模式、无主题生成** | L12-14；全文件无 `prefers-color-scheme` / `data-theme` |
| 缺失（本次调研重点） | 无 PDF/Excel/DXF 导出、无 glTF 家具、无 PBR 材质库、无 CSG 开洞、无多边形布尔、无 IndexedDB、无云/分享、无方案对比、无命令面板、无 WebXR | 见 §6 |

---

## 2. 候选开源项目（按要求覆盖 5 类原型）

### 2.1 Blueprint3D 系 —— **最直接的原型，学习价值最高**

| 项目 | 用途 | 能力边界 | 许可证 | 可直接借鉴的点 |
| --- | --- | --- | --- | --- |
| [`furnishup/blueprint3d`](https://github.com/furnishup/blueprint3d) | three.js 写的"2D 平面图 → 摆家具 → 3D 室内"可定制应用 | 【已核实】1987★ / 584 fork / TypeScript / **MIT** / 最后 push **2021-01-20** / 102 open issues。README 自陈：原型阶段产物、从未重构、代码质量一般 | **MIT**（可自由借用） | 目录分层 `core / floorplanner / items / model / three` 正是我们该抄的架构；2D↔3D 双向同步；家具"目录 + 价格/数量"；序列化设计（其 TODO 明说要换更好的序列化格式，我们的 JSON schema 可以做得更好） |
| [`aalavandhaann/blueprint-js`](https://github.com/aalavandhaann/blueprint-js) | blueprint3d 的 ES6 重写版，主题含 kitchen/cabinet | 【已核实】591★ / **MIT** / JS / 最后 push 2024-11-20 | **MIT** | 橱柜/厨电参数化建模、更大的模型库（仓库体积 280MB 级） |
| [`charmlinn/blueprint3d-modern`](https://github.com/charmlinn/blueprint3d-modern) | "现代 TS 重写、更快更干净、仍在维护" | 【已核实】158★ / **MIT** / TS / 创建 2026-03-25、最后 push 2026-05-22 | **MIT** | 作为"现代重构长什么样"的对照；**年轻、未经大规模验证，不建议依赖** |
| [`pegasus1982/threejs-3d-building-configurator`](https://github.com/pegasus1982/threejs-3d-building-configurator) | 基于 blueprint3d 的 3D 建筑配置器 | 【已核实】16★ / **无 license 字段** / HTML / 最后 push 2022-09-15 | ⚠️ 无许可证 | 只能读思路，**不能拷代码** |

**关键结论（Blueprint3D）**：它的**架构分层**和**交互模型**值得全盘借鉴，但代码已 5 年未更新、依赖 grunt + jquery 且 README 明说"未重构"，因此 **不要整包移植**；我们应该用 Vue3 + Pinia 重新组织同构的分层（model / floorplanner2d / viewer3d / export），把它的"设计决策"当规范、把它的"实现"当反例。

### 2.2 Sweet Home 3D 系 —— **功能完备度标杆（桌面端）**

| 项目 | 用途 | 能力边界 | 许可证 | 可直接借鉴的点 |
| --- | --- | --- | --- | --- |
| Sweet Home 3D（官方，SourceForge） | 桌面室内设计：画平面图 → 摆家具 → 3D 浏览/渲染 | 【已核实】SourceForge 项目 `sweethome3d`：**GPLv2**、状态 active、Java Swing + 内置 JavaScript、代码托管在 SVN（`svn://svn.code.sf.net/p/sweethome3d/code/`），官网 [sweethome3d.com](https://www.sweethome3d.com/)；含简体/繁体中文翻译 | **GPLv2** ⚠️ | 功能清单与信息架构：家具目录、多楼层、房间自动面积、**照片级渲染**、尺寸标注、导出 PDF/SVG/OBJ、`.sh3d` 单文件工程、插件 API。**GPL 代码不可并入我们的产物**，只做"功能对照表" |
| [`adizanni/ExportToHASS`](https://github.com/adizanni/ExportToHASS) | SweetHome3D 插件：把户型导出给 Home Assistant | 【已核实】70★ / **GPL-3.0** / Java / 最后 push 2024-02-16 | GPL-3.0 ⚠️ | "设计稿→智能家居点位"的映射思路 |
| [`fabien-michel/sweethome3d-textures-ambientcg`](https://github.com/fabien-michel/sweethome3d-textures-ambientcg) | 把 [ambientCG](https://ambientcg.com/) 的 CC0 贴图转成 SH3D 材质库 | 【已核实】40★ / **CC0-1.0** / Python / 最后 push 2025-05-06 | CC0（资产）/脚本自用 | **贴图资产来源方案**：ambientCG 的 CC0 PBR 贴图（颜色/法线/粗糙度）可商用，是我们补"地板-瓷砖-木纹真实质感"的合法来源 |
| [`Vanuan/sweethome3d`](https://github.com/Vanuan/sweethome3d)、[`ralic/sweethome-3d`](https://github.com/ralic/sweethome-3d) | 第三方 CVS/GitHub 镜像 | 【已核实】46★（license = `Other`）/ 38★（无 license）；均非官方 | ⚠️ | 不采用 |

### 2.3 floorplan.js / FloorPlanJS 系 —— **需精确区分，其中"正主"不可用**

| 项目 | 用途 | 能力边界 | 许可证 | 结论 |
| --- | --- | --- | --- | --- |
| [`smplrspace/floorplan.js`](https://github.com/smplrspace/floorplan.js)（npm `floorplan.js`，官网 floorplanjs.org） | "Create and render floor plans in Javascript easily"（2D/3D 户型渲染 SDK） | 【已核实】npm `floorplan.js@0.1.1`（发布 2022-02-07，仓库 push 同为 2022-02-07）；GitHub **14★ / license 字段为空**；npm `/latest` 响应中**无 license 字段** | ❌ **无许可证 + 已停更** | **禁止拷贝/禁止依赖**。它的主页面向的是 Smplrspace 商业产品 |
| [`ekymo/homeRoughEditor`](https://github.com/ekymo/homeRoughEditor) | 纯 JS + SVG 的户型/家装草图编辑器（client 端） | 【已核实】397★ / **MIT** / JS / 最后 push 2024-07-21 | MIT ✅ | 同类需求里**最贴近我们 2D 编辑器**的 MIT 实现：墙体/房间/门窗的 SVG DOM 组织、拖拽绘制状态机 |
| [`oodavid/SVG-Floorplan-Editor`](https://github.com/oodavid/SVG-Floorplan-Editor) | 老式 SVG 平面图编辑器 | 【已核实】24★ / **无 license** / 最后提交 2012 | ⚠️ | 只读思路，不拷代码 |
| [`andsilver/floorplan-angular`](https://github.com/andsilver/floorplan-angular) | Angular 13 + **Fabric.js** 画房间原型 | 【已核实】76★ / **无 license** / TS / 最后 push 2023-02-04 | ⚠️ | 只读思路 |
| [`irongollem/wallgraph`](https://github.com/irongollem/wallgraph) | "墙-图（wall graph）"数据模型、mm 级精确、零运行时依赖的浏览器编辑器 | 【已核实】3★ / **AGPL-3.0** / TS / 2026 年新项目 | AGPL ⚠️ | 数据模型（wall graph 而非 wall rect 列表）值得借鉴；**AGPL 代码不可并入** |
| [`Open-Location-Stack/floorplan-editor`](https://github.com/Open-Location-Stack/floorplan-editor) | OGC IMDF 地图编辑/校验器 | 【已核实】3★ / 无 license / TS | ⚠️ | 室内地图标准（IMDF）可作为长期互操作方向，非当前优先级 |

**关键结论（floorplan.js）**：市面上**没有一个"叫 floorplan.js 且许可证清晰、持续维护"的通用库**。名字相似的项目要么无许可证（smplrspace、oodavid、andsilver），要么是业务代码（homeRoughEditor，MIT）。**结论：平面图编辑内核必须自研或基于 MIT 项目重构，不存在可直接 npm 依赖的"户型编辑器"成品库。**

### 2.4 GitHub 上 three.js 户型/装修编辑器类

| 项目 | 用途 | 能力边界 | 许可证 | 可借鉴点 / 风险 |
| --- | --- | --- | --- | --- |
| [`cvdlab/react-planner`](https://github.com/cvdlab/react-planner) | React 组件：2D 平面设计 + 3D 漫游（three.js） | 【已核实】1482★ / 499 fork / **MIT** / JS / 最后 push **2024-04-20**；npm `react-planner@2.0.6`（MIT，最后发布 **2019-11-03**，月下载 ~23k），已有多个 fork（`floorplan-builder`、`react-planner-fork`） | **MIT** ✅ | **数据模型**（layers/lines/areas/items/holes）+ **状态机式的绘制工具**是目前开源里最完整的参考；但 **React 专用 + npm 停更 7 年** → 不依赖、只借鉴架构 |
| [`tentone/dt3d-ha`](https://github.com/tentone/dt3d-ha) | three.js 数字孪生：HA 卡片/插件 + **内置户型编辑器** + 导入模型 | 【已核实】36★ / **MIT** / JS / 最后 push 2026-10-06 | MIT ✅ | 小体量、活跃，可读"3D 编辑器 + 卡片化 UI"的整合方式 |
| [`wy51ai/floorplan-3d`](https://github.com/wy51ai/floorplan-3d) | 同名需求的 HTML 项目 | 【已核实】2607★ / **MIT** / HTML / 仓库仅 18KB / 创建 2026-09-29 | MIT（但⚠️**异常**） | 3 周内 2607★ 且仓库只有 18KB —— **疑似刷星/空壳**，请勿据此判断"同类项目已成熟"；需人工打开确认后再决定是否参考 |
| [`Sunflower613/blueprint3d-babylon`](https://github.com/Sunflower613/blueprint3d-babylon) | Babylon.js 重写的 blueprint3d 内核（中文描述，含在线预览/离线保存/文件转换） | 【已核实】仓库存在、描述如上；**star/license 未取到（响应被截断）** | 【基于既有知识、未经在线核实】 | 若未来考虑换渲染引擎（Babylon）可作参考；当前不建议 |
| 研究类（**不建议并入**） | —— | [`art-programmer/FloorplanTransformation`](https://github.com/art-programmer/FloorplanTransformation) 682★ MIT（raster→vector 论文代码，Lua/Py）；[`grebtsew/FloorplanToBlender3d`](https://github.com/grebtsew/FloorplanToBlender3d) 631★ **GPL-3.0**；[`zlzeng/DeepFloorplan`](https://github.com/zlzeng/DeepFloorplan) 418★ **GPL-3.0** | 混合 | 「上传平面图照片自动描摹成矢量户型」属**高成本 AI 方向**，当前不立项 |

### 2.5 Home Assistant floorplan 卡片类 —— **交互模式与"实体↔图元"映射**

| 项目 | 用途 | 能力边界 | 许可证 | 可借鉴点 |
| --- | --- | --- | --- | --- |
| [`ExperienceLovelace/ha-floorplan`](https://github.com/ExperienceLovelace/ha-floorplan) | 把 HA 实体映射到 SVG 对象：控制设备、显示状态、订阅服务、自定义样式 | 【已核实】1628★ / **Apache-2.0** / TypeScript / 最后 push **2026-09-13**（活跃） | Apache-2.0 ✅ | **核心思想可复用**：`实体 → SVG 元素 id → 状态/样式/动作` 的声明式绑定。即使我们不做智能家居，这个"图元绑定外部状态"的机制可直接用于：**设备点位图、家具与报价行联动、房间与清单联动** |
| [`pkozul/ha-floorplan`](https://github.com/pkozul/ha-floorplan) | 上一代 HA SVG 户型卡片 | 【已核实】1737★ / **无 license** / HTML / **archived（已归档）** / 最后 push 2021-01-25 | ⚠️ 无许可证 | 只读思路，**禁止拷代码** |
| [`nicosandller/easy-floorplan`](https://github.com/nicosandller/easy-floorplan) | HA 卡片：**可视化拖拽编辑器**（墙、门、家具、文字、设备控件） | 【已核实】635★ / **MIT** / TS / 创建 2026-05-21、最后 push **2026-10-20**（非常活跃） | MIT ✅ | 与我们形态最接近的**活跃 MIT 项目**：编辑器 UI 组织、墙体绘制、文字标注、卡片化预览 |
| [`ghys/habpanel-3dview`](https://github.com/ghys/habpanel-3dview) | 在 HABPanel 里显示并交互 Sweet Home 3D 的 WebGL 导出 | 【已核实】26★ / **MIT** / 最后 push 2017 | MIT ✅ | "3D 场景 + 热点交互"的轻量做法 |

---

## 3. 许可证决策表（能不能抄代码）

| 许可证 | 本项目是否可用代码 | 涉及对象 |
| --- | --- | --- |
| MIT / ISC / Apache-2.0 / BSD / Zlib / CC0 | ✅ 可以依赖与借鉴（保留版权声明） | blueprint3d、blueprint-js、homeRoughEditor、react-planner、easy-floorplan、ExperienceLovelace/ha-floorplan、three 生态绝大多数库、ambientCG 贴图 |
| GPLv2 / GPL-3.0 / AGPL-3.0 | ⚠️ **只读思路，不拷代码、不做衍生**（除非本项目也 GPL 开源） | Sweet Home 3D、ExportToHASS、FloorplanToBlender3d、DeepFloorplan、wallgraph |
| 无 license 字段 | ❌ **默认保留全部权利**：既不能拷代码，也不能"参考后重写同结构"到可辨识程度 | pkozul/ha-floorplan、smplrspace/floorplan.js、oodavid/SVG-Floorplan-Editor、andsilver/floorplan-angular、pegasus1982/threejs-3d-building-configurator、Open-Location-Stack/floorplan-editor |
| 待确认 | 需 captain 确认本项目是否开源、是否要发布 | 若本项目**闭源商用**：全项目禁止任何 GPL/AGPL/无 license 代码；若**开源但用 MIT**：同样禁止 GPL 代码混入（否则整体被传染） |

> 行动建议：在仓库根目录加 `THIRD-PARTY.md`，按"依赖名 / 版本 / 许可证 / 用途"登记；CI 里加许可证扫描（【基于既有知识、未经在线核实】可用 `license-checker` 或 `pnpm licenses list`）。

---

## 4. 直接依赖 npm 库选型表（替代自研的收益）

> 版本与许可证均为 **2026-10-20 实时抓取**。`月下载` 用于判断社区规模。

### 4.1 3D 内核与渲染

| 包名 | 版本【已核实】 | 许可证 | 用途 | 替代自研的收益 |
| --- | --- | --- | --- | --- |
| `three` | `0.186.1` | MIT | 3D 引擎主体 | 已在用（当前为 CDN 0.160.0）；改为 npm 依赖后可 tree-shaking、锁版本、走 Vite 优化 |
| `three/addons`（three 内置 `examples/jsm`） | 随 three | MIT | OrbitControls / PointerLockControls / GLTFLoader / CSS2DRenderer / RoomEnvironment | **已有**，继续用；不要自己写相机控制器 |
| `postprocessing`（pmndrs） | `6.39.5` | **Zlib**（非 MIT，注意） | SSAO / Bloom / DoF / SMAA / ToneMapping 后处理链 | 自研后处理 = 重写 WebGL render target 编排，性价比极低；**peer 依赖 `three >= 0.168 < 0.187`**，与 0.186.x 匹配 |
| `three-mesh-bvh` | `0.9.16` | MIT | 加速射线检测 / 碰撞 / 拾取 | 大场景点选与家具吸附的射线性能，自研 BVH 不现实 |
| `three-bvh-csg` | `0.0.18` | MIT | 布尔运算（墙体真实开洞） | 门/窗/垭口目前靠"墙分段近似"（`segs()`），CSG 可实现真开洞与异形吊顶 |
| `three-gpu-pathtracer` | `0.0.27` | MIT | GPU 路径追踪出图（照片级效果图） | 想要"渲染级出图"时，这是唯一理性路径（自研不可能） |
| `@gltf-transform/core` `/extensions` `/functions` `/cli` | `4.5.1` | MIT | glTF 读取/优化（Draco、KTX2、quantize、LOD、批量压缩） | 家具资产管线；自研 glTF 解析/优化 = 灾难 |

### 4.2 几何 / 编辑器交互

| 包名 | 版本【已核实】 | 许可证 | 用途 | 替代自研的收益 |
| --- | --- | --- | --- | --- |
| `interactjs` | `1.10.28` | MIT | 拖拽 / 缩放 / 旋转 / 吸附 / 惯性 / 多点触控 | 现有自研 pointer 状态机（L1644-1810）可缩到"业务规则"层；手势与惯性交给库 |
| `polygon-clipping` | `0.15.7` | MIT | 多边形布尔（并/交/差/异或） | 房间多边形求面积、墙体占地扣减、区域合并。⚠️ **最后发布 2023-12（`2023-12-18T15:38Z`，源码内 npm 时间戳 2023-12-11），且仍在 0.15.x 未过 1.0 → 建议在 `package.json` 里精确锁版本、不要写 `^`**（captain 侧已用 GitHub Security Advisory API 核实：npm/polygon-clipping 无已知安全公告） |
| `martinez-polygon-clipping` | `0.9.0` | MIT | **同一问题（多边形布尔）的备选实现**，API 不同、活跃度更好 | ⚠️ **与 `polygon-clipping` 是二选一关系，不要两个都装**；若 `polygon-clipping` 的"停更 + 未过 1.0"成为风险，则整体切换到本包 |
| `earcut` | `3.2.4` | ISC | 多边形三角化 | three 的 `ShapeGeometry` 内部已用；异形地面/吊顶自研三角化无意义 |
| `konva`（可选） | `10.9.0` | MIT | Canvas 2D 场景图（Transformer 缩放/旋转手柄、拖拽、命中检测） | **仅当决定把 2D 编辑器从 SVG 改为 Canvas 时**采用；改造成本高，需评估 |
| `moveable`（daybrush） | `0.53.0` | MIT | DOM 元素级拖拽/缩放/旋转/吸附/分组 | 与 `interactjs` 功能重叠，**只选一个**；注意 npm 最后发布为 2023-12-03 |
| `dxf-writer` | `1.18.4` | MIT | 导出 DXF（CAD 交付） | 自研 DXF 文本格式 = 无底洞 |
| `@tarikjabiri/dxf` | `2.9.0` | MIT | TS 版 DXF 读写（更活跃） | 同上，TS 项目更顺手 |

### 4.3 导出（PDF / Excel / CSV / 图片）

| 包名 | 版本【已核实】 | 许可证 | 用途 | 替代自研的收益 |
| --- | --- | --- | --- | --- |
| `pdf-lib` | `1.17.1` | MIT | 浏览器端生成/修改 PDF | 排版、字体嵌入、页面流全部现成 |
| `@cantoo/pdf-lib` | `2.11.1` | MIT | pdf-lib 的**活跃维护分支**（2026-09-15 发布） | 若 `pdf-lib` 停更影响安全性/兼容性，可无缝切换 |
| `@pdf-lib/fontkit` | `1.1.1` | MIT | 自定义字体嵌入（中文子集） | **中文 PDF 必须**：不嵌字体会乱码 |
| `pdfmake` | `0.3.12` | MIT | 声明式 PDF 排版（表格/页眉页脚） | 若更看重"报价单排版"而非"改现有 PDF"，它比 pdf-lib 更省事 |
| `jspdf-autotable` | `5.0.9` | MIT | jsPDF 表格插件 | 备选方案 |
| `exceljs` | `4.4.0` | MIT | 生成带样式/公式/冻结窗格的 xlsx | 清单导出首选；注意 npm 最后发布 2023-10-19 |
| `xlsx`（SheetJS CE） | `0.18.5` | Apache-2.0 | xlsx 读写 | ⚠️ **npm 上的 0.18.5 已停更（2022-03）**，新版只在 SheetJS 自有 CDN 分发；若不想引入"非 npm 源"，改用 `exceljs` |
| `xlsx-js-style` | `1.2.0` | Apache-2.0 | SheetJS CE + 单元格样式 | 需要样式又想要 Apache-2.0 时的折中 |
| `papaparse` | `5.7.0` | MIT | CSV 解析/生成（含流式、Worker） | CSV 导入导出的边界情况极多，不要自研 |
| `html-to-image` | `1.11.13` | MIT | DOM/SVG → PNG/SVG | 现有 `exportPNG` 手写 SVG 序列化（L1880-1897）可用，但**跨浏览器字体/外链图片**是坑，可作为兜底方案 |
| `modern-screenshot` | `4.7.0` | MIT | 同上（新实现，活跃） | 备选，二选一 |

### 4.4 配色 / 主题（团队目标第二支柱）

| 包名 | 版本【已核实】 | 许可证 | 用途 | 替代自研的收益 |
| --- | --- | --- | --- | --- |
| `@material/material-color-utilities` | `0.4.0` | Apache-2.0 | Material Design 3 (M3) 色彩系统：HCT 色彩空间、**从种子色生成 tonal palette**、从图片提取主色 | **配色体系的核心引擎**：给一个种子色（当前 `--accent:#b5653a`）即可生成完整的亮/暗双主题色阶，替代手调色板 |
| `colorjs.io` | `0.7.1` | MIT | 现代色彩空间转换、**WCAG 对比度 / APCA** | 对比度自检（无障碍）、色域映射（P3/sRGB） |
| `culori` | `4.0.2` | MIT | 通用色彩库（Lab/LCH/混合/色差） | 渐变、色差、插值 |
| `chroma-js` | `3.2.0` | **(BSD-3-Clause AND Apache-2.0)** | 轻量色彩操作 | 备选（功能少于 culori） |

### 4.5 工程基建

| 包名 | 版本【已核实】 | 许可证 | 用途 | 备注 |
| --- | --- | --- | --- | --- |
| `pinia` | `4.1.0` | MIT | 状态管理（户型/布置/UI/历史 4 个 store） | 替代全局可变 `state` 单例（现有 L1021-1029） |
| `vue-i18n` | `11.4.16` | MIT | 正式 i18n（词条抽离、复数、日期、自动语言检测） | 替代手写 `tr(zh,en)`（L414-444） |
| `@vueuse/core` 及同仓库子包 | 同版本线 **15.0.0**【已核实：`@vueuse/components`/`router`/`math` 均为 15.0.0 MIT】；`@vueuse/core` 本身**未直接命中**，版本请复核 | MIT | 手势、`useStorage`、`useMagicKeys`、节流、`useFullscreen` 等 | 现有大量手写工具函数可删除 |
| `zod` | 【基于既有知识、未经在线核实】 | 【同上，通常为 MIT】 | 导入 JSON 的运行时校验 | 现有 `normalizePlan()`（L1916+）是手写校验，zod 更严谨、可生成 TS 类型 |
| `dexie` 或 `idb-keyval` | 【基于既有知识、未经在线核实】 | 【同上】 | IndexedDB 持久化 | 现有 localStorage 会撞 5MB 配额（截图/大户型/多方案），换 IndexedDB 是刚需 |

---

## 5. 禁止重复造轮子的"禁区"（红线）

> 判定标准：**该问题有成熟通用解 + 通用解的正确性极难自证 + 自研收益仅为"少一个依赖"**。以下 12 条为红线，PR 里出现自研实现应被 review 打回。

| # | 禁区 | 必须使用 | 理由 |
| --- | --- | --- | --- |
| 1 | **不自研 PDF 排版/生成** | `pdf-lib` / `@cantoo/pdf-lib` / `pdfmake`（中文必须 `@pdf-lib/fontkit`） | 字体子集化、CJK 度量、页面流、压缩，全是深坑 |
| 2 | **不自研 Excel/xlsx 写出** | `exceljs`（或 `xlsx-js-style`） | OOXML 容器、共享字符串表、样式索引 |
| 3 | **不自研 CSV 解析** | `papaparse` | 引号转义、BOM、分隔符嗅探、流式 |
| 4 | **不自研 glTF/GLB 解析与优化** | three `GLTFLoader` + `@gltf-transform/*` | 规范庞大（Draco/KTX2/动画/材质扩展） |
| 5 | **不自研 3D 场景控制**（相机轨道、第一人称、指针锁定） | `OrbitControls` / `PointerLockControls`（three addons） | 已在用；重写只会引入抖动与边界 bug |
| 6 | **不自研 PBR 光照/材质/环境贴图** | three `MeshStandardMaterial` / `MaterialPhysicalMaterial` + `RoomEnvironment` + PMREM | 已在用（L2729-2735、L2803-2805） |
| 7 | **不自研色彩空间转换 / 主题色阶生成 / 对比度计算** | `@material/material-color-utilities` + `colorjs.io`（+ `culori`） | HCT/OKLCH 数学与 WCAG/APCA 阈值不容出错 |
| 8 | **不自研多边形布尔与三角化** | `polygon-clipping` / `martinez-polygon-clipping` + `earcut` | 退化边、自交、孔洞、数值鲁棒性 |
| 9 | **不自研 CSG（实体布尔）** | `three-bvh-csg` | 目前靠"墙分段"（`segs`）规避，真开洞必须用 CSG |
| 10 | **不自研空间加速结构（BVH、四叉树用于拾取）** | `three-mesh-bvh` | 性能与正确性 |
| 11 | **不自研拖拽/缩放/旋转手势引擎** | `interactjs`（或 `moveable`，二选一） | 多点触控、惯性、吸附、边界约束 |
| 12 | **不自研国际化/状态管理/路由/键盘快捷键** | `vue-i18n` / `pinia` / `vue-router` / `@vueuse/core` | 框架级能力，自研=重复社区工作量 |

**同时明确"应当自研"的反例（避免过度抽库）**：户型数据模型（walls/rooms/doors/…）、吸附与对齐规则、报价与算量规则、撤销/重做语义、2D↔3D 同步策略、家具目录结构。这些是本项目的**业务资产**，没有现成库能替代，**必须自研且必须写好测试**。

> 附注：不要重写 three 的数学库（`Vector2/3`、`Matrix4`、`Shape`、`Curve`、`Euler`）与 `BufferGeometryUtils`；现有代码已正确使用（L2859+）。

---

## 6. 缺失亮点功能候选（原 HTML 没有、同类项目普遍有）

> 成本：低＝1 人日量级内 / 中＝数人日 / 高＝需要资产或架构级投入。价值以"用户可感知 + 对标同类项目"衡量。

| # | 亮点功能 | 同类项目对照 | 成本 | 用户价值 | 复用哪个库 | 落地要点与风险 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **报价单 / 施工清单导出 PDF**（封面 + 户型图 + 房间面积表 + 主材表 + 家具表 + 合计） | Sweet Home 3D 导出 PDF；商业 App 标配 | 中 | 高（可直接给业主/工长） | `pdf-lib` + `@pdf-lib/fontkit` + `pdfmake`（二选一排版） | 中文字体必须子集嵌入并注意许可证（用思源黑体等 OFL 字体）；图表可复用现有 SVG→PNG |
| 2 | **家具与主材清单导出 Excel**（含样式、合计公式、冻结表头） | 商业装修工具标配；蓝图类工具的"价格/数量" | 低 | 高（做预算/采购） | `exceljs` | 公式用 Excel 原生（不要只写死值），便于业主改；注意 npm 包最后发布于 2023 |
| 3 | **平面图导出 SVG / DXF**（交付设计/CAD） | Sweet Home 3D 导出 SVG/PDF；CAD 协作 | 低（SVG）/ 中（DXF） | 中 | SVG：直接序列化现有 DOM；DXF：`dxf-writer` / `@tarikjabiri/dxf` | 需要"图纸规范"：图框、比例尺（已有 scalebar）、图层命名、线宽 |
| 4 | **真实 glTF 家具库替换程序化几何**（保留程序化模型作低端兜底） | Blueprint3D 的模型库、Sweet Home 3D 家具目录 | 高 | 高（真实感是第一感知） | three `GLTFLoader` + `@gltf-transform/cli` 预处理（Draco/KTX2/量化）+ `three-mesh-bvh` 加速拾取 | 资产是主要成本：需 CC0/CC-BY 授权模型（ambientCG、Poly Haven、Sketchfab CC0 分区）；必须做 LOD 与懒加载 |
| 5 | **PBR 材质库（墙漆/木地板/瓷砖/大理石一键切换）** | Sweet Home 3D 材质库；现只有 canvas 图案（L2853） | 中 | 高 | three 材质 + CC0 贴图（ambientCG） | 贴图体积控制（KTX2 压缩）；与"配色体系"联动（墙漆色 = 主题色阶） |
| 6 | **照片级效果图渲染出图**（一键路径追踪出 2K/4K 图） | Sweet Home 3D 的"创建照片/视频" | 中 | 高（卖点强） | `three-gpu-pathtracer` + `three-mesh-bvh` | 需降噪/渐进式显示；低端 GPU 要有降级（退回 `postprocessing` 的 SSAO+Bloom） |
| 7 | **3D 后处理画质档位**（SSAO / Bloom / DoF / SMAA） | 主流 web 3D 配置器 | 低 | 中 | `postprocessing`（pmndrs，**Zlib 许可**，peer three 0.168–0.186） | 提供"性能/平衡/画质"三档；移动端默认关 |
| 8 | **墙体真实 CSG 开洞**（门/窗/垭口/壁龛，替换分段近似） | Sweet Home 3D 墙体开口 | 中 | 中（几何严谨度） | `three-bvh-csg` | 与现有 `WALLS/WINS/DOORS` 数据模型兼容改造；注意重建开销（用脏标记） |
| 9 | **画完墙自动识别房间**（自动生成房间多边形 + 面积/周长/命名） | Sweet Home 3D、react-planner 均自动生成房间区域 | 中 | 高（省事、数据自洽） | `polygon-clipping` / `martinez-polygon-clipping` + `earcut` | 现有方案是**人工定义房间**（`RM()` 预设）；自动生成后仍需人工改名/改材质 |
| 10 | **撤销/重做历史面板 + 方案 A/B 对比** | Blueprint3D 有设计保存；商业工具普遍有"方案对比" | 中 | 高（改方案是高频场景） | 自研 store（Pinia）+ `pinia` 持久化；**不用第三方** | 现为快照栈无 UI（L1021-1029）；升级为"命名快照 + 面板 + 并排 2D/3D 对比" |
| 11 | **深/浅双主题 + 主题色一键生成 + 对比度自检**（配色体系核心竞争力） | 现代 web 工具标配；现无深色（L12-14） | 低 | 高（也是团队目标） | `@material/material-color-utilities` + `colorjs.io` | 见 §7；注意 3D 场景背景/曝光需随主题切换 |
| 12 | **工程数据落 IndexedDB + 导入校验**（大户型/多方案/截图不再丢） | 商业工具本地缓存；现为 localStorage（L983、L1902-1913） | 低 | 中（数据安全） | `dexie` 或 `idb-keyval`【未在线核实】+ `zod`【未在线核实】 | 需写迁移脚本（localStorage → IndexedDB）；配额与清理策略 |

**备选（未进前 12，可作为 P2）**：
- WebXR/VR 漫游（three 内置 WebXR；对齐"到房子里走一圈"的需求，成本中/价值中）
- 导入 Sweet Home 3D `.sh3d` 工程（zip + `Home.xml`；**无现成库，需自研解析**，且 SH3D 为 GPL，格式互操作需法务确认，成本高）
- 导出 OBJ/GLB 供外部渲染（three `OBJExporter`/`GLTFExporter`，成本低）
- 2D 图纸分享链接 + 水印（成本中，价值中）
- 命令面板 / 快捷键提示（Ctrl+K；`@vueuse/core` `useMagicKeys`，成本低）

---

## 7. 与"配色体系优化"的结合点（团队目标第二支柱）

现状问题：单一 `:root` 变量（L12-14），暖米色 + 陶土橙 + 墨绿，**无深色模式、无状态色语义（成功/警告/危险/信息）、无对比度校验、图表与 3D 场景未与主题联动**。

建议方案（复用库，不造轮子）：

1. **种子色 → 色调板**：以现有 `--accent:#b5653a` 为种子，用 `@material/material-color-utilities`（Apache-2.0, v0.4.0）生成 M3 tonal palette，自动产出 light/dark 两套 20 个 tone 的色阶。
2. **语义化 token**：`--ds-color-bg / surface / border / text / text-muted / accent / success / warning / danger / info`，组件只引用语义 token，不直接写十六进制。
3. **对比度守门**：用 `colorjs.io` 计算 WCAG 2.1 对比度与 APCA，写成单元测试（例如：正文 ≥ 4.5:1、大字号 ≥ 3:1），CI 里跑——这样"配色优化"是可回归的，而不是主观审美。
4. **深色模式**：`data-theme` + `prefers-color-scheme` 双通道；3D 场景同步切换背景、`toneMappingExposure`（现为 1.05/夜景 1.25，L3612）、地面材质亮度。
5. **色盲友好**：户型平面图中"承重墙=深色 / 非承重墙=浅色"目前靠明度差（L1061-1065 描边色），需复核在 deuteranopia 模拟下是否仍可辨；必要时叠加纹理/线型区分，不只靠颜色。
6. **避免风格割裂**：3D 里的家具颜色是多处硬编码（`mat('#...')` 遍布 L2902-3423），至少要把"材质基色 + 随机色板"集中到一处 token 表，否则改主题要改 40 处。

---

## 8. 建议落地顺序（P0 → P2）

| 优先级 | 内容 | 依据 |
| --- | --- | --- |
| **P0**（迁移时就定好，改起来最贵） | 依赖清单锁定（three / pinia / vue-i18n / @vueuse/core / zod）；`src/model` + `src/2d` + `src/3d` + `src/export` 分层（抄 blueprint3d 的骨架）；配色 token 架构（§7.1-7.3）；IndexedDB 持久化 | 分层与 token 是"迁移即可固化"的架构决策 |
| **P1**（迁移完成后立刻做，性价比最高） | Excel 导出（#2）、SVG/DXF 导出（#3）、深/浅主题（#11）、后处理档位（#7）、历史面板与方案对比（#10） | 成本低/价值高，且都是"库一接就有" |
| **P2**（需要资产或算力投入） | PDF 报价单（#1）、PBR 材质库（#5）、glTF 家具库（#4）、CSG 开洞（#8）、自动识别房间（#9）、路径追踪出图（#6） | 需要美术资产/GPU 算力/数据模型改造 |

---

## 9. 附录 A：人工核对清单（检索词 + 候选链接）

> 所有链接均为本次实际访问过的 URL（`web_fetch` HTTP 200）；未访问过的一律只给检索词。

**A.1 候选项目复核（GitHub API，可脚本化）**

```text
GET https://api.github.com/search/repositories?q=blueprint3d&sort=stars&order=desc
GET https://api.github.com/search/repositories?q=floorplan+in:name+stars:>300&sort=stars&order=desc
GET https://api.github.com/search/repositories?q=sweethome3d&sort=stars&order=desc
GET https://api.github.com/search/repositories?q=floorplan.js+OR+floorplan-js+OR+"floorplan+editor"&sort=stars&order=desc
GET https://api.github.com/repos/{owner}/{repo}      # 用于取 license/stargazers_count/pushed_at
```

已核实的具体 URL：

- https://github.com/furnishup/blueprint3d （1987★ MIT 2021-01-20）
- https://github.com/aalavandhaann/blueprint-js （591★ MIT）
- https://github.com/charmlinn/blueprint3d-modern （158★ MIT 2026-05-22）
- https://github.com/pegasus1982/threejs-3d-building-configurator （16★ 无 license）
- https://github.com/pkozul/ha-floorplan （1737★ 无 license archived）
- https://github.com/ExperienceLovelace/ha-floorplan （1628★ Apache-2.0 2026-09-13）
- https://github.com/nicosandller/easy-floorplan （635★ MIT 2026-10-20）
- https://github.com/tentone/dt3d-ha （36★ MIT 2026-10-06）
- https://github.com/ghys/habpanel-3dview （26★ MIT）
- https://github.com/cvdlab/react-planner （1482★ MIT 2024-04-20）
- https://github.com/ekymo/homeRoughEditor （397★ MIT）
- https://github.com/andsilver/floorplan-angular （76★ 无 license）
- https://github.com/oodavid/SVG-Floorplan-Editor （24★ 无 license）
- https://github.com/irongollem/wallgraph （3★ AGPL-3.0）
- https://github.com/Open-Location-Stack/floorplan-editor （3★ 无 license）
- https://github.com/smplrspace/floorplan.js （14★ 无 license，npm floorplan.js@0.1.1）
- https://github.com/wy51ai/floorplan-3d （2607★ MIT，**star 异常待人工甄别**）
- https://github.com/adizanni/ExportToHASS （70★ GPL-3.0）
- https://github.com/fabien-michel/sweethome3d-textures-ambientcg （40★ CC0-1.0）
- https://github.com/art-programmer/FloorplanTransformation （682★ MIT）
- https://github.com/grebtsew/FloorplanToBlender3d （631★ GPL-3.0）
- https://github.com/zlzeng/DeepFloorplan （418★ GPL-3.0）
- https://sourceforge.net/p/sweethome3d/ （GPLv2，active；代码 SVN）
- https://www.sweethome3d.com/ 、https://www.sweethome3d.com/features/ （官网，features 页为 JS 渲染，需人工在浏览器核对功能清单）

**A.2 npm 包复核（结构化，最省事）**

```text
GET https://registry.npmjs.org/{pkg}/latest                 # version + license
GET https://registry.npmjs.org/-/v1/search?text={kw}&size=10 # version/license/月下载/仓库地址
```

**A.3 需要人工在浏览器里确认的点**

| 待确认事项 | 建议检索词 |
| --- | --- |
| 各库最新许可证是否变更（尤其 `postprocessing` = Zlib、`chroma-js` 双许可） | `npm postprocessing license`、`chroma-js license` |
| `SheetJS` 离开 npm 后的官方分发与许可证 | `SheetJS CDN official distribution`、`sheetjs cdn.sheetjs.com` |
| `exceljs` 是否仍维护（最后发布 2023-10） | `exceljs maintenance status 2026`、`exceljs alternatives` |
| `moveable` / `interactjs` 当前活跃度与 three 版本兼容 | `moveable daybrush changelog`、`interact.js changelog` |
| Blueprint3D 是否有新版分支/活跃 fork（原仓库 2021 停更） | `blueprint3d active fork 2026`、`blueprint3d three.js update` |
| `wy51ai/floorplan-3d` 是否真实项目 | 直接打开仓库首页看提交历史与内容量 |
| Sweet Home 3D 功能清单（PDF/DXF/照片渲染/`.sh3d`） | `Sweet Home 3D export DXF`、`Sweet Home 3D sh3d file format Home.xml` |
| 免费 CC0 家具/材质资产来源与授权 | `ambientCG license CC0`、`Poly Haven license`、`Sketchfab CC0 models`、`Kenney furniture assets` |
| 中文字体嵌入 PDF 的合规字体 | `Noto Sans SC license OFL`、`Source Han Sans license` |
| 是否已有可直接依赖的"户型编辑内核"（本调研结论：无） | `floorplan editor npm package vue`、`svg floorplan editor library`、`three.js floorplan editor npm` |

---

## 10. 附录 B：未能在线核实的条目（**【基于既有知识、未经在线核实】**）

以下条目我**没有**取得实时证据，请勿据此锁定版本或许可证：

| 条目 | 我的既有认知（仅供参考） | 需核实的字段 |
| --- | --- | --- |
| `@vueuse/core` 本体版本 | 与同仓库子包同版本线（本次已核实子包为 **15.0.0 MIT**，故核心包极可能同版本，但未直接命中） | version / license |
| `zod` | MIT，v3/v4 双线 | version / license |
| `@types/three` | DefinitelyTyped，MIT | version |
| `file-saver` | 常见下载辅助库；本次只命中 `@types/file-saver@2.0.7 MIT` | version / license |
| `dexie` / `idb-keyval` | 均为 IndexedDB 封装，MIT/ISC | version / license |
| `draco3d` | Draco 解码器 npm 包 | version / license |
| `three-stdlib` | three addons 的社区打包 | version / license |
| `@tresjs/core` | Vue3 声明式 three.js 封装 | version / license / 活跃度 |
| `element-plus` / `naive-ui` | 团队其它项目已在用 element-plus（`webrtc-meeting`），可作为 UI 基础 | version / license |
| `sortablejs` / `vuedraggable` | 家具库排序 | version / license |
| `vue-router` / `vitest` / `playwright` / `vue-tsc` | Vue3 工程标配 | version |
| Sweet Home 3D 的导出格式（PDF/DXF/OBJ）、照片渲染、`.sh3d` 结构 | 依 SourceForge 描述只确认了"画平面图 / 摆家具 / 3D 浏览"，**具体导出格式未核实** | 功能清单（官网 features 页需浏览器渲染） |
| `Sunflower613/blueprint3d-babylon` 的 star/license | 响应被截断未取到 | stargazers_count / license |

---

## 11. 一页结论（TL;DR）

1. **没有可直接 npm 依赖的"户型/装修编辑器"成品库**（floorplan.js 无许可证且停更；react-planner 停更 7 年且 React 专用）。**编辑内核必须自研**，但架构应抄 `furnishup/blueprint3d`（MIT）的四层分层，交互应参考 `cvdlab/react-planner`（MIT）的 layer/line/area/item 模型与工具状态机。
2. **外围能力全部找库，不造轮子**：PDF→`pdf-lib`(+`fontkit`)、Excel→`exceljs`、DXF→`dxf-writer`、CSV→`papaparse`、glTF→`GLTFLoader`+`@gltf-transform`、CSG→`three-bvh-csg`、BVH→`three-mesh-bvh`、路径追踪→`three-gpu-pathtracer`、手势→`interactjs`、后处理→`postprocessing`、配色→`@material/material-color-utilities`+`colorjs.io`、i18n→`vue-i18n`、状态→`pinia`。
3. **亮点功能里性价比最高的五项**：Excel 清单导出、SVG/DXF 导出、深浅双主题+对比度自检、3D 后处理档位、历史面板+方案 A/B 对比（全部成本低、价值高，且迁移后即可接）。
4. **最高价值但需投入的两项**：真实 glTF 家具库（资产成本）+ 照片级路径追踪出图（算力成本）——这是和商业装修工具拉开差距的地方。
5. **法务红线**：Sweet Home 3D(GPLv2)、ExportToHASS(GPL-3.0)、FloorplanToBlender3d/DeepFloorplan(GPL-3.0)、wallgraph(AGPL-3.0)、以及**所有无 license 仓库**（pkozul/ha-floorplan、smplrspace/floorplan.js 等）——**只读思路，不拷代码**。

---

## 12. 附录 C：SPEC 五个缺口的定点选型（t1 / spec-lead 请求，2026-10-20 追加）

> spec-lead 只需要四列：**包名 + 用途 + 许可证 + 能否直接依赖（Vite + Vue3）**。版本为 2026-10-20 实时抓取的补充信息。
> ⚠️ "能否直接依赖"的判断依据是**许可证 + 包形态（是否提供浏览器/ESM 构建、是否强依赖 Node 内置模块）**；本会话 `pwsh` 不可用（STATUS_DLL_INIT_FAILED），**未能实际跑 `npm i` + `vite build` 验证**，因此这一列属于"许可与形态层面可行"，最终以 scaffold-dev 安装时的解析结果为准。

### 缺口 1：报价单 / 工程量清单导出（CSV / XLSX）—— 结论：**不自研表格写出**

| 包名 | 用途 | 许可证 | 能否直接依赖（Vite+Vue3） |
| --- | --- | --- | --- |
| `papaparse`（4.5 节，`5.7.0`） | CSV 解析**与生成**（`unparse`），含流式/Worker | MIT【已核实】 | ✅ 可。纯浏览器库、无 Node 内置依赖 |
| `exceljs`（`4.4.0`） | 生成带样式/公式/冻结窗格的 xlsx（报价单首选） | MIT【已核实】 | ✅ 可，但**体积较大**，且历史上在 Vite 下偶需 `buffer` polyfill → 建议动态 `import()` 按需加载 |
| `write-excel-file`（`4.1.1`） | 轻量 xlsx 写出（只写不读），浏览器优先 | MIT【已核实】 | ✅ 可。比 exceljs 小得多；仓库托管在 GitLab（非 GitHub） |
| `xlsx-js-style`（`1.2.0`） | SheetJS CE + 单元格样式 | Apache-2.0【已核实】 | ✅ 可 |
| ~~`xlsx`（SheetJS CE，npm 上 `0.18.5`）~~ | xlsx 读写 | Apache-2.0【已核实】 | ⚠️ **npm 版本 2022-03 后停更**，新版只在 SheetJS 自有 CDN 分发 → 若要留在 npm 生态，改用上面三个之一 |

**取舍**：CSV → `papaparse`；XLSX 需样式/公式 → `exceljs`（动态引入）；只要"能打开"的轻量导出 → `write-excel-file`。

### 缺口 2：打印 / PDF 图册 —— 结论：**不自研 PDF 排版**

| 包名 | 用途 | 许可证 | 能否直接依赖（Vite+Vue3） |
| --- | --- | --- | --- |
| `pdf-lib`（`1.17.1`） | 生成/修改 PDF；**也可直接画矢量线、填充户型几何** | MIT【已核实】 | ✅ 可。纯 JS/TS，无 Node 内置依赖 |
| `@pdf-lib/fontkit`（`1.1.1`） | 自定义字体嵌入（**中文必须，否则乱码**） | MIT【已核实】 | ✅ 可。需自带 OFL 字体文件（注意体积预算，可用字体子集化） |
| `@cantoo/pdf-lib`（`2.11.1`） | pdf-lib 的**活跃维护分支**（2026-09-15 发布），API 兼容 | MIT【已核实】 | ✅ 可。若上游停更影响安全/兼容性可无缝替换 |
| `pdfmake`（`0.3.12`） | **声明式排版**（表格/页眉页脚），做图册/报价单最省事 | MIT【已核实】 | ✅ 可。需配置字体 vfs（中文要加字体文件） |
| `jspdf`（`4.2.1`） | PDF 生成（svg2pdf.js 的宿主） | MIT【已核实】 | ✅ 可 |
| `jspdf-autotable`（`5.0.9`） | jsPDF 表格插件 | MIT【已核实】 | ✅ 可 |
| `svg2pdf.js`（`2.8.1`） | **把现有 SVG 平面图直接转成矢量 PDF**（yWorks 维护） | MIT【已核实】 | ✅ 可。配合 `jspdf` 使用 |

**取舍**：图册排版 → `pdfmake`（声明式，快）或 `pdf-lib`+`fontkit`（可控，还能顺带画矢量图）；把现有 SVG 平面图放进 PDF → `svg2pdf.js` + `jspdf`（矢量、不失真，优于先转 PNG 再贴）。

### 缺口 3：2D 平面图自动校验（穿墙 / 压门洞 / 堵通道 / 空房间 / 尺寸异常）—— 结论：**没有"装修规范校验"现成库，必须自研规则，但几何原语全部用库**

| 包名 | 用途 | 许可证 | 能否直接依赖（Vite+Vue3） |
| --- | --- | --- | --- |
| `@turf/boolean-intersects`（`7.4.0`） | 两几何是否重叠 → 家具穿墙 / 压门洞 | MIT【已核实】 | ✅ 可（按需装子包，勿装 `@turf/turf` 全家桶以控体积） |
| `@turf/boolean-point-in-polygon`（`7.4.0`） | 点是否在房间内 → "房间无家具" | MIT【已核实】 | ✅ 可 |
| `@turf/line-intersect`（`7.4.0`） | 线段求交 → 家具跨墙 / 尺寸线异常 | MIT【已核实】 | ✅ 可 |
| `@turf/area`（`7.4.0`） | 多边形面积（若统一用 GeoJSON 表达平面） | MIT【已核实】 | ✅ 可 |
| `polygon-clipping`（`0.15.7`） | 布尔交/差 → 家具轮廓 ∩ 墙体轮廓非空即穿墙；**也用于房间扣减** | MIT【已核实】 | ✅ 可（**精确锁版本，见 §4.2**） |
| `martinez-polygon-clipping`（`0.9.0`） | 同一问题的**备选实现**（二选一） | MIT【已核实】 | ✅ 可 |
| `js-angusj-clipper`（`1.3.1`） | 多边形布尔**+ 内缩/外扩（offset/inflate）** → "通道净宽"判定 | MIT【已核实】 | ⚠️ 可用，但为 WASM/Asm.js 端口，需确认 Vite 下 `.wasm` 资产加载（2023-02 后未再发布） |
| ~~`clipper-lib`（`6.4.2`）~~ | 同上（纯 JS 老移植） | **BSL**（Boost Software License，宽松但名称易误读）【已核实】 | ⚠️ 备选，2019-11 停更 |
| `rbush`（`4.0.1`） | 2D R*-tree 空间索引 → 家具上百件时的成对相交加速 | MIT【已核实】 | ✅ 可（数据量小可不装） |
| **`three` 自带 `three/addons/math/OBB.js` + `Box3`** | **旋转家具的 OBB 相交**（含旋转角） | MIT（three 本体，已在依赖） | ✅ 可，**零新增依赖**（推荐先走这条） |
| `three-pathfinding`（`1.3.0`） | three.js 的 navmesh + A* → "通道是否连通 / 绕行距离 / 某区域不可达" | MIT【已核实】 | ✅ 可（donmccurdy 维护） |
| `earcut`（`3.2.4`） | 房间多边形三角化 → 栅格化做可达性/净宽分析 | ISC【已核实】 | ✅ 可 |

**不能交给库的部分（必须自研 + 写单测）**：阈值定义（如门洞前 600mm 净空、通道 ≥ 800mm）、违规分级（错误/警告/提示）、尺寸异常规则（房间长宽比、面积与墙体不闭合）。库只提供"相交/包含/距离"的事实判断。
**明确不建议**：自己写"点在多边形内""线段求交""多边形布尔"（浮点鲁棒性坑极深），以及为 60 件家具引入重型物理引擎。

### 缺口 4：平面图矢量化导出 SVG / PDF —— 结论：**SVG 导出不需要库；SVG→PDF 用 `svg2pdf.js`+`jspdf`**

| 包名 | 用途 | 许可证 | 能否直接依赖（Vite+Vue3） |
| --- | --- | --- | --- |
| **（无需库）** | 2D 平面本身就是 SVG DOM：克隆 + 注入样式 + 序列化即得矢量 SVG（现有 `exportPNG` 已走这条路，L1880-1897） | — | ✅ 推荐首选路径 |
| `svg2pdf.js`（`2.8.1`） | SVG → **矢量** PDF | MIT【已核实】 | ✅ 可 |
| `jspdf`（`4.2.1`） | svg2pdf.js 的宿主，也用于分页/多图册 | MIT【已核实】 | ✅ 可 |
| `pdf-lib`（`1.17.1`） | 不走 SVG，直接用几何画矢量 PDF（线条/填充） | MIT【已核实】 | ✅ 可 |
| `dxf-writer`（`1.18.4`）/ `@tarikjabiri/dxf`（`2.9.0`） | CAD（DXF）交付 | MIT【已核实】 | ✅ 可 |
| `html-to-image`（`1.11.13`）/ `modern-screenshot`（`4.7.0`） | DOM→**光栅**图（分享图/缩略图，非矢量） | MIT【已核实】 | ✅ 可，二选一 |

### 缺口 5：主题预设 / 对比度校验 —— 结论：**不自研色彩数学**

| 包名 | 用途 | 许可证 | 能否直接依赖（Vite+Vue3） |
| --- | --- | --- | --- |
| `colorjs.io`（`0.7.1`） | **WCAG 2.1 对比度 + APCA**、色彩空间转换、色域映射 | MIT【已核实】 | ✅ 可。**推荐作为 CI 断言用的权威实现** |
| `@material/material-color-utilities`（`0.4.0`） | M3/HCT：**种子色 → 完整 tonal palette**（"主题预设"生成引擎） | Apache-2.0【已核实】 | ✅ 可（Google 官方） |
| `@adobe/leonardo-contrast-colors`（`1.1.0`） | **按目标对比度反推色阶**（"保证可读"的预设生成） | Apache-2.0【已核实】 | ✅ 可 |
| `wcag-contrast`（`3.0.0`） | 极小，只算对比度比值 | BSD-2-Clause【已核实】 | ✅ 可（2019 停更但算法稳定） |
| `color-contrast-checker`（`2.1.0`） | WCAG 2.0 校验 | Apache-2.0【已核实】 | ✅ 可 |
| `a11y-color-contrast`（`0.2.0`） | WCAG 2.2/3.0 + APCA | MIT【已核实】 | ✅ 可 |
| `culori`（`4.0.2`）/ `chroma-js`（`3.2.0`） | 色阶插值、色差、混合 | MIT / （BSD-3-Clause AND Apache-2.0）【已核实】 | ✅ 可 |

**推荐组合（三选二即可，但必须有一个跑在 CI 里）**：M3 生成主题 → `@adobe/leonardo-contrast-colors` 反推达标色阶 → `colorjs.io` 写对比度断言。

**本次追加的未核实项（沿用 §0 标记规则）**：`@turf/turf` 全家桶本体、`polygon-offset`、`pathfinding`(qiao) 三个包名**未被 npm search 命中**，因此改用 `@turf/*` 子包、`js-angusj-clipper`、`three-pathfinding` 替代；如需使用请先在线复核。

---

## 13. 法务口径定案（captain 决策，2026-10-20）

**已定案：本项目以 MIT 开源发布**，故：

- ❌ **GPL-2.0 / GPL-3.0 / AGPL-3.0 及全部无 license 字段的仓库一律只读思路、零代码拷贝**（MIT 产物混入 GPL/AGPL 代码同样会被传染，无 license 则默认保留全部权利）。
- ✅ 宽松许可（**MIT / ISC / Apache-2.0 / BSD / Zlib / CC0**）依赖需在 [`THIRD-PARTY.md`](./THIRD-PARTY.md) 登记并保留版权声明（Apache-2.0 另需保留其 NOTICE，若上游提供）。
- 📌 依赖登记与再分发判定见 [`THIRD-PARTY.md`](./THIRD-PARTY.md)。
- 📌 资产侧已处置：中文 PDF 字体走 **OFL**（Noto Sans SC / Source Han Sans，SIL OFL 1.1，可随 MIT 产物分发）；**3D 模型资产本版不引入**（glTF 家具库列为 P2/ROADMAP）→ 当前不存在"不能开源"的资产阻塞点。

