import type { ContentBlock } from '../../../libs/shared/src';
import { RPC_ERRORS } from '../rpc';

function getPathBasename(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/\/+$/, '');
  const segments = normalized.split('/');
  return segments[segments.length - 1] || '';
}

function isAbsoluteLocalPath(value: string): boolean {
  return /^(?:[a-zA-Z]:[\\/]|\/)/.test(value);
}

export interface NodeProps {
  id?: string;
  groupId?: string | null;
  from?: string | { node: string; edge?: Record<string, unknown> };
  to?: string;
  anchor?: string;
  position?: string;
  gap?: number;
  content?: string;
  x?: number;
  y?: number;
  zIndex?: number | null;
  width?: number;
  height?: number;
  pattern?: Record<string, unknown>;
  at?: Record<string, unknown>;
  shape?: 'rectangle' | 'heart' | 'cloud' | 'speech';
  [key: string]: unknown;
}

export interface CreateNodeInput {
  id: string;
  type:
    | 'shape'
    | 'rectangle'
    | 'ellipse'
    | 'diamond'
    | 'line'
    | 'text'
    | 'markdown'
    | 'mindmap'
    | 'sticky'
    | 'sticker'
    | 'washi-tape'
    | 'image';
  props?: Record<string, unknown>;
  placement?: (
    | { mode: 'canvas-absolute'; x: number; y: number }
    | { mode: 'mindmap-root'; x: number; y: number; mindmapId: string }
    | { mode: 'mindmap-child'; parentId: string }
    | { mode: 'mindmap-sibling'; siblingOf: string; parentId: string | null }
  );
}

export interface RpcContext {
  ws: unknown;
  subscriptions: Set<string>;
  notifyCanvasChanged?: (payload: {
    canvasId: string;
    canvasRevision: number;
    originId: string;
    commandId: string;
    rootPath?: string;
  }) => void;
}

export type RpcHandler = (
  params: Record<string, unknown>,
  ctx: RpcContext,
) => Promise<unknown>;

export type RpcMethodRegistry = Record<string, RpcHandler>;

export type UpdateCommandType =
  | 'node.move.relative'
  | 'node.content.update'
  | 'node.style.update'
  | 'node.rename'
  | 'node.group.update'
  | 'node.z-order.update';

export function sanitizeWorkspaceId(targetDir: string): string {
  const base = getPathBasename(targetDir).trim() || 'workspace';
  const sanitized = base
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized || 'workspace';
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function ensureString(value: unknown, fieldName: string): string {
  if (!value || typeof value !== 'string') {
    throw { ...RPC_ERRORS.INVALID_PARAMS, data: `${fieldName} is required` };
  }
  return value;
}

export function ensureOptionalString(
  value: unknown,
  fieldName: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw { ...RPC_ERRORS.INVALID_PARAMS, data: `${fieldName} must be a string` };
  }
  return value;
}

export function ensureOptionalRootPath(
  value: unknown,
  fieldName: string,
): string | undefined {
  const rootPath = ensureOptionalString(value, fieldName);
  if (rootPath === undefined) {
    return undefined;
  }

  const trimmed = rootPath.trim();
  if (!trimmed) {
    throw { ...RPC_ERRORS.INVALID_PARAMS, data: `${fieldName} must not be empty` };
  }
  if (!isAbsoluteLocalPath(trimmed)) {
    throw { ...RPC_ERRORS.INVALID_PARAMS, data: `${fieldName} must be an absolute path` };
  }

  return trimmed.replace(/\\/g, '/');
}

export function ensureNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw { ...RPC_ERRORS.INVALID_PARAMS, data: `${fieldName} must be a number` };
  }
  return value;
}

export function ensureRecord(
  value: unknown,
  fieldName: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw { ...RPC_ERRORS.INVALID_PARAMS, data: `${fieldName} must be an object` };
  }
  return value;
}

export function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

export function ensureOptionalUpdateCommandType(
  value: unknown,
): UpdateCommandType | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    value === 'node.move.relative'
    || value === 'node.content.update'
    || value === 'node.style.update'
    || value === 'node.rename'
    || value === 'node.group.update'
    || value === 'node.z-order.update'
  ) {
    return value;
  }
  throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'commandType is invalid' };
}

function isOffsetOnlyAtPatch(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.length === 1
    && keys[0] === 'offset'
    && typeof (value as Record<string, unknown>).offset === 'number';
}

export function inferUpdateCommandType(
  props: NodeProps,
  explicitType?: UpdateCommandType,
): UpdateCommandType | undefined {
  if (explicitType) {
    return explicitType;
  }

  const keys = Object.keys(props);
  if (keys.length === 1 && typeof props.id === 'string') {
    return 'node.rename';
  }
  if (keys.length === 1 && typeof props.content === 'string') {
    return 'node.content.update';
  }
  if (keys.length === 1 && 'groupId' in props) {
    return 'node.group.update';
  }
  if (keys.length === 1 && typeof props.zIndex === 'number') {
    return 'node.z-order.update';
  }
  if (keys.length === 1 && typeof props.gap === 'number') {
    return 'node.move.relative';
  }
  if (keys.length === 1 && isOffsetOnlyAtPatch(props.at)) {
    return 'node.move.relative';
  }
  return undefined;
}

