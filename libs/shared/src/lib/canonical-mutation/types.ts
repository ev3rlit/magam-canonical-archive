import type { ContentBlock, ContentKind, CanonicalCapabilityKey } from '../canonical-object-contract';

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
  afterBlockId?: string;
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

export interface CanvasNodeUpdateOperation {
  op: 'canvas.node.update';
  nodeId: string;
  propsPatch?: Record<string, unknown>;
  stylePatch?: Record<string, unknown>;
}

export interface CanvasNodeRenameOperation {
  op: 'canvas.node.rename';
  nodeId: string;
  nextNodeId: string;
}

export interface CanvasNodeDeleteOperation {
  op: 'canvas.node.delete';
  nodeId: string;
}

export interface CanvasNodeZOrderUpdateOperation {
  op: 'canvas.node.z-order.update';
  nodeId: string;
  zIndex: number;
}

export interface CanvasNodeCreateOperation {
  op: 'canvas.node.create';
  nodeId: string;
  nodeType:
    | 'shape'
    | 'rectangle'
    | 'ellipse'
    | 'diamond'
    | 'line'
    | 'text'
    | 'markdown'
    | 'sticky'
    | 'sticker'
    | 'washi-tape'
    | 'image';
  props?: Record<string, unknown>;
  placement:
    | { mode: 'canvas-absolute'; x: number; y: number }
    | { mode: 'mindmap-root'; x: number; y: number; mindmapId: string }
    | { mode: 'mindmap-child'; parentId: string }
    | { mode: 'mindmap-sibling'; siblingOf: string; parentId: string | null };
}

export type MutationOperation =
  | ObjectContentUpdateOperation
  | ObjectCapabilityPatchOperation
  | ObjectBodyReplaceOperation
  | ObjectBodyBlockInsertOperation
  | ObjectBodyBlockUpdateOperation
  | ObjectBodyBlockRemoveOperation
  | ObjectBodyBlockReorderOperation
  | CanvasNodeCreateOperation
  | CanvasNodeMoveOperation
  | CanvasNodeReparentOperation
  | CanvasNodeUpdateOperation
  | CanvasNodeRenameOperation
  | CanvasNodeDeleteOperation
  | CanvasNodeZOrderUpdateOperation;

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
