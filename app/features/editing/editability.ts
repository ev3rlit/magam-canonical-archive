import type { Node } from 'reactflow';
import {
  deriveCapabilityProfile,
  type CapabilityProfile,
} from '@/features/editing/capabilityProfile';
import type { CanonicalObject } from '@/features/render/canonicalObject';

export type EditCommandType =
  | 'node.move.absolute'
  | 'node.move.relative'
  | 'node.content.update'
  | 'node.style.update'
  | 'node.rename'
  | 'node.create'
  | 'mindmap.child.create'
  | 'mindmap.sibling.create'
  | 'node.reparent';

export type EditFamily =
  | 'canvas-absolute'
  | 'relative-attachment'
  | 'mindmap-member'
  | 'rich-content';

export type EditContentCarrier =
  | 'label-prop'
  | 'text-child'
  | 'markdown-child';

export type EditRelativeCarrier =
  | 'gap'
  | 'at.offset';

export type CreateMode =
  | 'canvas'
  | 'mindmap-child'
  | 'mindmap-sibling';

export interface EditMeta {
  family: EditFamily;
  contentCarrier?: EditContentCarrier;
  relativeCarrier?: EditRelativeCarrier;
  styleEditableKeys: string[];
  createMode?: CreateMode;
  readOnlyReason?: string;
}

type ParsedNodeLike = {
  id?: string;
  type?: string;
  data?: Record<string, unknown>;
};