export function ensureCreatePlacement(
  value: unknown,
): CreateNodeInput['placement'] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== 'object') {
    throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'node.placement is invalid' };
  }

  const placement = value as Record<string, unknown>;
  const mode = placement.mode;
  if (mode === 'canvas-absolute') {
    return {
      mode,
      x: ensureNumber(placement.x, 'node.placement.x'),
      y: ensureNumber(placement.y, 'node.placement.y'),
    };
  }
  if (mode === 'mindmap-root') {
    return {
      mode,
      x: ensureNumber(placement.x, 'node.placement.x'),
      y: ensureNumber(placement.y, 'node.placement.y'),
      mindmapId: ensureString(placement.mindmapId, 'node.placement.mindmapId'),
    };
  }
  if (mode === 'mindmap-child') {
    return {
      mode,
      parentId: ensureString(placement.parentId, 'node.placement.parentId'),
    };
  }
  if (mode === 'mindmap-sibling') {
    return {
      mode,
      siblingOf: ensureString(placement.siblingOf, 'node.placement.siblingOf'),
      parentId: placement.parentId === null
        ? null
        : ensureOptionalString(placement.parentId, 'node.placement.parentId') ?? null,
    };
  }

  throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'node.placement.mode is invalid' };
}

export function ensureContentBlock(value: unknown): ContentBlock {
  const input = ensureRecord(value, 'block');
  const id = ensureString(input.id, 'block.id');
  const blockType = ensureString(input.blockType, 'block.blockType');

  if (blockType === 'markdown') {
    return {
      id,
      blockType: 'markdown',
      source: typeof input.source === 'string' ? input.source : '',
    };
  }

  if (blockType === 'text') {
    return {
      id,
      blockType: 'text',
      text: typeof input.text === 'string' ? input.text : '',
    };
  }

  if (
    !/^[A-Za-z0-9_-]+(?:[.-][A-Za-z0-9_-]+)*\.[A-Za-z0-9_-]+(?:[.-][A-Za-z0-9_-]+)*$/.test(
      blockType,
    )
  ) {
    throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'block.blockType is invalid' };
  }

  return {
    id,
    blockType: blockType as Extract<
      ContentBlock,
      { payload: Record<string, unknown> }
    >['blockType'],
    payload: input.payload && typeof input.payload === 'object'
      ? input.payload as Record<string, unknown>
      : {},
    ...(typeof input.textualProjection === 'string'
      ? { textualProjection: input.textualProjection }
      : {}),
    ...(input.metadata && typeof input.metadata === 'object'
      ? { metadata: input.metadata as Record<string, unknown> }
      : {}),
  };
}

export function toRuntimeBodyBlock(block: ContentBlock): {
  blockId: string;
  kind: 'paragraph' | 'callout' | 'custom';
  props: Record<string, unknown>;
} {
  if (block.blockType === 'text') {
    return {
      blockId: block.id,
      kind: 'paragraph',
      props: {
        text: block.text,
      },
    };
  }

  if (block.blockType === 'markdown') {
    return {
      blockId: block.id,
      kind: 'callout',
      props: {
        source: block.source,
        text: block.source,
      },
    };
  }

  return {
    blockId: block.id,
    kind: 'custom',
    props: {
      ...(block.payload ?? {}),
      ...(block.textualProjection ? { textualProjection: block.textualProjection } : {}),
      ...(block.metadata ? { metadata: block.metadata } : {}),
    },
  };
}

export function toLegacyBodyBlock(
  block:
    | ReturnType<typeof toRuntimeBodyBlock>
    | { blockId: string; kind: string; props: Record<string, unknown> },
): {
  blockType: string;
  source?: string;
  text?: string;
  payload?: Record<string, unknown>;
} {
  if (block.kind === 'paragraph') {
    return {
      blockType: 'text',
      text: typeof block.props.text === 'string' ? block.props.text : '',
    };
  }

  if (block.kind === 'callout') {
    return {
      blockType: 'markdown',
      source: typeof block.props.source === 'string' ? block.props.source : '',
    };
  }

  return {
    blockType: 'runtime.custom',
    payload: block.props,
  };
}

export function toRuntimeNodeKind(nodeType: string): 'node' | 'sticker' {
  return nodeType === 'sticker' ? 'sticker' : 'node';
}

export function toRuntimeNodeType(nodeType: string): string {
  return nodeType === 'mindmap' ? 'shape' : nodeType;
}
