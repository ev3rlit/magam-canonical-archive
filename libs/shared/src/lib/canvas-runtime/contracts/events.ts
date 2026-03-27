import type {
  BodyBlockIdV1,
  CanvasDomainEventMetaV1,
  CanvasIdV1,
  CanvasNodeIdV1,
  CanvasNodeKindV1,
  CanonicalObjectCapabilityNameV1,
  CanonicalObjectIdV1,
  MutationFailureCodeV1,
  ResolvedBodyBlockPositionV1,
  RotationDegreesV1,
  SizeV1,
} from './core';
import type { ResizeConstraintV1, ResizeHandleV1 } from './commands';

export interface CanvasNodeCreatedEventV1 {
  name: 'CanvasNodeCreated';
  meta: CanvasDomainEventMetaV1;
  data: {
    canvasId: CanvasIdV1;
    nodeId: CanvasNodeIdV1;
    kind: CanvasNodeKindV1;
    parentNodeId: CanvasNodeIdV1 | null;
  };
}

export interface CanvasNodeMovedEventV1 {
  name: 'CanvasNodeMoved';
  meta: CanvasDomainEventMetaV1;
  data: {
    canvasId: CanvasIdV1;
    nodeId: CanvasNodeIdV1;
    x: number;
    y: number;
  };
}

export interface CanvasNodeReparentedEventV1 {
  name: 'CanvasNodeReparented';
  meta: CanvasDomainEventMetaV1;
  data: {
    canvasId: CanvasIdV1;
    nodeId: CanvasNodeIdV1;
    parentNodeId: CanvasNodeIdV1 | null;
  };
}

export interface CanvasNodeResizedEventV1 {
  name: 'CanvasNodeResized';
  meta: CanvasDomainEventMetaV1;
  data: {
    canvasId: CanvasIdV1;
    nodeId: CanvasNodeIdV1;
    handle: ResizeHandleV1;
    nextSize: SizeV1;
    constraint?: ResizeConstraintV1;
  };
}

export interface CanvasNodeRotatedEventV1 {
  name: 'CanvasNodeRotated';
  meta: CanvasDomainEventMetaV1;
  data: {
    canvasId: CanvasIdV1;
    nodeId: CanvasNodeIdV1;
    nextRotation: RotationDegreesV1;
  };
}

export interface CanvasNodePresentationStyleUpdatedEventV1 {
  name: 'CanvasNodePresentationStyleUpdated';
  meta: CanvasDomainEventMetaV1;
  data: {
    canvasId: CanvasIdV1;
    nodeId: CanvasNodeIdV1;
    changedFields: string[];
  };
}

export interface CanvasNodeRenderProfileUpdatedEventV1 {
  name: 'CanvasNodeRenderProfileUpdated';
  meta: CanvasDomainEventMetaV1;
  data: {
    canvasId: CanvasIdV1;
    nodeId: CanvasNodeIdV1;
    changedFields: string[];
  };
}

export interface CanvasNodeRenamedEventV1 {
  name: 'CanvasNodeRenamed';
  meta: CanvasDomainEventMetaV1;
  data: {
    canvasId: CanvasIdV1;
    nodeId: CanvasNodeIdV1;
    nextDisplayName: string;
  };
}

export interface CanvasNodeDeletedEventV1 {
  name: 'CanvasNodeDeleted';
  meta: CanvasDomainEventMetaV1;
  data: {
    canvasId: CanvasIdV1;
    nodeId: CanvasNodeIdV1;
  };
}

export interface CanvasNodeZOrderUpdatedEventV1 {
  name: 'CanvasNodeZOrderUpdated';
  meta: CanvasDomainEventMetaV1;
  data: {
    canvasId: CanvasIdV1;
    nodeId: CanvasNodeIdV1;
    zIndex: number;
  };
}

export interface CanvasMindmapMembershipChangedEventV1 {
  name: 'CanvasMindmapMembershipChanged';
  meta: CanvasDomainEventMetaV1;
  data: {
    canvasId: CanvasIdV1;
    nodeId: CanvasNodeIdV1;
    mindmapId: string | null;
    role: 'free' | 'mindmap-root' | 'mindmap-child';
  };
}

