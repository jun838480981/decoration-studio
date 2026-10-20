# 原功能盘点（基线：装修设计.html）

> 目的：为 Vue3 + Vite + TS 迁移提供**可核对的功能基线**。本文件所有功能结论均带**文件行号证据**。
>
> | 文件 | 绝对路径 | 行数 | 角色 |
> | --- | --- | --- | --- |
> | 现行版本 | `F:\LearnSpace\L1yuu_Space\装修设计.html` | 3895 | **功能基线**（唯一权威） |
> | 旧快照 | `F:\LearnSpace\L1yuu_Space\装修设计.html.bak` | 2664 | 差异核对基准 |
>
> 证据标注约定：`L1234` 表示该行；`L1234-1260` 表示行区间；引用 `.bak` 时写 `bak:L1234`。
> 未能在源码中确证的事项统一汇总在第 10 节「待确认项」，**不做推测**。
>
> 结构：现行版本 = 一个 classic `<script>`（L412-2674，2D + 全部业务逻辑，全局作用域）+ 一个 `<script type="module">`（L2675-3893，three.js 3D 场景）。3D 侧依赖 2D 侧暴露的全局 `state / ui / view / BOUNDS / WALLS / WINS / DOORS / SLIDES / ROOMS / PLAN / curLv / COARSE / TAP / snap / commit / getF / snapMove / renderAll / select / closeDrawers`，并通过 `window.View3D`（L3892）反向暴露 `enter/exit/relang/sync/shot/groundAt/flyToRoom/walking`。

---

## 0. 索引：UI 骨架与渲染层

### 0.1 布局骨架（L257-410）

| 区块 | 行号 | 说明 |
| --- | --- | --- |
| `.app` 网格 | L21-23 | `grid-template-rows: auto minmax(0,1fr) 30px`；`columns: 236px minmax(0,1fr) 300px`；宽屏可收起（L226-234），窄屏侧栏变抽屉浮层（L236-247） |
| `<header>` | L258-345 | 全部工具栏按钮，见第 1 节 |
| `aside.lib` | L347-353 | `#lib3d`（3D 房间列表，L348-351）+ `#lib`（家具库，L352） |
| `main#stage` | L355-382 | `svg#plan`（L356-368）+ `#view3d`（L369-378）+ `.scalebar`（L379）+ `.modehint`（L380）+ `#fab`（L381） |
| `aside.right > #panel` | L384 | 右侧属性面板（内容由 JS 渲染） |
| `<footer>` | L386-392 | 坐标 `#cx/#cy`、比例 `#ratio`、悬停 `#hover`、提示 `#tip` |
| `#planModal` | L394-408 | 户型库弹窗（`.modal`，`hidden` 控制） |
| `#planFileIn` / `#toast` | L409-410 | 户型 JSON 文件输入 / 全局 toast |

### 0.2 SVG 图层顺序（L356-368，自下而上）

`#defs` → `#gGrid` → `#gRooms` → `#gFurn` → `#gWalls` → `#gOpen` → `#gLabels` → `#gDims` → `#gMeasure` → `#gSel` → `#gEdit`。

> `#gLabels`/`#gDims`/`#gMeasure` 带 `pointer-events="none"`（L363-365）；`#gEdit` 亦为 `none`（L367），且编辑模式下 CSS 再兜底 `#plan.tool-edit #gEdit,#plan.tool-edit #gEdit *{pointer-events:none}`（L189）。

### 0.3 渲染总入口

`renderAll()`（L1338-1341）依次调用 `renderGrid → renderRooms → renderFurn → renderWalls → renderLabels → renderMeasure → renderSel → renderPanel → updateHeader`，最后 `window.View3D?.sync()`。

**架构要点（对下游关键）**：`renderOpenings()` 与 `renderDims()` **不在** `renderAll()` 内。二者只依赖「户型结构 + 图层开关」，与 `state.furniture` 无关，调用点仅：初始化 L2671、切换户型 L1972、户型结构编辑 L2159、图层/语言变更 L2528/L2574/L2662。Vue 侧应把它们做成只在 `plan` / `ui.layers` 变化时重算的 computed。

---

## 1. 交互与工具栏行为

### 1.1 工具栏分组与控件清单（L258-344）

| 分组 | 行号 | 控件（id / data 属性） |
| --- | --- | --- |
| `#paneBtns` | L259-262 | `#tgLib`（家具库开关）、`#tgPanel`（属性面板开关） |
| `.brand` | L263 | `#brand`（户型名+层名）、`#subtitle`（面积/单位提示） |
| 户型组 | L264-267 | `#planBtn`（户型▾，hotkey P）、`#editBtn`（编辑户型） |
| `#viewSeg` | L268-272 | `data-view="2d"` / `"3d"`，含滑动 `.pill` |
| `#tools`（only2d） | L273-277 | `data-tool="select|measure|demolish"` |
| `#editTools`（only2d，`hidden`） | L278-291 | `data-em="wall|room|door|win|erase"`、`data-edone`、`#editKinds`（`data-ek="n|b|e|low"`） |
| `#lvBar`（only2d，`hidden`） | L292 | 复式楼层按钮（L1982-1989 运行时生成） |
| 缩放组（only2d） | L293-299 | `#zoomOut`、`#zoomIn`、`#fit`、`#s60`、`#s100` |
| `#modes3d` | L300-303 | `data-mode="orbit|walk"` |
| 3D 视角 | L304-307 | `#vIso`（斜视）、`#vTop`（俯视） |
| 撤销组 | L308-312 | `#undo`、`#redo`、`#clearAll`（清空布置，danger） |
| `#layers`（only2d） | L313-320 | `data-layer="dims|labels|furn|grid|bearing|wallSnap"`，默认 on：dims/labels/furn/wallSnap（L314-319 `class="btn chip on"`） |
| 剖切 | L321-324 | `data-cut="2.8"`（全高墙，默认 on）、`data-cut="1.2"`（剖切墙） |
| `#toggles3d` | L325-329 | `data-t="furn|labels|night"`，默认 on：furn/labels |
| 日照滑块 | L330 | `#sun`，`min=7 max=18 step=.25 value=10`，读数 `#sunT` |
| 语言 / 全屏 | L332-333 | `#langBtn`（EN/中文）、`#fullscreen`（Shift+F） |
| 文件菜单 | L334-343 | `#exportPng`、`#exportJson`、`#importJson`、`#exportPlan`、`#importPlan`、`#managePlans`、`#reset`（danger） |
| 文件输入 | L344 | `#fileIn`，`accept=".json,application/json"` |

### 1.2 选择 / 移动（tool = select）

- 指针按下（L1668-1704）：命中 `[data-handle]` 且已选中家具 → 进入 `rot` / `size` 拖拽（L1690-1692）；命中 `[data-fid]` → 选中并进入 `move` 拖拽（L1695-1698）；否则进入 `pan`（同时记录 `room` 以便单击选中房间，L1700-1701）。
- 移动吸附：`snapMove(f, cx, cy)`（L1620-1630），栅格 `grid() = 10mm`（L1619）；`ui.layers.wallSnap` 开启时对 `snapRects()`（未拆墙体 + 窗，L908）做贴边吸附，容差 `10/view.s`。
- 拖拽阈值：`TAP = COARSE ? 9 : 4`（L1004），未超阈值不触发移动（L1734）。
- 旋转手柄：`Math.atan2(...)+90`，`e.shiftKey` 时自由角度，否则 15° 吸附（L1738-1740）。
- 尺寸手柄：反解局部坐标，宽深取整到 10mm、最小 100mm，并同步修正中心（L1741-1748）。
- 单击空白：`select(room ? {kind:'room',id} : null)`（L1662）。
- 双击家具：旋转 90°（L1768-1770）。
- 房间 hover：footer `#hover` 显示「名称 + 面积」（L1718-1719）；CSS `#plan.tool-select .room:hover{opacity:.82}`（L61）。
- 选中后浮动工具条 `#fab`（渲染 L1421-1434）：`rotL / rotR / dup / del / prop / done`；窄屏额外 `prop`。

### 1.3 测量（tool = measure）

- 两种交互并存：按住拖动一次成型，或依次点两点（L1684-1688）。
- 端点吸附 `snapPoint(p, shift)`（L1631-1640）：先 10mm 取整，再对 `snapRects()` 边界吸附（容差 `8/view.s`）；按住 Shift 且有起点时锁定水平/垂直。
- 拖动结束：位移 > 20mm 才落库（L1656-1658）；未拖动则保留起点等第二次点击（L1659）。
- 光标 `crosshair`（L57）；顶部模式提示 `#modehint`（L1580-1586）。
- 清除：右键（L1773，`preventDefault`）；Esc（L1802）；总览面板 `#clearMeasure`（L1416）。
- 渲染见 2.7。

### 1.4 拆改墙体（tool = demolish）

- 点击墙体即切换拆除状态 `toggleWall(id)`（L1563-1570，入口 L1693-1694）。
- 规则：`k==='b'` 承重墙拒绝（toast「承重墙（黑色）不可拆除」，L1565）；`k==='e'` 外墙拒绝（L1566）；`n`（非承重）与 `low`（矮墙）可拆。
- 存 `state.demolished`（墙体索引 id，形如 `w12`）；拆除长度统计 `max(dx,dy)/1000` 米（L1375）。
- 交互可达性：`#plan .wall{pointer-events:none}`（L58）→ `#plan.tool-demolish .wall{pointer-events:all;cursor:pointer}`（L59），hover 变 `#d9894f`（L60）。

### 1.5 缩放 / 适应 / 1:60 / 1:100

- 状态：`view = {x0, y0, s}`，初值 `s = .06`（L1020）。
- 滚轮：`view.s * Math.exp(-deltaY * (ctrlKey ? .01 : .0015))`（L1763-1767），`passive:false` 阻止页面滚动。
- `zoomAt` 钳制 `s ∈ [.012, 2]`（L1606）；按钮 `#zoomIn ×1.25` / `#zoomOut ×0.8`（L2577-2578）。
- `fitView()`（L1599-1604）：`s = min(W/BOUNDS.w, H/BOUNDS.h)`，并把 BOUNDS 居中。
- 比例换算常量：`PX_MM = 25.4/96`（≈0.264583 mm/px，L1002）。
  - `setRatio(r)` → `zoomAt(1/(r*PX_MM), 画面中心)`（L1611）；`#s60`（L2580）、`#s100`（L2581）。
  - footer 当前比例显示 `'1:' + Math.round(1/(view.s*PX_MM))`（L1592-1593）。
