import type { SelectionFloatingMenuInventoryItem } from './types';
import { getCanvasUiCopy } from '@/features/canvas-ui-entrypoints/copy';

const copy = getCanvasUiCopy().selectionMenu.inventory;

export const SELECTION_FLOATING_MENU_CONTROL_INVENTORY: SelectionFloatingMenuInventoryItem[] = [
  {
    itemId: 'selection-menu-object-type',
    controlId: 'object-type',
    intentId: 'selection.object-type.convert',
    label: copy.objectType,
    order: 10,
    group: 'primary',
  },
  {
    itemId: 'selection-menu-font-family',
    controlId: 'font-family',
    intentId: 'selection.style.update',
    label: copy.fontFamily,
    order: 20,
    group: 'primary',
  },
  {
    itemId: 'selection-menu-font-size',
    controlId: 'font-size',
    intentId: 'selection.style.update',
    label: copy.fontSize,
    order: 30,
    group: 'primary',
  },
  {
    itemId: 'selection-menu-bold',
    controlId: 'bold',
    intentId: 'selection.style.update',
    label: copy.bold,
    order: 40,
    group: 'primary',
  },
  {
    itemId: 'selection-menu-align',
    controlId: 'align',
    intentId: 'selection.style.update',
    label: copy.align,
    order: 50,
    group: 'primary',
  },
  {
    itemId: 'selection-menu-color',
    controlId: 'color',
    intentId: 'selection.style.update',
    label: copy.color,
    order: 60,
    group: 'primary',
  },
  {
    itemId: 'selection-menu-more',
    controlId: 'more',
    intentId: 'selection.menu.more',
    label: copy.more,
    order: 90,
    group: 'primary',
  },
  {
    itemId: 'selection-menu-content',
    controlId: 'content',
    intentId: 'selection.content.update',
    label: copy.content,
    order: 110,
    group: 'overflow',
  },
  {
    itemId: 'selection-menu-washi-preset',
    controlId: 'washi-preset',
    intentId: 'selection.style.update',
    label: copy.washiPreset,
    order: 120,
    group: 'overflow',
  },
];

export const SELECTION_FLOATING_MENU_ITEMS = SELECTION_FLOATING_MENU_CONTROL_INVENTORY
  .map(({ itemId, intentId, label, order }) => ({
    itemId,
    intentId,
    label,
    order,
  }));
