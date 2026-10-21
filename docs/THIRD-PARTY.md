# THIRD-PARTY 依赖与许可证登记表（THIRD-PARTY）

- 归属：decoration-studio 项目
- 初始作者：`oss-researcher`（task `t2`，captain 授权追加）
- 交接：captain 已指定由 **spec-lead 在 t9 收尾时接管维护**
- 法务口径（**已定案**：本项目以 **MIT** 开源发布，captain 2026-10-20）：
  > 本项目以 **MIT** 开源发布 —— **只允许 MIT / ISC / Apache-2.0 / BSD / Zlib / CC0**（需登记并保留版权声明）；**GPL-2.0 / GPL-3.0 / AGPL-3.0 及所有无 license 字段的仓库**一律**只读思路、零代码拷贝**（MIT 产物混入 GPL/AGPL 同样被传染）。详见 `docs/OSS-RESEARCH.md` §13。
- ⚠️ 本表**不是** `package.json` 的来源。所有版本号都是 **2026-10-20 抓取的"当时最新"**，**实际安装版本一律以 `pnpm add` 时 registry 的解析结果为准**（captain 决策：`docs/OSS-RESEARCH.md` §10 附录 B 的 13 项未核实条目**不得**据以写入依赖）。
- ⚠️ 本表**不含**任何未经在线核实的版本号；无法核实的行版本列留空并标注来源等级。

---

## 0. 维护规则（交接给 spec-lead）

### 0.1 新增一行的模板

```markdown
| `包名` | `x.y.z`（抓取日实测最新，安装时以 registry 为准） | MIT | 一句话用途 | registry.npmjs.org /{pkg}/latest，YYYY-MM-DD | ✅ 允许（需保留许可证与版权声明） |
```

### 0.2 字段口径

| 字段 | 口径 |
| --- | --- |
| **建议锁定版本** | 抓取日的 npm `latest`。**安装后**请改成 `pnpm-lock.yaml` 里的实际版本 |
| **许可证** | npm registry 返回的 `license` 字段（SPDX 或 SPDX 表达式）；若包内 `LICENSE` 与 npm 字段不一致，**以包内文件为准**并在此备注 |
| **数据来源与抓取日** | 必填。`registry.npmjs.org` / `api.github.com` / 官网；离线凭记忆的一律写 `【基于既有知识、未经在线核实】` |
| **是否允许再分发** | 口径：本项目**把依赖打进前端产物分发 = 再分发**。宽松许可（MIT/ISC/BSD/Zlib）✅ 允许，但**必须在 NOTICE / 本文件保留许可证全文与版权声明**；Apache-2.0 ✅ 允许，**另需保留其 `NOTICE` 文件（若上游提供）**；CC0 ✅ 允许；GPL/AGPL ❌ 不允许进入依赖树 |

### 0.3 校验方式（不依赖人工记忆）

- 【基于既有知识、未经在线核实】`pnpm licenses list --json` 可导出依赖树许可证清单；`license-checker` 亦可。若要在 CI 卡住违规，建议对上面的白名单做断言。
- 本会话 `pwsh` 完全不可用（所有命令 `exit code 3221225794` = `STATUS_DLL_INIT_FAILED`），**上述命令未在本机实际执行过**，请在具备 shell 的环境首次执行并回填结果。

---

## 1. 已在线核实的运行时依赖（可直接进入依赖树）

> 数据来源统一为 `registry.npmjs.org`（`/-/v1/search` 或 `/{pkg}/latest`），**抓取日 2026-10-20**。