- 比例尺 `#sbBar/#sbText`（L1594-1596）：从 `[100,200,500,1000,2000,5000]` 里取第一个 `v*view.s >= 60` 的值，`>=1000` 显示米。
- 画布尺寸变化：`ResizeObserver`（L2652-2657）——首次尺寸（`lastW===0`）执行 `fitView()`，其余变化保持画面中心不动。
- 3D 侧同步：2D→3D 时用 `planPose()` 精确对齐当前 2D 视口（L3623-3627）。

### 1.6 图层开关

- 统一状态 `ui.layers = {dims:true, labels:true, furn:true, grid:false, bearing:false, wallSnap:true}`（L1018-1019）。
- 绑定 L2572-2576：`dims` 只改 `#gDims` 的 `display` 属性（不重算）；`wallSnap` 只影响吸附；其余触发 `renderAll()`。
- 各图层落点：`dims` → L1279；`labels` → L1256；`furn` → L1198；`grid` → L1291（填 `url(#grid)` 或 `transparent`）；`bearing` → 承重墙填色由 `#26241f` 变 `#b8412c`（L1210）；`wallSnap` → L1622。
- 编辑面板内另有 `grid/dims/furn` 三个快捷开关（L2510-2511，绑定 L2525-2530）。

### 1.7 2D / 3D 切换

- `setView(m)`（L2558-2567）：`switching` 互斥；`document.body.classList.add('busy')` 期间 `#viewSeg` 禁用（L119）；3D 前强制回到 `select` 工具并清空测量起点（L2563）。
- 类名协议：`body.m3d` 控制 `.only2d/.only3d` 显隐（L120）、`.pill` 位移（L118）、2D 侧按钮着色（L116-117）；`main.is3d` 控制 `#plan` 淡出（L124）与 `#view3d` 淡入（L127-128）。
- 若 `window.View3D` 未就绪（three.js 需联网）→ toast 提示（L2560）。
- 切换动画：进入 = 交叉淡入 420ms + 1700ms 相机/墙体/家具生长（L3670-3689）；退出 = 1300ms 反向 + 450ms 等待（L3690-3706）。
- 3D 与 2D 实时同步靠 `renderAll()` 末尾的 `window.View3D?.sync()`（L1340）。

### 1.8 撤销 / 重做

- **布置历史**（家具 / 房间名 / 地面 / 拆除 / 测量）：`undoStack`、`redoStack`（L1021）；`commit(before)` 上限 **150** 步并清空 redo（L1025）；`undo/redo` 对 `state` 整体 JSON 快照进出（L1027-1028）；`validateSel()` 清理失效选中（L1029）。
- **户型结构历史**：独立 `planHist`（L866），`planEdit(fn)`（L2154-2160）先 `planSnapshot()`（L2140）压栈，上限 **80**（L2155），并重建 `BOUNDS`、`syncRoomState()`、`renderOpenings/renderDims/renderAll/renderPanel`；`planUndo()`（L2141-2153）恢复五组数组并按新长度过滤 `state.demolished`（L2150）。
- 入口：按钮 `#undo/#redo`（L2582）；`Ctrl/⌘+Z`、`Ctrl/⌘+Shift+Z`、`Ctrl/⌘+Y`（L1781-1782）；编辑面板 `#pUndo`（L2521）。
- 按钮态：`disabled` + `opacity` 由 `updateHeader()` 维护（L1346-1347）。

### 1.9 全屏

- `toggleFullscreen()`（L2587-2595）：标准 API + `webkit` 前缀回退；不支持时 toast 提示「添加到主屏幕」（L2592）。
- `syncFullscreen()`（L2596-2600）同步文案与 `title`；监听 `fullscreenchange` / `webkitfullscreenchange`（L2602）。
- 独立 App（`navigator.standalone` 或 `display-mode: standalone`）时隐藏按钮（L2604）。
- 快捷键 `Shift+F`（L1790）。

### 1.10 语言切换

- 存储键 `huxing-lang`，值 `'en' | 'zh'`，默认 `zh`（L414-415）。
- 三套机制：
  1. `tr(zh, en)` 运行时二选一（L416）。
  2. 术语表 `NAMES_EN`（L418-437，共 **86** 条）+ `nm(s)`（L438）——只翻译内置名称，用户改过的名字原样显示。
  3. 静态文案走 `[data-en]` / `[data-en-title]`，首次切换把中文原文写入 `dataset.zh` / `dataset.zhTitle`（`applyStaticLang()`，L440-446）。
- `setLang(l)`（L2659-2665）额外重建：`applyStaticLang / syncFullscreen / syncModeHint / syncPaneBtns / buildLib / renderOpenings / renderAll / tip / View3D.relang()`。
- 切换入口 `#langBtn`（L2666）。文档标题、`<html lang>` 同步（L441-442）。
- 3D 侧：`relang()` → `syncWalkTexts()` + `buildLabels()`（L3890）。

### 1.11 多方案（户型）管理

> 这是现行版本相对 `.bak` 的**最大结构性增量**。内置 **7 个** 户型，用户户型存 localStorage，二者用法完全一致（L603-604）。

| 能力 | 行号 | 要点 |
| --- | --- | --- |
| 内置户型表 `PRESETS` | L854 | 顺序：`P_3B, P_2B, P_3C, P_4D, P_1A, P_LOFT, P_BLANK`；默认打开 `PRESETS[0]`（L855, L1013） |
| 户型库弹窗 | L394-408、L2134-2135 | 打开时 `renderPlanGrid()` 重算 |
| 缩略图 | L2099-2106 | 纯色替代 `<pattern>`；`preserveAspectRatio="xMidYMid meet"`；多层显示 `N层` 角标（L2116） |
| 列表卡片 | L2107-2133 | 每卡：缩略图、名称、内置/自定义标签、`tag`、多层合计面积、房间数；按钮 打开/改名/复制/导出/删除（内置无删除，L2124） |
| 切换 | `switchPlan(id, lv)` L1962-1976 | 先 `endEdit()`、`save()`，3D 时先回 2D；重置 undo/redo/选中；`fitView()`；`View3D.sync(true)`；toast |
| 新建空白 | L2000-2007 | 新建后 60ms 自动进入编辑模式（L2005） |
| 复制 | L2008-2025 | 逐层复制存档（多层按层拷贝，L2013-2018） |
| 删除 | L2026-2040 | 内置拒绝（L2035）；二次确认（L2036）；删除后若为当前户型则切回 `PRESETS[0]`（L2038） |
| 改名 | L2041-2046 | `prompt` 输入（L2129） |
| 内置保护 | `ensureCustom()` L1991-1999 | 改内置户型前自动存副本，`tag` 置「自定义」 |
| 深拷贝 | `normalizePlan()` L1916-1960 | 外部/复制数据清洗：数值兜底、非法项丢弃、`rooms[].mat` 必须命中 `MATS`（L1937）、`levels` 递归复用同一清洗（L1950） |
| 楼层切换 | L1982-1989 + L2626 | `#lvBar` 运行时生成按钮；点击 `switchPlan(PLAN.id, lv)`；快捷键 `1` / `2`（L1787） |

### 1.12 编辑模式（户型结构编辑）

> 现行版本第二大增量。默认参数 `edit = {on:false, mode:'wall', kind:'n', thick:200, doorW:900, winW:1500, grid:100, snap:'grid', ortho:true, pts:[], drag:null, hover:null}`（L862-865）。

| 子能力 | 行号 | 要点 |
| --- | --- | --- |
| 进入 / 退出 | `startEdit()` L2278-2293、`endEdit()` L2294-2301 | 内置户型先 `ensureCustom()` 并延迟 80ms 进入（L2280-2288）；进入时暂存原 `grid` 图层并强制开网格（L2285, L2291），退出时还原（L2297） |
| 工具切换 | L2636-2641、L2523 | `wall / room / door / win / erase`，切换时清空 `pts/drag/hover/axis` |
| 墙类型 | L286-290、L2641 | `n` 非承重 / `b` 承重 / `e` 外墙 / `low` 矮墙 |
| CSS 态 | L182-189 | `tool-edit` 下墙与 `[data-op]` 可点、`.room` 不响应（另有透明补层）、`#gEdit` 全部 `pointer-events:none` |
| 画墙 | `editDown/editMove/editUp` L2414-2476 | 拖动成段；起笔 `alignToFace()` 对齐墙轴避免半墙厚错位（L2204-2208）；落点 `snapP()`；`orthoDelta()` 正交；`>80mm` 才成墙（L2466）；沿用 `edit.kind` 与 `edit.thick`（L2467-2471） |
| 画房间 | L2420-2428、`closeRoomPoly()` L2353-2374 | 逐点；点回起点（16px 内，L2427）或回车（L1789）或双击（L1769）闭合；闭合前把末点拉回起点轴线（L2355-2360）；去重点、面积 <0.5m² 拒绝（L2367）；`at` 取顶点均值（L2368-2369） |
| 加门 | `addDoorAt()` L2375-2391 | 门宽 `edit.doorW` 默认 900；沿墙居中钳制；`cutWall()` 开洞；开向由 `inAnyRoom()` 判断（L2382）；洞长 <300 拒绝（L2388） |
| 加窗 | `addWinAt()` L2392-2401 | 窗宽 `edit.winW` 默认 1500；厚度 <200 拒绝（L2398） |
| 删除 | `eraseWall/eraseOp/eraseRoom` L2402-2413 | 依序探测 `[data-op]`（门窗）→ `[data-wall]` → `[data-room]`（L2437-2439） |
| 吸附 | L2209-2218 | `grid`（吸 `edit.grid`，默认 100mm）/ `corner`（吸 `snapEnds()` 中线端点与房间角点，容差 `14/view.s`）/ `off` |
| 正交 | `orthoDelta()` L2220-2225 | 默认开；按住 **Alt** 临时自由角度（L2424, L2446） |
| 吸附提示 | `renderSnapGuides()` L2236-2248 | 命中网格 → 小圆环；仅命中单轴 → 贯穿虚线 `#c65b3a`；墙角 → `#2f5d62` 圆环 |
| 尺寸提示 | `lenTag()` L2250-2259 | 长度 + （非 0°/90° 时）角度，文字带白描边 |
| 编辑网格 | `gridLines()` L2227-2235 | 仅编辑绘制时画；间距 <20mm 或线条 >400 条时跳过 |
| 预览层 | `renderEditPreview()` L2312-2352 | `#gEdit`；正交锁参考线 `#2f5d62` dash `7 5` |
| 编辑面板 | `editPanel()` L2479-2518、`bindEditPanel()` L2519-2545 | 户型名、墙体段数/房间数、撤销修改、一键自动布置（L2495, L2522）、墙厚/门宽/窗宽/捕捉步长（L2499-2503）、吸附模式、正交开关、图层快捷、房间表（改名/换地面/删除）、完成/导出/户型库 |
| 墙体裁切 | `cutWall()` L2165-2171 + `remapDemolished()` L2161-2164 | 拆分后重映射 `state.demolished` 索引 |
| 命中判定 | `wallAt()` L2172、`inAnyRoom()` L2173-2178（射线法） | |

