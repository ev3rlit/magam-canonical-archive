import paneContextMenuContribution from '@/features/canvas-ui-entrypoints/pane-context-menu/contribution';
import {
  createCanvasRuntimeFixedSlot,
  type CanvasRuntimeContribution,
  type PaneContextMenuSlot,
} from '../types';

export const PANE_CONTEXT_MENU_CONTRIBUTION_PATH =
  'app/features/canvas-ui-entrypoints/pane-context-menu/contribution.ts';

export function createPaneContextMenuSlot(
  contribution: CanvasRuntimeContribution = paneContextMenuContribution,
): PaneContextMenuSlot {
  return createCanvasRuntimeFixedSlot({
    slotId: 'pane-context-menu',
    overlaySlot: 'pane-context-menu',
    surfaceId: 'pane-context-menu',
    contributionPath: PANE_CONTEXT_MENU_CONTRIBUTION_PATH,
    items: contribution.paneMenuItems,
  });
}
