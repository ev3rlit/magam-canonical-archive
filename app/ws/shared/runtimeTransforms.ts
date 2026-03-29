import type {
  CanvasRuntimeCommandV1,
} from '../../../libs/shared/src/lib/canvas-runtime';
import type { ContentBlock } from '../../../libs/shared/src';
import {
  isRecord,
  toRuntimeNodeKind,
  toRuntimeNodeType,
  type CreateNodeInput,
  type NodeProps,
} from './params';

type RuntimeCreateCommand = Extract<CanvasRuntimeCommandV1, { name: 'canvas.node.create' }>;
type RuntimeContentUpdateCommand = Extract<CanvasRuntimeCommandV1, { name: 'object.content.update' }>;
type RuntimeBodyBlockInsertCommand = Extract<CanvasRuntimeCommandV1, { name: 'object.body.block.insert' }>;
type RuntimePresentationStylePatch = NonNullable<RuntimeCreateCommand['presentationStyle']>;

export type RuntimeContentKind = RuntimeContentUpdateCommand['kind'];

export function resolveSourceNodeId(node: { id: string; data?: unknown }): string {
  const data = isRecord(node.data) ? node.data : {};
  const runtimeEditing = isRecord(data.runtimeEditing) ? data.runtimeEditing : null;
  if (typeof runtimeEditing?.nodeId === 'string' && runtimeEditing.nodeId.length > 0) {
    return runtimeEditing.nodeId;
  }

  const sourceMeta = isRecord(data.sourceMeta) ? data.sourceMeta : null;
  if (typeof sourceMeta?.sourceId === 'string' && sourceMeta.sourceId.length > 0) {
    return sourceMeta.sourceId;
  }

  return node.id;
}

export function resolveCanonicalObjectId(node: { id: string; data?: unknown }): string | null {
  const data = isRecord(node.data) ? node.data : {};
  const runtimeEditing = isRecord(data.runtimeEditing) ? data.runtimeEditing : null;
  if (
    typeof runtimeEditing?.canonicalObjectId === 'string'
    && runtimeEditing.canonicalObjectId.length > 0
  ) {
    return runtimeEditing.canonicalObjectId;
  }

  const canonicalObject = isRecord(data.canonicalObject) ? data.canonicalObject : null;
  const core = canonicalObject && isRecord(canonicalObject.core) ? canonicalObject.core : null;
  if (typeof core?.id === 'string' && core.id.length > 0) {
    return core.id;
  }

  return null;
}

export function normalizeRuntimeContentKind(
  kind: unknown,
  fallbackNodeType?: string,
): RuntimeContentKind {
  if (
    kind === 'text'
    || kind === 'markdown'
    || kind === 'media'
    || kind === 'sequence'
    || kind === 'document'
  ) {
    return kind;
  }
  return fallbackNodeType === 'text' ? 'text' : 'markdown';
}

export function resolveRuntimeContentKind(node: {
  type?: string;
  data?: unknown;
}): RuntimeContentKind {
  const data = isRecord(node.data) ? node.data : {};
  const canonicalObject = isRecord(data.canonicalObject) ? data.canonicalObject : null;
  const capabilities = canonicalObject && isRecord(canonicalObject.capabilities)
    ? canonicalObject.capabilities
    : null;
  const content = capabilities && isRecord(capabilities.content)
    ? capabilities.content
    : null;
  return normalizeRuntimeContentKind(content?.kind, node.type);
}

export function buildRuntimePresentationStylePatch(
  props: Record<string, unknown>,
): RuntimePresentationStylePatch {
  return {
    ...(typeof props.fill === 'string' ? { fillColor: props.fill } : {}),
    ...(typeof props.stroke === 'string' ? { strokeColor: props.stroke } : {}),
    ...(typeof props.strokeWidth === 'number' ? { strokeWidth: props.strokeWidth } : {}),
    ...(typeof props.opacity === 'number' ? { opacity: props.opacity } : {}),
    ...(typeof props.color === 'string' ? { textColor: props.color } : {}),
    ...(typeof props.fontFamily === 'string' ? { fontFamily: props.fontFamily } : {}),
    ...(typeof props.fontSize === 'number' ? { fontSize: props.fontSize } : {}),
  };
}

export function buildRuntimeContentUpdateCommand(input: {
  objectId: string;
  kind: RuntimeContentKind;
  content: string;
}): RuntimeContentUpdateCommand {
  return {
    name: 'object.content.update',
    objectId: input.objectId,
    kind: input.kind,
    patch: input.kind === 'text'
      ? { text: input.content, value: input.content }
      : { source: input.content, value: input.content },
    expectedContentKind: input.kind,
  };
}

