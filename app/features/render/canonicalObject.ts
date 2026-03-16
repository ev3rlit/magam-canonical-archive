export type SemanticRole =
  | 'topic'
  | 'shape'
  | 'sticky-note'
  | 'image'
  | 'sticker'
  | 'sequence';

export type ContentKind = 'text' | 'markdown' | 'media' | 'sequence';

export type CanonicalObjectAlias =
  | 'Node'
  | 'Shape'
  | 'Sticky'
  | 'Image'
  | 'Markdown'
  | 'Sticker'
  | 'Sequence';

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
  | 'PATCH_SURFACE_VIOLATION';

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
  filePath?: string;
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

export interface CanonicalObject {
  core: ObjectCore;
  semanticRole: SemanticRole;
  capabilities: CapabilityBag;
  capabilitySources?: Partial<Record<CanonicalCapabilityKey, NormalizationSource>>;
  alias?: CanonicalObjectAlias;
}

export interface ValidationResult {
  ok: boolean;
  code?: CanonicalValidationCode;
  message?: string;
  path?: string;
}

const SEMANTIC_ROLES: readonly SemanticRole[] = [
  'topic',
  'shape',
  'sticky-note',
  'image',
  'sticker',
  'sequence',
];

const CONTENT_KINDS: readonly ContentKind[] = ['text', 'markdown', 'media', 'sequence'];

export function isSemanticRole(value: unknown): value is SemanticRole {
  return typeof value === 'string' && (SEMANTIC_ROLES as readonly string[]).includes(value);
}

export function isContentKind(value: unknown): value is ContentKind {
  return typeof value === 'string' && (CONTENT_KINDS as readonly string[]).includes(value);
}

export function okValidation(): ValidationResult {
  return { ok: true };
}

export function invalidValidation(
  code: CanonicalValidationCode,
  message: string,
  path?: string,
): ValidationResult {
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
