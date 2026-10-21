<script setup lang="ts">
/**
 * 户型库弹窗（原 `#planModal` L394-408 + `renderPlanGrid()` L2107-2135）。
 *
 * 能力（OF §1.11，全部保真）：
 * - 卡片列表：缩略图（纯色房间 + 四类墙色）、名称、内置/自定义标签、`tag`、多层合计面积、房间数、层数角标；
 * - 操作：打开 / 改名 / 复制 / 导出 / 删除（内置无删除）；
 * - 底部：新建空白户型 / 复制当前 / 导入户型 JSON / 导出全部户型 / 关闭。
 *
 * 导入导出走 `plan.exportPlan/exportAll/importText`（⛔ 不在这里拼 JSON、不碰 localStorage，B6）。
 * 原生 `prompt()` / `confirm()` 已被 `askPrompt()` / `askConfirm()` 取代（X5）。
 */
import { computed, ref } from 'vue';
import { usePlanStore } from '@/stores/plan';
import { useToastStore } from '@/stores/toast';
import { useUiStore } from '@/stores/ui';
import { useTheme } from '@/theme/useTheme';
import { useAppLang } from '@/composables/useAppLang';
import { useFocusTrap } from '@/composables/useFocusTrap';
import { nameIn } from '@/data/names-en';
import { fmt } from '@/utils/geometry';
import { downloadText } from '@/features/extras/lib/download';
import { askConfirm } from './dialogs/confirm';
import { askPrompt } from './dialogs/prompt';
import { planLevelCount, planRoomCount, planThumbSvg, planTotalArea } from './plan-thumb';

const emit = defineEmits<{ (event: 'close'): void }>();

const plan = usePlanStore();
const toast = useToastStore();
const ui = useUiStore();
const { resolve } = useTheme();
const lang = useAppLang();

const fileInput = ref<HTMLInputElement | null>(null);

/**
 * 焦点陷阱（无障碍必需）。
 *
 * 本组件以 `v-if` 挂载，组件存在即「已打开」，所以 `active` 恒为 `true`；
 * `onMounted` 时 `dialogBox` 已就位，陷阱立即生效，卸载时自动解绑（`useEventListener`）。
 * 此前只有 `role="dialog"` + `aria-modal="true"` 而无陷阱：Tab 会跑到背后的页面上，
 * 对键盘/读屏用户等于「模态」承诺失效。
 */
const dialogBox = ref<HTMLElement | null>(null);
useFocusTrap(dialogBox, () => true);

interface CardModel {
  id: string;
  name: string;
  tag: string;
  builtin: boolean;
  current: boolean;
  area: number;
  rooms: number;
  levels: number;
  thumb: string;
}

const cards = computed<CardModel[]>(() =>
  plan.allPlans.map((item) => ({
    id: item.id,
    name: nameIn(item.name, lang.value),
    tag: item.tag ?? '',
    builtin: Boolean(item.builtin),
    current: item.id === plan.currentId,
    area: planTotalArea(item),
    rooms: planRoomCount(item),
    levels: planLevelCount(item),
    thumb: planThumbSvg(item, resolve),
  })),
);

async function open(id: string): Promise<void> {
  if (id === plan.currentId) return;
  await plan.switchTo(id);
  emit('close');
}

async function rename(card: CardModel): Promise<void> {
  const next = await askPrompt({ title: '户型名称', value: card.name });
  if (next === null) return;
  plan.renamePlan(card.id, next);
}

function duplicate(card: CardModel): void {
  plan.duplicatePlan(card.id);
}

function exportOne(card: CardModel): void {
  const file = plan.exportPlan(card.id);
  const result = downloadText(`${card.name || 'plan'}.json`, JSON.stringify(file, null, 2), 'application/json');
  if (result.ok) toast.push(`已导出「${card.name}」`);
  else toast.push(`导出失败：${result.reason ?? 'unknown'}`, 'danger');
}

function exportAll(): void {
  const file = plan.exportAll();
  const result = downloadText('全部户型.json', JSON.stringify(file, null, 2), 'application/json');
  if (result.ok) toast.push('已导出全部户型');
  else toast.push(`导出失败：${result.reason ?? 'unknown'}`, 'danger');
}

async function remove(card: CardModel): Promise<void> {
  if (card.builtin) return;
  const ok = await askConfirm({
    title: '删除户型',
    message: `确定删除「${card.name}」？\n该户型各层的布置存档会一起删除，无法撤销。`,
    confirmText: '删除',
    danger: true,
  });
  if (!ok) return;
  plan.deletePlan(card.id);
  toast.push(`已删除「${card.name}」`);
}

function newBlank(): void {
  plan.newBlankPlan();
  emit('close');
}

function duplicateCurrent(): void {
  plan.duplicatePlan(plan.currentId);
}