### 1.13 自动布置（亮点功能，已在基线内）

- `autoFurnish()`（L911-974）：按房间**名称正则**与包围盒尺寸推一套家具。
  - 卧室类 `/卧|寝室|睡房|主卧|次卧|儿童房|小孩房|子女房|老人房|客卧/`（L921）：床 + 床头柜×2 + 衣柜；儿童房且面积 >8m² 追加书桌 + 椅子（L934）。
  - 书房 `/书房|工作间|studio/i`（L935）：书桌 + 椅子 + 大书架。
  - 客厅（L939）、餐厅（L946）、厨房（L952）、卫浴（L958，面积 ≥3.2m² 才放淋浴房）、阳台（L962，含洗衣/生活阳台分支）、过道/玄关（L966）、其他面积 >4m² 放绿植（L968）。
  - 地毯排序到最底层（L973）；`put()` 丢弃 <200mm 的项并 `pushOut()` 防穿墙（L913-917）。
- 触发：编辑面板「一键自动布置」（L2522）；`defaultState()` 对无 `furn` 的户型自动调用（L979）。

---

## 2. 2D 渲染管线

### 2.1 房间多边形 `renderRooms()`（L1171-1194）

- 编辑模式先渲染一层 `fill="transparent"` 的可点面（L1174，CSS 承接 L186-187），再渲染真正的图案填充面（L1175）。
- 填充 = `url(#m-<mat>)`，`mat` 来自 `state.rooms[id].mat`（L1175）。
- 门/推拉门洞口先铺「门槛石」矩形：`fill="#e2dacb" stroke="#b9b0a0"`（L1176-1177）。
- 楼梯 `L.stairs`（L1180-1189）：踏步数 `max(3, round(|y1-y0|/260))`，梯段宽 1000mm，填 `#efe9de` 描边 `#a7a195`；中部上行箭头 `#6b655c`。
- 挑空 `L.voids`（L1190-1192）：`fill rgba(181,101,58,.06)`，`stroke #b5653a` `dash 7 4`。

### 2.2 材质图案 `buildDefs()`（L1037-1058）

| pattern id | 行号 | 尺寸 | 底色 / 线色 |
| --- | --- | --- | --- |
| `m-wood` | L1045 | 1800×360 | `#dcc09a` / `#bf9d70` |
| `m-walnut` | L1045 | 1800×360 | `#a57c56` / `#80593a` |
| `m-tile800` | L1046 | 800×800 | `#ece7de` / `#d3cabb` |
| `m-tile600` | L1046 | 600×600 | `#e2e6e3` / `#c4cbc6` |
| `m-antislip` | L1046 | 300×300 | `#d6dbd7` / `#b3bab4` |
| `m-marble` | L1047-1048 | 1200×1200 | `#f3f0ea` + 云纹 `#d6cfc2` |
| `m-terrazzo` | L1050-1053 | 500×500 | `#e8e1d5` + 6 色骨料圆 |
| `m-carpet` | L1054-1055 | 120×120 | `#c9c3d3` + 点纹 `#bab3c6` |
| `grid` | L1056-1057 | 1000×1000 | 次线 `#e5dfd3`/w8，主线 `#d8d0c1`/w14 |

### 2.3 墙体 `renderWalls()`（L1207-1215）

| 类型 | 常态填色 | 备注 |
| --- | --- | --- |
| `b` 承重 | `#26241f`（`bearing` 图层开时 `#b8412c`） | L1210 |
| `low` 矮墙 | `#e9e3d8` + `stroke #8f897d` w1 | L1210-1211 |
| `e` 外墙 | `#8f897d` | L1210 |
| `n` 非承重 | `#a7a195` | L1210 |
| 已拆 | `rgba(198,91,58,.12)` + `stroke #c65b3a` w1.2 `dash 5 3` | L1212 |

每个墙是一个 `<rect class="wall" data-wall="w<i>">`（L1213）——`data-wall` 是拆改/编辑命中键。

> **⚠️ 对下游有约束的语义（t12 / C-2 裁定依据）**：矮墙在原实现里是**两件套**——浅色**填充** `#e9e3d8`（L1210）+ 深色**描边** `#8f897d` w1（L1211）。
> 承载"这是一段矮墙"这一**信息**的是**描边**；填充只是视觉面（相对画布 `#f7f4ee` 仅 1.16:1）。
> 因此迁移后 `--ds-wall-low`（填充）计入**装饰豁免**、只有 `--ds-wall-low-stroke` 参与 ≥3:1 断言。
> 完整裁决与对比度规则见 `SPEC.md` §E.3 装饰豁免清单、§E.7 断言生成规则、**ADR-17**。

### 2.4 门窗 `renderOpenings()`（L1217-1252）

- 窗（L1220-1225）：`fill #f7fbfd`、`stroke #4f7394` w1（`non-scaling-stroke`）；在 1/3、2/3 处画分格线（横窗画横线、竖窗画竖线）。`data-op="w<i>"`。
- 平开门（L1227-1234）：钢制矩形门扇多边形（`fill #fff`）+ 开启弧路径（`stroke-dasharray 5 3`、`opacity .7`）；弧方向由 `o×c` 叉积定 sweep（L1230）；入户门（`entry`）用 `#b5653a` 且线宽 1.8（L1231-1232）。`data-op="d<i>"`。
- 推拉门（L1235-1238）：两片门扇各占洞口 55%；按 `v` 判断横/竖。`data-op="s<i>"`。
- 入户标识（L1239-1250）：**由入户门位置与 BOUNDS 中心自动推导方向**（不再硬编码）；箭头 + 文字「入户 / Entry」，`#b5653a`，字号 200。

### 2.5 尺寸标注链 `renderDims()`（L1264-1280）+ `autoDims()`（L1282-1288）

- 数据来源：`PLAN.dims`，为空时回退 `autoDims()`（墙包围盒总宽总高两条链，L1286-1287）。
- 链定义：`{h:<bool 水平>, at:<mm 偏移>, segs:[...递增分段], start?}`；示例见 P_3B 的 8 条链（L633-636）。
- 绘制：主链线 + 每个节点 ±170 的界桩线 + 45° 短划（长 80，线宽 2）；文字居中在分段中点、偏移 `at-70`，字号 `v<400 ? 140 : 200`；竖排链旋转 -90°。
- 颜色 `DC = '#7d7160'`（L1265）。显隐由 `ui.layers.dims` 控制（L1279）。

### 2.6 网格与测量

- 网格（L1290-1292）：单张 `55000×55000` 的 `<rect data-bg="1">`，`fill = ui.layers.grid ? 'url(#grid)' : 'transparent'`。
- 测量（L1294-1310）：已落库线 `#b5653a`，进行中线 `#2f5d62`；线宽 1.5（non-scaling）；端点画 ±5*k 的垂线；文字 `${round(L)} mm`，字号 `12/view.s`、白描边 `3.5/view.s`、`paint-order="stroke"`；起点画 `r=3*k` 圆点。
- `k = 1/view.s` 是本管线统一「屏幕像素 → 户型 mm」系数，所有描边/字号都据此换算以保证视觉恒定。

### 2.7 选中框 `renderSel()`（L1312-1336）

- 家具：虚线外框（偏移 `p = 5*k`，`dash 5 3`）；顶部旋转手柄（距边 `ro = COARSE?40:26`，半径 `6*hs*k`，`hs = COARSE?1.7:1`）；右下尺寸手柄为 `10*hs*k` 方块；两者各带透明大热区 `hit = COARSE?24:11`（`data-handle="rot"|"size"`）；下方标注 `${f.w} × ${f.d}`。
- 房间：`fill rgba(181,101,58,.08)` + `stroke #b5653a` w2。

### 2.8 家具图例 SVG `furnSVG(t,w,d,c)`（L1060-1167）

- 统一描边常量 `ST = 'stroke="#3d3a34" stroke-width="1" vector-effect="non-scaling-stroke"'`（L1061）。
- 辅助：`rc` 矩形（L1062）、`ec` 椭圆（L1063）、`ln` 线（L1064）、`pa` 路径（L1065）、`DASH = '4 3'`（L1066）、`shade(hex,k)` 明暗（L1035，k>1 时向白靠）。
- 覆盖 **45** 种家具类型（`switch` L1070-1166，无遗漏、有 `default` 兜底 L1165），并在两处复用：家具库缩略图（L1817）、图纸内家具（L1203）、拖拽幽灵图（L1845）。
- 库内缩略图 viewBox 按 `pad = max(w,d)*.08` 外扩（L1815）。

---

## 3. 3D 场景能力（three.js 0.160.0，importmap L249-254）

### 3.1 初始化与基础设施（L2703-2795）

