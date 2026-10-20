<script setup lang="ts">
/**
 * `#gWalls`：墙体 4 类 + 已拆（原 `renderWalls`，L1207-1215）。
 *
 * 依赖（SPEC §F.2）：`plan.walls`、`layout.demolished`、`ui.flags.bearing`。
 * 矮墙 = 浅填充（装饰豁免）+ 深描边（承载语义，ADR-17）。
 */
import { computed } from 'vue';
import { useLayoutStore } from '@/stores/layout';
import { usePlanStore } from '@/stores/plan';
import { useUiStore } from '@/stores/ui';
import { useTheme } from '@/theme/useTheme';
import { wallsSvg } from '../svg';
import { SvgGroup } from './shell';

const plan = usePlanStore();
const layout = useLayoutStore();
const ui = useUiStore();
const { resolve } = useTheme();

const html = computed(() => wallsSvg(plan.walls, layout.demolished, ui.flags.bearing, resolve));
</script>

<template>
  <SvgGroup id="gWalls" :html="html" />
</template>