export function toRuntimeCreatePlacement(
  placement: CreateNodeInput['placement'] | Record<string, unknown> | undefined,
  input?: {
    fallbackMindmapId?: string;
    generateId?: () => string;
  },
): RuntimeCreateCommand['placement'] {
  const value = placement ?? {};
  if (!isRecord(value)) {
    throw new Error('INVALID_RUNTIME_CREATE_PLACEMENT');
  }
  const raw = value as Record<string, unknown>;

  if (raw.mode === 'mindmap-child' && typeof raw.parentId === 'string') {
    return {
      mode: 'mindmap-child',
      parentNodeId: raw.parentId,
    };
  }

  if (raw.mode === 'mindmap-sibling' && typeof raw.siblingOf === 'string') {
    return {
      mode: 'mindmap-sibling',
      siblingOfNodeId: raw.siblingOf,
      parentNodeId: raw.parentId === null
        ? null
        : typeof raw.parentId === 'string'
          ? raw.parentId
          : null,
    };
  }

  if (raw.mode === 'mindmap-root' && typeof raw.x === 'number' && typeof raw.y === 'number') {
    return {
      mode: 'mindmap-root',
      x: raw.x,
      y: raw.y,
      mindmapId: typeof raw.mindmapId === 'string' && raw.mindmapId.length > 0
        ? raw.mindmapId
          : input?.fallbackMindmapId
          ?? (input?.generateId ? `mindmap-${input.generateId()}` : 'mindmap-runtime'),
    };
  }

  if (typeof raw.x === 'number' && typeof raw.y === 'number') {
    return {
      mode: 'canvas-absolute',
      x: raw.x,
      y: raw.y,
    };
  }

  throw new Error('INVALID_RUNTIME_CREATE_PLACEMENT');
}

export function buildCanvasNodeCreateCommand(input: {
  canvasId: string;
  nodeId: string;
  nodeType: string;
  props?: Record<string, unknown>;
  placement: CreateNodeInput['placement'] | Record<string, unknown> | undefined;
  fallbackMindmapId?: string;
  generateId?: () => string;
}): RuntimeCreateCommand {
  const props = input.props ?? {};
  return {
    name: 'canvas.node.create',
    canvasId: input.canvasId,
    nodeId: input.nodeId,
    kind: toRuntimeNodeKind(input.nodeType),
    nodeType: toRuntimeNodeType(input.nodeType),
    placement: toRuntimeCreatePlacement(input.placement, {
      fallbackMindmapId: input.fallbackMindmapId,
      generateId: input.generateId,
    }),
    transform: {
      ...(typeof props.width === 'number' ? { width: props.width } : {}),
      ...(typeof props.height === 'number' ? { height: props.height } : {}),
    },
    presentationStyle: buildRuntimePresentationStylePatch(props),
  };
}

export function toRuntimeBodyBlock(
  block: Record<string, unknown> | ContentBlock,
  input?: { generateId?: () => string },
): RuntimeBodyBlockInsertCommand['block'] {
  const blockId = typeof block.id === 'string'
    ? block.id
    : input?.generateId
      ? input.generateId()
      : 'runtime-block';
  if (block.blockType === 'text') {
    return {
      blockId,
      kind: 'paragraph',
      props: {
        text: typeof block.text === 'string' ? block.text : '',
      },
    };
  }

  if (block.blockType === 'markdown') {
    return {
      blockId,
      kind: 'callout',
      props: {
        source: typeof block.source === 'string' ? block.source : '',
        ...(typeof block.source === 'string' ? { text: block.source } : {}),
      },
    };
  }

  return {
    blockId,
    kind: 'custom',
    props: {
      ...(isRecord((block as { payload?: unknown }).payload)
        ? (block as { payload: Record<string, unknown> }).payload
        : {}),
      ...(typeof (block as { textualProjection?: unknown }).textualProjection === 'string'
        ? { textualProjection: (block as { textualProjection: string }).textualProjection }
        : {}),
      ...(isRecord((block as { metadata?: unknown }).metadata)
        ? { metadata: (block as { metadata: Record<string, unknown> }).metadata }
        : {}),
    },
  };
}

export function buildObjectBodyBlockInsertCommand(input: {
  objectId: string;
  sourceNodeId?: string;
  block: Record<string, unknown> | ContentBlock;
  afterBlockId?: string;
  generateId?: () => string;
}): RuntimeBodyBlockInsertCommand {
  return {
    name: 'object.body.block.insert',
    objectId: input.objectId,
    block: toRuntimeBodyBlock(input.block, {
      generateId: input.generateId,
    }),
    position: input.afterBlockId
      ? {
          mode: 'anchor',
          anchorId: `node:${input.sourceNodeId ?? input.objectId}:body-after:${input.afterBlockId}`,
        }
      : { mode: 'end' },
  };
}

export function asNodePropsRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function asNodeStyleProps(value: NodeProps): Record<string, unknown> {
  return value as Record<string, unknown>;
}