| 项 | 行号 | 值 |
| --- | --- | --- |
| 渲染器 | L2705-2710 | `WebGLRenderer{antialias, preserveDrawingBuffer}`；`pixelRatio = min(dpr,2)`；`PCFSoftShadowMap`；`ACESFilmicToneMapping`，曝光 1.05 |
| 标签渲染器 | L2711-2714 | `CSS2DRenderer`，绝对定位 `pointer-events:none` |
| 相机 | L2717 | `PerspectiveCamera(FOV=45, near .05, far 300)` |
| OrbitControls | L2718-2719 | `enableDamping`；`maxPolarAngle = π*.495`；距离 `[1.5, 45]` |
| PointerLockControls | L2720-2722 | `lock` 隐藏遮罩显示准星；`unlock` 时若仍处 walk 则恢复遮罩 |
| 光照 | L2724-2728 | `HemisphereLight(0xfff8ee, 0xb9a88f, 1.1)`；`DirectionalLight(0xfff1dd, 2.6)` 投影，阴影贴图 `2048`（触屏）/`4096`；阴影相机 `±11`，`near 1 far 60`，`bias -0.0004`，`normalBias 0.02` |
| 地面 | L2729-2730 | `160×160` 平面，`0xf2eee7`，`y = -0.015` |
| 环境贴图 | L2733 | `PMREMGenerator.fromScene(RoomEnvironment, .04)` |
| 玻璃/墙/压顶/框材质 | L2734-2735 | 玻璃 `#cfe6ef`（roughness .05、opacity .28、双面）；墙 `#f4f1eb`（.92）；压顶 `#34312d`；框 `#5d6166`（metalness .4） |
| 分组 | L2737-2738 | `archFloor / archUp / furnG / labelG / lampG` |
| 世界坐标 | L2691-2692 | `OX()/OY() = BOUNDS 中心`；`wx(x)=(x-OX)/1000`，`wz(y)=(y-OY)/1000`，`M(v)=v/1000` |
| 常量 | L2690 | 层高 `H = 2.8`，`FOV = 45` |
| 运行时参数 `opt` | L2694 | `{cut:2.8, furn:true, labels:true, night:false, hour:10, mode:'orbit'}` |

### 3.2 程序化建筑 `buildArch()`（L3495-3559）

按序构建：清空 → `buildOtherLevels()`（复式其它层，L3458-3478）→ 房间地面 → 门/推拉门槛板 → 墙体 + 碰撞盒 → 洞口过梁 → 窗 → 门扇 → 楼梯 → 推拉门扇 → `applyLight()/applyGrow()`。

- **房间地面**（L3500-3515）：普通房间 `ShapeGeometry`；飘窗（`counted === false`）用 `ExtrudeGeometry` 挤出 **0.45m** 并加侧面材质 `#e9e4da`，抬到 `archUp`（L3502-3506）。天花 `#fbfaf7` 置于 `y=H`，仅当 `cut >= H` 可见（L3508-3509）。房间中心放吸顶灯盘 + `PointLight(0xffd9a8, 0, 7, 1.6)`（L3510-3514）。
- **墙体**（L3517-3521）：`wallBox(w, 0, cut)`；`low` 矮墙高度 `min(1, cut)`；每段墙同步推入碰撞盒 `colliders`。
- **过梁**（L3523-3524）：门洞 2.1m、推拉门 2.4m（横）/2.1m（竖）、`PLAN.lintels` 自定义（`l[4] || 2.4`）。
- **窗**（L3525-3536）：`[x0,y0,x1,y1, sill=0.9, head=2.4]`；上下墙、玻璃板、竖梃（间距 `L/0.9`）、上下横梃。
- **门扇**（L3537-3547）：`pivot` 铰点；`a0/a1` 由 `c/o` 向量求角并做 ±2π 归一（L3544）；初始 `cur = a1`、`open = true`；门扇 `box`，入户门色 `#6b4f3a`；球形把手。
- **楼梯** `stairBox()`（L3479-3487）：踏步数 `max(4, round(|Δy|/260))`，宽 1000mm，每级高度 `H/n` 累进。
- **推拉门扇**（L3549-3557）：两片玻璃（各占 55%）+ 上下框 + 两侧竖框。
- **其它层**（L3458-3478）：**仅**画墙体/窗/门/楼梯 + 「当前层之下」的楼板（`li < curLv`，L3467-3471）；当前层之上的楼板不画以免遮挡。
- 漫游辅助（L3448-3452）：每段墙附 `EdgesGeometry` 棱线与踢脚线，**仅 walk 模式可见**（`userData.walkOnly`）。

### 3.3 程序化家具 3D 模型清单 `buildFurniture()`（L2954-3439）

- 局部坐标约定：**背面朝 -z**；翻转后 `g.rotation.y = -f.rot * π/180`（L3436），`f.rot` 为平面顺时针角度。
- 46 个 `case`（45 类型 + `default` 兜底，L3433）：`bed`(L2957)、`sofa|armchair`(L2973)、`cornersofa`(L2986)、`nightstand`(L3002)、`wardrobe|cabinet|shoecab`(L3011)、`dresser`(L3039)、`desk`(L3054)、`chair`(L3073)、`bookshelf`(L3083)、`baycushion`(L3106)、`coffeetable`(L3111)、`tvstand`(L3121)、`rug`(L3132)、`plant`(L3137)、`table`(L3150)、`roundtable`(L3163)、`counter`(L3170)、`stove`(L3185)、`ksink`(L3197)、`fridge`(L3206)、`toilet`(L3219)、`vanity`(L3228)、`shower`(L3244)、`bathtub`(L3257)、`washer|dryer`(L3266)、`crib`(L3279)、`beanbag`(L3294)、`sidetable`(L3299)、`floorlamp`(L3306)、`island`(L3313)、`barstool`(L3325)、`waterheater`(L3332)、`tv`(L3340)、`aircon`(L3346)、`acwall`(L3355)、`dishwasher`(L3365)、`ovencol`(L3373)、`purifier`(L3384)、`officechair`(L3392)、`piano`(L3407)、`treadmill`(L3422)。
- 复用几何工具（L2857-2951）：`box/rbox/cyl/lathe/rod/tube/blob/ring/rrect/shell` + 参数化部件 `pull/knob/fronts/vase/tableLamp/plate/legs`。
- 材质工厂（L2902-2911）：`metal/chrome/hwMat/blackMetal/mirror/ceramic/fabric/woodM/screenMat/glowMat`；`mat()` 带缓存与「金属或光滑面挂环境反射」规则（L2800-2809）。
- 确定性伪随机 `rng(seed)`（L2810），种子 = `round(w*7 + d*13 + cx + cy)`（L2955）→ 书架/绿植等细节稳定可复现。
- 地面贴图 `floorMat(kind)`（L2820-2854）：Canvas 程序化生成（木纹/大理石/水磨石/砖点噪），按真实尺寸平铺（`repeat = 1/sx, 1/sy`），`TEX` 参数表 L2813-2818。

### 3.4 剖切墙 / 全高墙

- 参数 `opt.cut`，按钮 `data-cut="2.8"`（默认）与 `"1.2"`（L321-324）；绑定 L3862，同步 L3841。
- 影响：墙体高度、矮墙 `min(1, cut)`、天花与吸顶灯可见性（L3509, L3512）、过梁是否需要（`top > h`）、窗上下墙与玻璃高度。进入漫游时强制恢复全高（L3794）。

### 3.5 鸟瞰 / 漫游

- 模式 `opt.mode = 'orbit' | 'walk'`，按钮 L300-303，绑定 L3853，同步 L3840。
- 切换 `setMode(m)`（L3789-3807）：进入 walk 时清空选中、强制全高、从 `entryPose()` 定位（站在入户门外 1.6m 高，看向室内，L3796）；退出时回鸟瞰 `isoWhole()`（L3803）。
- 桌面端用 `PointerLockControls`；`pointerlockerror` 或触屏设备回退到摇杆漫游（L3855-3856）。
- `walkCtl` 遮罩文案三行由 `syncWalkTexts()` 生成（L3842-3851），按 `COARSE` 分触屏/桌面两套。
- 视角快捷：`#vIso` → `isoWhole()`，`#vTop` → `topWhole()`（L3860-3861）。
- 房间飞行：3D 左栏房间列表（`buildLabels()` 内 L3575-3582），`flyToRoom(id)` 按房间包围盒定距（L3660-3667）；「全屋」按钮飞 `isoWhole()`。

### 3.6 漫游摇杆（触屏）

- DOM `#joy`（L375，样式 L200-203）；逻辑 `bindJoystick()`（L3776-3788）：半径 50px，`pointerdown/move/up/cancel` 全 pointer 事件；输出归一化 `joy.x/joy.y ∈ [-1,1]`。
- `startTouchWalk()/stopTouchWalk()`（L3767-3775）控制 `#joy`、`#walkExit`、`#cross` 与提示文案。
- 转向：在画布上拖动 → `lookBy(dx,dy)`（L3762-3766），灵敏度 0.005，俯仰钳制 ±1.35rad。
- 移动 `stepWalk(dt)`（L3817-3831）：速度 1.4 m/s（Shift 2.6）；摇杆推力线性映射速度；**分轴碰撞**（X、Z 分开判定，L3829-3830）。

### 3.7 门开关

- 门对象 `{pivot, a0, a1, cur, open}`（L3543）；主循环按 `dt*6` 缓动逼近目标角（L3882）。
- 三种触发：鸟瞰点击（L2785）、漫游点击（`h.dist < 3.5`，L2780）、漫游按 `E`（`h.dist < 2.5`，L3835）。
- 拾取 `pick(e)`（L3710-3725）会**跳过玻璃**（`o.material === glassMat`），并沿父链回溯 `userData.fid`；被墙体挡住时返回 `null`。

### 3.8 日照 / 夜景

