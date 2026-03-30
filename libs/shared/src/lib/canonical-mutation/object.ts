import type {
  CanonicalCapabilityKey,
  CanonicalObjectRecord,
  ContentBlock,
  ContentKind,
  ContentCapability,
  MediaContentCapability,
} from '../canonical-object-contract';
import { cloneContentBlocks, readContentBlocks } from '../canonical-object-contract';
import { cliError, persistenceFailureToCliError } from '../canonical-cli';
import { deriveCanonicalText, derivePrimaryContentKind } from '../canonical-persistence/mappers';
import { validateCanonicalObjectRecord } from '../canonical-persistence/validators';
import {
  CANONICAL_BODY_SCHEMA_VERSION,
  contentBlocksToCanonicalBody,
  contentCapabilityToCanonicalBody,
  createBodyImageNode,
  createBodyParagraphNode,
  createCanonicalBodyDocument,
  insertTopLevelBodyNode,
  markdownToCanonicalBody,
  readCanonicalBody,
  removeTopLevelBodyNode,
  reorderTopLevelBodyNode,
  replaceTopLevelBodyNode,
  type CanonicalBodyDocument,
  type CanonicalBodyNode,
} from '../canonical-body-document';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ensureRecord(value: unknown, message: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw cliError('INVALID_JSON_INPUT', message);
  }

  return value;
}

function toDirectContent(kind: Exclude<ContentKind, 'text' | 'markdown'>, patch: Record<string, unknown>): ContentCapability {
  if (kind === 'media') {
    const fit = typeof patch['fit'] === 'string'
      && ['cover', 'contain', 'fill', 'none', 'scale-down'].includes(patch['fit'])
      ? patch['fit'] as MediaContentCapability['fit']
      : undefined;
    return {
      kind: 'media',
      src: typeof patch['src'] === 'string' ? patch['src'] : '',
      ...(typeof patch['alt'] === 'string' ? { alt: patch['alt'] } : {}),
      ...(fit ? { fit } : {}),
      ...(typeof patch['width'] === 'number' ? { width: patch['width'] } : {}),
      ...(typeof patch['height'] === 'number' ? { height: patch['height'] } : {}),
    };
  }

  return {
    kind: 'sequence',
    participants: Array.isArray(patch['participants']) ? patch['participants'] : [],
    messages: Array.isArray(patch['messages']) ? patch['messages'] : [],
  };
}

function resolveBody(record: CanonicalObjectRecord): CanonicalBodyDocument {
  const existing = readCanonicalBody(record);
  if (existing) {
    return existing;
  }

  const contentBlocks = cloneContentBlocks(readContentBlocks(record));
  if (contentBlocks && contentBlocks.length > 0) {
    return contentBlocksToCanonicalBody(contentBlocks);
  }

  if (record.capabilities.content) {
    return contentCapabilityToCanonicalBody(record.capabilities.content) ?? createCanonicalBodyDocument();
  }

  return createCanonicalBodyDocument();
}

function toBodyNodeFromLegacyBlock(block: ContentBlock): CanonicalBodyNode {
  if (block.blockType === 'text') {
    return createBodyParagraphNode(block.text);
  }

  if (block.blockType === 'markdown') {
    return markdownToCanonicalBody(block.source).content[0] ?? createBodyParagraphNode();
  }

  const payload = isRecord(block.payload) ? block.payload : {};
  if (block.blockType.includes('image')) {
    return createBodyImageNode({
      src: typeof payload['src'] === 'string' ? payload['src'] : '',
      alt: typeof payload['alt'] === 'string' ? payload['alt'] : '',
    });
  }

  return createBodyParagraphNode(typeof block.textualProjection === 'string' ? block.textualProjection : '');
}

