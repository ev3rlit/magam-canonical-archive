import type { ContextMenuContext } from '@/types/contextMenu';

export type NodeContextMenuActionId =
  | 'copy-as-png'
  | 'export-selection'
  | 'rename-node'
  | 'mindmap-add-child'
  | 'mindmap-add-sibling'
  | 'select-group'
  | 'duplicate-node'
  | 'delete-node'
  | 'lock-node';

export type NodeRelationSummary = NonNullable<NonNullable<ContextMenuContext['nodeContext']>['relations']>;

export interface NodeContextSnapshot {
  type: 'node';
  nodeId: string;
  nodeFamily?: string;
  selectedNodeIds: string[];
  nodeContext?: ContextMenuContext['nodeContext'];
}

export type NodeContextMenuDisabledReasonCode =
  | 'NODE_CONTEXT_MISSING'
  | 'SELECTION_NOT_SINGULAR'
  | 'READ_ONLY'
  | 'COMMAND_NOT_ALLOWED'
  | 'GROUP_CONTEXT_REQUIRED'
  | 'UNSUPPORTED_NODE_TYPE';

export interface NodeContextMenuDisabledReason {
  code: NodeContextMenuDisabledReasonCode;
  message: string;
}

export interface NodeContextMenuActionState {
  visibility: 'enabled' | 'disabled' | 'hidden';
  disabledReason?: NodeContextMenuDisabledReason;
}

export type NodeContextMenuModel = Record<NodeContextMenuActionId, NodeContextMenuActionState>;
