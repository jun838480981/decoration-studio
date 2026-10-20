<script setup lang="ts">
/**
 * 右侧属性面板（原 `renderPanel()` 的四个分支：总览 / 家具 / 房间 / 编辑，L1353-1531）。
 *
 * 分支优先级与原实现一致：编辑模式 → 家具选中 → 房间选中 → 总览。
 *
 * 算量口径**逐条保留**（OF §6.2）：面积 m² 两位小数、地面材料 ×1.05 损耗、墙面面积 = 周长 ×2.8
 * （未扣门窗）、拆除长度 Σmax(dx,dy)/1000。数据全部来自 store 的 computed，⛔ 不在组件里重算口径。
 */
import { computed } from 'vue';
import { useLayoutStore } from '@/stores/layout';
import { usePlanStore } from '@/stores/plan';
import { useUiStore } from '@/stores/ui';
import { useToastStore } from '@/stores/toast';
import { MATERIAL_LIST, MATS } from '@/data/materials';
import { nameIn } from '@/data/names-en';
import { useAppLang } from '@/composables/useAppLang';
import { fmt, norm } from '@/utils/geometry';
import { furnitureFootprint, furnitureInside, roomEstimate, roomSize, wallArea } from '@/utils/measure';
import { askConfirm } from './dialogs/confirm';
import { askPrompt } from './dialogs/prompt';
import type { MaterialKey } from '@/types/material';
import type { Furniture } from '@/types/furniture';

const plan = usePlanStore();
const layout = useLayoutStore();
const ui = useUiStore();
const toast = useToastStore();
const lang = useAppLang();

const mode = computed<'edit' | 'furn' | 'room' | 'overview'>(() => {
  if (ui.edit.on) return 'edit';
  if (ui.selection?.kind === 'furn' && layout.getF(ui.selection.id)) return 'furn';
  if (ui.selection?.kind === 'room') return 'room';
  return 'overview';
});

const selectedFurniture = computed<Furniture | undefined>(() =>
  ui.selection?.kind === 'furn' ? layout.getF(ui.selection.id) : undefined,
);

const selectedRoom = computed(() =>
  ui.selection?.kind === 'room' ? plan.rooms.find((room) => room.id === ui.selection?.id) : undefined,
);

const roomRows = computed(() =>
  layout.roomRows.map((row) => ({ ...row, name: nameIn(row.name, lang.value) })),
);

const materialRows = computed(() =>
  layout.materialBreakdown.map((entry) => ({
    key: entry.key,
    name: nameIn(MATS[entry.key].name, lang.value),
    sw: MATS[entry.key].sw,
    area: entry.area,
    cost: entry.cost,
  })),
);

const roomDetail = computed(() => {
  const room = selectedRoom.value;
  if (!room) return null;
  const override = layout.rooms[room.id];
  const mat = (override?.mat ?? room.mat) as MaterialKey;
  const size = roomSize(room.poly);
  return {
    id: room.id,
    name: nameIn(override?.name ?? room.name, lang.value),
    mat,
    area: layout.roomRows.find((row) => row.id === room.id)?.area ?? 0,
    counted: room.counted !== false,
    wallArea: wallArea(room.poly),
    width: size.width,
    depth: size.depth,
    estimate: roomEstimate(room, mat),
    furniture: furnitureInside(room.poly, layout.furniture),
  };
});

function selectRoom(id: string): void {
  ui.select({ kind: 'room', id });
}

function selectFurniture(id: string): void {
  ui.select({ kind: 'furn', id });
}

function clearMeasures(): void {
  if (layout.measures.length === 0) return;
  layout.clearMeasures();
}

async function clearLayout(): Promise<void> {
  const count = layout.furniture.length;
  if (count === 0) {
    toast.push('当前没有布置任何家具');
    return;
  }
  const ok = await askConfirm({
    title: '清空布置',
    message: `确定清空全部 ${count} 件家具 / 家电吗？\n墙体、地面材料和测量线会保留，可点「撤销」恢复。`,
    confirmText: '清空',
    danger: true,
  });
  if (ok && layout.clearLayout()) toast.push('已清空布置，可点「撤销」恢复');
}

