import type { CanvasEntrypointCreateMode } from '@/features/canvas-ui-entrypoints/contracts';

export type GraphCanvasPointerType = 'mouse' | 'pen' | 'touch' | 'unknown';
export type GraphCanvasGestureKind = 'move' | 'resize' | 'rotate';

const DRAG_COMMIT_DISTANCE_PX: Record<GraphCanvasPointerType, number> = {
  mouse: 2,
  pen: 4,
  touch: 12,
  unknown: 4,
};

const AUTO_PAN_POLICY_BY_GESTURE: Record<GraphCanvasGestureKind, {
  enabled: boolean;
  speed: number;
  strength: 'aggressive' | 'conservative';
}> = {
  move: {
    enabled: true,
    speed: 1,
    strength: 'aggressive',
  },
  resize: {
    enabled: true,
    speed: 0.45,
    strength: 'conservative',
  },
  rotate: {
    enabled: true,
    speed: 0.35,
    strength: 'conservative',
  },
};

export function normalizePointerType(pointerType: unknown): GraphCanvasPointerType {
  if (pointerType === 'mouse' || pointerType === 'pen' || pointerType === 'touch') {
    return pointerType;
  }

  return 'unknown';
}

export function resolvePointerTypeFromEvent(event: unknown): GraphCanvasPointerType {
  if (!event || typeof event !== 'object') {
    return 'unknown';
  }

  const candidate = event as {
    pointerType?: unknown;
    nativeEvent?: { pointerType?: unknown };
    touches?: { length?: unknown };
    changedTouches?: { length?: unknown };
  };

  const nativePointerType = candidate.nativeEvent?.pointerType;
  if (nativePointerType !== undefined) {
    return normalizePointerType(nativePointerType);
  }

  if (candidate.pointerType !== undefined) {
    return normalizePointerType(candidate.pointerType);
  }

  if (
    (typeof candidate.touches?.length === 'number' && candidate.touches.length > 0)
    || (typeof candidate.changedTouches?.length === 'number' && candidate.changedTouches.length > 0)
  ) {
    return 'touch';
  }

  return 'unknown';
}

export function resolveDragCommitDistance(pointerType: unknown): number {
  return DRAG_COMMIT_DISTANCE_PX[normalizePointerType(pointerType)];
}

export function resolveAutoPanPolicy(gesture: GraphCanvasGestureKind) {
  return AUTO_PAN_POLICY_BY_GESTURE[gesture];
}

export function shouldCommitDragStop(input: {
  origin?: { x: number; y: number };
  current: { x: number; y: number };
  pointerType?: GraphCanvasPointerType;
}): boolean {
  if (!input.origin) return true;

  const deltaX = input.current.x - input.origin.x;
  const deltaY = input.current.y - input.origin.y;
  return Math.hypot(deltaX, deltaY) >= resolveDragCommitDistance(input.pointerType);
}

export type GraphCanvasCreateMode = CanvasEntrypointCreateMode;

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
