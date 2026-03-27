export type WorkspaceIdV1 = string;
export type CanvasIdV1 = string;
export type CanvasNodeIdV1 = string;
export type CanonicalObjectIdV1 = string;
export type BodyBlockIdV1 = string;
export type SurfaceIdV1 = string;
export type HistoryEntryIdV1 = string;
export type MutationIdV1 = string;
export type MindmapIdV1 = string;

export type CanvasNodeKindV1 =
  | 'node'
  | 'edge'
  | 'annotation'
  | 'highlight'
  | 'doodle'
  | 'sticker'
  | 'text-run';

export interface NodeIdentityV1 {
  nodeId: CanvasNodeIdV1;
  kind: CanvasNodeKindV1;
  nodeType?: string | null;
  surfaceId: SurfaceIdV1;
}

export interface HierarchyV1 {
  parentNodeId: CanvasNodeIdV1 | null;
  zIndex: number;
}

export interface TransformV1 {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: RotationDegreesV1;
  scaleX?: number;
  scaleY?: number;
}

export interface SizeV1 {
  width: number;
  height: number;
}

export type RotationDegreesV1 = number;

export interface PresentationStyleV1 {
  fillColor?: string | null;
  strokeColor?: string | null;
  strokeWidth?: number | null;
  opacity?: number | null;
  textColor?: string | null;
  fontFamily?: string | null;
  fontSize?: number | null;
}

export type InkProfileV1 = 'pen' | 'marker' | 'brush' | 'pencil' | 'none';
export type PaperBlendV1 = 'none' | 'plain-paper' | 'graph-paper' | 'notebook' | 'sticky-paper';

export interface RenderProfileV1 {
  roughness?: number | null;
  wobble?: number | null;
  pressureVariance?: number | null;
  angleVariance?: number | null;
  inkProfile?: InkProfileV1 | null;
  paperBlend?: PaperBlendV1 | null;
}

export interface MindmapMembershipV1 {
  mindmapId: MindmapIdV1 | null;
  role: 'free' | 'mindmap-root' | 'mindmap-child';
}

export interface ObjectLinkV1 {
  canonicalObjectId: CanonicalObjectIdV1 | null;
  pluginInstanceId?: string | null;
}

export interface InteractionCapabilitiesV1 {
  selectable: boolean;
  movable: boolean;
  reparentable: boolean;
  renamable: boolean;
  deletable: boolean;
  zOrderEditable: boolean;
  objectContentEditable: boolean;
  objectCapabilityPatchable: boolean;
  bodyEntrySupported: boolean;
}

export interface CanvasNodeEntityV1 {
  identity: NodeIdentityV1;
  hierarchy: HierarchyV1;
  transform: TransformV1;
  presentationStyle?: PresentationStyleV1;
  renderProfile?: RenderProfileV1;
  mindmapMembership: MindmapMembershipV1;
  objectLink: ObjectLinkV1;
  interactionCapabilities?: InteractionCapabilitiesV1;
}

export type CanonicalObjectContentKindV1 = 'text' | 'markdown' | 'media' | 'sequence' | 'document';

export interface CanonicalObjectContentV1 {
  kind: CanonicalObjectContentKindV1;
  data: Record<string, unknown>;
}

export type CanonicalObjectCapabilityNameV1 =
  | 'frame'
  | 'material'
  | 'texture'
  | 'attach'
  | 'ports'
  | 'bubble'
  | 'content'
  | 'custom';

export interface CanonicalObjectCapabilityV1 {
  capability: CanonicalObjectCapabilityNameV1;
  payload: Record<string, unknown> | null;
}

export type BodyBlockKindV1 =
  | 'paragraph'
  | 'heading'
  | 'checklist'
  | 'callout'
  | 'code'
  | 'quote'
  | 'divider'
  | 'image'
  | 'embed'
  | 'custom';

export interface BodyBlockEntityV1 {
  blockId: BodyBlockIdV1;
  kind: BodyBlockKindV1;
  props: Record<string, unknown>;
}

export type ResolvedBodyBlockPositionV1 =
  | { mode: 'start' }
  | { mode: 'end' }
  | { mode: 'before-block'; blockId: BodyBlockIdV1 }
  | { mode: 'after-block'; blockId: BodyBlockIdV1 };

export interface CanvasAggregateV1 {
  canvasId: CanvasIdV1;
  workspaceId: WorkspaceIdV1;
  revision: number;
  nodes: CanvasNodeEntityV1[];
}

export interface CanonicalObjectAggregateV1 {
  objectId: CanonicalObjectIdV1;
  content: CanonicalObjectContentV1;
  capabilities: CanonicalObjectCapabilityV1[];
  bodyBlocks: BodyBlockEntityV1[];
}

export type MutationActorKindV1 = 'agent' | 'user' | 'system';

export interface MutationActorV1 {
  kind: MutationActorKindV1;
  id: string;
  displayName?: string;
}

export type MutationFailureCodeV1 =
  | 'VERSION_CONFLICT'
  | 'VALIDATION_FAILED'
  | 'COMMAND_NOT_ALLOWED'
  | 'CAPABILITY_REJECTED'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

export interface CanvasDomainEventMetaV1 {
  eventId: string;
  occurredAt: string;
  mutationId?: MutationIdV1;
  causedByCommandName?: string;
}