- `applyLight()`（L3603-3616）：
  - `t = (hour - 6)/12`；方位角 `az = π(.15 + t*.7)`；高度角 `el = sin(πt)*1.05 + .15`；暖度 `warm = 1 - sin(πt)`。
  - 太阳位置 `(cos(az)*18, sin(el)*20+3, -sin(az)*10+8)`；颜色 `HSL(.09, .5+warm*.4, .92-warm*.12)`。
  - 强度：白天 `1.4 + sin(πt)*1.6`，夜景 `0.05`；半球光 1.1 / 0.12。
  - 背景 白天 `0xf7f4ee` / 夜 `0x1c2130`；地面 白天 `0xf2eee7` / 夜 `0x2a2e38`。
  - 夜景时室内点光源强度 6、灯盘自发光 2；曝光 1.25（白天 1.05）；环境反射系数 `envK = 0.15`（白天 1）并就地刷新缓存材质的 `envMapIntensity`。
  - 时间读数 `#sunT` 格式 `HH:MM`。
- 控件：滑块 `#sun` 7–18h step .25（L330，绑定 L3869）；夜景开关 `data-t="night"`（L328，绑定 L3867）。

### 3.9 CSS2D 房间标签

- `buildLabels()`（L3567-3582）：为有 `at` 的房间创建 `div.rlabel`（`名称 + 面积 m²`），`CSS2DObject` 置于 `y = opt.cut + 0.15`（L3572）。
- `showLabels(v)`（L3594）逐个设置 `visible`——CSS2DRenderer **不继承父级可见性**，必须逐项设置（注释 L3593）。
- 显隐规则：`opt.labels && opt.mode === 'orbit' && !anim`（L3866）；进出 3D 动画期间关闭（L3674, L3687, L3693）。
- 同时刷新左侧 3D 房间列表（L3574-3581）。

### 3.10 增量重建

`sync(force)`（L3585-3591）用三组签名做脏检查：

| 签名 | 内容 | 触发重建 |
| --- | --- | --- |
| `sigArch` | `[state.rooms, state.demolished, opt.cut, PLAN.id, curLv, curLevel().stairs.length]`（L3587） | `buildArch()` |
| `sigFurn` | `state.furniture`（L3587） | `buildFurn()` |
| `sigLabels` | `[state.rooms, opt.cut, PLAN.id, curLv]`（L3587） | `buildLabels()` |

主循环 `loop()`（L3875-3886）：`anim` → `fly` → `orbit.update()` → `stepWalk(dt)`，随后门缓动、`updateSel()`、`renderer.render` + `labelRenderer.render`。

### 3.11 导出 3D 截图

`shot()`（L3888）：直接 `renderer.domElement.toDataURL('image/png')`（因 `preserveDrawingBuffer:true`），文件名「户型装修方案-3D.png」。

---

## 4. 数据模型与 localStorage

### 4.1 内存数据模型（现行版本）

```js
// 户型（L603 注释为准，实际字段见下）
Plan = {
  id, name, tag, builtin,            // L629 等
  bounds: {x, y, w, h},              // mm，可选；缺省由 boundsOf() 推导（L869-876）
  walls:  [x0, y0, x1, y1, kind],    // kind ∈ b|e|n|low（L456, L457-483）
  wins:   [x0, y0, x1, y1, sill?, head?],   // 默认 0.9 / 2.4（L484-491, L3526）
  doors:  {name, rect[4], h[2], c[2], o[2], len, entry?},  // L492-500, L623
  slides: {rect[4], v},              // L501-505, L625
  rooms:  {id, name, poly:[[x,y]...], mat, at?, counted?}, // L507-521, L624
  dims:   [{h, at, segs[], start?}], // L633-636, L1267-1278
  lintels:[[x0,y0,x1,y1,height]],    // L632, L3523
  stairs: [{x, y0, y1, dir}],        // L783, L820
  voids:  [{poly}],                  // L784, L845
}
MultiLevelPlan = Plan & { multilevel:true, levels:[{name, elev, walls, wins, doors, slides, rooms, dims, lintels, stairs, voids, bounds}] }  // L797-852, L1947-1957
Furniture = { id, type, name, cx, cy, w, d, rot, color }   // L566（F() 工厂）
State     = { furniture:[], rooms: { [roomId]: {name, mat} }, demolished:['w<i>'], measures:[{a:{x,y}, b:{x,y}}] }  // L976-981, L1017
```

- `uid()`：`'f' + Date.now().toString(36) + (_n++)`，`_n` 从 1 递增（L565）。
- 房间默认地面（`ROOMS[].mat`）：主卧室/小孩房/子女房 `wood`；主卫浴/客卫浴/洗衣阳台 `antislip`；厨房 `tile600`；餐厅/过道/客厅 `tile800`；休闲阳台 `walnut`；两个飘窗 `marble`（L508-521）。
- 飘窗用 `counted:false` 排除出使用面积（L519-520；统计处 L1344, L1368, L2110）。

### 4.2 localStorage 键（**完整清单**）

| 键 | 行号 | 值结构 | 说明 |
| --- | --- | --- | --- |
| `huxing-lang` | L414 | `'en'` / `'zh'` | 语言 |
| `huxing-panes` | L1446 | `{hideLib?:bool, hidePanel?:bool}` | 宽屏侧栏收起状态（L1447, L1457） |
| `huxing-plans-v1` | L608 | `{custom:[Plan...], current:<planId>}` | 自定义户型库 + 上次打开（L1904-1908） |
| `huxing-state-v2-<planId>` | L609 | `State` | **单层户型**布置 |
| `huxing-state-v2-<planId>-l<level>` | L891 | `State` | **复式每层**各一份 |
| `huxing-design-v1` | L983 | `State` | **旧版遗留键**；仍与新键同时写入（L1023），启动时一次性迁移（L1912-1913） |

### 4.3 迁移 / 修复 / 兜底逻辑

1. **启动顺序**（L1012-1013）：`loadPlans()` → `migrateLegacy()` → `usePlan(findPlan(curId) || PRESETS[0])`。
2. `loadPlans()`（L1902-1907）：读 `huxing-plans-v1`，`custom` 逐条 `normalizePlan` 并过滤 `null`，`curId = o.current`；异常静默。
3. `migrateLegacy()`（L1911-1914）：若存在 `huxing-design-v1` 且**尚无** `huxing-state-v2-h3b`，则把旧键内容写到 `PRESETS[0].id` 对应的新键（**不删除**旧键）。
4. `load()`（L984-987）：读当前 `curStateKey()`；要求 `Array.isArray(s.furniture)`，否则返回 `null`；成功则过 `fixState`。
5. `fixState(s)`（L988-994）：
   - `s.rooms = Object.assign(d.rooms, s.rooms || {})` —— 以默认房间表为底、存档覆盖（新增房间自动补齐、已删房间保留在存档中）；
   - `demolished` / `measures` 置空数组兜底；
   - `furniture` 非数组则回落默认布置。
6. `syncRoomState()`（L996-1000）：户型结构变更后**重建** `state.rooms`——只保留当前户型仍存在的房间 id（用户改过的名称/地面优先保留）。
7. `normalizePlan(p)`（L1916-1960）：导入/复制的唯一入口。非法项直接丢弃（`walls` 需数组且长度 ≥4，L1926-1927；`rooms` 需 `poly` ≥3 点，L1933；`doors` 需 `rect`+`h` 数组，L1929）；数值统一 `num()` 兜底为 0（L1920）；`mat` 非法回落 `tile800`（L1937）；`bounds` 需 `isFinite(w)`（L1945）；多层走 `levels.map` 并递归复用同一清洗（L1949-1956），同时把顶层 `walls/rooms` 清空（L1957）。
8. 存档时机：`save()`（L1023）同时写新键与旧键；`savePlans()`（L1908）写户型库与 `current`；切户型前先 `save()`（L1965）；`endEdit()`/`planEdit()` 均落盘（L2158-2159, L2299）。
9. 异常策略：所有 `localStorage` 访问都包 `try/catch` 静默失败（隐私模式 / 配额）；`planHist` 视觉快照同样无持久化。
10. 旧存档兼容（L890-892）：`stateOf(id, lv)` 对多层的户型追加 `-l<lv>`，单层沿用旧键名——即单层户型的存档路径与 `.bak` 时代完全一致。

### 4.4 视图与 UI 状态（不持久化）

```js
ui   = { tool:'select', sel:null, mA:null, mCur:null,
         layers:{dims:true, labels:true, furn:true, grid:false, bearing:false, wallSnap:true} }   // L1018-1019
view = { x0:0, y0:0, s:.06 }                                                                       // L1020
edit = { on:false, mode:'wall', kind:'n', thick:200, doorW:900, winW:1500, grid:100,
         snap:'grid', ortho:true, pts:[], drag:null, hover:null }                                  // L862-865
opt  = { cut:2.8, furn:true, labels:true, night:false, hour:10, mode:'orbit' }                     // L2694（3D）
```
`viewMode = '2d'`（L859）；`switching`、`drag`、`pinch`、`touches`、`libDrag`、`planHist`、`undoStack/redoStack` 均为会话内状态。

---

## 5. 家具库

### 5.1 结构与条目数（L533-561）

| # | 分类 | 行号 | 条目数 |
| --- | --- | --- | --- |
| 1 | 卧室 | L534-538 | **12** |
| 2 | 客厅 | L539-544 | **14** |
| 3 | 餐厨 | L545-549 | **11** |
| 4 | 卫浴 | L550-553 | **8** |
| 5 | 家电 | L554-557 | **9** |
| 6 | 书房 · 休闲 | L558-560 | **6** |
| | **合计** | L533-561 | **60** |

条目结构：`[type, 名称, 宽mm, 深mm, 颜色hex]`（L532 注释）。去重后 **45** 种 `type`（与 2D `furnSVG`、3D `buildFurniture` 的 switch 覆盖一致）。

### 5.2 全量清单（`type | 名称 | 宽 × 深 | 颜色`）

**卧室（L535-538）**
| type | 名称 | 宽×深 | 颜色 |
| --- | --- | --- | --- |
| bed | 双人床 1.8m | 1800×2000 | `#c9d6df` |
| bed | 双人床 1.5m | 1500×2000 | `#d8c7dc` |
| bed | 单人床 | 1200×2000 | `#e8d5b5` |
| crib | 婴儿床 | 1250×700 | `#efe3d0` |
| nightstand | 床头柜 | 450×400 | `#e8dccb` |
| wardrobe | 衣柜 | 2000×600 | `#efe6d8` |
| wardrobe | 小衣柜 | 1200×550 | `#efe6d8` |
| dresser | 梳妆台 | 1000×450 | `#efe6d8` |
| desk | 书桌 | 1200×600 | `#e2cfb4` |
| chair | 椅子 | 450×480 | `#cfc6b8` |
| bookshelf | 书架 | 800×300 | `#e2cfb4` |
| baycushion | 飘窗垫 | 520×1800 | `#e7dccd` |

