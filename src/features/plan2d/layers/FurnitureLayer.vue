<script setup lang="ts">
/**
 * `#gFurn`：家具（唯一含 `layout.furniture` 的图层，SPEC §F.2）。
 *
 * 依赖：`layout.furniture`、`ui.flags.furn`。
 * 名称标签走 `NAMES_EN`（只翻内置名，用户改名原样显示，OF §1.10）。
 */
import { computed } from 'vue';
import { useLayoutStore } from '@/stores/layout';
import { useUiStore } from '@/stores/ui';
import { useTheme } from '@/theme/useTheme';
import { nameIn } from '@/data/names-en';
import { furnitureSvg } from '../svg';
import { SvgGroup } from './shell';
import { useAppLang } from '@/composables/useAppLang';

const layout = useLayoutStore();
const ui = useUiStore();
const { resolve } = useTheme();
const lang = useAppLang();

const html = computed(() =>
  furnitureSvg(layout.furniture, {
    resolve,
    nameOf: (name) => nameIn(name, lang.value),
  }),
);
</script>

<template>
  <SvgGroup id="gFurn" :html="html" :visible="ui.flags.furn" />
</template>