// ---- 家具属性编辑（原 `bindFurnPanel`，L1517-1531） ----
function updateFurniture(mutator: (target: Furniture) => void): void {
  const id = selectedFurniture.value?.id;
  if (!id) return;
  layout.mutate(() => {
    const target = layout.getF(id);
    if (target) mutator(target);
  });
}

function setName(event: Event): void {
  const value = (event.target as HTMLInputElement).value.trim();
  if (!value) return;
  updateFurniture((target) => {
    target.name = value;
  });
}

function setNumber(field: 'w' | 'd' | 'cx' | 'cy' | 'rot', min: number, event: Event): void {
  const raw = Number.parseFloat((event.target as HTMLInputElement).value);
  if (!Number.isFinite(raw)) return;
  updateFurniture((target) => {
    if (field === 'rot') target.rot = norm(raw);
    else target[field] = Math.max(min, Math.round(raw));
  });
}

function setColor(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  updateFurniture((target) => {
    target.color = value;
  });
}

// ---- 房间属性编辑（原 `bindRoomPanel`，L1490-1496） ----
function setRoomName(event: Event): void {
  const room = selectedRoom.value;
  if (!room) return;
  const value = (event.target as HTMLInputElement).value.trim();
  if (!value) return;
  layout.renameRoom(room.id, value);
}

function setRoomMaterial(mat: MaterialKey): void {
  const room = selectedRoom.value;
  if (!room) return;
  layout.setRoomMaterial(room.id, mat);
}

// ---- 编辑面板（原 `editPanel()` + `bindEditPanel()`，L2479-2545） ----
function setEditParam(key: 'thick' | 'doorW' | 'winW' | 'grid', event: Event): void {
  const value = Number.parseFloat((event.target as HTMLInputElement).value);
  if (!Number.isFinite(value) || value <= 0) return;
  ui.setEditParam(key, value);
}

function setPlanName(event: Event): void {
  const value = (event.target as HTMLInputElement).value.trim();
  if (!value) return;
  plan.renamePlan(plan.currentId, value);
}

async function renameRoomInline(id: string, current: string): Promise<void> {
  const next = await askPrompt({ title: '房间名称', value: nameIn(current, lang.value) });
  if (next !== null) layout.renameRoom(id, next);
}

function deleteRoomInline(id: string): void {
  plan.planEdit(() => {
    const data = plan.levelData;
    data.rooms = data.rooms.filter((room) => room.id !== id);
  });
  if (ui.selection?.kind === 'room' && ui.selection.id === id) ui.select(null);
  toast.push('已删除房间');
}

function autoFurnish(): void {
  layout.autoFurnish();
  toast.push('已按户型自动布置家具');
}

function undoStructure(): void {
  if (!plan.planUndo()) toast.push('没有可撤销的户型修改', 'warn');
}
</script>