**客厅（L540-544）**
| type | 名称 | 宽×深 | 颜色 |
| --- | --- | --- | --- |
| sofa | 三人沙发 | 2400×900 | `#b7c4b0` |
| sofa | 双人沙发 | 1700×880 | `#c3cbd6` |
| cornersofa | 转角沙发 | 2800×1700 | `#b7c4b0` |
| armchair | 单人沙发 | 850×850 | `#d6b99a` |
| beanbag | 懒人沙发 | 800×800 | `#e0b98f` |
| coffeetable | 茶几 | 1300×650 | `#e8dccb` |
| sidetable | 边几 | 500×500 | `#d9c3a3` |
| tvstand | 电视柜 | 2400×400 | `#e2cfb4` |
| rug | 地毯 | 2400×1700 | `#d9cbb8` |
| shoecab | 鞋柜 | 1000×350 | `#efe6d8` |
| shoecab | 玄关柜 | 1400×380 | `#e6dccc` |
| floorlamp | 落地灯 | 450×450 | `#3d3a34` |
| plant | 绿植 | 500×500 | `#a9c39b` |
| plant | 大绿植 | 700×700 | `#9dbb8c` |

**餐厨（L546-549）**
| type | 名称 | 宽×深 | 颜色 |
| --- | --- | --- | --- |
| table | 餐桌 | 1400×800 | `#e2cfb4` |
| table | 六人餐桌 | 1800×900 | `#d8c2a2` |
| roundtable | 圆桌 | 1000×1000 | `#e2cfb4` |
| chair | 餐椅 | 450×480 | `#cfc6b8` |
| island | 岛台 | 1800×900 | `#e9e5de` |
| barstool | 吧椅 | 420×420 | `#6b5d4c` |
| counter | 橱柜台面 | 1600×600 | `#e9e5de` |
| stove | 燃气灶 | 750×450 | `#dcdcdc` |
| ksink | 水槽 | 800×450 | `#e1e6ea` |
| fridge | 冰箱 | 700×700 | `#dfe4e8` |
| cabinet | 餐边柜 | 1600×400 | `#efe6d8` |

**卫浴（L551-553）**
| type | 名称 | 宽×深 | 颜色 |
| --- | --- | --- | --- |
| toilet | 马桶 | 400×700 | `#ffffff` |
| vanity | 浴室柜 | 800×500 | `#eef1f3` |
| vanity | 双盆浴室柜 | 1200×500 | `#eef1f3` |
| shower | 淋浴房 | 900×900 | `#e4edf2` |
| bathtub | 浴缸 | 1600×750 | `#eef3f6` |
| washer | 洗衣机 | 600×600 | `#e6ebee` |
| waterheater | 电热水器 | 800×450 | `#f4f4f2` |
| cabinet | 储物柜 | 1000×400 | `#efe6d8` |

**家电（L555-557）**
| type | 名称 | 宽×深 | 颜色 |
| --- | --- | --- | --- |
| tv | 65 寸电视 | 1450×80 | `#1d1d1f` |
| tv | 55 寸电视 | 1230×80 | `#1d1d1f` |
| fridge | 对开门冰箱 | 910×700 | `#c9ced3` |
| aircon | 柜机空调 | 500×380 | `#f6f7f8` |
| acwall | 挂机空调 | 900×250 | `#f6f7f8` |
| dishwasher | 洗碗机 | 600×600 | `#c9ced3` |
| ovencol | 蒸烤箱高柜 | 600×600 | `#efe6d8` |
| dryer | 烘干机 | 600×600 | `#e6ebee` |
| purifier | 空气净化器 | 400×300 | `#f4f4f2` |

**书房 · 休闲（L559-560）**
| type | 名称 | 宽×深 | 颜色 |
| --- | --- | --- | --- |
| desk | 长书桌 | 1600×700 | `#d8c2a2` |
| officechair | 办公椅 | 620×620 | `#4a4f55` |
| bookshelf | 大书架 | 1600×350 | `#e2cfb4` |
| piano | 立式钢琴 | 1500×600 | `#1f1d1b` |
| treadmill | 跑步机 | 800×1800 | `#3a3a3c` |
| armchair | 阅读椅 | 750×800 | `#c9a98a` |

### 5.3 家具库交互

- 渲染 `buildLib()`（L1813-1825）：每项 `.item[data-key="<catIdx>:<itemIdx>"]`，缩略图 viewBox 按 `pad = max(w,d)*.08` 外扩（L1815）。
- 拖放（**pointer 事件，非 HTML5 DnD**，为兼容 iPad）：`libDrag`（L1821-1824, L1830）；超过 `TAP` 像素才生成 `#ghost` 幽灵图（L1842-1847），幽灵图按落点比例显示真实大小（L1848-1850）；`touch-action:pan-y` 让竖向滑动交还滚动（L45, 注释 L1829）。
- 落点 `dropPoint(x,y)`（L1832-1838）：需在 `#stage` 内且不落在侧栏抽屉/`#fab`/`#walkOverlay`/`#joy`/`#walkExit` 上；3D 走 `View3D.groundAt()`，2D 走 `toMM()`。
- 轻点（未拖动）：放到选中房间中心，否则画面中心（3D 取屏幕中心的地面点）（L1866-1873）。
- 新增 `addItem()`（L1556-1562）：坐标取整到 10mm、`pushOut()` 防穿墙、`rug` 自动 `unshift` 到最底层、自动选中并 toast。
- `pushOut()`（L1543-1555）：最多 4 轮，沿穿透较浅的轴向推离墙/窗，使家具刚好贴边。
- `typeColor(t)`（L562）：取该类型在库中首次出现的颜色作为默认色。

---

## 6. 材料价格表与报价 / 面积计算口径

### 6.1 材料表 `MATS`（L522-531）

| key | 名称 | 单价 ¥/m² | 色板 sw |
| --- | --- | --- | --- |
| `wood` | 橡木地板 | 320 | `#d8b88a` |
| `walnut` | 胡桃木地板 | 380 | `#9b7250` |
| `tile800` | 800 地砖 | 220 | `#ebe6dc` |
| `tile600` | 600 地砖 | 160 | `#dfe3e1` |
| `marble` | 大理石 | 650 | `#f1eee8` |
| `antislip` | 300 防滑砖 | 140 | `#d3d8d4` |
| `terrazzo` | 水磨石 | 280 | `#e6dfd3` |
| `carpet` | 满铺地毯 | 200 | `#c9c3d3` |

> `terrazzo` 与 `carpet` 在 7 个内置户型中**均未被任何房间使用**，但可被用户/导入数据选用。

### 6.2 计算口径（**必须逐字保留**）

| 指标 | 公式 | 行号 |
| --- | --- | --- |
| 多边形面积（m²） | `abs(Σ(x_i*y_{i+1} - x_{i+1}*y_i))/2 / 1e6`（鞋带公式） | L902 |
| 周长（m） | 各边 `hypot` 求和 `/1000` | L903 |
| 套内使用面积 | `Σ area(room)`，**排除** `counted === false` 的飘窗 | L1344, L1368 |
| 地面材料合计 | `Σ (每种材料面积 × 单价 × 1.05)`，**含 5% 损耗** | L1372-1373, L1381-1383 |
| 单房间材料估价 | `area × price × 1.05` | L1485 |
| 墙面面积（估算） | `周长 × 2.8m`，**未扣除门窗洞口** | L1483 |
| 家具占地面积 | `w*d/1e6` m² | L1509 |
| 拆除墙体长度 | `Σ max(dx, dy) / 1000` 米 | L1375 |
| 房间开间 / 进深 | 包围盒 `x1-x0` / `y1-y0`（mm） | L1481-1482 |
| 户型卡片面积 | 各层 `counted !== false` 房间面积之和 | L2110-2113 |

- 面积计算基于**墙体内净尺寸多边形**（文案 L1380：「* 飘窗不计入使用面积；面积按墙体内净尺寸计算」）。
- 默认示例：P_3B 上/下/左/右四边尺寸链 `10270 / 11850 / 10560 / 10560`（L451-454）。
- 报价展示位置：右侧「地面材料估算」表（L1381-1383）、房间面板「材料估价」（L1485）、户型卡片面积（L2118）。
- **无**税费、人工费、辅料、损耗以外的任何系数；**无**货币/单位切换。

---

## 7. 导入导出能力

### 7.1 图片

| 入口 | 行号 | 行为 |
| --- | --- | --- |
| `#exportPng` → `exportPNG()` | L1880-1897 | 2D：克隆 `svg#plan`，重设 `viewBox = BOUNDS`、宽 `3200px`、高按比例；清空 `#gSel`；`#gGrid` 换成纯色底（网格开时仍用 `url(#grid)`）并额外插入 `#f7f4ee` 背景矩形；序列化 → `Image` → `canvas` → PNG Blob → 下载。文件名「户型装修方案.png」 |
| 3D | L1881, L3888 | 委托 `View3D.shot()`，`toDataURL` 直出。文件名「户型装修方案-3D.png」 |

### 7.2 布置 JSON（家具层）

| 入口 | 行号 | 结构 / 校验 |
| --- | --- | --- |
| `#exportJson` | L2612 | 直接 `JSON.stringify(state, null, 2)`；**仅** `{furniture, rooms, demolished, measures}` |
| `#importJson` → `#fileIn` | L2613-2621 | `file.text()` → `JSON.parse`；**必须** `Array.isArray(s.furniture)`，否则抛错 toast「文件格式不正确」；成功则 `fixState` 后 `commit(before)` 入撤销栈 |
| `#reset` | L2622 | 确认后 `state = defaultState()`，可撤销 |

> 「布置」= 单户型的 `State`；不含墙体结构。

