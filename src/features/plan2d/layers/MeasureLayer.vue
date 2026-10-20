<script setup lang="ts">
/**
 * `#gMeasure`：已落库测量线 + 进行中线 + 起点圆点（原 `renderMeasure`，L1294-1310）。
 *
 * 依赖（SPEC §F.2）：`layout.measures`、`ui.measureA`、`ui.measureCur`、`ui.view.s`。
 * 字号/描边按 `k = 1/view.s` 换算 → 缩放时视觉恒定。
 */
import { computed } from 'vue';
import { useLayoutStore } from '@/stores/layout';
import { useUiStore } from '@/stores/ui';
import { useTheme } from '@/theme/useTheme';
import { measureSvg } from '../svg';
import { SvgGroup } from './shell';

const layout = useLayoutStore();
const ui = useUiStore();
const { resolve } = useTheme();

const html = computed(() =>
  measureSvg(layout.measures, { a: ui.measureA, b: ui.measureCur }, 1 / ui.view.s, resolve),
);
</script>

<template>
  <SvgGroup id="gMeasure" :html="html" passive />
</template>
