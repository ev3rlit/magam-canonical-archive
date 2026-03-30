import type {
  CanonicalBodyCarrier,
  CanonicalBodyDocument,
} from './canonical-body-document';

export type SemanticRole =
  | 'topic'
  | 'shape'
  | 'sticky-note'
  | 'image'
  | 'sticker'
  | 'sequence';

export type ContentKind = 'text' | 'markdown' | 'media' | 'sequence' | 'document';
export type PrimaryContentKind = ContentKind | null;

export type CanonicalObjectAlias =
  | 'Node'
  | 'Shape'
  | 'Sticky'
  | 'Image'
  | 'Markdown'
  | 'Sticker'
  | 'Sequence';

export type EditableNoteAlias = Extract<CanonicalObjectAlias, 'Node' | 'Sticky'>;
export type EditableNoteSemanticRole = Extract<SemanticRole, 'topic' | 'sticky-note'>;

export type NormalizationSource = 'explicit' | 'legacy-inferred' | 'alias-default';

export type CanonicalValidationCode =
  | 'INVALID_OBJECT_CORE'
  | 'INVALID_ALIAS_ROLE_BINDING'
  | 'INVALID_CAPABILITY'
  | 'INVALID_CAPABILITY_PAYLOAD'
  | 'CONTENT_CONTRACT_VIOLATION'
  | 'INVALID_CONTENT_ROLE_BINDING'
  | 'LEGACY_INFERENCE_FAILED'
  | 'RENDER_ROUTE_UNRESOLVED'
  | 'PATCH_SURFACE_VIOLATION'
  | 'SOURCE_PROVENANCE_MISSING'
  | 'CANONICAL_OBJECT_ID_CONFLICT'
  | 'INVALID_CANONICAL_ROLE'
  | 'INVALID_CONTENT_BLOCK'
  | 'INVALID_CUSTOM_BLOCK_TYPE'
  | 'CONTENT_BODY_CONFLICT'
  | 'EDITABLE_OBJECT_REQUIRES_CLONE';

export interface ObjectCorePosition {
  x?: number;
  y?: number;
}

export interface ObjectCoreRelations {
  from?: unknown;
  to?: unknown;
  anchor?: unknown;
}

export interface ObjectCoreSourceMeta {
  sourceId: string;
  scopeId?: string;
  kind?: 'canvas' | 'mindmap';
  renderedId?: string;
  frameScope?: string;
  framePath?: string[];
  [key: string]: unknown;
}

export interface ObjectCore {
  id: string;
  position?: ObjectCorePosition;
  relations?: ObjectCoreRelations;
  children?: unknown[];
  className?: string;
  sourceMeta: ObjectCoreSourceMeta;
}

export interface TextContentCapability {
  kind: 'text';
  value: string;
  fontSize?: number | string;
}

export interface MarkdownContentCapability {
  kind: 'markdown';
  source: string;
  size?: unknown;
}

export interface MediaContentCapability {
  kind: 'media';
  src: string;
  alt?: string;
  fit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  width?: number;
  height?: number;
}

export interface SequenceContentCapability {
  kind: 'sequence';
  participants: unknown[];
  messages: unknown[];
}

export type ContentCapability =
  | TextContentCapability
  | MarkdownContentCapability
  | MediaContentCapability
  | SequenceContentCapability;

export type CoreContentBlockType = 'text' | 'markdown';
export type NamespacedCustomBlockType = `${string}.${string}`;
export type ContentBlockType = CoreContentBlockType | NamespacedCustomBlockType;

export interface TextContentBlock {
  id: string;
  blockType: 'text';
  text: string;
}

export interface MarkdownContentBlock {
  id: string;
  blockType: 'markdown';
  source: string;
}

export interface CustomContentBlock {
  id: string;
  blockType: NamespacedCustomBlockType;
  payload: Record<string, unknown>;
  textualProjection?: string;
  metadata?: Record<string, unknown>;
}

export type ContentBlock = TextContentBlock | MarkdownContentBlock | CustomContentBlock;

export interface ContentBlocksCarrier {
  contentBlocks?: ContentBlock[];
  content_blocks?: ContentBlock[];
}