### 7.3 户型 JSON（结构 + 各层布置）

| 入口 | 行号 | 结构 |
| --- | --- | --- |
| `#exportPlan` → `exportPlan(p)` | L2055-2063 | `{format:'huxing-plan-v1', plan:stripPlan(p), state:<当前层存档>, states?:[...仅多层]}`；文件名 `<户型名>.json` |
| `#pmExportAll` → `exportAllPlans()` | L2064-2072 | `{format:'huxing-plan-v1-set', plans:[{plan, state, states?}...]}`（**全部**内置 + 自定义）；文件名「全部户型.json」 |
| `#importPlan` / `#pmImport` → `#planFileIn` | L2630-2635, L2644 | `f.text()` → `importPlanText()`；弹窗打开时同步刷新列表 |
| `importPlanText(txt)` | L2073-2096 | 见下 |

**`stripPlan(p)` 白名单**（L2049-2054）：`id, name, tag, bounds, walls, wins, doors, slides, rooms, dims, lintels, stairs, voids, multilevel`；多层再逐层 strip 一次。

**`importPlanText()` 接受的 4 种形态**（L2075-2081）：
1. 顶层数组 `[...]`；
2. `{plans:[...]}`（`-set` 格式）；
3. `{plan:{...}, state, states?}`（单户型格式）；
4. 裸户型对象（含 `walls` 数组）。

拒绝：`{furniture:[...]}` → 提示改用「导入布置」（L2075）；无法识别 → 「不是有效的户型文件」（L2081）。

导入行为：每个户型**重新分配 id**（L2085），`normalizePlan` 清洗后入 `customPlans`；`states` / `state` 里 `furniture` 为数组时写入对应层存档（L2087-2089）；导入完成后打开最后一个（L2094）。

### 7.4 多方案打包

- 「导出全部户型」即 7.3 的 `-set` 格式，一次性打包内置 + 自定义（含每层布置）（L2064-2072）。
- 复制户型时也会**逐层复制布置存档**（L2013-2021）。
- **没有** zip / 云端 / 分享链接能力；下载统一走 `download(name, blob)`（L1879，`URL.createObjectURL` + 1s 后 `revokeObjectURL`）。

---

## 8. 键盘与触屏快捷键表

### 8.1 键盘（现行版本，L1777-1810）

前置守卫：焦点在 `input,select,textarea` 时全部失效（L1778）；3D 漫游中 `View3D.walking()` 为真时全部失效（L1779）——漫游有自己的 WASD 处理（L3832-3837）。

| 按键 | 行为 | 行号 |
| --- | --- | --- |
| `Ctrl/⌘ + Z` | 撤销 | L1781 |
| `Ctrl/⌘ + Shift + Z` | 重做 | L1781 |
| `Ctrl/⌘ + Y` | 重做 | L1782 |
| `Ctrl/⌘ + D` | 复制选中家具 | L1783 |
| `[` | 切换家具库侧栏 | L1785 |
| `]` | 切换属性面板 | L1785 |
| `P` | 打开户型库 | L1786 |
| `1` / `2` | 复式切层（多层层型，需无 Shift） | L1787 |
| `E` | 进入 / 退出编辑户型（仅 2D） | L1788 |
| `Enter` | 闭合绘制中的房间多边形（编辑·房间模式） | L1789 |
| `Shift + F` | 全屏切换 | L1790 |
| `T` | 2D / 3D 切换 | L1791 |
| `V` | 选择工具 | L1793 |
| `M` | 测量工具 | L1794 |
| `X` | 拆改墙体工具 | L1795 |
| `F` | 适应窗口 | L1796 |
| `R` | 旋转 90°（`Shift` 反向 -90°） | L1797 |
| `Delete` / `Backspace` | 删除选中家具 | L1798 |
| `Esc` | 依次：清编辑绘制点 → 关户型弹窗 → 清测量起点 → 回选择工具并取消选中 | L1799-1803 |
| `↑ ↓ ← →` | 移动选中家具 10mm（`Shift` 100mm） | L1804-1807 |
| `+` / `=` | 放大（×1.25） | L1808 |
| `-` | 缩小（×0.8） | L1809 |

守卫分支（L1792）：3D 模式下 `v/m/x/f/+/-` 被忽略（避免与 3D 视角键冲突）。

**3D 漫游专属键**（L3832-3837 + `stepWalk` L3817-3831）：

| 按键 | 行为 |
| --- | --- |
| `W/A/S/D` 或方向键 | 前后左右移动（速度 1.4 m/s） |
| `Shift` | 快走（2.6 m/s） |
| `E` | 开关正前方 2.5m 内的门（L3835） |
| `Esc` | 解除指针锁定 → 回到遮罩（`unlock` 事件 L2722） |
| 鼠标移动 | 转向（`PointerLockControls`） |

### 8.2 触屏（`pointer: coarse`，L206-223 样式 / L1389-1403 面板文案）

| 手势 | 行为 | 实现行号 |
| --- | --- | --- |
| 单指拖空白 | 平移画面 | L1728-1731 |
| 双指捏合 | 缩放 + 平移（以两指中点为锚） | L1675-1680, L1709-1714 |
| 家具库轻点 | 放到选中房间中心 / 画面中心 | L1866-1873 |
| 家具库按住横拖 | 拖到指定位置（竖向滑动仍为滚动列表） | L1821-1824, L1839-1853 |
| 点家具 | 选中；拖动移动 | L1695-1698 |
| 拖顶部圆点 | 旋转（`Shift` 自由角度；触屏无 Shift） | L1738-1740 |
| 拖右下方块 | 改尺寸 | L1741-1748 |
| 底部工具条 | 旋转 / 复制 / 删除 / 属性 / 完成 | L1421-1434 |
| 测量 | 按住拖线，或依次点两点 | L1684-1688 |
| 3D 单指 | 旋转（鸟瞰） | OrbitControls |
| 3D 双指 | 缩放 / 平移 | OrbitControls |
| 3D 漫游摇杆 | 左下 130px 摇杆移动 | L3776-3788 |
| 3D 漫游拖动画面 | 转向 | L3761-3766 |
| 点门 | 开关（漫游中 3.5m 内） | L2780, L2785 |

触屏适配常量与样式：`COARSE`（L1003）、`TAP = 9`（L1004）、按钮 `min-height:38px`、`seg` 宽度 92px（L211-212）、表单字号 16px 防 iOS 缩放（L216）、手柄半径与热区放大（L1318）。

其他输入约定：
- 鼠标中键 / 右键按下不触发 2D 拖拽（L1669）；右键在测量模式清空起点（L1773），在编辑模式清空绘制点（L1772）。
- iPad Safari 双指整页缩放被显式阻止（`gesturestart/change/end`，L1761）。
- 页面 `overscroll-behavior:none`、`touch-action:manipulation`（L17）。

---

## 9. 现行版本 与 `.bak` 的差异清单

### 9.1 结论（先行）

**现行版本是 `.bak` 的功能超集（strict functional superset）。**逐节核对后**未发现任何 `.bak` 具备而现行版本缺失的用户可见能力**：`.bak` 的每一项 2D 渲染、3D 场景、家具库、材料报价、多语言、导入导出、快捷键能力，在现行版本中都有对应实现（部分被**参数化 / 数据驱动化**重写，语义等价或更强）。差异全部是**新增**或**改造升级**。逐项证据见下表。

### 9.2 新增能力（`.bak` 无）

| # | 能力 | 现行版本证据 | `.bak` 对照 |
| --- | --- | --- | --- |
| D1 | **多方案（户型）管理**：户型库弹窗、切换/新建/复制/改名/删除/缩略图 | 按钮 L265；弹窗 L394-409；`PLAN_STORE`/`PLAN_FMT` L607-608；逻辑 L1902-2135 | 无 `#planBtn`（bak:L230 为静态 brand）、无 `#planModal`（bak:L338 之后直接 `#toast`）、无 `PRESETS` |
| D2 | **7 个内置户型**（三室两厅两卫 / 一室一厅一卫 / 两室两厅一卫 / 三室两厅一卫 / 四室两厅两卫 / 复式两层 / 空白） | `PRESETS` L854；定义 L628-852 | 仅 1 套硬编码户型（bak:L385-448） |
| D3 | **户型结构编辑模式**（画墙/画房间/加门窗/删除 + 吸附 + 正交 + 编辑面板） | 工具条 L278-291；实现 L2137-2545；`#gEdit` L367；CSS L179-189 | 完全无（bak:L301-311 的 SVG 无 `#gEdit`；bak:L1182-1216 指针处理无 `edit.on` 分支） |
| D4 | **复式 / 多层**（层切换、楼梯、挑空、逐层存档） | `P_LOFT` L781-852；`isMulti/levelOf/usePlan` L858-895；`#lvBar` L292 + L1982-1989；楼梯/挑空渲染 L1178-1192；3D 其它层 L3458-3487 | 无（bak 无 `levels`/`stairs`/`voids` 概念） |
| D5 | **自动布置家具**（按房间名 + 面积） | `autoFurnish()` L911-974；按钮 L2495/L2522；`defaultState()` 回退 L979 | 无（bak:L496-527 只有一套手工默认布置） |
| D6 | **尺寸标注数据驱动 + 自动兜底** | `PLAN.dims` L633-636 等；`renderDims()` L1264-1280；`autoDims()` L1282-1288 | bak:L798-802 **硬编码** 8 条链，只对唯一户型有效 |
| D7 | **入户标识自动推导方向**（任意户型可用） | L1239-1250（依 `DOORS.entry` + `BOUNDS` 中心） | bak:L770-771 **硬编码** 坐标 3350/8755 |
| D8 | **窗台高 / 窗顶高参数化** | `WINS` 支持第 5/6 元素 L484-491；3D 解构默认 L3526 | bak:L2309 `const sill = i === 0 ? 1.4 : i >= 6 ? .45 : .9` 按索引硬编码；head 恒为 2.4 |
| D9 | **过梁（lintels）数据驱动** | `lintels` L632 等；3D 使用 L3523 | bak:L2306 硬编码两段飘窗过梁 |
| D10 | **户型缩略图** | `planThumb()` L2099-2106 | 无 |
| D11 | **逐户型 / 逐层存档键** | `stateKey` L609、`stateOf` L891、`save()` L1023 | bak:L534/L562 只有单一 `huxing-design-v1` |
| D12 | **旧存档自动迁移** | `migrateLegacy()` L1911-1914 | 无（bak:L536 直接读旧键） |
| D13 | **户型导入导出的清洗与校验** | `normalizePlan` L1916-1960、`stripPlan` L2049-2054、`importPlanText` L2073-2096 | bak 只有布置 JSON 的导入导出（bak:L1463-1473） |
| D14 | **多层级 `furn` 工厂 + `bounds` 自动推导** | `boundsOf()` L869-876、`usePlan` L882-888、`L.furn` L979 | bak:L550 `const BOUNDS` 写死；`defaultState` 只用 `defaultFurniture()`（bak:L531） |
| D15 | **世界原点随户型自适应** | `OX()/OY()` L2691 | bak:L1514 `OX = 6000, OY = 5300` 常量 |
| D16 | **漫游入口自动定位到入户门** | `entryPose()` L3650-3659，用于 L3796 | bak:L2565 硬编码 `wx(4200)/wz(8755)` |
| D17 | **3D 增量重建签名纳入户型/楼层** | `sync()` L3587 | bak:L2369 签名仅 `[state.rooms, state.demolished, opt.cut]` |
| D18 | **存档字段兜底加固** | `fixState` 的 `furniture` 数组校验 L992 | bak:L539-544 无该校验 |
| D19 | **新快捷键**：`P`（户型库）/`E`（编辑）/`1`·`2`（切层）/`Enter`（闭合房间） | L1786-1789 | bak:L1292-1293 无这四个键 |
| D20 | **新增工具栏分组**：`#editTools`、`#lvBar`、`#planBtn`、`#editBtn`、文件菜单 3 个新项 | L264-267, L278-292, L334-343（7 项）| bak:L282-288 文件菜单仅 4 项 |
| D21 | **CSS 新增模块**：户型库弹窗、户型编辑、卡片、标签 | L157-189 | bak 无对应样式块 |

