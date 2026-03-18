import type { CreatableNodeType } from '@/types/contextMenu';

export function shouldCommitDragStop(input: {
  origin?: { x: number; y: number };
  current: { x: number; y: number };
}): boolean {
  if (!input.origin) return true;
  return input.origin.x !== input.current.x || input.origin.y !== input.current.y;
}

export type GraphCanvasCreateMode = CreatableNodeType | null;

type RpcLikeError = {
  code?: unknown;
  message?: unknown;
  data?: unknown;
};

type DragNodeLike = {
  id: string;
  position: { x: number; y: number };
  width?: number | null;
  height?: number | null;
  data?: {
    groupId?: unknown;
    editMeta?: {
      family?: unknown;
    };
    canonicalObject?: {
      core?: {
        relations?: {
          from?: unknown;
        };
        sourceMeta?: {
          kind?: unknown;
        };
      };
    };
  };
};

function resolveDragNodeFamily(node: DragNodeLike): unknown {
  const editMetaFamily = node.data?.editMeta?.family;
  if (typeof editMetaFamily === 'string') {
    return editMetaFamily;
  }

  if (node.data?.canonicalObject?.core?.sourceMeta?.kind === 'mindmap') {
    return 'mindmap-member';
  }

  return 'canvas-absolute';
}

export function shouldHandlePaneCreate(input: {
  interactionMode: 'pointer' | 'hand';
  createMode: GraphCanvasCreateMode;
}): boolean {
  return input.interactionMode === 'pointer' && input.createMode !== null;
}

export function resolveMindMapReparentIntent(input: {
  draggedNode: DragNodeLike;
  allNodes: DragNodeLike[];
  dropPosition: { x: number; y: number };
  thresholdPx?: number;
}): { kind: 'reparent'; newParentNodeId: string } | { kind: 'rejected'; reason: 'NO_VALID_PARENT' } | null {
  const groupId = typeof input.draggedNode.data?.groupId === 'string'
    ? input.draggedNode.data.groupId
    : null;
  const family = resolveDragNodeFamily(input.draggedNode);
  if (!groupId || family !== 'mindmap-member') {
    return null;
  }

  const draggedWidth = input.draggedNode.width ?? 0;
  const draggedHeight = input.draggedNode.height ?? 0;
  const dropCenter = {
    x: input.dropPosition.x + draggedWidth / 2,
    y: input.dropPosition.y + draggedHeight / 2,
  };
  const thresholdPx = input.thresholdPx ?? 120;

  let bestCandidate: { nodeId: string; distance: number } | null = null;

  input.allNodes.forEach((candidate) => {
    if (candidate.id === input.draggedNode.id) {
      return;
    }
    if (candidate.data?.groupId !== groupId) {
      return;
    }

    const width = candidate.width ?? 160;
    const height = candidate.height ?? 80;
    const center = {
      x: candidate.position.x + width / 2,
      y: candidate.position.y + height / 2,
    };
    const inside =
      dropCenter.x >= candidate.position.x
      && dropCenter.x <= candidate.position.x + width
      && dropCenter.y >= candidate.position.y
      && dropCenter.y <= candidate.position.y + height;
    const distance = Math.hypot(center.x - dropCenter.x, center.y - dropCenter.y);

    if (!inside && distance > thresholdPx) {
      return;
    }

    if (!bestCandidate || distance < bestCandidate.distance) {
      bestCandidate = {
        nodeId: candidate.id,
        distance,
      };
    }
  });

  if (!bestCandidate) {
    return { kind: 'rejected', reason: 'NO_VALID_PARENT' };
  }

  const resolvedCandidate = bestCandidate as { nodeId: string; distance: number };
  return {
    kind: 'reparent',
    newParentNodeId: resolvedCandidate.nodeId,
  };
}

export function resolveMindMapDragFeedback(input: {
  draggedNode: DragNodeLike;
  allNodes: DragNodeLike[];
  dropPosition: { x: number; y: number };
  thresholdPx?: number;
}): { kind: 'reparent-ready'; newParentNodeId: string } | { kind: 'reparent-hint' } | null {
  const intent = resolveMindMapReparentIntent(input);
  if (!intent) {
    return null;
  }
  if (intent.kind === 'reparent') {
    return {
      kind: 'reparent-ready',
      newParentNodeId: intent.newParentNodeId,
    };
  }
  return { kind: 'reparent-hint' };
}

export function shouldSuppressDragStopErrorToast(error: unknown): boolean {
  const rpc = error as RpcLikeError;
  const data = rpc.data && typeof rpc.data === 'object'
    ? rpc.data as { reason?: unknown }
    : undefined;
  return (
    (rpc.code === 42201 || rpc.message === 'EDIT_NOT_ALLOWED')
    && data?.reason === 'NO_VALID_PARENT'
  );
}

export function shouldRetainSelectionOnStyleUpdate(input: {
  selectedNodeIds: string[];
  updatedNodeId: string;
}): boolean {
  return input.selectedNodeIds.includes(input.updatedNodeId);
}
