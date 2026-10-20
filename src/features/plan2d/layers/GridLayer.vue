<script setup lang="ts">
/**
 * `#gGrid`：整页网格底（原 `renderGrid`，L1290-1292）。
 *
 * 依赖（SPEC §F.2）：`ui.flags.grid`。
 */
import { computed } from 'vue';
import { useUiStore } from '@/stores/ui';
import { gridSvg } from '../svg';
import { SvgGroup } from './shell';

const ui = useUiStore();
const html = computed(() => gridSvg(ui.flags.grid));
</script>

<template>
  <SvgGroup id="gGrid" :html="html" />
</template>
