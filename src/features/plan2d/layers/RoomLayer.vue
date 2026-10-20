<script setup lang="ts">
/**
 * `#gRooms`：房间材质填充 + 门槛石 + 楼梯 + 挑空（原 `renderRooms`，L1171-1194）。
 *
 * 依赖（SPEC §F.2）：`plan.rooms`、`layout.rooms`、`plan.stairs`、`plan.voids`、`ui.edit.on`。
 * ⛔ 不含 `layout.furniture`（拖动家具时本层不重算）。
 */
import { computed } from 'vue';
import { useLayoutStore } from '@/stores/layout';
import { usePlanStore } from '@/stores/plan';
import { useUiStore } from '@/stores/ui';
import { useTheme } from '@/theme/useTheme';
import { roomsSvg } from '../svg';
import { SvgGroup } from './shell';

const plan = usePlanStore();
const layout = useLayoutStore();
const ui = useUiStore();
const { resolve } = useTheme();

const html = computed(() =>
  roomsSvg(plan.rooms, plan.doors, plan.slides, plan.stairs, plan.voids, {
    resolve,
    editOn: ui.edit.on,
    overrides: layout.rooms,
  }),
);
</script>

<template>
  <SvgGroup id="gRooms" :html="html" />
</template>
