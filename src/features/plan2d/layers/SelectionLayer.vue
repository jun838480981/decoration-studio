<script setup lang="ts">
/**
 * `#gSel`：选中框 + 拖拽手柄（原 `renderSel`，L1312-1336）。
 *
 * 依赖（SPEC §F.2）：`ui.selection`、`layout.furniture`、`ui.view.s`。
 * ⚠️ 这是家具拖动期间**允许重算**的两个图层之一（另一个是 `FurnitureLayer`）。
 */
import { computed } from 'vue';
import { useLayoutStore } from '@/stores/layout';
import { usePlanStore } from '@/stores/plan';
import { useUiStore } from '@/stores/ui';
import { useTheme } from '@/theme/useTheme';
import { selectionSvg } from '../svg';
import { SvgGroup } from './shell';

const layout = useLayoutStore();
const plan = usePlanStore();
const ui = useUiStore();
const { resolve } = useTheme();

const html = computed(() =>
  selectionSvg(ui.selection, layout.furniture, plan.rooms, 1 / ui.view.s, resolve),
);
</script>

<template>
  <SvgGroup id="gSel" :html="html" />
</template>