type NodeDataWithEditMeta = {
  editMeta?: EditMeta;
  canonicalObject?: CanonicalObject;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCanonicalObject(value: unknown): value is CanonicalObject {
  if (!isRecord(value)) {
    return false;
  }

  return isRecord(value.core)
    && typeof value.semanticRole === 'string'
    && isRecord(value.capabilities);
}

const SHAPE_STYLE_KEYS = [
  'color',
  'fill',
  'stroke',
  'fontSize',
  'labelColor',
  'labelFontSize',
  'labelBold',
  'fontFamily',
  'className',
] as const;

const TEXT_STYLE_KEYS = [
  'color',
  'fontSize',
  'fontFamily',
  'className',
] as const;

const MARKDOWN_STYLE_KEYS = [
  'color',
  'fill',
  'stroke',
  'fontSize',
  'fontFamily',
  'className',
  'size',
] as const;

const STICKER_STYLE_KEYS = [
  'outlineColor',
  'outlineWidth',
  'shadow',
  'padding',
  'rotation',
  'fontFamily',
] as const;

const STICKY_STYLE_KEYS = [
  'pattern',
  'shape',
  'fontFamily',
  'className',
] as const;

const WASHI_STYLE_KEYS = [
  'pattern',
  'opacity',
  'texture',
] as const;

const IMAGE_STYLE_KEYS = ['width', 'height', 'fit'] as const;
const SEQUENCE_STYLE_KEYS = ['fontFamily', 'className'] as const;

const NODE_TYPE_STYLE_KEYS: Record<string, readonly string[]> = {
  shape: SHAPE_STYLE_KEYS,
  text: TEXT_STYLE_KEYS,
  markdown: MARKDOWN_STYLE_KEYS,
  sticker: STICKER_STYLE_KEYS,
  sticky: STICKY_STYLE_KEYS,
  'washi-tape': WASHI_STYLE_KEYS,
  image: IMAGE_STYLE_KEYS,
  'sequence-diagram': SEQUENCE_STYLE_KEYS,
};

const JSX_TAG_STYLE_KEYS: Record<string, readonly string[]> = {
  Node: SHAPE_STYLE_KEYS,
  Shape: SHAPE_STYLE_KEYS,
  Text: TEXT_STYLE_KEYS,
  Sticky: [...STICKY_STYLE_KEYS, ...STICKER_STYLE_KEYS],
  Sticker: STICKER_STYLE_KEYS,
  WashiTape: WASHI_STYLE_KEYS,
  Image: IMAGE_STYLE_KEYS,
  Sequence: SEQUENCE_STYLE_KEYS,
};

function isMindMapMember(data: Record<string, unknown> | undefined): boolean {
  return typeof data?.groupId === 'string' && data.groupId.length > 0;
}

function inferContentCarrier(
  nodeType: string | undefined,
  data: Record<string, unknown> | undefined,
): EditContentCarrier | undefined {
  if (nodeType === 'markdown') {
    return 'markdown-child';
  }
  if (nodeType === 'text') {
    return 'text-child';
  }
  if (typeof data?.label === 'string') {
    return 'label-prop';
  }
  return undefined;
}

function inferRelativeCarrier(
  nodeType: string | undefined,
  data: Record<string, unknown> | undefined,
): EditRelativeCarrier | undefined {
  const at = data?.at;
  if (at && typeof at === 'object' && 'offset' in (at as Record<string, unknown>)) {
    return 'at.offset';
  }
  if (
    typeof data?.gap === 'number'
    && (
      typeof data?.anchor === 'string'
      || nodeType === 'sticker'
      || nodeType === 'sticky'
    )
  ) {
    return 'gap';
  }
  return undefined;
}

function inferReadOnlyReason(input: ParsedNodeLike): string | undefined {
  const data = input.data;
  const sourceMeta = data?.sourceMeta;
  if (!sourceMeta || typeof sourceMeta !== 'object') {
    return '원본 sourceMeta를 찾을 수 없습니다.';
  }

  const sourceId = (sourceMeta as { sourceId?: unknown }).sourceId;
  if (typeof sourceId !== 'string' || sourceId.length === 0) {
    return '원본 sourceId를 확인할 수 없습니다.';
  }

  return undefined;
}

export function getNodeTypeStyleEditableKeys(nodeType: string | undefined): string[] {
  if (!nodeType) {
    return [];
  }
  return [...(NODE_TYPE_STYLE_KEYS[nodeType] ?? [])];
}

export function getJsxTagStyleEditableKeys(tagName: string | undefined): string[] {
  if (!tagName) {
    return [];
  }
  return [...(JSX_TAG_STYLE_KEYS[tagName] ?? [])];
}

export function deriveEditMeta(input: ParsedNodeLike): EditMeta {
  const data = input.data;
  const contentCarrier = inferContentCarrier(input.type, data);
  const relativeCarrier = inferRelativeCarrier(input.type, data);
  const groupMember = isMindMapMember(data);

  const family: EditFamily = groupMember
    ? 'mindmap-member'
    : relativeCarrier
      ? 'relative-attachment'
      : contentCarrier
        ? 'rich-content'
        : 'canvas-absolute';

  return {
    family,
    contentCarrier,
    relativeCarrier,
    styleEditableKeys: getNodeTypeStyleEditableKeys(input.type),
    createMode: groupMember ? 'mindmap-child' : 'canvas',
    readOnlyReason: inferReadOnlyReason(input),
  };
}

function deriveFamilyFromCapabilityProfile(
  canonical: CanonicalObject,
  profile: CapabilityProfile,
): EditFamily {
  if (canonical.core.sourceMeta.kind === 'mindmap') {
    return 'mindmap-member';
  }
  if (profile.relativeCarrier) {
    return 'relative-attachment';
  }
  if (profile.contentCarrier) {
    return 'rich-content';
  }
  return 'canvas-absolute';
}

function deriveEditMetaFromCanonical(canonical: CanonicalObject): EditMeta {
  const profile = deriveCapabilityProfile(canonical);
  const family = deriveFamilyFromCapabilityProfile(canonical, profile);

  return {
    family,
    contentCarrier: profile.contentCarrier,
    relativeCarrier: profile.relativeCarrier,
    styleEditableKeys: profile.allowedUpdateKeys,
    createMode: family === 'mindmap-member' ? 'mindmap-child' : 'canvas',
    readOnlyReason: profile.readOnlyReason,
  };
}

export function isCommandAllowed(editMeta: EditMeta | undefined, commandType: EditCommandType): boolean {
  if (!editMeta || editMeta.readOnlyReason) {
    return false;
  }

  if (commandType === 'node.move.absolute') {
    return editMeta.family !== 'mindmap-member' && !editMeta.relativeCarrier;
  }

  if (commandType === 'node.move.relative') {
    return Boolean(editMeta.relativeCarrier);
  }

  if (commandType === 'node.content.update') {
    return Boolean(editMeta.contentCarrier);
  }

  if (commandType === 'node.style.update') {
    return editMeta.styleEditableKeys.length > 0;
  }

  if (commandType === 'node.rename') {
    return true;
  }

  if (commandType === 'node.reparent') {
    return editMeta.family === 'mindmap-member';
  }

  if (commandType === 'mindmap.child.create' || commandType === 'mindmap.sibling.create') {
    return editMeta.family === 'mindmap-member';
  }

  if (commandType === 'node.create') {
    return editMeta.createMode === 'canvas';
  }

  return false;
}

export function pickStylePatch(
  patch: Record<string, unknown>,
  styleEditableKeys: readonly string[],
): {
  allowedPatch: Record<string, unknown>;
  rejectedKeys: string[];
} {
  const allowedKeySet = new Set(styleEditableKeys);
  return Object.entries(patch).reduce<{
    allowedPatch: Record<string, unknown>;
    rejectedKeys: string[];
  }>((acc, [key, value]) => {
    if (allowedKeySet.has(key)) {
      acc.allowedPatch[key] = value;
      return acc;
    }
    acc.rejectedKeys.push(key);
    return acc;
  }, {
    allowedPatch: {},
    rejectedKeys: [],
  });
}

export function getNodeEditMeta(node: Pick<Node, 'data'>): EditMeta | undefined {
  const data = (node.data || {}) as NodeDataWithEditMeta;
  if (isCanonicalObject(data.canonicalObject)) {
    return deriveEditMetaFromCanonical(data.canonicalObject);
  }
  return data.editMeta;
}
