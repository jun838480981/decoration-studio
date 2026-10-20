<script setup lang="ts">
/**
 * `#gEdit`：结构编辑的预览层（原 `renderEditPreview`，L2312-2352）。
 *
 * 依赖（SPEC §F.2）：`ui.edit.*`、`ui.view`、`plan.walls`、`plan.rooms`（吸附源）。
 * 整层 `pointer-events:none`（原 L189）：编辑命中由下层墙体/房间的 `data-*` 承担。
 */
import { computed } from 'vue';
import { usePlanStore } from '@/stores/plan';
import { useUiStore } from '@/stores/ui';
import { useTheme } from '@/theme/useTheme';
import { stageSize } from '@/composables/useResizeFit';
import { editPreviewSvg } from '../editing';
import { SvgGroup } from './shell';

const plan = usePlanStore();
const ui = useUiStore();
const { resolve } = useTheme();

const html = computed(() =>
  editPreviewSvg({
    edit: ui.edit,
    view: ui.view,
    stage: { w: stageSize.w, h: stageSize.h },
    walls: plan.walls,
    rooms: plan.rooms,
    gridLayerOn: ui.flags.grid,
    resolve,
  }),
);
</script>

<template>
  <SvgGroup id="gEdit" :html="html" passive />
</template>
