<script setup lang="ts">
/**
 * `#defs`：8 种材质图案 + 编辑网格图案（原 `buildDefs()`，L1037-1058）。
 *
 * 依赖（SPEC §F.2）：只随**主题令牌**（网格线色）变化；与 `layout.furniture` 无关。
 */
import { computed } from 'vue';
import { buildDefs } from '../patterns';
import { useTheme } from '@/theme/useTheme';
import { SvgDefs } from './shell';

const { resolve } = useTheme();
const html = computed(() => buildDefs(resolve));
</script>

<template>
  <SvgDefs :html="html" />
</template>
