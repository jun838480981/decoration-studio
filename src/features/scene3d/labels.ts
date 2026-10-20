/**
 * CSS2D 房间标签 + 3D 房间列表（原 `buildLabels()` L3567-3582 + `showLabels()` L3594）。
 *
 * 三个必须保留的细节：
 * 1. `CSS2DRenderer` **不继承父级可见性**，必须逐个设 `visible`（原注释 L3593）；
 * 2. 标签文本 = 「名称 + 面积 m²」，位置 `y = opt.cut + 0.15`（原 L3572）；
 * 3. 标签是 **DOM**，其配色必须来自 `--ds-*` 变量（SPEC §E.8 T5），故本文件只建节点、不写内联颜色。
 *
 * 与 2D 的联动：左侧房间列表的数据来源与 2D 同名（`layout.rooms[id].name` 覆盖 `plan.rooms[].name`），
 * 3D 侧**只提供数据**，渲染与点击由 `Scene3D.vue` 负责（SPEC §F.1 单一事实来源）。
 */
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { Group } from 'three';
import type { Room } from '@/types/plan';
import { polyAreaM2, wx, wz, type WorldConfig } from './scene';

export interface LabelInput {
  rooms: readonly Room[];
  /** `layout.rooms` 的覆盖表（名称） */
  overrides: Record<string, { name?: string } | undefined>;
  cut: number;
  world: WorldConfig;
}

/** 房间列表条目（3D 左栏；`__all` = 全屋，原 L3576） */
export interface RoomListEntry {
  id: string;
  name: string;
  area: number;
}

/** 房间显示名：用户覆盖优先（原 `nm(state.rooms[r.id].name)`） */
export function roomLabelName(room: Room, overrides: LabelInput['overrides']): string {
  const override = overrides[room.id]?.name;
  return override && override.trim() ? override : room.name;
}

/**
 * 重建全部标签（原 L3567-3573）。
 * ⛔ 旧节点必须 `element.remove()`（CSS2DRenderer 的 element 挂在 host 上，只 `clear()` 会留下孤儿 DOM）。
 */
export function buildLabels(group: Group, input: LabelInput): void {
  group.children.slice().forEach((child) => {
    const css2d = child as CSS2DObject;
    css2d.element?.remove();
    css2d.removeFromParent();
  });
  input.rooms
    .filter((room) => room.at)
    .forEach((room) => {
      const element = document.createElement('div');
      element.className = 'rlabel';
      const name = document.createElement('span');
      name.textContent = roomLabelName(room, input.overrides);
      const area = document.createElement('small');
      area.textContent = `${polyAreaM2(room.poly).toFixed(1)}m²`;
      element.append(name, area);
      const object = new CSS2DObject(element);
      object.position.set(wx(input.world, room.at![0]), input.cut + 0.15, wz(input.world, room.at![1]));
      object.visible = group.visible;
      group.add(object);
    });
}

/** 逐个设置可见性（CSS2DRenderer 不继承父级；原 L3594） */
export function showLabels(group: Group, visible: boolean): void {
  group.visible = visible;
  group.children.forEach((child) => {
    child.visible = visible;
  });
}

/** 3D 左栏房间数据（原 L3574-3581；`__all` 放最后一项） */
export function roomList(input: LabelInput): RoomListEntry[] {
  const counted = input.rooms.filter((room) => room.counted !== false);
  const entries: RoomListEntry[] = counted.map((room) => ({
    id: room.id,
    name: roomLabelName(room, input.overrides),
    area: polyAreaM2(room.poly),
  }));
  entries.push({
    id: '__all',
    name: '',
    area: counted.reduce((sum, room) => sum + polyAreaM2(room.poly), 0),
  });
  return entries;
}