| 包名 | 建议锁定版本 | 许可证 | 用途 | 数据来源与抓取日 | 是否允许再分发 |
| --- | --- | --- | --- | --- | --- |
| `three` | `0.186.1` | MIT | 3D 引擎本体（3D 场景 / 材质 / 加载器） | registry.npmjs.org/three/latest，2026-10-20 | ✅ 允许（保留 MIT 声明）；须复核内嵌的第三方子模块声明 |
| `postprocessing` | `6.39.5` | **Zlib** | 3D 后处理（SSAO/Bloom/DoF/SMAA） | registry，2026-10-20 | ✅ 允许（Zlib 为宽松许可，保留声明）。注意 peer 约束 `three >= 0.168 < 0.187` |
| `three-mesh-bvh` | `0.9.16` | MIT | 射线/拾取加速 | registry，2026-10-20 | ✅ 允许 |
| `three-bvh-csg` | `0.0.18` | MIT | 实体布尔（墙体真开洞） | registry，2026-10-20 | ✅ 允许 |
| `three-gpu-pathtracer` | `0.0.27` | MIT | GPU 路径追踪出图 | registry，2026-10-20 | ✅ 允许 |
| `three-pathfinding` | `1.3.0` | MIT | navmesh + A*（通道连通性校验） | registry，2026-10-20 | ✅ 允许 |
| `@gltf-transform/core` | `4.5.1` | MIT | glTF 读写 SDK | registry，2026-10-20 | ✅ 允许 |
| `@gltf-transform/extensions` | `4.5.1` | MIT | glTF 扩展支持 | registry，2026-10-20 | ✅ 允许 |
| `@gltf-transform/functions` | `4.5.1` | MIT | glTF 常用变换（Draco/KTX2/量化） | registry，2026-10-20 | ✅ 允许 |
| `konva` | `10.9.0` | MIT | Canvas 2D 场景图（**仅当 2D 编辑器改 Canvas 时**） | registry，2026-10-20 | ✅ 允许 |
| `interactjs` | `1.10.28` | MIT | 拖拽/缩放/旋转/吸附/多点触控 | registry，2026-10-20 | ✅ 允许 |
| `moveable` | `0.53.0` | MIT | DOM 元素级拖拽/缩放（**与 interactjs 二选一**） | registry，2026-10-20 | ✅ 允许。注意最后发布 2023-12-03 |
| `polygon-clipping` | `0.15.7` | MIT | 多边形布尔（并/交/差/异或） | registry，2026-10-20 | ✅ 允许。⚠️ **最后发布 2023-12、仍在 0.15.x 未过 1.0 → 精确锁版本，勿写 `^`**；captain 侧已用 GitHub Security Advisory API 核实无已知安全公告 |
| `martinez-polygon-clipping` | `0.9.0` | MIT | 同一问题（多边形布尔）的**备选实现**（**与 polygon-clipping 二选一**） | registry，2026-10-20 | ✅ 允许 |
| `earcut` | `3.2.4` | ISC | 多边形三角化 | registry，2026-10-20 | ✅ 允许 |
| `rbush` | `4.0.1` | MIT | 2D 空间索引（家具量大时加速） | registry，2026-10-20 | ✅ 允许 |
| `js-angusj-clipper` | `1.3.1` | MIT | 多边形布尔 **+ 偏移（通道净宽判定）** | registry，2026-10-20 | ✅ 允许。WASM/Asm.js 端口，需验证 Vite 下 wasm 资产加载 |
| `@turf/boolean-intersects` | `7.4.0` | MIT | 几何重叠判定 | registry，2026-10-20 | ✅ 允许 |
| `@turf/boolean-point-in-polygon` | `7.4.0` | MIT | 点是否在多边形内 | registry，2026-10-20 | ✅ 允许 |
| `@turf/line-intersect` | `7.4.0` | MIT | 线段求交 | registry，2026-10-20 | ✅ 允许 |
| `@turf/area` | `7.4.0` | MIT | 多边形面积 | registry，2026-10-20 | ✅ 允许 |
| `pdf-lib` | `1.17.1` | MIT | 生成/修改 PDF；矢量绘制 | registry，2026-10-20 | ✅ 允许 |
| `@pdf-lib/fontkit` | `1.1.1` | MIT | 自定义字体嵌入（**中文 PDF 必需**） | registry，2026-10-20 | ✅ 允许。字体文件另有授权要求（见 §4） |
| `@cantoo/pdf-lib` | `2.11.1` | MIT | pdf-lib 活跃维护分支（**替换候选，非同时安装**） | registry，2026-10-20 | ✅ 允许 |
| `pdfmake` | `0.3.12` | MIT | 声明式 PDF 排版 | registry，2026-10-20 | ✅ 允许 |
| `jspdf` | `4.2.1` | MIT | PDF 生成（svg2pdf.js 宿主） | registry，2026-10-20 | ✅ 允许 |
| `svg2pdf.js` | `2.8.1` | MIT | SVG → 矢量 PDF | registry，2026-10-20 | ✅ 允许 |
| `jspdf-autotable` | `5.0.9` | MIT | jsPDF 表格插件 | registry，2026-10-20 | ✅ 允许 |
| `exceljs` | `4.4.0` | MIT | 生成带样式/公式的 xlsx | registry，2026-10-20 | ✅ 允许。注意最后发布 2023-10-19 |
| `write-excel-file` | `4.1.1` | MIT | 轻量 xlsx 写出（exceljs 的轻量替代） | registry，2026-10-20 | ✅ 允许。仓库在 GitLab |
| `xlsx-js-style` | `1.2.0` | Apache-2.0 | SheetJS CE + 单元格样式 | registry，2026-10-20 | ✅ 允许（Apache-2.0：保留 LICENSE，若有 NOTICE 一并保留） |
| `papaparse` | `5.7.0` | MIT | CSV 解析与生成 | registry，2026-10-20 | ✅ 允许 |
| `dxf-writer` | `1.18.4` | MIT | DXF（CAD）导出 | registry，2026-10-20 | ✅ 允许 |
| `@tarikjabiri/dxf` | `2.9.0` | MIT | TS 版 DXF 读写 | registry，2026-10-20 | ✅ 允许 |
| `html-to-image` | `1.11.13` | MIT | DOM → 光栅图（**与 modern-screenshot 二选一**） | registry，2026-10-20 | ✅ 允许 |
| `modern-screenshot` | `4.7.0` | MIT | 同上（新实现） | registry，2026-10-20 | ✅ 允许 |
| `colorjs.io` | `0.7.1` | MIT | WCAG/APCA 对比度、色彩空间 | registry，2026-10-20 | ✅ 允许 |
| `@material/material-color-utilities` | `0.4.0` | Apache-2.0 | M3/HCT 主题生成 | registry，2026-10-20 | ✅ 允许（Apache-2.0，保留 NOTICE 若有） |
| `@adobe/leonardo-contrast-colors` | `1.1.0` | Apache-2.0 | 按目标对比度反推色阶 | registry，2026-10-20 | ✅ 允许（同上） |
| `culori` | `4.0.2` | MIT | 通用色彩运算 | registry，2026-10-20 | ✅ 允许 |
| `chroma-js` | `3.2.0` | (BSD-3-Clause AND Apache-2.0) | 轻量色彩操作 | registry，2026-10-20 | ✅ 允许（**双许可 SPDX 表达式**，转录时勿简化成单一许可） |
| `wcag-contrast` | `3.0.0` | BSD-2-Clause | 对比度比值 | registry，2026-10-20 | ✅ 允许 |
| `color-contrast-checker` | `2.1.0` | Apache-2.0 | WCAG 2.0 校验 | registry，2026-10-20 | ✅ 允许 |
| `a11y-color-contrast` | `0.2.0` | MIT | WCAG 2.2/3.0 + APCA | registry，2026-10-20 | ✅ 允许 |
| `pinia` | `4.1.0` | MIT | 状态管理 | registry，2026-10-20 | ✅ 允许 |
| `vue-i18n` | `11.4.16` | MIT | 国际化 | registry，2026-10-20 | ✅ 允许 |
| `@vueuse/components` / `@vueuse/router` / `@vueuse/math` | `15.0.0` | MIT | Vue 组合式工具（同仓库同名版本线） | registry，2026-10-20 | ✅ 允许。**`@vueuse/core` 本体版本未直接核实**（见 §2） |

