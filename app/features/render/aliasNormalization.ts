import {
  type CapabilityBag,
  type CanonicalCapabilityKey,
  type CanonicalObject,
  type CanonicalObjectAlias,
  type CanonicalValidationCode,
  type ContentCapability,
  type ContentKind,
  type FrameCapability,
  type NormalizationSource,
  type ObjectCore,
  type SemanticRole,
  type ValidationFailure,
  type ValidationResult,
  invalidValidation,
  isContentKind,
  okValidation,
  validateObjectCore,
} from './canonicalObject';
import { validateCapabilityBag } from './capabilityRegistry';

type UnknownRecord = Record<string, unknown>;

type LegacyChild = {
  type?: string;
  props?: UnknownRecord;
  children?: unknown;
};

const ALIAS_ROLE_MAP: Readonly<Record<CanonicalObjectAlias, SemanticRole>> = {
  Node: 'topic',
  Shape: 'shape',
  Sticky: 'sticky-note',
  Image: 'image',
  Markdown: 'topic',
  Sticker: 'sticker',
  Sequence: 'sequence',
};

const ALLOWED_CAPABILITY_KEYS = new Set<CanonicalCapabilityKey>([
  'frame',
  'material',
  'texture',
  'attach',
  'ports',
  'bubble',
  'content',
]);

const SHAPE_TYPES = new Set([
  'rectangle',
  'ellipse',
  'diamond',
  'line',
  'heart',
  'cloud',
  'speech',
]);

const ALIAS_ALLOWED_CONTENT_KINDS: Readonly<Record<CanonicalObjectAlias, ReadonlyArray<ContentKind>>> = {
  Node: ['text', 'markdown'],
  Shape: ['text'],
  Sticky: ['text'],
  Image: ['media'],
  Markdown: ['markdown'],
  Sticker: ['text'],
  Sequence: ['sequence'],
};

const ALIAS_DEFAULT_CAPABILITIES: Readonly<Record<CanonicalObjectAlias, Partial<CanonicalObject['capabilities']>>> = {
  Node: {},
  Shape: {
    frame: {
      shape: 'rectangle',
    },
  },
  Sticky: {
    material: { preset: 'postit' },
    texture: {},
    attach: {},
  },
  Image: {
    content: {
      kind: 'media',
      src: '',
    },
  },
  Markdown: {
    content: {
      kind: 'markdown',
      source: '',
    },
  },
  Sticker: {
    frame: {
      shape: 'rectangle',
    },
  },
  Sequence: {
    content: {
      kind: 'sequence',
      participants: [],
      messages: [],
    },
  },
};

interface RawAliasNormalizationInput {
  alias: unknown;
  core: ObjectCore;
  explicitCapabilities?: unknown;
  legacyProps?: UnknownRecord;
  legacyChildren?: readonly unknown[];
  expectedRole?: SemanticRole;
}

export interface CanonicalAliasInput {
  alias: CanonicalObjectAlias;
  core: ObjectCore;
  explicitCapabilities?: Partial<CanonicalObject['capabilities']>;
  legacyProps?: UnknownRecord;
  legacyChildren?: readonly unknown[];
  expectedRole?: SemanticRole;
}

export interface LegacyCapabilityInferenceInput {
  alias: CanonicalObjectAlias;
  legacyProps?: UnknownRecord;
  legacyChildren?: readonly unknown[];
}

export interface LegacyCapabilityInferenceSuccess {
  ok: true;
  capabilities: Partial<CanonicalObject['capabilities']>;
  sources: Partial<Record<CanonicalCapabilityKey, NormalizationSource>>;
}

export interface LegacyCapabilityInferenceFailure {
  ok: false;
  code: CanonicalValidationCode;
  message: string;
  path: string;
}

export type LegacyCapabilityInferenceResult = LegacyCapabilityInferenceSuccess | LegacyCapabilityInferenceFailure;

