import type { Node } from 'reactflow';
import { getCreateDefaults, createUniqueNodeId } from './createDefaults';
import type { CreatePayload, EditTarget } from './commands';
import { createActionRoutingBridgeError } from './actionRoutingErrors';
import type {
  ActionRoutingBridgeRequest,
  ActionRoutingNormalizedPayload,
  ActionRoutingRuntimeSnapshot,
  ActionRoutingTargetSnapshot,
  EntryPointSurface,
  ActionRoutingIntent,
  ActionRoutingCreateNodeInput,
} from './actionRoutingBridge.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ensureString(
  value: unknown,
  input: { surface: EntryPointSurface; intent: ActionRoutingIntent; field: string },
): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  throw createActionRoutingBridgeError({
    code: 'NORMALIZATION_FAILED',
    surface: input.surface,
    intent: input.intent,
    details: { field: input.field },
  });
}

function ensureNumber(
  value: unknown,
  input: { surface: EntryPointSurface; intent: ActionRoutingIntent; field: string },
): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  throw createActionRoutingBridgeError({
    code: 'NORMALIZATION_FAILED',
    surface: input.surface,
    intent: input.intent,
    details: { field: input.field },
  });
}

function ensureNodeType(
  value: unknown,
  input: { surface: EntryPointSurface; intent: ActionRoutingIntent },
): CreatePayload['nodeType'] {
  if (
    value === 'shape'
    || value === 'rectangle'
    || value === 'ellipse'
    || value === 'diamond'
    || value === 'line'
    || value === 'text'
    || value === 'markdown'
    || value === 'sticky'
    || value === 'sticker'
    || value === 'washi-tape'
    || value === 'image'
  ) {
    return value;
  }

  throw createActionRoutingBridgeError({
    code: 'NORMALIZATION_FAILED',
    surface: input.surface,
    intent: input.intent,
    details: { field: 'nodeType' },
  });
}

function ensurePlacement(
  value: unknown,
  input: { surface: EntryPointSurface; intent: ActionRoutingIntent },
): CreatePayload['placement'] {
  if (!isRecord(value)) {
    throw createActionRoutingBridgeError({
      code: 'NORMALIZATION_FAILED',
      surface: input.surface,
      intent: input.intent,
      details: { field: 'placement' },
    });
  }

  if (value.mode === 'canvas-absolute') {
    return {
      mode: 'canvas-absolute',
      x: ensureNumber(value.x, { ...input, field: 'placement.x' }),
      y: ensureNumber(value.y, { ...input, field: 'placement.y' }),
    };
  }

  if (value.mode === 'mindmap-child') {
    return {
      mode: 'mindmap-child',
      parentId: ensureString(value.parentId, { ...input, field: 'placement.parentId' }),
    };
  }

  if (value.mode === 'mindmap-sibling') {
    return {
      mode: 'mindmap-sibling',
      siblingOf: ensureString(value.siblingOf, { ...input, field: 'placement.siblingOf' }),
      parentId: value.parentId === null
        ? null
        : ensureString(value.parentId, { ...input, field: 'placement.parentId' }),
    };
  }

  throw createActionRoutingBridgeError({
    code: 'NORMALIZATION_FAILED',
    surface: input.surface,
    intent: input.intent,
    details: { field: 'placement.mode' },
  });
}

