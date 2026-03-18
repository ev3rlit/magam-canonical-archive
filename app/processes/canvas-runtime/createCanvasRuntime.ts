import canvasToolbarContribution from '@/features/canvas-ui-entrypoints/canvas-toolbar/contribution';
import nodeContextMenuContribution from '@/features/canvas-ui-entrypoints/node-context-menu/contribution';
import paneContextMenuContribution from '@/features/canvas-ui-entrypoints/pane-context-menu/contribution';
import selectionFloatingMenuContribution from '@/features/canvas-ui-entrypoints/selection-floating-menu/contribution';
import { createCanvasToolbarSlot } from './builtin-slots/canvasToolbar';
import { createNodeContextMenuSlot } from './builtin-slots/nodeContextMenu';
import { createPaneContextMenuSlot } from './builtin-slots/paneContextMenu';
import { createSelectionFloatingMenuSlot } from './builtin-slots/selectionFloatingMenu';
import type {
  CanvasIntentContribution,
  CanvasRuntime,
  CanvasRuntimeContribution,
  CanvasRuntimeContributionSet,
  CanvasShortcutContribution,
} from './types';

export interface CreateCanvasRuntimeInput {
  contributions?: Partial<CanvasRuntimeContributionSet>;
}

function resolveContributionSet(
  input: CreateCanvasRuntimeInput['contributions'] = {},
): CanvasRuntimeContributionSet {
  return {
    canvasToolbar: input.canvasToolbar ?? canvasToolbarContribution,
    selectionFloatingMenu: input.selectionFloatingMenu ?? selectionFloatingMenuContribution,
    paneContextMenu: input.paneContextMenu ?? paneContextMenuContribution,
    nodeContextMenu: input.nodeContextMenu ?? nodeContextMenuContribution,
  };
}

function flattenShortcuts(contributions: CanvasRuntimeContribution[]): CanvasShortcutContribution[] {
  return contributions.flatMap((contribution) => contribution.shortcuts ?? []);
}

function flattenIntents(contributions: CanvasRuntimeContribution[]): CanvasIntentContribution[] {
  return contributions.flatMap((contribution) => contribution.intents ?? []);
}

export function createCanvasRuntime(input: CreateCanvasRuntimeInput = {}): CanvasRuntime {
  const contributions = resolveContributionSet(input.contributions);
  const orderedContributions = [
    contributions.canvasToolbar,
    contributions.selectionFloatingMenu,
    contributions.paneContextMenu,
    contributions.nodeContextMenu,
  ];

  return {
    slots: {
      canvasToolbar: createCanvasToolbarSlot(contributions.canvasToolbar),
      selectionFloatingMenu: createSelectionFloatingMenuSlot(contributions.selectionFloatingMenu),
      paneContextMenu: createPaneContextMenuSlot(contributions.paneContextMenu),
      nodeContextMenu: createNodeContextMenuSlot(contributions.nodeContextMenu),
    },
    shortcuts: flattenShortcuts(orderedContributions),
    intents: flattenIntents(orderedContributions),
  };
}

export const canvasRuntime = createCanvasRuntime();