function applyLegacyPatchToBodyNode(
  current: CanonicalBodyNode,
  patch: Record<string, unknown>,
): CanonicalBodyNode {
  if (typeof patch['source'] === 'string') {
    return markdownToCanonicalBody(patch['source']).content[0] ?? createBodyParagraphNode();
  }

  if (typeof patch['text'] === 'string' || typeof patch['value'] === 'string') {
    const text = typeof patch['text'] === 'string' ? patch['text'] : patch['value'] as string;
    if (current.type === 'heading') {
      return {
        type: 'heading',
        ...(current.attrs ? { attrs: { ...current.attrs } } : { attrs: { level: 1 } }),
        content: text.length > 0 ? [{ type: 'text', text }] : [],
      };
    }
    return createBodyParagraphNode(text);
  }

  if (current.type === 'image') {
    return {
      type: 'image',
      attrs: {
        ...(current.attrs ?? {}),
        ...(typeof patch['src'] === 'string' ? { src: patch['src'] } : {}),
        ...(typeof patch['alt'] === 'string' ? { alt: patch['alt'] } : {}),
      },
    };
  }

  return current;
}

function applyDocumentPatch(patch: Record<string, unknown>): CanonicalBodyDocument {
  if (patch['body'] && typeof patch['body'] === 'object') {
    return patch['body'] as CanonicalBodyDocument;
  }

  if (typeof patch['value'] === 'string') {
    return createCanonicalBodyDocument([createBodyParagraphNode(patch['value'])]);
  }

  return createCanonicalBodyDocument();
}

function commitNextRecord(
  previous: CanonicalObjectRecord,
  next: CanonicalObjectRecord,
): CanonicalObjectRecord {
  const validation = validateCanonicalObjectRecord(next);
  if (!validation.ok) {
    throw persistenceFailureToCliError(validation);
  }

  return {
    ...previous,
    ...validation.value,
  };
}

function withNormalizedContent(
  previous: CanonicalObjectRecord,
  next: CanonicalObjectRecord,
): CanonicalObjectRecord {
  const normalized: CanonicalObjectRecord = {
    ...next,
    primaryContentKind: derivePrimaryContentKind(next),
    canonicalText: deriveCanonicalText(next),
  };

  return commitNextRecord(previous, normalized);
}

export function applyObjectContentUpdate(input: {
  record: CanonicalObjectRecord;
  kind: ContentKind;
  patch: Record<string, unknown>;
}): CanonicalObjectRecord {
  const { record, kind, patch } = input;
  const next: CanonicalObjectRecord = {
    ...record,
    capabilities: { ...record.capabilities },
  };

  if (kind === 'document' || kind === 'text' || kind === 'markdown') {
    delete next.capabilities.content;
    delete next.contentBlocks;
    delete next.content_blocks;
    next.body = kind === 'document'
      ? applyDocumentPatch(patch)
      : kind === 'text'
        ? createCanonicalBodyDocument([
            createBodyParagraphNode(
              typeof patch['value'] === 'string'
                ? patch['value']
                : typeof patch['text'] === 'string'
                  ? patch['text']
                  : '',
            ),
          ])
        : markdownToCanonicalBody(
            typeof patch['source'] === 'string'
              ? patch['source']
              : typeof patch['value'] === 'string'
                ? patch['value']
                : '',
          );
    next.bodySchemaVersion = CANONICAL_BODY_SCHEMA_VERSION;
  } else {
    next.capabilities.content = toDirectContent(kind, patch);
    delete next.body;
    delete next.bodySchemaVersion;
    delete next.contentBlocks;
    delete next.content_blocks;
  }

  return withNormalizedContent(record, next);
}

export function applyObjectCapabilityPatch(input: {
  record: CanonicalObjectRecord;
  capability: CanonicalCapabilityKey;
  patch: Record<string, unknown> | null;
}): CanonicalObjectRecord {
  const { record, capability, patch } = input;
  if (capability === 'content') {
    throw cliError('PATCH_SURFACE_VIOLATION', 'Use object.content.update for content patches.', {
      details: { capability },
    });
  }

  const next: CanonicalObjectRecord = {
    ...record,
    capabilities: { ...record.capabilities },
  };

  if (patch === null) {
    delete next.capabilities[capability];
  } else {
    next.capabilities = {
      ...next.capabilities,
      [capability]: {
        ...(isRecord(next.capabilities[capability]) ? next.capabilities[capability] as Record<string, unknown> : {}),
        ...patch,
      },
    };
  }

  return withNormalizedContent(record, next);
}