**说明**：上表**不代表这些包全部都要安装**。多处已标注"二选一/替换候选"，请在 SPEC 定稿时收敛成最终依赖集（例如 `polygon-clipping` 与 `martinez-polygon-clipping`、`interactjs` 与 `moveable`、`html-to-image` 与 `modern-screenshot`、`pdf-lib` 与 `@cantoo/pdf-lib`、`dxf-writer` 与 `@tarikjabiri/dxf`）。

---

## 2. 未在线核实（**【基于既有知识、未经在线核实】**，版本列留空，禁止据此写 `package.json`）

| 包名 | 版本 | 许可证 | 用途 | 数据来源与抓取日 | 是否允许再分发 |
| --- | --- | --- | --- | --- | --- |
| `@vueuse/core` | 待确认（同仓库子包为 `15.0.0`） | 待确认（预期 MIT） | Vue 组合式工具（手势/存储/快捷键） | 未核实 | 待确认（预期 ✅） |
| `zod` | 待确认 | 待确认（预期 MIT） | 导入 JSON 的运行时校验 | 未核实 | 待确认 |
| `@types/three` | 待确认 | 待确认（DefinitelyTyped，预期 MIT） | three 的类型定义 | 未核实 | 待确认 |
| `file-saver` | 待确认 | 待确认 | 触发浏览器下载（现有 `download()` 可自研，见下） | 未核实 | 待确认 |
| `dexie` 或 `idb-keyval` | 待确认 | 待确认 | IndexedDB 持久化（替代 localStorage 5MB 配额） | 未核实 | 待确认 |
| `drei`/`three-stdlib`/`@tresjs/core` | 待确认 | 待确认 | three 社区封装（可选） | 未核实 | 待确认 |
| `element-plus` / `naive-ui` | 待确认 | 待确认 | UI 组件库（团队其它项目已在用 element-plus） | 未核实 | 待确认 |
| `sortablejs` / `vuedraggable` | 待确认 | 待确认 | 家具库排序 | 未核实 | 待确认 |
| `vue-router` / `vitest` / `@vue/test-utils` / `playwright` / `vue-tsc` | 待确认 | 待确认 | 工程基建与测试 | 未核实 | 待确认 |
| `draco3d` | 待确认 | 待确认 | Draco 解码器（GLTFLoader 也可从 CDN 取解码器） | 未核实 | 待确认 |
| `clipper-lib` | `6.4.2`（**已核实**） | **BSL**（Boost Software License） | 多边形布尔+偏移（老纯 JS 移植） | registry，2026-10-20（**许可证已核实、但 2019-11 停更，仅备选**） | ✅ 允许（BSL 宽松），但建议优先 `js-angusj-clipper` |
| `xlsx`（SheetJS CE） | `0.18.5`（**已核实**） | Apache-2.0（**已核实**） | xlsx 读写 | registry，2026-10-20；⚠️ **npm 版本 2022-03 后停更**，新版只在 SheetJS 自有 CDN 分发 | ⚠️ 需先与 captain 确认"从非 npm 源引入"是否可接受；否则改用 `exceljs` / `write-excel-file` |

