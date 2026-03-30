import type {
  BodyBlockIdV1,
  BodyBlockKindV1,
  CanvasIdV1,
  CanvasNodeIdV1,
  CanvasNodeKindV1,
  CanonicalObjectIdV1,
  InteractionCapabilitiesV1,
  MindmapIdV1,
  PresentationStyleV1,
  RenderProfileV1,
  SurfaceIdV1,
  TransformV1,
  WorkspaceIdV1,
} from './core';
import type { CanvasRuntimeCommandNameV1 } from './commands';
import type { CanonicalBodyDocument } from '../../canonical-body-document';

export interface CanvasProjectionSummaryV1 {
  title?: string | null;
  canonicalTextPreview?: string | null;
  semanticRole?: string | null;
}

export interface CanvasHierarchyProjectionNodeV1 {
  nodeId: CanvasNodeIdV1;
  kind: CanvasNodeKindV1;
  nodeType?: string | null;
  parentNodeId: CanvasNodeIdV1 | null;
  surfaceId: SurfaceIdV1;
  mindmapId: MindmapIdV1 | null;
  topologyRole: 'free' | 'mindmap-root' | 'mindmap-child';
  zIndex: number;
  canonicalObjectId: CanonicalObjectIdV1 | null;
  pluginInstanceId?: string | null;
  summary?: CanvasProjectionSummaryV1;
  children: CanvasHierarchyProjectionNodeV1[];
}

export interface CanvasHierarchyProjectionRequestV1 {
  workspaceId?: WorkspaceIdV1;
  canvasId: CanvasIdV1;
  surfaceId?: SurfaceIdV1;
  rootNodeId?: CanvasNodeIdV1;
}

export interface CanvasHierarchyProjectionResponseV1 {
  canvasId: CanvasIdV1;
  canvasRevision: number;
  workspaceId?: WorkspaceIdV1;
  surfaceId?: SurfaceIdV1 | null;
  roots: CanvasHierarchyProjectionNodeV1[];
  orphanNodeIds: CanvasNodeIdV1[];
}

export interface CanvasRenderEdgeV1 {
  edgeId: string;
  sourceNodeId: CanvasNodeIdV1;
  targetNodeId: CanvasNodeIdV1;
  surfaceId: SurfaceIdV1;
  mindmapId: MindmapIdV1 | null;
  zIndex: number;
}

export interface CanvasRenderMindmapGroupV1 {
  mindmapId: MindmapIdV1;
  surfaceId: SurfaceIdV1;
  rootNodeId: CanvasNodeIdV1 | null;
  nodeIds: CanvasNodeIdV1[];
}

export interface CanvasRenderProjectionNodeV1 {
  nodeId: CanvasNodeIdV1;
  kind: CanvasNodeKindV1;
  nodeType?: string | null;
  surfaceId: SurfaceIdV1;
  canonicalObjectId: CanonicalObjectIdV1 | null;
  transform: TransformV1;
  presentationStyle?: PresentationStyleV1;
  renderProfile?: RenderProfileV1;
  visible: boolean;
  summary?: CanvasProjectionSummaryV1;
}

export interface CanvasRenderProjectionRequestV1 {
  workspaceId?: WorkspaceIdV1;
  canvasId: CanvasIdV1;
  surfaceId?: SurfaceIdV1;
}

export interface CanvasRenderProjectionResponseV1 {
  canvasId: CanvasIdV1;
  canvasRevision: number;
  workspaceId?: WorkspaceIdV1;
  surfaceId?: SurfaceIdV1 | null;
  nodes: CanvasRenderProjectionNodeV1[];
  edges: CanvasRenderEdgeV1[];
  mindmapGroups: CanvasRenderMindmapGroupV1[];
}

export type CanvasEditingAnchorKindV1 =
  | 'node-shell'
  | 'node-body'
  | 'node-label'
  | 'mindmap-port'
  | 'overlay-target'
  | 'body-block-before'
  | 'body-block-content'
  | 'body-block-after';

export interface CanvasEditingAnchorV1 {
  anchorId: string;
  anchorKind: CanvasEditingAnchorKindV1;
  nodeId: CanvasNodeIdV1;
  surfaceId: SurfaceIdV1;
  canonicalObjectId?: CanonicalObjectIdV1 | null;
  bodyBlockId?: BodyBlockIdV1 | null;
}

export interface CanvasBodyEntryCapabilityV1 {
  supported: boolean;
  targetObjectId?: CanonicalObjectIdV1 | null;
  preferredCommandName?: CanvasRuntimeCommandNameV1 | null;
  mode?: 'inline' | 'object-body' | null;
}

export interface CanvasEditingProjectionBodyBlockV1 {
  blockId: BodyBlockIdV1;
  kind: BodyBlockKindV1;
  index: number;
  selectionKey: string;
  contentAnchorId: string;
  beforeAnchorId: string;
  afterAnchorId: string;
  previewText?: string | null;
}

export interface CanvasEditingProjectionNodeV1 {
  nodeId: CanvasNodeIdV1;
  surfaceId: SurfaceIdV1;
  canonicalObjectId: CanonicalObjectIdV1 | null;
  pluginInstanceId?: string | null;
  selectionKey: string;
  allowedCommands: CanvasRuntimeCommandNameV1[];
  interactionCapabilities: InteractionCapabilitiesV1;
  bodyEntry: CanvasBodyEntryCapabilityV1;
  body?: CanonicalBodyDocument | null;
  bodySource?: 'native' | 'legacy-converted' | null;
  anchors: CanvasEditingAnchorV1[];
  bodyBlocks: CanvasEditingProjectionBodyBlockV1[];
  selectedBodyBlockId?: BodyBlockIdV1 | null;
}

export interface CanvasEditingProjectionRequestV1 {
  workspaceId?: WorkspaceIdV1;
  canvasId: CanvasIdV1;
  surfaceId?: SurfaceIdV1;
  nodeIds?: CanvasNodeIdV1[];
}

export interface CanvasEditingProjectionResponseV1 {
  canvasId: CanvasIdV1;
  canvasRevision: number;
  workspaceId?: WorkspaceIdV1;
  surfaceId?: SurfaceIdV1 | null;
  nodes: CanvasEditingProjectionNodeV1[];
}
