import type {
  CanvasDomainEventMetaV1,
  CanvasIdV1,
  CanvasNodeIdV1,
  CanvasNodeKindV1,
  RotationDegreesV1,
  SizeV1,
} from './canvas-runtime-core.contract';
import type { ResizeConstraintV1, ResizeHandleV1 } from './canvas-command-language.contract';

// Events emitted by the Canvas Aggregate.

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