function buildRenderedNodeId(target: ActionRoutingTargetSnapshot, sourceId: string): string {
  const segments = [
    target.scopeId,
    target.frameScope,
    sourceId,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  return segments.length > 0 ? segments.join('.') : sourceId;
}

function resolveBaseVersion(
  runtime: ActionRoutingRuntimeSnapshot,
  canvasId: string,
  input: { surface: EntryPointSurface; intent: ActionRoutingIntent },
): string {
  const baseVersion = runtime.canvasVersions[canvasId];
  if (typeof baseVersion === 'string' && baseVersion.length > 0) {
    return baseVersion;
  }
  throw createActionRoutingBridgeError({
    code: 'NORMALIZATION_FAILED',
    surface: input.surface,
    intent: input.intent,
    details: { field: 'baseVersion', canvasId },
  });
}

function resolveTargetNode(
  runtime: ActionRoutingRuntimeSnapshot,
  renderedNodeId: string,
  input: { surface: EntryPointSurface; intent: ActionRoutingIntent },
): Node {
  const targetNode = runtime.nodes.find((node) => node.id === renderedNodeId);
  if (targetNode) {
    return targetNode;
  }
  throw createActionRoutingBridgeError({
    code: 'NORMALIZATION_FAILED',
    surface: input.surface,
    intent: input.intent,
    details: { field: 'target.renderedNodeId', renderedNodeId },
  });
}

function resolveEditTarget(
  target: ActionRoutingTargetSnapshot | undefined,
  fallbackCanvasId: string | null,
  input: { surface: EntryPointSurface; intent: ActionRoutingIntent },
): EditTarget {
  const sourceId = ensureString(target?.sourceId, { ...input, field: 'target.sourceId' });
  const canvasId = ensureString(target?.canvasId ?? fallbackCanvasId, { ...input, field: 'target.canvasId' });
  return {
    sourceId,
    canvasId,
    ...(target?.renderedNodeId ? { renderedId: target.renderedNodeId } : {}),
    ...(target?.scopeId ? { scopeId: target.scopeId } : {}),
    ...(target?.frameScope ? { frameScope: target.frameScope } : {}),
    ...(input.intent === 'style-update' || input.intent === 'rename-node'
      ? { editMeta: undefined }
      : {}),
  };
}

function pickNodeDataSnapshot(
  node: Node,
  keys: string[],
): Record<string, unknown> {
  const data = ((node.data || {}) as Record<string, unknown>);
  return keys.reduce<Record<string, unknown>>((acc, key) => {
    if (key in data) {
      acc[key] = data[key];
    }
    return acc;
  }, {});
}

function resolveCanvasId(
  request: ActionRoutingBridgeRequest,
  runtime: ActionRoutingRuntimeSnapshot,
): string {
  return ensureString(
    request.resolvedContext.target?.canvasId
      ?? runtime.currentCanvasId
      ?? (typeof request.uiPayload.canvasId === 'string' ? request.uiPayload.canvasId : undefined),
    {
    surface: request.surface,
    intent: request.intent,
    field: 'canvasId',
  });
}

function normalizeCreateNode(
  request: ActionRoutingBridgeRequest,
  runtime: ActionRoutingRuntimeSnapshot,
): ActionRoutingNormalizedPayload {
  const nodeType = ensureNodeType(request.uiPayload.nodeType, {
    surface: request.surface,
    intent: request.intent,
  });
  const placement = ensurePlacement(request.uiPayload.placement, {
    surface: request.surface,
    intent: request.intent,
  });
  const canvasId = resolveCanvasId(request, runtime);
  const baseVersion = resolveBaseVersion(runtime, canvasId, request);
  const existingSourceIds = runtime.nodes.map((node) => {
    const sourceMeta = (node.data as { sourceMeta?: { sourceId?: unknown } } | undefined)?.sourceMeta;
    return typeof sourceMeta?.sourceId === 'string' ? sourceMeta.sourceId : node.id;
  });
  const nextId = createUniqueNodeId(nodeType, existingSourceIds);
  const defaults = getCreateDefaults(nodeType);
  const target: ActionRoutingTargetSnapshot = {
    canvasId,
    ...(typeof request.uiPayload.scopeId === 'string' ? { scopeId: request.uiPayload.scopeId } : {}),
    ...(typeof request.uiPayload.frameScope === 'string' ? { frameScope: request.uiPayload.frameScope } : {}),
  };
  const editTarget: EditTarget = {
    sourceId: nextId,
    canvasId,
    ...(target.scopeId ? { scopeId: target.scopeId } : {}),
    ...(target.frameScope ? { frameScope: target.frameScope } : {}),
  };
  const renderedId = buildRenderedNodeId(target, nextId);
  const createInput: ActionRoutingCreateNodeInput = {
    id: nextId,
    type: nodeType,
    props: {
      ...(defaults.initialProps ?? {}),
      ...(isRecord(request.uiPayload.initialProps) ? request.uiPayload.initialProps : {}),
      ...(placement.mode === 'canvas-absolute'
        ? { x: placement.x, y: placement.y }
        : placement.mode === 'mindmap-child'
          ? { from: placement.parentId }
          : placement.mode === 'mindmap-sibling' && placement.parentId
            ? { from: placement.parentId }
            : {}),
      ...(defaults.initialContent ? { content: defaults.initialContent } : {}),
    },
    placement,
  };

  return {
    kind: 'create-node',
    commandType: placement.mode === 'canvas-absolute'
      ? 'node.create'
      : placement.mode === 'mindmap-child'
        ? 'mindmap.child.create'
        : 'mindmap.sibling.create',
    editTarget,
    baseVersion,
    nodeType,
    initialProps: defaults.initialProps,
    initialContent: defaults.initialContent,
    placement,
    createInput,
    renderedId,
  };
}

function normalizeRenameNode(
  request: ActionRoutingBridgeRequest,
  runtime: ActionRoutingRuntimeSnapshot,
): ActionRoutingNormalizedPayload {
  const editTarget = resolveEditTarget(
    request.resolvedContext.target,
    runtime.currentCanvasId,
    request,
  );
  const baseVersion = resolveBaseVersion(runtime, editTarget.canvasId ?? runtime.currentCanvasId ?? null, request);
  const nextId = ensureString(request.uiPayload.nextId, {
    surface: request.surface,
    intent: request.intent,
    field: 'nextId',
  });

  return {
    kind: 'rename-node',
    commandType: 'node.rename',
    editTarget: {
      ...editTarget,
      editMeta: request.resolvedContext.editability.editMeta,
    },
    baseVersion,
    previousId: editTarget.sourceId,
    nextId,
  };
}

function normalizeStyleUpdate(
  request: ActionRoutingBridgeRequest,
  runtime: ActionRoutingRuntimeSnapshot,
): ActionRoutingNormalizedPayload {
  const patch = isRecord(request.uiPayload.patch) ? request.uiPayload.patch : null;
  if (!patch || Object.keys(patch).length === 0) {
    throw createActionRoutingBridgeError({
      code: 'NORMALIZATION_FAILED',
      surface: request.surface,
      intent: request.intent,
      details: { field: 'patch' },
    });
  }

  const editTarget = resolveEditTarget(
    request.resolvedContext.target,
    runtime.currentCanvasId,
    request,
  );
  const baseVersion = resolveBaseVersion(runtime, editTarget.canvasId ?? runtime.currentCanvasId ?? null, request);
  const renderedNodeId = ensureString(request.resolvedContext.target?.renderedNodeId, {
    surface: request.surface,
    intent: request.intent,
    field: 'target.renderedNodeId',
  });
  const targetNode = resolveTargetNode(runtime, renderedNodeId, request);
  const previousPatch = pickNodeDataSnapshot(targetNode, Object.keys(patch));

  return {
    kind: 'style-update',
    commandType: 'node.style.update',
    editTarget: {
      ...editTarget,
      renderedId: renderedNodeId,
      editMeta: request.resolvedContext.editability.editMeta,
    },
    baseVersion,
    renderedNodeId,
    patch,
    previousPatch,
    previousNodeData: { ...((targetNode.data || {}) as Record<string, unknown>) },
    targetNode,
  };
}

export function normalizeActionPayload(
  request: ActionRoutingBridgeRequest,
  runtime: ActionRoutingRuntimeSnapshot,
): ActionRoutingNormalizedPayload {
  if (request.intent === 'create-node' || request.intent === 'create-mindmap-child' || request.intent === 'create-mindmap-sibling') {
    return normalizeCreateNode(request, runtime);
  }

  if (request.intent === 'rename-node') {
    return normalizeRenameNode(request, runtime);
  }

  if (request.intent === 'style-update') {
    return normalizeStyleUpdate(request, runtime);
  }

  throw createActionRoutingBridgeError({
    code: 'INVALID_INTENT',
    surface: request.surface,
    intent: request.intent,
  });
}