function pickFile(): void {
  fileInput.value?.click();
}

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const text = await file.text();
  const count = plan.importText(text);
  if (count === 0) toast.push('不是有效的户型文件', 'danger');
  else toast.push(`已导入 ${count} 个户型`);
}

function close(): void {
  emit('close');
}

void ui;
</script>

<template>
  <div class="modal" role="presentation" @pointerdown.self="close">
    <div ref="dialogBox" class="modal__box" role="dialog" aria-modal="true" aria-label="户型库" @keydown.esc="close">
      <header class="modal__head">
        <h3>户型库</h3>
        <button type="button" class="btn" title="关闭" @click="close">✕</button>
      </header>

      <div class="modal__body">
        <div class="grid">
          <article v-for="card in cards" :key="card.id" class="pcard" :class="{ 'pcard--on': card.current }">
            <div class="pcard__thumb" role="button" tabindex="0" @click="open(card.id)" @keydown.enter="open(card.id)">
              <!-- eslint-disable-next-line vue/no-v-html -- 内部生成的 SVG 缩略图（非用户输入，无 XSS 风险；SVG 无法用插值渲染） -->
              <span class="pcard__svg" v-html="card.thumb" />
              <span v-if="card.levels > 1" class="pcard__lv">{{ card.levels }}层</span>
            </div>
            <div class="pcard__name">
              {{ card.name }}
              <span class="tag">{{ card.builtin ? '内置' : '自定义' }}</span>
            </div>
            <small class="pcard__meta">
              {{ card.tag }}{{ card.area ? ` · ${fmt(card.area)} m²` : '' }} · {{ card.rooms }} 间
            </small>
            <div class="pcard__row">
              <button type="button" class="btn btn--tiny" @click="open(card.id)">
                {{ card.current ? '当前' : '打开' }}
              </button>
              <button type="button" class="btn btn--tiny" @click="rename(card)">改名</button>
              <button type="button" class="btn btn--tiny" @click="duplicate(card)">复制</button>
              <button type="button" class="btn btn--tiny" @click="exportOne(card)">导出</button>
              <button v-if="!card.builtin" type="button" class="btn btn--tiny btn--danger" @click="remove(card)">
                删除
              </button>
            </div>
          </article>
        </div>
      </div>

      <footer class="modal__foot">
        <button type="button" class="btn" @click="newBlank">＋ 新建户型</button>
        <button type="button" class="btn" @click="duplicateCurrent">复制当前户型</button>
        <button type="button" class="btn" @click="pickFile">导入户型 JSON</button>
        <button type="button" class="btn" @click="exportAll">导出全部户型</button>
        <span class="spacer" />
        <button type="button" class="btn btn--primary" @click="close">关闭</button>
        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onFile" />
      </footer>
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  z-index: 65;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgb(0 0 0 / 45%);
}

.modal__box {
  width: min(920px, 100%);
  max-height: min(88vh, 760px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--ds-surface);
  border: 1px solid var(--ds-border-strong);
  border-radius: 14px;
  box-shadow: 0 20px 60px rgb(0 0 0 / 32%);
}

.modal__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--ds-border);
}

.modal__head h3 {
  margin: 0;
  flex: 1;
  font-size: 14px;
}

.modal__body {
  overflow: auto;
  padding: 12px 14px;
}

.modal__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid var(--ds-border);
}

.spacer {
  flex: 1;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 10px;
}

.pcard {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 8px;
  border: 1px solid var(--ds-border);
  border-radius: 10px;
  background: var(--ds-surface-2);
}

.pcard--on {
  border-color: var(--ds-accent);
  box-shadow: 0 0 0 2px var(--ds-accent-soft);
}

.pcard__thumb {
  position: relative;
  height: 98px;
  overflow: hidden;
  border-radius: 7px;
  background: var(--ds-surface);
  cursor: pointer;
}

.pcard__svg :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.pcard__lv {
  position: absolute;
  right: 5px;
  bottom: 5px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--ds-text);
  color: var(--ds-surface);
  font-size: 10px;
}

.pcard__name {
  font-weight: 600;
  font-size: 13px;
}

.pcard__meta {
  font-size: 11px;
  line-height: 1.35;
  color: var(--ds-text-muted);
}

.pcard__row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.btn {
  border: 1px solid var(--ds-border-strong);
  padding: 4px 10px;
  font-size: 12px;
}

.btn--tiny {
  padding: 2px 7px;
}

.btn--danger {
  color: var(--ds-danger);
  border-color: var(--ds-danger);
}

.btn--primary {
  background: var(--ds-accent);
  color: var(--ds-on-accent);
  border-color: var(--ds-accent);
}

.tag {
  display: inline-block;
  margin-left: 4px;
  padding: 0 5px;
  border-radius: 4px;
  background: var(--ds-surface);
  color: var(--ds-text-muted);
  font-size: 11px;
  font-weight: 400;
}
</style>