export function applyObjectBodyReplace(input: {
  record: CanonicalObjectRecord;
  body: CanonicalBodyDocument;
}): CanonicalObjectRecord {
  const next: CanonicalObjectRecord = {
    ...input.record,
    capabilities: {
      ...input.record.capabilities,
    },
    body: input.body,
    bodySchemaVersion: CANONICAL_BODY_SCHEMA_VERSION,
  };
  delete next.capabilities.content;
  delete next.contentBlocks;
  delete next.content_blocks;
  return withNormalizedContent(input.record, next);
}

export function applyObjectBodyBlockInsert(input: {
  record: CanonicalObjectRecord;
  block: ContentBlock;
  index?: number;
  afterBlockId?: string;
}): CanonicalObjectRecord {
  const body = resolveBody(input.record);
  const anchorIndex = typeof input.afterBlockId === 'string'
    ? Number.parseInt(input.afterBlockId.replace(/^body-/, ''), 10) - 1
    : -1;
  const index = typeof input.index === 'number'
    ? Math.max(0, Math.min(input.index, body.content.length))
    : anchorIndex >= 0
      ? anchorIndex + 1
      : body.content.length;
  return applyObjectBodyReplace({
    record: input.record,
    body: insertTopLevelBodyNode(body, index, toBodyNodeFromLegacyBlock(input.block)),
  });
}

export function applyObjectBodyBlockUpdate(input: {
  record: CanonicalObjectRecord;
  blockId: string;
  patch: Record<string, unknown>;
}): CanonicalObjectRecord {
  const body = resolveBody(input.record);
  const index = Number.parseInt(input.blockId.replace(/^body-/, ''), 10) - 1;
  if (index < 0 || index >= body.content.length) {
    throw cliError('INVALID_ARGUMENT', `Content block ${input.blockId} was not found.`, {
      details: { blockId: input.blockId },
    });
  }

  return applyObjectBodyReplace({
    record: input.record,
    body: replaceTopLevelBodyNode(body, index, applyLegacyPatchToBodyNode(body.content[index]!, input.patch)),
  });
}

export function applyObjectBodyBlockRemove(input: {
  record: CanonicalObjectRecord;
  blockId: string;
}): CanonicalObjectRecord {
  const body = resolveBody(input.record);
  const index = Number.parseInt(input.blockId.replace(/^body-/, ''), 10) - 1;
  return applyObjectBodyReplace({
    record: input.record,
    body: removeTopLevelBodyNode(body, index),
  });
}

export function applyObjectBodyBlockReorder(input: {
  record: CanonicalObjectRecord;
  blockId: string;
  toIndex: number;
}): CanonicalObjectRecord {
  const body = resolveBody(input.record);
  const index = Number.parseInt(input.blockId.replace(/^body-/, ''), 10) - 1;
  if (index < 0 || index >= body.content.length) {
    throw cliError('INVALID_ARGUMENT', `Content block ${input.blockId} was not found.`, {
      details: { blockId: input.blockId },
    });
  }
  return applyObjectBodyReplace({
    record: input.record,
    body: reorderTopLevelBodyNode(body, index, input.toIndex),
  });
}

export function normalizeObjectContentPatch(patch: unknown): Record<string, unknown> {
  return ensureRecord(patch, 'Object content patch must be a JSON object.');
}

export function normalizeCapabilityPatch(
  capability: string,
  patch: unknown,
): Record<string, unknown> | null {
  if (patch === null) {
    return null;
  }

  if (!isRecord(patch)) {
    throw cliError('INVALID_JSON_INPUT', `Capability patch for ${capability} must be a JSON object or null.`);
  }

  return patch;
}
