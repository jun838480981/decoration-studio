<script setup lang="ts">
/**
 * `#gOpen`：窗 / 平开门 / 推拉门 / 入户标识（原 `renderOpenings`，L1217-1252）。
 *
 * 依赖（SPEC §F.2）：`plan.wins`、`plan.doors`、`plan.slides`、`plan.bounds`、入户门位置。
 * ⛔ 不含 `layout.furniture`：原实现把 `renderOpenings` 排除在 `renderAll()` 之外（OF §0.3），
 * 这里保持同一性能语义。
 */
import { computed } from 'vue';
import { usePlanStore } from '@/stores/plan';
import { useTheme } from '@/theme/useTheme';
import { useAppLang } from '@/composables/useAppLang';
import { openingsSvg } from '../svg';
import { SvgGroup } from './shell';

const plan = usePlanStore();
const { resolve } = useTheme();
const lang = useAppLang();

const html = computed(() =>
  openingsSvg(plan.wins, plan.doors, plan.slides, plan.bounds, resolve, lang.value === 'en' ? 'Entry' : '入户'),
);
</script>

<template>
  <SvgGroup id="gOpen" :html="html" />
</template>
