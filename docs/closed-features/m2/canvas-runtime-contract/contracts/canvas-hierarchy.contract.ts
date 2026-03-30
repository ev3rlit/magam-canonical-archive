// Canvas runtime read contract for hierarchy/tree-oriented canvas understanding.
// This contract is framework-neutral and is intended to be shared by UI, CLI, and other runtime consumers.

export type CanvasHierarchyViewV1 = 'logical-tree' | 'render-order';
export type CanvasHierarchyProjectionModeV1 = 0 | 1;

export type CanvasHierarchyProjectionPathV1 =
  | 'id'
  | 'nodeType'
  | 'nodeKind'
  | 'parentNodeId'
  | 'surfaceId'
  | 'zIndex'
  | 'canonicalObjectId'
  | 'pluginInstanceId'
  | 'layout'
  | 'summary'
  | 'summary.title'
  | 'summary.canonicalTextPreview'
  | 'summary.semanticRole';

export type CanvasHierarchyInclusionProjectionV1 =
  Partial<Record<Exclude<CanvasHierarchyProjectionPathV1, 'id'>, 1>>
  & { id?: CanvasHierarchyProjectionModeV1 };

export type CanvasHierarchyExclusionProjectionV1 =
  Partial<Record<Exclude<CanvasHierarchyProjectionPathV1, 'id'>, 0>>
  & { id?: CanvasHierarchyProjectionModeV1 };

export type CanvasHierarchyProjectionV1 =
  | CanvasHierarchyInclusionProjectionV1
  | CanvasHierarchyExclusionProjectionV1;

export interface CanvasHierarchySummaryV1 {
  title?: string | null;
  canonicalTextPreview?: string | null;
  semanticRole?: string | null;
}

export interface CanvasHierarchyNodeV1 {
  id: string;
  nodeType: string | null;
  nodeKind: string;
  parentNodeId: string | null;
  surfaceId: string;
  zIndex: number;
  canonicalObjectId: string | null;
  pluginInstanceId: string | null;
  layout?: Record<string, unknown> | null;
  summary?: CanvasHierarchySummaryV1;
  children: CanvasHierarchyNodeV1[];
}

export interface CanvasHierarchyRequestV1 {
  workspaceRef?: string;
  canvasRef: string;
  surfaceId?: string;
  view?: CanvasHierarchyViewV1;
  projection?: CanvasHierarchyProjectionV1;
  rootNodeId?: string;
}

export interface CanvasHierarchyResponseV1 {
  canvasId: string;
  workspaceId?: string;
  surfaceId?: string | null;
  view: CanvasHierarchyViewV1;
  projection?: CanvasHierarchyProjectionV1;
  roots: CanvasHierarchyNodeV1[];
  orphanNodeIds: string[];
}