export interface CanonicalAliasNormalizationSuccess {
  ok: true;
  canonical: CanonicalObject;
}

export type CanonicalAliasNormalizationResult = CanonicalAliasNormalizationSuccess | ValidationFailure;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function normalizeAliasValue(alias: unknown): CanonicalObjectAlias | null {
  if (!isString(alias)) {
    return null;
  }
  if (alias in ALIAS_ROLE_MAP) {
    return alias as CanonicalObjectAlias;
  }
  return null;
}

function asLegacyChildren(children: readonly unknown[] | undefined): readonly LegacyChild[] {
  return (children ?? []).map((item) => (isRecord(item) ? item as LegacyChild : { type: undefined }));
}

function readString(value: unknown): string | undefined {
  return isString(value) && value.trim().length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function extractTextLike(legacyProps: UnknownRecord): string | undefined {
  return readString(legacyProps.text) || readString(legacyProps.label) || readString((legacyProps as { value?: unknown }).value);
}

function extractMarkdownTextFromChildren(children: readonly LegacyChild[]): string | undefined {
  for (const child of children) {
    if (child.type === 'graph-markdown') {
      const source = readString(child.props?.content);
      if (source !== undefined) {
        return source;
      }
    }
  }
  return undefined;
}

function extractMarkdownFromLegacyChildren(children: readonly LegacyChild[]): string | undefined {
  return extractMarkdownTextFromChildren(children);
}

function extractMarkdownForSequenceAlias(legacyProps: UnknownRecord, children: readonly LegacyChild[]): string | undefined {
  return readString(legacyProps.content) || readString(legacyProps.source) || extractMarkdownFromLegacyChildren(children);
}

function extractTextFromLegacyChildren(
  children: readonly LegacyChild[],
  joiner = '',
): string | undefined {
  const textParts: string[] = [];

  const visit = (items: readonly LegacyChild[]) => {
    for (const child of items) {
      if (child.type === 'text') {
        const text = readString(child.props?.text);
        if (text !== undefined) {
          textParts.push(text);
        }
        continue;
      }

      if (child.type === 'graph-text') {
        visit(asLegacyChildren(Array.isArray(child.children) ? child.children : undefined));
      }
    }
  };

  visit(children);
  return textParts.length > 0 ? textParts.join(joiner) : undefined;
}

function buildTextContent(value: string): ContentCapability {
  return {
    kind: 'text',
    value,
  };
}

function buildMarkdownContent(source: string): ContentCapability {
  return {
    kind: 'markdown',
    source,
  };
}

function buildMediaContentFromLegacy(
  legacyProps: UnknownRecord,
): ContentCapability | undefined {
  const src = readString(legacyProps.src);
  if (!src) {
    return undefined;
  }

  const alt = readString(legacyProps.alt);
  const fit =
    legacyProps.fit === 'cover'
    || legacyProps.fit === 'contain'
    || legacyProps.fit === 'fill'
    || legacyProps.fit === 'none'
    || legacyProps.fit === 'scale-down'
      ? legacyProps.fit
      : undefined;

  return {
    kind: 'media',
    src,
    ...(alt !== undefined ? { alt } : {}),
    ...(fit !== undefined ? { fit } : {}),
    ...(readNumber(legacyProps.width) !== undefined ? { width: readNumber(legacyProps.width) } : {}),
    ...(readNumber(legacyProps.height) !== undefined ? { height: readNumber(legacyProps.height) } : {}),
  };
}

function buildSequencePayloadFromLegacy(
  legacyProps: UnknownRecord,
  children: readonly LegacyChild[],
): { participants: unknown[]; messages: unknown[] } | null {
  const participantsFromProps =
    Array.isArray(legacyProps.participants)
      ? legacyProps.participants
      : [];

  const messagesFromProps = Array.isArray(legacyProps.messages) ? legacyProps.messages : [];

  const participantsFromChildren: unknown[] = [];
  const messagesFromChildren: unknown[] = [];

  for (const child of children) {
    if (child.type === 'graph-participant') {
      if (!child.props) {
        continue;
      }
      const id = readString(child.props.id);
      if (id) {
        participantsFromChildren.push({
          id,
          label: readString(child.props.label) || id,
          className: readString(child.props.className),
        });
      }
    }

    if (child.type === 'graph-message') {
      if (!child.props) {
        continue;
      }
      const from = readString(child.props.from);
      const to = readString(child.props.to);
      if (!from || !to) {
        continue;
      }
      messagesFromChildren.push({
        from,
        to,
        label: readString(child.props.label),
        type:
          child.props.type === 'async'
          || child.props.type === 'reply'
          || child.props.type === 'self'
          || child.props.type === 'sync'
            ? child.props.type
            : 'sync',
      });
    }
  }

  const hasExplicitPayload =
    Array.isArray(legacyProps.participants)
    || Array.isArray(legacyProps.messages);

  const participants = hasExplicitPayload ? participantsFromProps : participantsFromChildren;
  const messages = hasExplicitPayload ? messagesFromProps : messagesFromChildren;

  if (participants.length === 0 && messages.length === 0) {
    return null;
  }

  return {
    participants,
    messages,
  };
}

function inferAliasDefaults(alias: CanonicalObjectAlias): Partial<CanonicalObject['capabilities']> {
  return {
    ...ALIAS_DEFAULT_CAPABILITIES[alias],
  };
}

export function inferLegacyCapabilities(input: LegacyCapabilityInferenceInput): LegacyCapabilityInferenceResult {
  const alias = input.alias;
  const legacyProps = input.legacyProps ?? {};
  const legacyChildren = asLegacyChildren(input.legacyChildren);

  const inferred: Partial<CanonicalObject['capabilities']> = {};
  const sources: Partial<Record<CanonicalCapabilityKey, NormalizationSource>> = {};
  const recordConflictFailure = (
    code: CanonicalValidationCode,
    message: string,
    path: string,
  ): LegacyCapabilityInferenceFailure => ({
    ok: false,
    code,
    message,
    path,
  });

  const attachFromAt = readString(legacyProps.target)
    || readString(legacyProps.position)
    || readString(legacyProps.targetAnchor);

  switch (alias) {
    case 'Node': {
      const markdown = extractMarkdownFromLegacyChildren(legacyChildren);
      const text = extractTextLike(legacyProps) || extractTextFromLegacyChildren(legacyChildren, '\n');
      if (markdown !== undefined) {
        inferred.content = buildMarkdownContent(markdown);
        sources.content = 'legacy-inferred';
      } else if (text !== undefined) {
        inferred.content = buildTextContent(text);
        sources.content = 'legacy-inferred';
      }

      return { ok: true, capabilities: inferred, sources };
    }

    case 'Shape': {
      const text = extractTextLike(legacyProps) || extractTextFromLegacyChildren(legacyChildren);
      const frame: Partial<FrameCapability> = {};
      const legacyShape = readString(legacyProps.type);
      const shapeValue = SHAPE_TYPES.has(legacyShape ?? '') ? legacyShape : undefined;
      const fill = readString(legacyProps.fill);
      const stroke = readString(legacyProps.stroke);
      const strokeWidth = readNumber(legacyProps.strokeWidth);

      if (shapeValue !== undefined) {
        frame.shape = shapeValue;
      }
      if (fill !== undefined) {
        frame.fill = fill;
      }
      if (stroke !== undefined) {
        frame.stroke = stroke;
      }
      if (strokeWidth !== undefined) {
        frame.strokeWidth = strokeWidth;
      }

      if (Object.keys(frame).length > 0) {
        inferred.frame = {
          ...(frame.shape !== undefined ? { shape: frame.shape } : {}),
          ...(frame.fill !== undefined ? { fill: frame.fill } : {}),
          ...(frame.stroke !== undefined ? { stroke: frame.stroke } : {}),
          ...(frame.strokeWidth !== undefined ? { strokeWidth: frame.strokeWidth } : {}),
        };
        sources.frame = 'legacy-inferred';
      }

      if (text !== undefined) {
        inferred.content = buildTextContent(text);
        sources.content = 'legacy-inferred';
      }

      return { ok: true, capabilities: inferred, sources };
    }

    case 'Sticky': {
      const text = extractTextLike(legacyProps) || extractTextFromLegacyChildren(legacyChildren);
      if (text !== undefined) {
        inferred.content = buildTextContent(text);
        sources.content = 'legacy-inferred';
      }

      const frame: Partial<FrameCapability> = {};
      const legacyShape = readString(legacyProps.shape);
      const shapeValue = SHAPE_TYPES.has(legacyShape ?? '') ? legacyShape : undefined;
      const fill = readString(legacyProps.fill);
      const stroke = readString(legacyProps.stroke);
      const strokeWidth = readNumber(legacyProps.strokeWidth);

      if (shapeValue !== undefined) frame.shape = shapeValue;
      if (fill !== undefined) frame.fill = fill;
      if (stroke !== undefined) frame.stroke = stroke;
      if (strokeWidth !== undefined) frame.strokeWidth = strokeWidth;
      if (Object.keys(frame).length > 0) {
        inferred.frame = {
          ...(frame.shape !== undefined ? { shape: frame.shape as string } : {}),
          ...(frame.fill !== undefined ? { fill: frame.fill as string } : {}),
          ...(frame.stroke !== undefined ? { stroke: frame.stroke as string } : {}),
          ...(frame.strokeWidth !== undefined ? { strokeWidth: frame.strokeWidth as number } : {}),
        };
        sources.frame = 'legacy-inferred';
      }

      if (legacyProps.pattern !== undefined) {
        inferred.material = { pattern: legacyProps.pattern };
        sources.material = 'legacy-inferred';
      }

      if (legacyProps.texture !== undefined) {
        inferred.texture = { texture: legacyProps.texture };
        sources.texture = 'legacy-inferred';
      }

      if (attachFromAt !== undefined) {
        inferred.attach = { target: attachFromAt, position: readString(legacyProps.position), offset: readNumber(legacyProps.offset) };
        sources.attach = 'legacy-inferred';
      }

      return { ok: true, capabilities: inferred, sources };
    }

    case 'Image': {
      const markdown = extractMarkdownFromLegacyChildren(legacyChildren);
      const text = extractTextLike(legacyProps);
      const media = buildMediaContentFromLegacy(legacyProps);

      if ((markdown !== undefined || text !== undefined) && media !== undefined) {
        return recordConflictFailure(
          'CONTENT_CONTRACT_VIOLATION',
          'Image alias legacy input contains mixed media and non-media content sources.',
          'capabilities.content',
        );
      }

      if (media === undefined && (text !== undefined || markdown !== undefined)) {
        return recordConflictFailure(
          'CONTENT_CONTRACT_VIOLATION',
          'Image alias legacy input requires media-style fields (src/alt/fit).',
          'capabilities.content',
        );
      }

      if (media !== undefined) {
        inferred.content = media;
        sources.content = 'legacy-inferred';
      }

      return { ok: true, capabilities: inferred, sources };
    }

    case 'Markdown': {
      const markdown = extractMarkdownForSequenceAlias(legacyProps, legacyChildren);
      if (markdown === undefined) {
        return { ok: true, capabilities: inferred, sources };
      }

      const text = extractTextLike(legacyProps);
      if (text !== undefined) {
        return recordConflictFailure(
          'CONTENT_CONTRACT_VIOLATION',
          'Markdown alias legacy input mixes text and markdown content sources.',
          'capabilities.content',
        );
      }

      inferred.content = buildMarkdownContent(markdown);
      sources.content = 'legacy-inferred';
      return { ok: true, capabilities: inferred, sources };
    }

    case 'Sticker': {
      const text = extractTextLike(legacyProps) || extractTextFromLegacyChildren(legacyChildren, ' ');
      if (text !== undefined) {
        inferred.content = buildTextContent(text);
        sources.content = 'legacy-inferred';
      }

      const outlineWidth = readNumber(legacyProps.outlineWidth);
      const outlineColor = readString(legacyProps.outlineColor);
      const shadow =
        readString(legacyProps.shadow) === 'none'
        || readString(legacyProps.shadow) === 'sm'
        || readString(legacyProps.shadow) === 'md'
        || readString(legacyProps.shadow) === 'lg'
          ? readString(legacyProps.shadow)
          : undefined;

      const frame: Partial<FrameCapability> = {};
      const legacyShape = readString(legacyProps.type);
      const shapeValue = SHAPE_TYPES.has(legacyShape ?? '') ? legacyShape : undefined;
      const fill = readString(legacyProps.fill);
      const stroke = readString(legacyProps.stroke);
      const strokeWidth = readNumber(legacyProps.strokeWidth);

      if (shapeValue !== undefined) frame.shape = shapeValue;
      if (fill !== undefined) frame.fill = fill;
      if (stroke !== undefined) frame.stroke = stroke;
      if (strokeWidth !== undefined) frame.strokeWidth = strokeWidth;
      if (Object.keys(frame).length > 0) {
        inferred.frame = {
          ...(shapeValue !== undefined ? { shape: shapeValue as string } : {}),
          ...(fill !== undefined ? { fill } : {}),
          ...(stroke !== undefined ? { stroke } : {}),
          ...(strokeWidth !== undefined ? { strokeWidth } : {}),
        };
        sources.frame = 'legacy-inferred';
      }

      if (legacyProps.pattern !== undefined) {
        inferred.material = { pattern: legacyProps.pattern };
        sources.material = 'legacy-inferred';
      }

      if (readBoolean(legacyProps.bubble) === true) {
        inferred.bubble = { bubble: true };
        sources.bubble = 'legacy-inferred';
      }

      if (outlineWidth !== undefined || outlineColor !== undefined || shadow !== undefined) {
        inferred.content = inferred.content ?? buildTextContent(readString(legacyProps.label) || '');
        sources.content = sources.content ?? 'legacy-inferred';
      }

      return { ok: true, capabilities: inferred, sources };
    }

    case 'Sequence': {
      const markdown = extractMarkdownFromLegacyChildren(legacyChildren);
      const text = extractTextLike(legacyProps);
      if (text !== undefined || markdown !== undefined) {
        return {
          ok: false,
          code: 'CONTENT_CONTRACT_VIOLATION',
          message: 'Sequence alias legacy input cannot infer text/markdown content.',
          path: 'capabilities.content',
        };
      }

      const sequencePayload = buildSequencePayloadFromLegacy(legacyProps, legacyChildren);
      if (sequencePayload !== null) {
        inferred.content = {
          kind: 'sequence',
          participants: sequencePayload.participants,
          messages: sequencePayload.messages,
        };
        sources.content = 'legacy-inferred';
      }

      const frameShape = readString(legacyProps.type);
      if (SHAPE_TYPES.has(frameShape ?? '')) {
        inferred.frame = { shape: frameShape as string };
        sources.frame = 'legacy-inferred';
      }

      return { ok: true, capabilities: inferred, sources };
    }

    default: {
        return {
          ok: false,
          code: 'LEGACY_INFERENCE_FAILED',
          message: `Unsupported alias for legacy inference: ${alias}`,
          path: 'alias',
        };
      }
  }
}

function validateExplicitCapabilities(
  capabilities: unknown,
): ValidationFailure | null {
  if (capabilities === undefined) {
    return null;
  }

  if (!isRecord(capabilities)) {
    return invalidValidation('INVALID_CAPABILITY', 'explicit capabilities must be an object.', 'capabilities');
  }

  const unknownKeys = Object.keys(capabilities).filter((key) => !ALLOWED_CAPABILITY_KEYS.has(key as CanonicalCapabilityKey));
  if (unknownKeys.length > 0) {
    return invalidValidation(
      'INVALID_CAPABILITY',
      `invalid capability key(s): ${unknownKeys.join(', ')}`,
      'capabilities',
    );
  }

  return null;
}

function normalizeCapabilityMap(
  capabilities: UnknownRecord | undefined,
): Partial<CanonicalObject['capabilities']> {
  if (capabilities === undefined) {
    return {};
  }
  return capabilities as Partial<CanonicalObject['capabilities']>;
}

function applyCapabilityLayer(
  target: Partial<CanonicalObject['capabilities']>,
  sources: Partial<Record<CanonicalCapabilityKey, NormalizationSource>>,
  layer: Partial<CanonicalObject['capabilities']>,
  source: NormalizationSource,
) {
  const typedTarget = target as CapabilityBag;
  for (const [rawKey, value] of Object.entries(layer)) {
    const key = rawKey as CanonicalCapabilityKey;
    if (value === undefined) {
      continue;
    }
    switch (key) {
      case 'frame': {
        typedTarget.frame = isRecord(typedTarget.frame) && isRecord(value)
          ? { ...typedTarget.frame, ...value }
          : value as CapabilityBag['frame'];
        break;
      }
      case 'material': {
        typedTarget.material = isRecord(typedTarget.material) && isRecord(value)
          ? { ...typedTarget.material, ...value }
          : value as CapabilityBag['material'];
        break;
      }
      case 'texture': {
        typedTarget.texture = isRecord(typedTarget.texture) && isRecord(value)
          ? { ...typedTarget.texture, ...value }
          : value as CapabilityBag['texture'];
        break;
      }
      case 'attach': {
        typedTarget.attach = isRecord(typedTarget.attach) && isRecord(value)
          ? { ...typedTarget.attach, ...value }
          : value as CapabilityBag['attach'];
        break;
      }
      case 'ports': {
        typedTarget.ports = value as CapabilityBag['ports'];
        break;
      }
      case 'bubble': {
        typedTarget.bubble = value as CapabilityBag['bubble'];
        break;
      }
      case 'content': {
        typedTarget.content = value as CapabilityBag['content'];
        break;
      }
      default: {
        break;
      }
    }
    sources[key] = source;
  }
}

function validateAliasContentBinding(
  alias: CanonicalObjectAlias,
  capabilities: CanonicalObject['capabilities'],
): ValidationResult {
  if (capabilities.content === undefined) {
    return okValidation();
  }

  const content = capabilities.content as ContentCapability;
  if (!isContentKind(content.kind)) {
    return invalidValidation(
      'CONTENT_CONTRACT_VIOLATION',
      `content.kind must be one of text|markdown|media|sequence.`,
      'capabilities.content',
    );
  }

  const allowedKinds = ALIAS_ALLOWED_CONTENT_KINDS[alias];
  if (!allowedKinds.includes(content.kind)) {
    return invalidValidation(
      'CONTENT_CONTRACT_VIOLATION',
      `alias "${alias}" only supports content kind ${allowedKinds.join('|')}.`,
      'capabilities.content',
    );
  }

  return okValidation();
}

function mergeCapabilityLayers(
  aliasDefaults: Partial<CanonicalObject['capabilities']>,
  legacyInferred: Partial<CanonicalObject['capabilities']>,
  explicit: Partial<CanonicalObject['capabilities']>,
) {
  const merged: Partial<CanonicalObject['capabilities']> = {};
  const sources: Partial<Record<CanonicalCapabilityKey, NormalizationSource>> = {};

  applyCapabilityLayer(merged, sources, aliasDefaults, 'alias-default');
  applyCapabilityLayer(merged, sources, legacyInferred, 'legacy-inferred');
  applyCapabilityLayer(merged, sources, explicit, 'explicit');

  return { capabilities: merged, capabilitySources: sources };
}

export function getCanonicalRoleForAlias(alias: CanonicalObjectAlias): SemanticRole {
  return ALIAS_ROLE_MAP[alias];
}

export function normalizeAliasToCanonicalObject(
  input: CanonicalAliasInput,
): CanonicalAliasNormalizationResult {
  const explicitFailure = validateExplicitCapabilities(input.explicitCapabilities);
  if (explicitFailure !== null) {
    return explicitFailure;
  }

  const resolvedAlias = normalizeAliasValue(input.alias);
  if (resolvedAlias === null) {
    return {
      ok: false,
      code: 'INVALID_ALIAS_ROLE_BINDING',
      message: `unsupported alias: ${String(input.alias)}`,
      path: 'alias',
    };
  }

  const coreValidation = validateObjectCore(input.core);
  if (!coreValidation.ok) {
    return coreValidation;
  }

  const semanticRole = getCanonicalRoleForAlias(resolvedAlias);
  if (input.expectedRole !== undefined && input.expectedRole !== semanticRole) {
    return {
      ok: false,
      code: 'INVALID_ALIAS_ROLE_BINDING',
      message: `alias "${resolvedAlias}" maps to semantic role "${semanticRole}" but got "${input.expectedRole}".`,
      path: 'semanticRole',
    };
  }

  const legacy = inferLegacyCapabilities({
    alias: resolvedAlias,
    legacyProps: input.legacyProps ?? {},
    legacyChildren: input.legacyChildren,
  });

  if (!legacy.ok) {
    return legacy;
  }

  const merged = mergeCapabilityLayers(
    inferAliasDefaults(resolvedAlias),
    legacy.capabilities,
    normalizeCapabilityMap(input.explicitCapabilities as UnknownRecord | undefined),
  );

  const capabilityValidation = validateCapabilityBag(merged.capabilities);
  if (!capabilityValidation.ok) {
    return capabilityValidation;
  }

  const aliasBinding = validateAliasContentBinding(resolvedAlias, merged.capabilities);
  if (!aliasBinding.ok) {
    return aliasBinding;
  }

  return {
    ok: true,
    canonical: {
      core: input.core,
      semanticRole,
      alias: resolvedAlias,
      capabilities: merged.capabilities,
      ...(Object.keys(merged.capabilitySources).length > 0
        ? { capabilitySources: merged.capabilitySources }
        : {}),
    },
  };
}

const buildAliasNormalizationInput = (
  input: RawAliasNormalizationInput,
): CanonicalAliasInput | ValidationFailure => {
  const legacyProps = input.legacyProps ?? {};
  if (!isRecord(legacyProps)) {
    return invalidValidation('INVALID_ALIAS_ROLE_BINDING', 'legacyProps must be an object.', 'legacyProps');
  }

  return {
    alias: normalizeAliasValue(input.alias) as CanonicalObjectAlias,
    core: input.core,
    explicitCapabilities: input.explicitCapabilities as Partial<CanonicalObject['capabilities']> | undefined,
    legacyProps,
    legacyChildren: input.legacyChildren,
    expectedRole: input.expectedRole,
  };
};

export function createCanonicalFromLegacyAliasInput(input: RawAliasNormalizationInput): CanonicalAliasNormalizationResult {
  const normalized = buildAliasNormalizationInput(input);
  if ('ok' in normalized) {
    return normalized;
  }

  const result = normalizeAliasToCanonicalObject(normalized);
  if (result.ok) {
    result.canonical.alias = normalized.alias;
  }

  return result;
}
