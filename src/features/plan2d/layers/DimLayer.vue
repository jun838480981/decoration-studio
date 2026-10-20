<script setup lang="ts">
/**
 * `#gDims`：尺寸标注链（原 `renderDims`，L1264-1280；数据驱动 + `autoDims()` 兜底）。
 *
 * 依赖（SPEC §F.2）：`plan.dims`、`plan.walls`、`ui.flags.dims`。
 * 显示走 `display` 属性（原 L1279：只改显隐、不重算）。
 */
import { computed } from 'vue';
import { usePlanStore } from '@/stores/plan';
import { useUiStore } from '@/stores/ui';
import { useTheme } from '@/theme/useTheme';
import { dimsSvg } from '../dims';
import { SvgGroup } from './shell';

const plan = usePlanStore();
const ui = useUiStore();
const { resolve } = useTheme();

const html = computed(() => dimsSvg(plan.dims, plan.walls, resolve));
</script>

<template>
  <SvgGroup id="gDims" :html="html" :visible="ui.flags.dims" passive />
</template>
