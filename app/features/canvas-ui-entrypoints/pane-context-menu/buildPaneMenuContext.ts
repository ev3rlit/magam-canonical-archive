import type { ContextMenuContext } from '@/types/contextMenu';
import type { PaneMenuActions, PaneMenuContextSnapshot } from './types';

function buildPaneMenuActions(input: PaneMenuContextSnapshot): PaneMenuActions | undefined {
  const actions = input.actions;
  if (!actions) {
    return undefined;
  }

  const nextActions: PaneMenuActions = {};
  if (input.canCreateNode && actions.createCanvasNode) {
    nextActions.createCanvasNode = actions.createCanvasNode;
  }
  if (actions.openExportDialog) {
    nextActions.openExportDialog = actions.openExportDialog;
  }
  if (actions.fitView) {
    nextActions.fitView = actions.fitView;
  }

  return Object.keys(nextActions).length > 0 ? nextActions : undefined;
}

export function buildPaneMenuContext(input: PaneMenuContextSnapshot): ContextMenuContext {
  return {
    type: 'pane',
    position: input.position,
    selectedNodeIds: input.selectedNodeIds.slice(),
    actions: buildPaneMenuActions(input),
  };
}
