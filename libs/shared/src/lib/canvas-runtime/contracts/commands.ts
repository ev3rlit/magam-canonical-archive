import type {
  BodyBlockEntityV1,
  CanvasIdV1,
  CanvasNodeIdV1,
  CanvasNodeKindV1,
  CanonicalObjectCapabilityNameV1,
  CanonicalObjectContentKindV1,
  CanonicalObjectIdV1,
  MindmapIdV1,
  MutationActorV1,
  ObjectLinkV1,
  PresentationStyleV1,
  RenderProfileV1,
  RotationDegreesV1,
  SizeV1,
  TransformV1,
  WorkspaceIdV1,
} from './core';

export interface CanvasMutationPreconditionsV1 {
  canvasRevision?: number;
}

export type CanvasRuntimeCommandNameV1 =
  | 'canvas.node.create'
  | 'canvas.node.move'
  | 'canvas.node.reparent'
  | 'canvas.node.resize'
  | 'canvas.node.rotate'
  | 'canvas.node.presentation-style.update'
  | 'canvas.node.render-profile.update'
  | 'canvas.node.rename'
  | 'canvas.node.delete'
  | 'canvas.node.z-order.update'
  | 'object.content.update'
  | 'object.capability.patch'
  | 'object.body.block.insert'
  | 'object.body.block.update'
  | 'object.body.block.remove'
  | 'object.body.block.reorder';

export interface CanvasNodeCreatePlacementV1CanvasAbsolute {
  mode: 'canvas-absolute';
  x: number;
  y: number;
}

export interface CanvasNodeCreatePlacementV1MindmapRoot {
  mode: 'mindmap-root';
  x: number;
  y: number;
  mindmapId: MindmapIdV1;
}

export interface CanvasNodeCreatePlacementV1MindmapChild {
  mode: 'mindmap-child';
  parentNodeId: CanvasNodeIdV1;
}

export interface CanvasNodeCreatePlacementV1MindmapSibling {
  mode: 'mindmap-sibling';
  siblingOfNodeId: CanvasNodeIdV1;
  parentNodeId: CanvasNodeIdV1 | null;
}

export type CanvasNodeCreatePlacementV1 =
  | CanvasNodeCreatePlacementV1CanvasAbsolute
  | CanvasNodeCreatePlacementV1MindmapRoot
  | CanvasNodeCreatePlacementV1MindmapChild
  | CanvasNodeCreatePlacementV1MindmapSibling;

export interface CanvasNodeCreateCommandV1 {
  name: 'canvas.node.create';
  canvasId: CanvasIdV1;
  nodeId: CanvasNodeIdV1;
  kind: CanvasNodeKindV1;
  nodeType?: string | null;
  placement: CanvasNodeCreatePlacementV1;
  transform?: Partial<TransformV1>;
  presentationStyle?: Partial<PresentationStyleV1>;
  renderProfile?: Partial<RenderProfileV1>;
  objectLink?: ObjectLinkV1;
}

export interface CanvasNodeMoveCommandV1 {
  name: 'canvas.node.move';
  canvasId: CanvasIdV1;
  nodeId: CanvasNodeIdV1;
  x: number;
  y: number;
}

export interface CanvasNodeReparentCommandV1 {
  name: 'canvas.node.reparent';
  canvasId: CanvasIdV1;
  nodeId: CanvasNodeIdV1;
  parentNodeId: CanvasNodeIdV1 | null;
}

export interface CanvasNodeResizeCommandV1 {
  name: 'canvas.node.resize';
  canvasId: CanvasIdV1;
  nodeId: CanvasNodeIdV1;
  handle: ResizeHandleV1;
  nextSize: SizeV1;
  constraint?: ResizeConstraintV1;
}

export type ResizeHandleV1 =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left';

export type ResizeConstraintV1 = 'free' | 'keep-aspect';

export interface CanvasNodeRotateCommandV1 {
  name: 'canvas.node.rotate';
  canvasId: CanvasIdV1;
  nodeId: CanvasNodeIdV1;
  nextRotation: RotationDegreesV1;
}