export interface FrameCapability {
  shape?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface MaterialCapability {
  preset?: string;
  pattern?: unknown;
}

export interface TextureCapability {
  noiseOpacity?: number;
  glossOpacity?: number;
  texture?: unknown;
}

export interface AttachCapability {
  target?: string;
  position?: string;
  offset?: number;
}

export interface PortsCapability {
  ports: unknown[];
}

export interface BubbleCapability {
  bubble: boolean;
}

export interface CapabilityBag {
  frame?: FrameCapability;
  material?: MaterialCapability;
  texture?: TextureCapability;
  attach?: AttachCapability;
  ports?: PortsCapability;
  bubble?: BubbleCapability;
  content?: ContentCapability;
}

export type CanonicalCapabilityKey = keyof CapabilityBag;

export interface CanonicalObject extends ContentBlocksCarrier, CanonicalBodyCarrier {
  core: ObjectCore;
  semanticRole: SemanticRole;
  capabilities: CapabilityBag;
  capabilitySources?: Partial<Record<CanonicalCapabilityKey, NormalizationSource>>;
  alias?: CanonicalObjectAlias;
  primaryContentKind?: PrimaryContentKind;
}

export interface CanonicalObjectRecord extends ContentBlocksCarrier, CanonicalBodyCarrier {
  id: string;
  workspaceId: string;
  semanticRole: SemanticRole;
  sourceMeta: ObjectCoreSourceMeta;
  capabilities: CapabilityBag;
  canonicalText: string;
  primaryContentKind?: PrimaryContentKind;
  publicAlias?: CanonicalObjectAlias;
  capabilitySources?: Partial<Record<CanonicalCapabilityKey, NormalizationSource>>;
  extensions?: Record<string, unknown>;
  deletedAt?: string | null;
}

export interface ValidationSuccess {
  ok: true;
}

export interface ValidationFailure {
  ok: false;
  code?: CanonicalValidationCode;
  message?: string;
  path?: string;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

export const SEMANTIC_ROLES: readonly SemanticRole[] = [
  'topic',
  'shape',
  'sticky-note',
  'image',
  'sticker',
  'sequence',
];

export const CONTENT_KINDS: readonly ContentKind[] = ['text', 'markdown', 'media', 'sequence', 'document'];
export const CORE_CONTENT_BLOCK_TYPES: readonly CoreContentBlockType[] = ['text', 'markdown'];
export const EDITABLE_NOTE_ALIASES: readonly EditableNoteAlias[] = ['Node', 'Sticky'];
export const EDITABLE_NOTE_SEMANTIC_ROLES: readonly EditableNoteSemanticRole[] = [
  'topic',
  'sticky-note',
];
export const EDITABLE_NOTE_CLONE_MODE = 'clone-on-create' as const;
export type EditableNoteCloneMode = typeof EDITABLE_NOTE_CLONE_MODE;

export function isSemanticRole(value: unknown): value is SemanticRole {
  return typeof value === 'string' && (SEMANTIC_ROLES as readonly string[]).includes(value);
}

export function isContentKind(value: unknown): value is ContentKind {
  return typeof value === 'string' && (CONTENT_KINDS as readonly string[]).includes(value);
}

export function isEditableNoteAlias(value: unknown): value is EditableNoteAlias {
  return typeof value === 'string' && (EDITABLE_NOTE_ALIASES as readonly string[]).includes(value);
}

export function isCoreContentBlockType(value: unknown): value is CoreContentBlockType {
  return typeof value === 'string' && (CORE_CONTENT_BLOCK_TYPES as readonly string[]).includes(value);
}

export function isNamespacedCustomBlockType(value: unknown): value is NamespacedCustomBlockType {
  return typeof value === 'string' && /^[A-Za-z0-9_-]+(?:[.-][A-Za-z0-9_-]+)*\.[A-Za-z0-9_-]+(?:[.-][A-Za-z0-9_-]+)*$/.test(value);
}

export function readContentBlocks(
  carrier: ContentBlocksCarrier,
): ContentBlocksCarrier['contentBlocks'] | undefined {
  if (Array.isArray(carrier.contentBlocks)) {
    return carrier.contentBlocks;
  }

  if (Array.isArray(carrier.content_blocks)) {
    return carrier.content_blocks;
  }

  return undefined;
}

export function cloneContentBlocks(
  contentBlocks: readonly ContentBlock[] | undefined,
): ContentBlock[] | undefined {
  if (!contentBlocks) {
    return undefined;
  }

  return contentBlocks.map((block): ContentBlock => {
    if (block.blockType === 'text' || block.blockType === 'markdown') {
      return { ...block };
    }

    return {
      ...block,
      payload: { ...block.payload },
      ...(block.metadata ? { metadata: { ...block.metadata } } : {}),
    };
  });
}

export function cloneCanonicalBody(
  body: CanonicalBodyDocument | undefined,
): CanonicalBodyDocument | undefined {
  if (!body) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(body)) as CanonicalBodyDocument;
}

export function okValidation(): ValidationSuccess {
  return { ok: true };
}

export function invalidValidation(
  code: CanonicalValidationCode,
  message: string,
  path?: string,
): ValidationFailure {
  return { ok: false, code, message, path };
}

export function validateObjectCore(core: unknown): ValidationResult {
  if (!core || typeof core !== 'object') {
    return invalidValidation('INVALID_OBJECT_CORE', 'Object core must be an object.');
  }

  const value = core as Partial<ObjectCore>;
  if (typeof value.id !== 'string' || value.id.length === 0) {
    return invalidValidation('INVALID_OBJECT_CORE', 'Object core requires a non-empty id.', 'core.id');
  }

  if (!value.sourceMeta || typeof value.sourceMeta !== 'object') {
    return invalidValidation(
      'INVALID_OBJECT_CORE',
      'Object core requires sourceMeta.',
      'core.sourceMeta',
    );
  }

  if (
    typeof (value.sourceMeta as Partial<ObjectCoreSourceMeta>).sourceId !== 'string'
    || (value.sourceMeta as Partial<ObjectCoreSourceMeta>).sourceId?.length === 0
  ) {
    return invalidValidation(
      'INVALID_OBJECT_CORE',
      'Object core requires sourceMeta.sourceId.',
      'core.sourceMeta.sourceId',
    );
  }

  return okValidation();
}
