<script setup lang="ts">
/**
 * `#gLabels`：房间名 + 面积（原 `renderLabels`，L1254-1262）。
 *
 * 依赖（SPEC §F.2）：`plan.rooms`、`layout.rooms`、`ui.flags.labels`。
 */
import { computed } from 'vue';
import { useLayoutStore } from '@/stores/layout';
import { usePlanStore } from '@/stores/plan';
import { useUiStore } from '@/stores/ui';
import { useTheme } from '@/theme/useTheme';
import { useAppLang } from '@/composables/useAppLang';
import { nameIn } from '@/data/names-en';
import { labelsSvg } from '../svg';
import { SvgGroup } from './shell';

const plan = usePlanStore();
const layout = useLayoutStore();
const ui = useUiStore();
const { resolve } = useTheme();
const lang = useAppLang();

const html = computed(() =>
  labelsSvg(plan.rooms, layout.rooms, resolve, (name) => nameIn(name, lang.value)),
);
</script>

<template>
  <SvgGroup id="gLabels" :html="html" :visible="ui.flags.labels" passive />
</template>
