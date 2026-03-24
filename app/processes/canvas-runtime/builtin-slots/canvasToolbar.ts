import canvasToolbarContribution from '@/features/canvas-ui-entrypoints/canvas-toolbar/contribution';
import {
  createCanvasRuntimeFixedSlot,
  type CanvasRuntimeContribution,
  type CanvasToolbarSlot,
} from '../types';

export const CANVAS_TOOLBAR_CONTRIBUTION_PATH =
  'app/features/canvas-ui-entrypoints/canvas-toolbar/contribution.ts';

export function createCanvasToolbarSlot(
  contribution: CanvasRuntimeContribution = canvasToolbarContribution,
): CanvasToolbarSlot {
  return createCanvasRuntimeFixedSlot({
    slotId: 'canvas-toolbar',
    overlaySlot: 'toolbar',
    surfaceId: 'toolbar',
    contributionPath: CANVAS_TOOLBAR_CONTRIBUTION_PATH,
    items: contribution.toolbarSections,
  });
}