<template>
  <div class="panel">
    <!-- ============ 1. 结构编辑 ============ -->
    <template v-if="mode === 'edit'">
      <section class="panel__section">
        <h3 class="panel__title">编辑户型 <small>{{ plan.plan.name }}</small></h3>
        <label class="field">
          <span>户型名称</span>
          <input :value="plan.plan.name" @change="setPlanName" />
        </label>
        <div class="stats">
          <div class="stat"><small>墙体段数</small><span class="big">{{ plan.walls.length }}</span></div>
          <div class="stat"><small>房间数</small><span class="big">{{ plan.rooms.length }}</span></div>
        </div>
        <div class="actions">
          <button type="button" class="btn" @click="undoStructure">撤销修改</button>
          <button type="button" class="btn" @click="autoFurnish">一键自动布置</button>
        </div>
      </section>

      <section class="panel__section">
        <h3 class="panel__title">绘制内容</h3>
        <div class="e-grid">
          <button
            v-for="item in [
              { key: 'wall', zh: '画墙' },
              { key: 'room', zh: '画房间' },
              { key: 'door', zh: '加门' },
              { key: 'win', zh: '加窗' },
              { key: 'erase', zh: '删除' },
            ] as const"
            :key="item.key"
            type="button"
            class="btn"
            :class="{ 'btn--on': ui.edit.mode === item.key }"
            @click="ui.setEditMode(item.key)"
          >
            {{ item.zh }}
          </button>
        </div>
        <div class="form">
          <label class="field">
            <span>墙厚 (mm)</span>
            <input type="number" :value="ui.edit.thick" step="10" min="60" @change="setEditParam('thick', $event)" />
          </label>
          <label class="field">
            <span>门宽 (mm)</span>
            <input type="number" :value="ui.edit.doorW" step="50" min="500" @change="setEditParam('doorW', $event)" />
          </label>
          <label class="field">
            <span>窗宽 (mm)</span>
            <input type="number" :value="ui.edit.winW" step="50" min="300" @change="setEditParam('winW', $event)" />
          </label>
          <label class="field">
            <span>捕捉步长 (mm)</span>
            <input type="number" :value="ui.edit.grid" step="50" min="10" @change="setEditParam('grid', $event)" />
          </label>
        </div>
        <div class="e-grid">
          <button
            v-for="item in [
              { key: 'grid', zh: '吸附网格' },
              { key: 'corner', zh: '吸附墙角' },
              { key: 'off', zh: '不吸附' },
            ] as const"
            :key="item.key"
            type="button"
            class="btn"
            :class="{ 'btn--on': ui.edit.snap === item.key }"
            @click="ui.setSnap(item.key)"
          >
            {{ item.zh }}
          </button>
        </div>
        <div class="e-grid">
          <button type="button" class="btn" :class="{ 'btn--on': ui.edit.ortho }" @click="ui.toggleOrtho()">
            正交（只画直线）
          </button>
        </div>
        <p class="muted">
          画墙：按住拖一段，落点吸网格 / 墙角；起笔点在墙上时会对齐到墙轴，不会错半墙。画房间：逐点点击，点回起点或按回车闭合。绘制默认正交，按住 Alt 临时自由斜画。加门 / 加窗：点在某段墙上会自动开洞。删除：点墙体 / 门窗 / 房间。
        </p>
      </section>

      <section class="panel__section">
        <h3 class="panel__title">显示</h3>
        <div class="actions">
          <button
            v-for="item in [
              { key: 'grid', zh: '网格' },
              { key: 'dims', zh: '尺寸' },
              { key: 'furn', zh: '家具' },
            ] as const"
            :key="item.key"
            type="button"
            class="chip"
            :class="{ 'chip--on': ui.flags[item.key] }"
            @click="ui.toggleLayer(item.key)"
          >
            {{ item.zh }}
          </button>
        </div>
      </section>

      <section class="panel__section">
        <h3 class="panel__title">房间 <small>改名 / 换地面 / 删除</small></h3>
        <table class="table">
          <tbody>
            <tr v-for="room in plan.rooms" :key="room.id">
              <td>
                <button type="button" class="link" @click="renameRoomInline(room.id, layout.rooms[room.id]?.name ?? room.name)">
                  {{ nameIn(layout.rooms[room.id]?.name ?? room.name, lang) }}
                </button>
              </td>
              <td class="table__narrow">
                <select
                  :value="layout.rooms[room.id]?.mat ?? room.mat"
                  @change="layout.setRoomMaterial(room.id, ($event.target as HTMLSelectElement).value as MaterialKey)"
                >
                  <option v-for="mat in MATERIAL_LIST" :key="mat.key" :value="mat.key">
                    {{ nameIn(mat.name, lang) }}
                  </option>
                </select>
              </td>
              <td class="table__tiny">
                <button type="button" class="btn btn--danger btn--tiny" title="删除" @click="deleteRoomInline(room.id)">
                  ✕
                </button>
              </td>
            </tr>
            <tr v-if="plan.rooms.length === 0">
              <td class="muted">还没有房间，用「画房间」添加</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="panel__section actions">
        <button type="button" class="btn btn--primary" @click="ui.endEdit()">完成编辑</button>
      </section>
    </template>

    <!-- ============ 2. 家具属性 ============ -->
    <template v-else-if="mode === 'furn' && selectedFurniture">
      <section class="panel__section">
        <h3 class="panel__title">家具属性</h3>
        <div class="form">
          <label class="field field--full">
            <span>名称</span>
            <input :value="selectedFurniture.name" @change="setName" />
          </label>
          <label class="field">
            <span>宽 (mm)</span>
            <input type="number" :value="selectedFurniture.w" min="50" step="10" @change="setNumber('w', 50, $event)" />
          </label>
          <label class="field">
            <span>深 (mm)</span>
            <input type="number" :value="selectedFurniture.d" min="50" step="10" @change="setNumber('d', 50, $event)" />
          </label>
          <label class="field">
            <span>中心 X (mm)</span>
            <input type="number" :value="Math.round(selectedFurniture.cx)" step="10" @change="setNumber('cx', -1e9, $event)" />
          </label>
          <label class="field">
            <span>中心 Y (mm)</span>
            <input type="number" :value="Math.round(selectedFurniture.cy)" step="10" @change="setNumber('cy', -1e9, $event)" />
          </label>
          <label class="field">
            <span>旋转 (°)</span>
            <input type="number" :value="selectedFurniture.rot" step="15" @change="setNumber('rot', -1e9, $event)" />
          </label>
          <label class="field">
            <span>颜色</span>
            <input type="color" :value="selectedFurniture.color" @change="setColor" />
          </label>
        </div>
        <p class="muted">占地面积 {{ fmt(furnitureFootprint(selectedFurniture)) }} m²</p>
        <div class="actions">
          <button type="button" class="btn" @click="layout.rotateSelection(90)">旋转 90°</button>
          <button type="button" class="btn" @click="layout.duplicateSelection()">复制</button>
          <button type="button" class="btn" @click="layout.bringToFront(selectedFurniture.id)">置于顶层</button>
          <button type="button" class="btn" @click="layout.sendToBack(selectedFurniture.id)">置于底层</button>
          <button type="button" class="btn btn--danger" @click="layout.deleteSelection()">删除</button>
          <button type="button" class="btn" @click="ui.select(null)">← 返回</button>
        </div>
      </section>
      <section class="panel__section muted">
        拖动家具移动；拖动上方圆点旋转；拖动右下角方块调整尺寸。开启「贴墙吸附」后靠近墙面会自动贴齐。
      </section>
    </template>

    <!-- ============ 3. 房间属性 ============ -->
    <template v-else-if="mode === 'room' && roomDetail">
      <section class="panel__section">
        <h3 class="panel__title">房间</h3>
        <label class="field field--full">
          <span>名称</span>
          <input :value="roomDetail.name" @change="setRoomName" />
        </label>
        <div class="stats">
          <div class="stat"><small>使用面积</small><span class="big">{{ fmt(roomDetail.area) }}</span> m²</div>
          <div class="stat"><small>开间</small><span class="big">{{ roomDetail.width }}</span> mm</div>
          <div class="stat"><small>进深</small><span class="big">{{ roomDetail.depth }}</span> mm</div>
          <div class="stat"><small>是否计入</small><span class="big">{{ roomDetail.counted ? '是' : '否' }}</span></div>
        </div>
        <p class="muted">墙面面积（层高 2.8m，未扣门窗）约 {{ fmt(roomDetail.wallArea, 1) }} m²</p>
      </section>

      <section class="panel__section">
        <h3 class="panel__title">地面材料</h3>
        <div class="mats">
          <button
            v-for="mat in MATERIAL_LIST"
            :key="mat.key"
            type="button"
            class="mat"
            :class="{ 'mat--on': roomDetail.mat === mat.key }"
            @click="setRoomMaterial(mat.key)"
          >
            <i class="mat__swatch" :style="{ background: mat.sw }" />
            <span>
              {{ nameIn(mat.name, lang) }}
              <small>¥{{ mat.price }}/m²</small>
            </span>
          </button>
        </div>
        <div class="total"><span>材料估价</span><b>¥{{ Math.round(roomDetail.estimate).toLocaleString() }}</b></div>
      </section>

      <section class="panel__section">
        <h3 class="panel__title">房间内家具 <small>{{ roomDetail.furniture.length }} 件</small></h3>
        <table class="table">
          <tbody>
            <tr v-for="item in roomDetail.furniture" :key="item.id" class="table__row" @click="selectFurniture(item.id)">
              <td>{{ nameIn(item.name, lang) }}</td>
              <td class="table__right muted">{{ item.w }}×{{ item.d }}</td>
            </tr>
            <tr v-if="roomDetail.furniture.length === 0">
              <td class="muted">暂无</td>
            </tr>
          </tbody>
        </table>
        <div class="actions">
          <button type="button" class="btn" @click="ui.select(null)">← 返回总览</button>
        </div>
      </section>
    </template>

    <!-- ============ 4. 总览 ============ -->
    <template v-else>
      <section class="panel__section">
        <h3 class="panel__title">房间面积 <small>点击查看 / 更换地面</small></h3>
        <table class="table">
          <tbody>
            <tr v-for="row in roomRows" :key="row.id" class="table__row" @click="selectRoom(row.id)">
              <td>
                <span class="swatch" :style="{ background: MATS[row.mat].sw }" />
                {{ row.name }}
                <span v-if="!row.counted" class="muted">*</span>
              </td>
              <td class="table__right">{{ fmt(row.area) }} m²</td>
            </tr>
          </tbody>
        </table>
        <div class="total"><span>套内使用面积</span><b>{{ fmt(layout.totalArea) }} m²</b></div>
        <p class="muted">* 飘窗不计入使用面积；面积按墙体内净尺寸计算</p>
      </section>

      <section class="panel__section">
        <h3 class="panel__title">地面材料估算 <small>含 5% 损耗</small></h3>
        <table class="table">
          <tbody>
            <tr v-for="row in materialRows" :key="row.key">
              <td><span class="swatch" :style="{ background: row.sw }" />{{ row.name }}</td>
              <td class="table__right">{{ fmt(row.area, 1) }} m²</td>
              <td class="table__right">¥{{ Math.round(row.cost).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
        <div class="total"><span>地面材料合计</span><b>¥{{ Math.round(layout.flooringCost).toLocaleString() }}</b></div>
      </section>

      <section class="panel__section">
        <h3 class="panel__title">方案统计</h3>
        <div class="stats">
          <div class="stat"><small>家具数量</small><span class="big">{{ layout.furniture.length }}</span></div>
          <div class="stat"><small>拆除墙体</small><span class="big">{{ fmt(layout.demolishedLength, 1) }}</span> m</div>
        </div>
        <div class="actions">
          <button type="button" class="btn" @click="clearMeasures">清除测量 ({{ layout.measures.length }})</button>
          <button type="button" class="btn btn--danger" @click="clearLayout">清空布置</button>
        </div>
      </section>

      <section class="panel__section">
        <h3 class="panel__title">键盘快捷键</h3>
        <dl class="kbd">
          <dt><kbd>V</kbd></dt><dd>选择 / 移动</dd>
          <dt><kbd>M</kbd></dt><dd>测量（Shift 水平/垂直）</dd>
          <dt><kbd>X</kbd></dt><dd>拆改非承重墙（黑色为承重墙）</dd>
          <dt><kbd>R</kbd></dt><dd>旋转 90°（Shift 反向）</dd>
          <dt><kbd>方向键</kbd></dt><dd>微调 10mm（Shift 100mm）</dd>
          <dt><kbd>⌘/Ctrl D</kbd></dt><dd>复制</dd>
          <dt><kbd>Delete</kbd></dt><dd>删除</dd>
          <dt><kbd>⌘/Ctrl Z</kbd></dt><dd>撤销</dd>
          <dt><kbd>T</kbd></dt><dd>切换 2D / 3D</dd>
          <dt><kbd>F</kbd></dt><dd>适应窗口</dd>
          <dt><kbd>P</kbd></dt><dd>户型库</dd>
          <dt><kbd>E</kbd></dt><dd>编辑户型</dd>
          <dt><kbd>1 / 2</kbd></dt><dd>复式切层</dd>
          <dt><kbd>Esc</kbd></dt><dd>取消选择</dd>
        </dl>
      </section>
    </template>
  </div>
</template>

<style scoped>
.panel {
  height: 100%;
  overflow: auto;
  background: var(--ds-surface);
}

.panel__section {
  padding: 12px 14px;
  border-bottom: 1px solid var(--ds-border);
}

.panel__title {
  margin: 0 0 8px;
  font-size: 13px;
}

.panel__title small {
  margin-left: 6px;
  font-weight: 400;
  color: var(--ds-text-muted);
}

.muted {
  color: var(--ds-text-muted);
  font-size: 12px;
  margin: 8px 0 0;
}

.form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 12px;
  color: var(--ds-text-muted);
}

.field--full {
  grid-column: 1 / -1;
}

.field input,
.field select {
  border: 1px solid var(--ds-border-strong);
  border-radius: 6px;
  padding: 5px 7px;
  background: var(--ds-surface-2);
  color: var(--ds-text);
  font-size: 13px;
  width: 100%;
}

.field input[type='color'] {
  padding: 2px;
  height: 30px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.btn {
  border: 1px solid var(--ds-border-strong);
  padding: 4px 10px;
  font-size: 12px;
}

.btn--on {
  background: var(--ds-accent-soft);
  color: var(--ds-accent);
  border-color: var(--ds-accent);
}

.btn--primary {
  background: var(--ds-accent);
  color: var(--ds-on-accent);
  border-color: var(--ds-accent);
}

.btn--danger {
  color: var(--ds-danger);
  border-color: var(--ds-danger);
}

.btn--tiny {
  padding: 1px 6px;
}

.chip {
  border: 1px solid var(--ds-border);
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 12px;
  color: var(--ds-text-secondary);
}

.chip--on {
  background: var(--ds-accent-soft);
  color: var(--ds-accent);
  border-color: var(--ds-accent);
}

.e-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(64px, 1fr));
  gap: 5px;
  margin-bottom: 6px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
}