export interface CanvasNodePresentationStyleUpdateCommandV1 {
  name: 'canvas.node.presentation-style.update';
  canvasId: CanvasIdV1;
  nodeId: CanvasNodeIdV1;
  presentationStyle: Partial<PresentationStyleV1>;
}

export interface CanvasNodeRenderProfileUpdateCommandV1 {
  name: 'canvas.node.render-profile.update';
  canvasId: CanvasIdV1;
  nodeId: CanvasNodeIdV1;
  renderProfile: Partial<RenderProfileV1>;
}

export interface CanvasNodeRenameCommandV1 {
  name: 'canvas.node.rename';
  canvasId: CanvasIdV1;
  nodeId: CanvasNodeIdV1;
  nextDisplayName: string;
}

export interface CanvasNodeDeleteCommandV1 {
  name: 'canvas.node.delete';
  canvasId: CanvasIdV1;
  nodeId: CanvasNodeIdV1;
}

export interface CanvasNodeZOrderUpdateCommandV1 {
  name: 'canvas.node.z-order.update';
  canvasId: CanvasIdV1;
  nodeId: CanvasNodeIdV1;
  zIndex: number;
}

export interface ObjectContentUpdateCommandV1 {
  name: 'object.content.update';
  objectId: CanonicalObjectIdV1;
  kind: CanonicalObjectContentKindV1;
  patch: Record<string, unknown>;
  expectedContentKind?: CanonicalObjectContentKindV1;
}

export interface ObjectCapabilityPatchCommandV1 {
  name: 'object.capability.patch';
  objectId: CanonicalObjectIdV1;
  capability: CanonicalObjectCapabilityNameV1;
  patch: Record<string, unknown> | null;
}

export interface ObjectBodyBlockInsertCommandV1 {
  name: 'object.body.block.insert';
  objectId: CanonicalObjectIdV1;
  block: BodyBlockEntityV1;
  position: BodyBlockPositionRefV1;
}

export type BodyBlockTargetRefV1 =
  | { mode: 'selection'; selectionKey: string }
  | { mode: 'anchor'; anchorId: string }
  | { mode: 'index'; index: number };

export type BodyBlockPositionRefV1 =
  | { mode: 'start' }
  | { mode: 'end' }
  | { mode: 'selection'; selectionKey: string }
  | { mode: 'anchor'; anchorId: string }
  | { mode: 'index'; index: number };

export interface ObjectBodyBlockUpdateCommandV1 {
  name: 'object.body.block.update';
  objectId: CanonicalObjectIdV1;
  target: BodyBlockTargetRefV1;
  props: Record<string, unknown>;
}

export interface ObjectBodyBlockRemoveCommandV1 {
  name: 'object.body.block.remove';
  objectId: CanonicalObjectIdV1;
  target: BodyBlockTargetRefV1;
}

export interface ObjectBodyBlockReorderCommandV1 {
  name: 'object.body.block.reorder';
  objectId: CanonicalObjectIdV1;
  target: BodyBlockTargetRefV1;
  position: BodyBlockPositionRefV1;
}

export type CanvasRuntimeCommandV1 =
  | CanvasNodeCreateCommandV1
  | CanvasNodeMoveCommandV1
  | CanvasNodeReparentCommandV1
  | CanvasNodeResizeCommandV1
  | CanvasNodeRotateCommandV1
  | CanvasNodePresentationStyleUpdateCommandV1
  | CanvasNodeRenderProfileUpdateCommandV1
  | CanvasNodeRenameCommandV1
  | CanvasNodeDeleteCommandV1
  | CanvasNodeZOrderUpdateCommandV1
  | ObjectContentUpdateCommandV1
  | ObjectCapabilityPatchCommandV1
  | ObjectBodyBlockInsertCommandV1
  | ObjectBodyBlockUpdateCommandV1
  | ObjectBodyBlockRemoveCommandV1
  | ObjectBodyBlockReorderCommandV1;

export interface CanvasMutationBatchV1 {
  workspaceId: WorkspaceIdV1;
  canvasId?: CanvasIdV1;
  actor?: MutationActorV1;
  sessionId?: string;
  reason?: string;
  preconditions?: CanvasMutationPreconditionsV1;
  dryRun?: boolean;
  commands: CanvasRuntimeCommandV1[];
}