**无需引入的包（避免为了"少写 3 行"加依赖）**：`file-saver` —— 现有 `download(name, blob)`（`装修设计.html` L1879）已用 `URL.createObjectURL` + `<a download>` 实现，迁移时保留即可。

---

## 3. 明确**禁止进入依赖树**的项目（GPL / AGPL / 无 license）

> 这些项目仅作**功能对照与思路参考**，**零代码拷贝**。行内不登记版本，因为永远不会被安装。

| 项目 | 许可证 | 为什么记录在案 |
| --- | --- | --- |
| Sweet Home 3D（SourceForge `sweethome3d`） | **GPL-2.0** | 功能标杆（PDF、家具目录、多楼层、照片渲染），仅作需求对照 |
| [`adizanni/ExportToHASS`](https://github.com/adizanni/ExportToHASS) | **GPL-3.0** | 户型→智能家居点位思路 |
| [`grebtsew/FloorplanToBlender3d`](https://github.com/grebtsew/FloorplanToBlender3d) | **GPL-3.0** | 平面图→3D 参考 |
| [`zlzeng/DeepFloorplan`](https://github.com/zlzeng/DeepFloorplan) | **GPL-3.0** | AI 识别方向参考 |
| [`irongollem/wallgraph`](https://github.com/irongollem/wallgraph) | **AGPL-3.0** | wall-graph 数据模型思路（AGPL 传染性最强） |
| [`pkozul/ha-floorplan`](https://github.com/pkozul/ha-floorplan) | **无 license**（且已 archived） | 实体↔SVG 绑定思路 |
| [`smplrspace/floorplan.js`](https://github.com/smplrspace/floorplan.js) | **无 license**（npm `0.1.1` 亦无） | "floorplan.js" 这个名字的来源，但**不可用** |
| [`oodavid/SVG-Floorplan-Editor`](https://github.com/oodavid/SVG-Floorplan-Editor) | **无 license** | SVG 编辑器思路 |
| [`andsilver/floorplan-angular`](https://github.com/andsilver/floorplan-angular) | **无 license** | Fabric.js 方案思路 |
| [`pegasus1982/threejs-3d-building-configurator`](https://github.com/pegasus1982/threejs-3d-building-configurator) | **无 license** | three.js 配置器思路 |
| [`Open-Location-Stack/floorplan-editor`](https://github.com/Open-Location-Stack/floorplan-editor) | **无 license** | IMDF 标准方向 |

**允许借用代码（宽松许可）的同类项目**（仍建议"借鉴而非拷贝"，拷贝时必须在 §1 追加登记并保留声明）：

| 项目 | 许可证 | 说明 |
| --- | --- | --- |
| [`furnishup/blueprint3d`](https://github.com/furnishup/blueprint3d) | MIT | 架构分层的主要借鉴对象（1987★，2021 停更） |
| [`aalavandhaann/blueprint-js`](https://github.com/aalavandhaann/blueprint-js) | MIT | ES6 重写版 |
| [`charmlinn/blueprint3d-modern`](https://github.com/charmlinn/blueprint3d-modern) | MIT | TS 重写（年轻，谨慎） |
| [`cvdlab/react-planner`](https://github.com/cvdlab/react-planner) | MIT | 数据模型与工具状态机 |
| [`ekymo/homeRoughEditor`](https://github.com/ekymo/homeRoughEditor) | MIT | SVG 平面编辑器 |
| [`nicosandller/easy-floorplan`](https://github.com/nicosandller/easy-floorplan) | MIT | 活跃的可视化编辑器 |
| [`ExperienceLovelace/ha-floorplan`](https://github.com/ExperienceLovelace/ha-floorplan) | Apache-2.0 | 实体↔SVG 声明式绑定（保留 NOTICE） |
| [`tentone/dt3d-ha`](https://github.com/tentone/dt3d-ha) | MIT | 3D 数字孪生整合方式 |

---

## 3.5 上游来源项目（代码来源，非 npm 依赖）

本项目是以下 MIT 项目的重构版，其代码以「重写」形式进入本仓库（非直接 import）。
MIT 要求保留版权声明——已在根目录 `LICENSE` 与本表中履行。

| 项目 | 许可证 | 用途 | 来源与抓取日 | 是否允许再分发 |
| --- | --- | --- | --- | --- |
| [`wy51ai/floorplan-3d`](https://github.com/wy51ai/floorplan-3d) | **MIT**【已核实】 | 本项目的功能基线：2D 平面图 + Three.js 3D 场景的纯前端户型设计工具（单文件 `index.html`，185 KB / 2675 行） | api.github.com 于 2026-10-21 核实（2696★ / 553 fork / MIT / 最后 push 2026-10-02）；详见 [`ORIGIN.md`](ORIGIN.md) | ✅ 允许（MIT，需保留版权声明与许可声明——已在 `LICENSE` 中保留） |

> **与本地源文件的关系**：本项目迁移自 `装修设计.html.bak`（2665 行 / 185,771 B），
> 经比对与上游 `index.html`（2675 行 / 185,528 B）**同源但非完全相同**
> （SHA256 不同，差异约 10 行；核心特征串 `huxing-design-v1` / `--accent:#b5653a` /
> `case 'plant'` / `双人床 1.8m` 全部一致）。详见 [`ORIGIN.md`](ORIGIN.md) §2。
>
> ⚠️ 注意区分：上游 **MIT 可用**，但本项目**没有**直接拷贝任何 GPL/AGPL/无 license 项目的代码
> （那些只在 `OSS-RESEARCH.md` 中作「思路参考」，见本文件 §3 的禁止清单）。

---

## 4. 非代码资产（同样需要登记许可证）

| 资产 | 许可证 | 用途 | 来源与抓取日 | 是否允许再分发 |
| --- | --- | --- | --- | --- |
| ambientCG PBR 贴图（木地板/瓷砖/大理石等） | **CC0-1.0**（口径来自 [`fabien-michel/sweethome3d-textures-ambientcg`](https://github.com/fabien-michel/sweethome3d-textures-ambientcg) 的 CC0 标注，GitHub API 于 2026-10-20 核实；**ambientCG 官网自身的许可条款未逐条核实**） | 地板/墙面真实质感替代现有 canvas 程序化贴图 | api.github.com，2026-10-20 | ✅ 允许（CC0 无署名义务，仍建议在表内留痕） |
| 中文字体（PDF 嵌入用） | **待确认** —— 必须选用 OFL 或同等可嵌入、可再分发的字体（如 Noto Sans SC / Source Han Sans 系） | `@pdf-lib/fontkit` 嵌入中文 | **未核实**，需人工确认具体字体与版本 | ⚠️ 待确认。字体文件的嵌入权限与体积预算需专项确认（captain 已提示 features-dev 先评估体积） |
| 3D 家具模型（glTF） | **待确认** | 替换程序化几何 | **未核实** | ⚠️ 待确认。必须逐模型确认 CC0/CC-BY 并记录署名要求 |

---

## 5. 待办（交接给 spec-lead / 后续任务）

1. **安装后回填实际版本**：把 §1 的"建议锁定版本"替换为 `pnpm-lock.yaml` 中的实际版本。
2. **收敛最终依赖集**：把 §1 中所有"二选一/替换候选"合并为唯一选择。
3. **首次执行许可证扫描**（`pnpm licenses list` 或 `license-checker`）并在具备 shell 的环境回填结果（本会话 `pwsh` 不可用，未能执行）。
4. **补齐 §2 的 13 项未核实条目**：安装时以 registry 实际解析结果为准（captain 已定：未核实条目不写入 `package.json`）。
5. **补齐 §4 的字体与 3D 模型授权**：这是唯一可能导致"不能商用"的风险点。
6. **发布前**：确认前端产物内含 MIT/ISC/BSD/Zlib 的许可证全文与版权声明，以及 Apache-2.0 的 NOTICE。