export type CanvasAggregateEventV1 =
  | CanvasNodeCreatedEventV1
  | CanvasNodeMovedEventV1
  | CanvasNodeReparentedEventV1
  | CanvasNodeResizedEventV1
  | CanvasNodeRotatedEventV1
  | CanvasNodePresentationStyleUpdatedEventV1
  | CanvasNodeRenderProfileUpdatedEventV1
  | CanvasNodeRenamedEventV1
  | CanvasNodeDeletedEventV1
  | CanvasNodeZOrderUpdatedEventV1
  | CanvasMindmapMembershipChangedEventV1;

export interface ObjectContentUpdatedEventV1 {
  name: 'ObjectContentUpdated';
  meta: CanvasDomainEventMetaV1;
  data: {
    objectId: CanonicalObjectIdV1;
  };
}

export interface ObjectCapabilityPatchedEventV1 {
  name: 'ObjectCapabilityPatched';
  meta: CanvasDomainEventMetaV1;
  data: {
    objectId: CanonicalObjectIdV1;
    capability: CanonicalObjectCapabilityNameV1;
  };
}

export interface ObjectBodyBlockInsertedEventV1 {
  name: 'ObjectBodyBlockInserted';
  meta: CanvasDomainEventMetaV1;
  data: {
    objectId: CanonicalObjectIdV1;
    blockId: BodyBlockIdV1;
  };
}

export interface ObjectBodyBlockUpdatedEventV1 {
  name: 'ObjectBodyBlockUpdated';
  meta: CanvasDomainEventMetaV1;
  data: {
    objectId: CanonicalObjectIdV1;
    blockId: BodyBlockIdV1;
  };
}

export interface ObjectBodyBlockRemovedEventV1 {
  name: 'ObjectBodyBlockRemoved';
  meta: CanvasDomainEventMetaV1;
  data: {
    objectId: CanonicalObjectIdV1;
    blockId: BodyBlockIdV1;
  };
}

export interface ObjectBodyBlockReorderedEventV1 {
  name: 'ObjectBodyBlockReordered';
  meta: CanvasDomainEventMetaV1;
  data: {
    objectId: CanonicalObjectIdV1;
    blockId: BodyBlockIdV1;
    position: ResolvedBodyBlockPositionV1;
  };
}

export type CanonicalObjectAggregateEventV1 =
  | ObjectContentUpdatedEventV1
  | ObjectCapabilityPatchedEventV1
  | ObjectBodyBlockInsertedEventV1
  | ObjectBodyBlockUpdatedEventV1
  | ObjectBodyBlockRemovedEventV1
  | ObjectBodyBlockReorderedEventV1;

export interface CanvasMutationDryRunValidatedEventV1 {
  name: 'CanvasMutationDryRunValidated';
  meta: CanvasDomainEventMetaV1;
  data: {
    canvasId?: CanvasIdV1;
    changedPreviewAvailable: boolean;
  };
}

export interface CanvasMutationRejectedEventV1 {
  name: 'CanvasMutationRejected';
  meta: CanvasDomainEventMetaV1;
  data: {
    code: MutationFailureCodeV1;
    message: string;
    retryable: boolean;
  };
}

export interface CanvasVersionConflictDetectedEventV1 {
  name: 'CanvasVersionConflictDetected';
  meta: CanvasDomainEventMetaV1;
  data: {
    canvasId?: CanvasIdV1;
    expectedCanvasRevision?: number | null;
    actualCanvasRevision?: number | null;
  };
}

export interface CanvasChangedEventV1 {
  name: 'CanvasChanged';
  meta: CanvasDomainEventMetaV1;
  data: {
    canvasId: CanvasIdV1;
  };
}

export type CanvasApplicationEventV1 =
  | CanvasMutationDryRunValidatedEventV1
  | CanvasMutationRejectedEventV1
  | CanvasVersionConflictDetectedEventV1
  | CanvasChangedEventV1;