### 9.3 语义等价的重写（不算删减）

| 项 | 现行版本 | `.bak` | 等价性说明 |
| --- | --- | --- | --- |
| 飘窗过梁 | `PLAN.lintels = [[10270,800,10510,2600,2.4],[10270,4260,10510,5740,2.4]]`（L632）+ 通用消费（L3523） | 硬编码 `[[10270,800,10510,2600],2.4],[[10270,4260,10510,5740],2.4]`（bak:L2306） | 数值完全相同 |
| 窗台高 | P_3B `WINS[0]=[5140,-240,5760,0,1.4]`，索引 ≥6 为 `.45`（L486-491） | `i===0 ? 1.4 : i>=6 ? .45 : .9`（bak:L2309） | 对 P_3B 结果逐项一致 |
| 默认布置 | `PLAN.furn` → `defaultFurniture()`（L979, L637） | 直接 `defaultFurniture()`（bak:L531） | P_3B 路径一致 |
| `BOUNDS` | `let` + `boundsOf()`（L1006, L869） | `const`（bak:L550） | 升级为可变/推导 |
| `renderRooms` | 增加编辑补层 + 楼梯 + 挑空（L1174, L1180-1192） | 无（bak:L718-724） | 原逻辑保留在 L1175-1177 |
| `renderOpenings` | 增加 `data-op` 与自动入户标识（L1220-1250） | 无属性、硬编码标识（bak:L750-771） | 原图元逐一对应 |
| `setView` 所在的 `viewMode` 声明位置 | L859（户型段落内） | bak:L1403（与 `switching` 同处） | 仅声明位置差异 |

### 9.4 `.bak` 独有内容检查（逐项否定）

已核对 `.bak` 的每个功能区块，均可在现行版本中定位到对应或更强实现：

| `.bak` 区块 | 现行版本对应 |
| --- | --- |
| 2D 图层组 `#gGrid…#gSel`（bak:L302-311） | L357-366（多一个 `#gEdit`） |
| CSS 样式（bak:L11-215） | L11-248（`.bak` 全部规则逐条存在，另加 L157-189 新块） |
| 房间/材料/`NAMES_EN`（bak:L346-448） | L418-531（`NAMES_EN` 完全一致，86 条） |
| 家具库 `LIB`（bak:L461-489） | L533-561（逐条一致，60 条） |
| 默认布置（bak:L496-527） | L568-599（逐条一致） |
| 2D 渲染 8 个函数（bak:L715-857） | L1169-1348（逐一对应） |
| 家具图例 `furnSVG`（bak:L615-713） | L1068-1167（**逐 case 一致**） |
| 右侧面板 4 个函数（bak:L869-1046） | L1353-1531（对应，`renderPanel` 增加 `edit.on` 分支 L1356） |
| 操作/视图/吸附/指针/键盘/家具库/导入导出（bak:L1048-1497） | L1533-2673（全部存在，另有新增） |
| 3D 全部（bak:L1499-2661） | L2675-3893（初始化/材质/几何工具/46 个家具 case/建筑/光照/相机/拾取/漫游/工具栏/主循环**逐一对应**） |
| 3D 家具 `case` 集合（bak:L1779-2256） | L2956-3433（**类型集合完全相同，无新增无缺失**） |

### 9.5 迁移风险提示（源自差异）

1. **硬编码 → 数据驱动的重构点必须逐一验证**：D6/D7/D8/D9/D15/D16 六处由「写死」变为「按户型推导」。若迁移实现保留硬编码，内置 6 个非默认户型与所有导入户型会立刻出错。
2. **两套历史栈互不干扰**（布置 `undoStack` L1021 vs 结构 `planHist` L866）：迁移时若合并成单一栈，`Ctrl+Z` 语义会变化。
3. **`renderAll` 不含 `renderOpenings/renderDims`**（见 0.3）：这是刻意的性能设计，Vue 化时若并入统一 watch，会造成家具拖动时门窗/尺寸全量重绘。
4. **`state.demolished` 存的是墙体数组下标**（L1567, L1210），户型结构编辑会重排下标，必须实现 `remapDemolished()`（L2161-2164）等价逻辑，否则拆改状态会错位。
5. **`huxing-design-v1` 旧键必须继续写入**（L1023）以兼容回退，迁移时应保留。

---

## 10. 待确认项（不做推测）

以下事项在源码中**未找到确定性依据**，标注为待确认，需在实现阶段用运行验证而非猜测来定论：

| # | 待确认项 | 现状证据 | 需要何种验证 |
| --- | --- | --- | --- |
| U1 | `fixState()` 中 `Object.assign(d.rooms, s.rooms || {})`（L990）会就地修改 `defaultState()` 产出的 `d.rooms` 对象。因 `d` 为局部变量、每次调用新建，是否只影响本次调用？ | L988-994 无其它引用 | 单元测试：连续两次 `fixState` 传入不同存档，断言互不污染 |
| U2 | `.bak` 存档迁移（L1912-1913）只针对 `PRESETS[0].id`（`h3b`）。用户若在旧版本里没有改动过默认户型，迁移后 `huxing-design-v1` 仍会被 `save()` 继续覆写（L1023）——是否存在旧数据被新数据覆盖的时序问题？ | L1023 每次保存都写旧键 | 集成测试：注入旧键数据后启动，检查新旧键值 |
| U3 | `importPlanText` 对「裸户型对象」与「`{plan}` 包装」的 `states` 取值分支（L2087-2088）在 `list.length === 1` 时才读顶层 `o.states`；多层导出格式 `{format, plan, state, states}` 是否总满足该分支？ | L2058-2060, L2087-2088 | 往返测试：`exportPlan` → `importPlanText` 逐层比对 |
| U4 | `buildOtherLevels()`（L3458-3477）临时覆写全局 `WALLS/WINS/DOORS/SLIDES/ROOMS` 后恢复；与主循环异步渲染是否可能交叉？ | L3463, L3476 保存/恢复；调用点 L3499 在 `buildArch` 内同步执行 | 复式户型切换层 + 连续编辑，观察是否有层级错绘 |
| U5 | 3D `pick()` 在多层户型下只对当前层 + `archUp` 全部对象做射线；`buildOtherLevels` 加入的下层墙体是否会误挡拾取？ | L3714, L3492 | 复式户型 3D 点击测试 |
| U6 | `autoFurnish()` 的房间名正则为中文/英文混合（如 `/书房|工作间|studio/i`，L935）；纯英文房间名（如「Bedroom」）不会命中卧室分支 | L921, L935, L939… | 用英文命名的自定义户型验证，确认是否需要补英文关键词 |
| U7 | `terrazzo` / `carpet` 两种材料在内置户型中零使用（见 6.1） | L529-530 vs L508-521 | 确认是否有意保留为可选材料（影响是否需要在 UI 中突出） |
| U8 | 材料价格表（L522-531）的来源与时效性未知 | 仅硬编码 | 需产品确认是否为示例价 |
| U9 | 3D 依赖 CDN importmap（L249-254，`three@0.160.0`），离线环境不可用；`setView` 对此有降级提示（L2560）但 2D 不受影响 | L249-254, L2560 | 确认迁移后是否需要本地打包（Vite 下应为 npm 依赖） |
| U10 | `.bak` 与现行版本在 `isoFrom()` 上的差异：现行对多层户型额外抬高并加大距离系数 1.25（L3631-3632）；对单层户型方向向量同为 `(.3,.82,.49)` | L3631 vs bak:L2411 | 确认单层户型视角未变（对比截图） |
| U11 | 现行 `renderDims()` 依赖 `PLAN.dims`，而 `PLAN` 在结构编辑中**不会**重新计算 `dims`（`planEdit` 未更新 `PLAN.dims`，L2154-2160）——编辑增删房间后尺寸链是否应同步？ | L2154-2160, L1277 | 产品决策：编辑后尺寸链保持原样（现状）还是重算 |
| U12 | `#fab` 的 `done` 动作在编辑模式下被强制隐藏（L2310），但 CSS 尚有 `main.drawer-panel #fab` 规则（L194） | L2310, L194 | 交互回归确认 |
