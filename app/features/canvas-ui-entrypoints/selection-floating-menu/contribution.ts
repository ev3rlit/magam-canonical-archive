import { createActionRoutingRegistry } from '@/features/editing/actionRoutingBridge/registry';
import { SELECTION_FLOATING_MENU_ITEMS } from './controlInventory';
import type { SelectionFloatingMenuContributionShape } from './types';

const registry = createActionRoutingRegistry();

export const selectionFloatingMenuItems = SELECTION_FLOATING_MENU_ITEMS;

export const selectionFloatingMenuIntents = [
  registry['selection.style.update'],
  registry['selection.content.update'],
].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

const selectionFloatingMenuContribution: SelectionFloatingMenuContributionShape = {
  selectionMenuItems: selectionFloatingMenuItems,
  intents: selectionFloatingMenuIntents,
};

export default selectionFloatingMenuContribution;