.table td {
  padding: 4px 2px;
  border-bottom: 1px dashed var(--ds-border);
}

.table__right {
  text-align: right;
}

.table__narrow {
  width: 104px;
}

.table__tiny {
  width: 28px;
}

.table__row {
  cursor: pointer;
}

.table__row:hover td {
  background: var(--ds-surface-2);
}

.link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ds-accent);
  text-align: left;
  text-decoration: underline dotted;
}

.swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  border: 1px solid var(--ds-border-strong);
  vertical-align: -2px;
  margin-right: 6px;
}

.total {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 14px;
}

.total b {
  color: var(--ds-accent);
}

.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 10px;
}

.stat {
  background: var(--ds-surface-2);
  border-radius: 8px;
  padding: 8px;
}

.stat small {
  display: block;
  font-size: 11px;
  color: var(--ds-text-muted);
}

.big {
  font-size: 20px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.mats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.mat {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--ds-border);
  border-radius: 8px;
  padding: 6px;
  background: var(--ds-surface-2);
  text-align: left;
  font-size: 12px;
}

.mat--on {
  border-color: var(--ds-accent);
  box-shadow: 0 0 0 2px var(--ds-accent-soft);
}

.mat__swatch {
  width: 26px;
  height: 26px;
  border-radius: 5px;
  border: 1px solid var(--ds-border-strong);
  flex: none;
}

.mat small {
  display: block;
  color: var(--ds-text-muted);
}

.kbd {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 3px 10px;
  margin: 0;
  font-size: 12px;
  color: var(--ds-text-muted);
}

.kbd dt {
  margin: 0;
}

.kbd dd {
  margin: 0;
}
</style>
