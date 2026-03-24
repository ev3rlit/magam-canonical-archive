// External batch mutation contract for the canvas runtime.
// This payload carries domain intent only and must not be interpreted as a raw DB patch surface.

export type MutationActorKind = 'agent' | 'user' | 'system';

export interface MutationActorV1 {
  kind: MutationActorKind;
  id: string;
}

export interface MutationPreconditionsV1 {
  canvasRevision?: number;
}

export interface CreateNodeOperatorV1 {
  $createNode: {
    nodeId: string;
    nodeType: 'shape' | 'rectangle' | 'ellipse' | 'diamond' | 'line' | 'text' | 'markdown' | 'sticky' | 'sticker' | 'washi-tape' | 'image';
    props?: Record<string, unknown>;
    placement:
      | { mode: 'canvas-absolute'; x: number; y: number }
      | { mode: 'mindmap-root'; x: number; y: number; mindmapId: string }
      | { mode: 'mindmap-child'; parentId: string }
      | { mode: 'mindmap-sibling'; siblingOf: string; parentId: string | null };
  };
}

export interface MoveNodeOperatorV1 {
  $moveNode: {
    nodeId: string;
    x: number;
    y: number;
  };
}

export interface ReparentNodeOperatorV1 {
  $reparentNode: {
    nodeId: string;
    parentNodeId: string | null;
  };
}

export interface UpdateNodeOperatorV1 {
  $updateNode: {
    nodeId: string;
    props?: Record<string, unknown>;
    style?: Record<string, unknown>;
  };
}

export interface RenameNodeOperatorV1 {
  $renameNode: {
    nodeId: string;
    nextNodeId: string;
  };
}

export interface DeleteNodeOperatorV1 {
  $deleteNode: {
    nodeId: string;
  };
}

export interface ZOrderNodeOperatorV1 {
  $updateNodeZOrder: {
    nodeId: string;
    zIndex: number;
  };
}

export interface UpdateObjectContentOperatorV1 {
  $updateObjectContent: {
    objectId: string;
    kind: 'text' | 'markdown' | 'media' | 'sequence';
    patch: Record<string, unknown>;
    expectedContentKind?: 'text' | 'markdown' | 'media' | 'sequence';
  };
}

export interface PatchObjectCapabilityOperatorV1 {
  $patchObjectCapability: {
    objectId: string;
    capability: 'frame' | 'material' | 'texture' | 'attach' | 'ports' | 'bubble' | 'content';
    patch: Record<string, unknown> | null;
  };
}

export interface InsertObjectBodyBlockOperatorV1 {
  $insertObjectBodyBlock: {
    objectId: string;
    block: Record<string, unknown>;
    afterBlockId?: string;
  };
}

export type BulkMutationOperatorV1 =
  | CreateNodeOperatorV1
  | MoveNodeOperatorV1
  | ReparentNodeOperatorV1
  | UpdateNodeOperatorV1
  | RenameNodeOperatorV1
  | DeleteNodeOperatorV1
  | ZOrderNodeOperatorV1
  | UpdateObjectContentOperatorV1
  | PatchObjectCapabilityOperatorV1
  | InsertObjectBodyBlockOperatorV1;

export interface BulkMutationRequestV1 {
  workspaceRef: string;
  canvasRef?: string;
  actor?: MutationActorV1;
  reason?: string;
  preconditions?: MutationPreconditionsV1;
  dryRun?: boolean;
  $operations: BulkMutationOperatorV1[];
}
