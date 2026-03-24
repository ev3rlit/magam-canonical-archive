import type { CanvasRuntimeContribution } from '@/processes/canvas-runtime/types';
import type { ContextMenuActionsContext, ContextMenuContext } from '@/types/contextMenu';

export type PaneMenuActions = Pick<
  ContextMenuActionsContext,
  'createCanvasNode' | 'createMindMapRoot' | 'fitView' | 'openExportDialog'
>;

export interface PaneMenuContextSnapshot {
  position: ContextMenuContext['position'];
  selectedNodeIds: string[];
  canCreateNode: boolean;
  actions?: PaneMenuActions;
}

export type PaneContextMenuContribution = Pick<CanvasRuntimeContribution, 'paneMenuItems'>;
