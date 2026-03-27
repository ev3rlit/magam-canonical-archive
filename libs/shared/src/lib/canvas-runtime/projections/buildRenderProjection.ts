import type { CanonicalObjectRecord } from '../../canonical-object-contract';
import type {
  CanvasRenderEdgeV1,
  CanvasRenderMindmapGroupV1,
  CanvasRenderProjectionNodeV1,
  CanvasRenderProjectionRequestV1,
  CanvasRenderProjectionResponseV1,
  PresentationStyleV1,
  RenderProfileV1,
} from '../contracts';
import type { CanvasRuntimeServiceContext } from '../application/serviceContext';

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function toPresentationStyle(record: { props?: Record<string, unknown> | null; style?: Record<string, unknown> | null }): PresentationStyleV1 | undefined {
  const source = {
    ...(record.props ?? {}),
    ...(record.style ?? {}),
  };
  const next: PresentationStyleV1 = {
    ...(readString(source.fill) ? { fillColor: readString(source.fill) } : {}),
    ...(readString(source.stroke) ? { strokeColor: readString(source.stroke) } : {}),
    ...(typeof source.strokeWidth === 'number' ? { strokeWidth: source.strokeWidth } : {}),
    ...(typeof source.opacity === 'number' ? { opacity: source.opacity } : {}),
    ...(readString(source.color) ? { textColor: readString(source.color) } : {}),
    ...(readString(source.fontFamily) ? { fontFamily: readString(source.fontFamily) } : {}),
    ...(typeof source.fontSize === 'number' ? { fontSize: source.fontSize } : {}),
  };

  return Object.keys(next).length > 0 ? next : undefined;
}

function toRenderProfile(record: { props?: Record<string, unknown> | null; style?: Record<string, unknown> | null }): RenderProfileV1 | undefined {
  const source = {
    ...(record.props ?? {}),
    ...(record.style ?? {}),
  };
  const next: RenderProfileV1 = {
    ...(typeof source.roughness === 'number' ? { roughness: source.roughness } : {}),
    ...(typeof source.wobble === 'number' ? { wobble: source.wobble } : {}),
    ...(typeof source.pressureVariance === 'number' ? { pressureVariance: source.pressureVariance } : {}),
    ...(typeof source.angleVariance === 'number' ? { angleVariance: source.angleVariance } : {}),
    ...(readString(source.inkProfile) ? { inkProfile: source.inkProfile as RenderProfileV1['inkProfile'] } : {}),
    ...(readString(source.paperBlend) ? { paperBlend: source.paperBlend as RenderProfileV1['paperBlend'] } : {}),
  };

  return Object.keys(next).length > 0 ? next : undefined;
}

function createSummary(record: CanonicalObjectRecord | null) {
  if (!record) {
    return undefined;
  }

  return {
    title: record.publicAlias ?? null,
    canonicalTextPreview: record.canonicalText?.slice(0, 160) ?? null,
    semanticRole: record.semanticRole,
  };
}

function readMindmapId(record: CanonicalObjectRecord | null): string | null {
  const scopeId = record?.sourceMeta?.scopeId;
  return typeof scopeId === 'string' && scopeId.length > 0 ? scopeId : null;
}

function toRenderNode(input: {
  node: Awaited<ReturnType<CanvasRuntimeServiceContext['repository']['listCanvasNodes']>>[number];
  objectRecord: CanonicalObjectRecord | null;
}): CanvasRenderProjectionNodeV1 {
  const { node, objectRecord } = input;
  return {
    nodeId: node.id,
    kind: node.nodeKind === 'plugin' ? 'annotation' : 'node',
    nodeType: node.nodeType ?? null,
    surfaceId: node.surfaceId,
    canonicalObjectId: node.canonicalObjectId ?? null,
    transform: {
      x: readNumber(node.layout.x),
      y: readNumber(node.layout.y),
      width: readNumber(node.layout.width, readNumber(node.props?.width, 160)),
      height: readNumber(node.layout.height, readNumber(node.props?.height, 90)),
      rotation: readNumber(node.style?.rotation ?? node.props?.rotation),
      ...(typeof node.layout.scaleX === 'number' ? { scaleX: node.layout.scaleX as number } : {}),
      ...(typeof node.layout.scaleY === 'number' ? { scaleY: node.layout.scaleY as number } : {}),
    },
    presentationStyle: toPresentationStyle(node),
    renderProfile: toRenderProfile(node),
    visible: node.props?.hidden !== true,
    summary: createSummary(objectRecord),
  };
}

export async function buildRenderProjection(
  context: CanvasRuntimeServiceContext,
  request: CanvasRenderProjectionRequestV1,
): Promise<CanvasRenderProjectionResponseV1> {
  const workspaceId = request.workspaceId ?? context.headless.defaultWorkspaceId;
  const nodes = await context.repository.listCanvasNodes(request.canvasId, request.surfaceId);
  const canvasRevision = await context.repository.getLatestCanvasRevision(request.canvasId);
  const objects = await context.repository.listCanonicalObjects(workspaceId);
  const objectsById = new Map(objects.map((record) => [record.id, record]));

  const renderNodes = nodes
    .sort((left, right) => left.zIndex - right.zIndex)
    .map((node) => toRenderNode({
      node,
      objectRecord: node.canonicalObjectId ? objectsById.get(node.canonicalObjectId) ?? null : null,
    }));

  const edges: CanvasRenderEdgeV1[] = nodes
    .filter((node) => typeof node.parentNodeId === 'string' && node.parentNodeId.length > 0)
    .map((node) => {
      const objectRecord = node.canonicalObjectId ? objectsById.get(node.canonicalObjectId) ?? null : null;
      return {
        edgeId: `${node.parentNodeId}->${node.id}`,
        sourceNodeId: node.parentNodeId as string,
        targetNodeId: node.id,
        surfaceId: node.surfaceId,
        mindmapId: readMindmapId(objectRecord),
        zIndex: node.zIndex,
      };
    });

  const groupsByMindmapId = new Map<string, CanvasRenderMindmapGroupV1>();
  nodes.forEach((node) => {
    const objectRecord = node.canonicalObjectId ? objectsById.get(node.canonicalObjectId) ?? null : null;
    const mindmapId = readMindmapId(objectRecord);
    if (!mindmapId) {
      return;
    }
    const existing = groupsByMindmapId.get(mindmapId) ?? {
      mindmapId,
      surfaceId: node.surfaceId,
      rootNodeId: null,
      nodeIds: [],
    };
    existing.nodeIds.push(node.id);
    if (!node.parentNodeId) {
      existing.rootNodeId = node.id;
    }
    groupsByMindmapId.set(mindmapId, existing);
  });

  return {
    canvasId: request.canvasId,
    canvasRevision,
    workspaceId,
    surfaceId: request.surfaceId ?? null,
    nodes: renderNodes,
    edges,
    mindmapGroups: [...groupsByMindmapId.values()],
  };
}
