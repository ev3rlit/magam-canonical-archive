import selectionFloatingMenuContribution from '@/features/canvas-ui-entrypoints/selection-floating-menu/contribution';
import {
  createCanvasRuntimeFixedSlot,
  type CanvasRuntimeContribution,
  type SelectionFloatingMenuSlot,
} from '../types';

export const SELECTION_FLOATING_MENU_CONTRIBUTION_PATH =
  'app/features/canvas-ui-entrypoints/selection-floating-menu/contribution.ts';

export function createSelectionFloatingMenuSlot(
  contribution: CanvasRuntimeContribution = selectionFloatingMenuContribution,
): SelectionFloatingMenuSlot {
  return createCanvasRuntimeFixedSlot({
    slotId: 'selection-floating-menu',
    overlaySlot: 'selection-floating-menu',
    surfaceId: 'selection-floating-menu',
    contributionPath: SELECTION_FLOATING_MENU_CONTRIBUTION_PATH,
    items: contribution.selectionMenuItems,
  });
}
