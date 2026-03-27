import type { CanonicalObjectRecord } from '../../canonical-object-contract';
import type {
  CanvasHierarchyProjectionNodeV1,
  CanvasHierarchyProjectionRequestV1,
  CanvasHierarchyProjectionResponseV1,
} from '../contracts';
import type { CanvasRuntimeServiceContext } from '../application/serviceContext';

function readMindmapId(record: CanonicalObjectRecord | null): string | null {
  const scopeId = record?.sourceMeta?.scopeId;
  return typeof scopeId === 'string' && scopeId.length > 0 ? scopeId : null;
}

function readTopologyRole(record: CanonicalObjectRecord | null, parentNodeId: string | null): 'free' | 'mindmap-root' | 'mindmap-child' {
  if (record?.sourceMeta?.kind !== 'mindmap') {
    return 'free';
  }
  return parentNodeId ? 'mindmap-child' : 'mindmap-root';
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

export async function buildHierarchyProjection(
  context: CanvasRuntimeServiceContext,
  request: CanvasHierarchyProjectionRequestV1,
): Promise<CanvasHierarchyProjectionResponseV1> {
  const workspaceId = request.workspaceId ?? context.headless.defaultWorkspaceId;
  const nodes = await context.repository.listCanvasNodes(request.canvasId, request.surfaceId);
  const objects = await context.repository.listCanonicalObjects(workspaceId);
  const objectsById = new Map(objects.map((record) => [record.id, record]));
  const filteredNodes = request.rootNodeId
    ? nodes.filter((node) => node.id === request.rootNodeId || node.parentNodeId === request.rootNodeId)
    : nodes;
  const childrenByParent = new Map<string | null, typeof filteredNodes>();

  filteredNodes.forEach((node) => {
    const key = node.parentNodeId ?? null;
    const existing = childrenByParent.get(key) ?? [];
    existing.push(node);
    childrenByParent.set(key, existing);
  });

  const buildNode = (nodeId: string): CanvasHierarchyProjectionNodeV1 | null => {
    const node = filteredNodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      return null;
    }
    const objectRecord = node.canonicalObjectId
      ? objectsById.get(node.canonicalObjectId) ?? null
      : null;
    const children = (childrenByParent.get(node.id) ?? [])
      .sort((left, right) => left.zIndex - right.zIndex)
      .map((child) => buildNode(child.id))
      .filter((child): child is CanvasHierarchyProjectionNodeV1 => child !== null);

    return {
      nodeId: node.id,
      kind: node.nodeKind === 'plugin' ? 'annotation' : 'node',
      nodeType: node.nodeType ?? null,
      parentNodeId: node.parentNodeId ?? null,
      surfaceId: node.surfaceId,
      mindmapId: readMindmapId(objectRecord),
      topologyRole: readTopologyRole(objectRecord, node.parentNodeId ?? null),
      zIndex: node.zIndex,
      canonicalObjectId: node.canonicalObjectId ?? null,
      pluginInstanceId: node.pluginInstanceId ?? null,
      summary: createSummary(objectRecord),
      children,
    };
  };

  const roots = (childrenByParent.get(request.rootNodeId ?? null) ?? filteredNodes.filter((node) => !node.parentNodeId))
    .sort((left, right) => left.zIndex - right.zIndex)
    .map((node) => buildNode(node.id))
    .filter((node): node is CanvasHierarchyProjectionNodeV1 => node !== null);

  const nodeIds = new Set(filteredNodes.map((node) => node.id));
  const orphanNodeIds = filteredNodes
    .filter((node) => node.parentNodeId && !nodeIds.has(node.parentNodeId))
    .map((node) => node.id);

  return {
    canvasId: request.canvasId,
    workspaceId,
    surfaceId: request.surfaceId ?? null,
    roots,
    orphanNodeIds,
  };
}
