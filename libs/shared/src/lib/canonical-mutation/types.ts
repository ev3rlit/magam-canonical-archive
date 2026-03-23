import type { ContentBlock, ContentKind, ContentCapability, CanonicalCapabilityKey } from '../canonical-object-contract';

export interface MutationActor {
  kind: 'agent' | 'user' | 'system';
  id: string;
}

export interface MutationPreconditions {
  canvasRevision?: number;
}

export interface ObjectContentUpdateOperation {
  op: 'object.content.update';
  objectId: string;
  kind?: ContentKind;
  expectedContentKind?: ContentKind;
  patch: Record<string, unknown>;
}

export interface ObjectCapabilityPatchOperation {
  op: 'object.capability.patch';
  objectId: string;
  capability: CanonicalCapabilityKey;
  patch: Record<string, unknown> | null;
}

export interface ObjectBodyReplaceOperation {
  op: 'object.body.replace';
  objectId: string;
  blocks: ContentBlock[];
}

export interface ObjectBodyBlockInsertOperation {
  op: 'object.body.block.insert';
  objectId: string;
  block: ContentBlock;
  index?: number;
}

export interface ObjectBodyBlockUpdateOperation {
  op: 'object.body.block.update';
  objectId: string;
  blockId: string;
  patch: Record<string, unknown>;
}

export interface ObjectBodyBlockRemoveOperation {
  op: 'object.body.block.remove';
  objectId: string;
  blockId: string;
}

export interface ObjectBodyBlockReorderOperation {
  op: 'object.body.block.reorder';
  objectId: string;
  blockId: string;
  toIndex: number;
}

export interface CanvasNodeMoveOperation {
  op: 'canvas.node.move';
  nodeId: string;
  patch: {
    x: number;
    y: number;
  };
}

export interface CanvasNodeReparentOperation {
  op: 'canvas.node.reparent';
  nodeId: string;
  parentNodeId: string | null;
}

export type MutationOperation =
  | ObjectContentUpdateOperation
  | ObjectCapabilityPatchOperation
  | ObjectBodyReplaceOperation
  | ObjectBodyBlockInsertOperation
  | ObjectBodyBlockUpdateOperation
  | ObjectBodyBlockRemoveOperation
  | ObjectBodyBlockReorderOperation
  | CanvasNodeMoveOperation
  | CanvasNodeReparentOperation;

export interface MutationBatch {
  workspaceRef: string;
  canvasRef?: string;
  actor?: MutationActor;
  reason?: string;
  preconditions?: MutationPreconditions;
  operations: MutationOperation[];
}

export interface MutationChangedSet {
  objects: string[];
  nodes: string[];
  edges: string[];
  bindings: string[];
  pluginInstances: string[];
}

export interface MutationExecutionResult {
  mutationId: string;
  canvasRevisionBefore: number | null;
  canvasRevisionAfter: number | null;
  changed: MutationChangedSet;
  warnings: string[];
  dryRun: boolean;
}
