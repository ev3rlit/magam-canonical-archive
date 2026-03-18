import nodeContextMenuContribution from '@/features/canvas-ui-entrypoints/node-context-menu/contribution';
import {
  createCanvasRuntimeFixedSlot,
  type CanvasRuntimeContribution,
  type NodeContextMenuSlot,
} from '../types';

export const NODE_CONTEXT_MENU_CONTRIBUTION_PATH =
  'app/features/canvas-ui-entrypoints/node-context-menu/contribution.ts';

export function createNodeContextMenuSlot(
  contribution: CanvasRuntimeContribution = nodeContextMenuContribution,
): NodeContextMenuSlot {
  return createCanvasRuntimeFixedSlot({
    slotId: 'node-context-menu',
    overlaySlot: 'node-context-menu',
    surfaceId: 'node-context-menu',
    contributionPath: NODE_CONTEXT_MENU_CONTRIBUTION_PATH,
    items: contribution.nodeMenuItems,
  });
}
