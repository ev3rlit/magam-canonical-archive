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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ensureRecord(value: unknown, message: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw cliError('INVALID_JSON_INPUT', message);
  }

  return value;
}

function toSingleBlock(
  blockType: 'text' | 'markdown',
  patch: Record<string, unknown>,
  existingId: string,
): ContentBlock {
  if (blockType === 'text') {
    const text = typeof patch['value'] === 'string'
      ? patch['value']
      : typeof patch['text'] === 'string'
        ? patch['text']
        : '';
    return {
      id: existingId,
      blockType: 'text',
      text,
    };
  }

  const source = typeof patch['source'] === 'string'
    ? patch['source']
    : typeof patch['value'] === 'string'
      ? patch['value']
      : '';

  return {
    id: existingId,
    blockType: 'markdown',
    source,
  };
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

  if (kind === 'text' || kind === 'markdown') {
    const existingBlocks = cloneContentBlocks(readContentBlocks(record)) ?? [];
    const firstBlockId = existingBlocks[0]?.id ?? 'body-1';
    delete next.capabilities.content;
    next.contentBlocks = Array.isArray(patch['contentBlocks'])
      ? cloneContentBlocks(patch['contentBlocks'] as ContentBlock[]) ?? []
      : [toSingleBlock(kind, patch, firstBlockId)];
  } else {
    next.capabilities.content = toDirectContent(kind, patch);
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
  blocks: ContentBlock[];
}): CanonicalObjectRecord {
  const next: CanonicalObjectRecord = {
    ...input.record,
    capabilities: {
      ...input.record.capabilities,
    },
    contentBlocks: cloneContentBlocks(input.blocks) ?? [],
  };
  delete next.capabilities.content;
  return withNormalizedContent(input.record, next);
}

export function applyObjectBodyBlockInsert(input: {
  record: CanonicalObjectRecord;
  block: ContentBlock;
  index?: number;
  afterBlockId?: string;
}): CanonicalObjectRecord {
  const blocks = cloneContentBlocks(readContentBlocks(input.record)) ?? [];
  const anchorIndex = typeof input.afterBlockId === 'string'
    ? blocks.findIndex((block) => block.id === input.afterBlockId)
    : -1;
  const index = typeof input.index === 'number'
    ? Math.max(0, Math.min(input.index, blocks.length))
    : anchorIndex >= 0
      ? anchorIndex + 1
      : blocks.length;
  blocks.splice(index, 0, cloneContentBlocks([input.block])![0]);
  return applyObjectBodyReplace({
    record: input.record,
    blocks,
  });
}

export function applyObjectBodyBlockUpdate(input: {
  record: CanonicalObjectRecord;
  blockId: string;
  patch: Record<string, unknown>;
}): CanonicalObjectRecord {
  const blocks = cloneContentBlocks(readContentBlocks(input.record)) ?? [];
  const index = blocks.findIndex((block) => block.id === input.blockId);
  if (index < 0) {
    throw cliError('INVALID_ARGUMENT', `Content block ${input.blockId} was not found.`, {
      details: { blockId: input.blockId },
    });
  }

  const current = blocks[index];
  if (current.blockType === 'text') {
    blocks[index] = {
      ...current,
      ...(typeof input.patch['text'] === 'string' ? { text: input.patch['text'] } : {}),
    };
  } else if (current.blockType === 'markdown') {
    blocks[index] = {
      ...current,
      ...(typeof input.patch['source'] === 'string' ? { source: input.patch['source'] } : {}),
    };
  } else {
    blocks[index] = {
      ...current,
      ...(isRecord(input.patch['payload']) ? { payload: input.patch['payload'] } : {}),
      ...(typeof input.patch['textualProjection'] === 'string' ? { textualProjection: input.patch['textualProjection'] } : {}),
      ...(isRecord(input.patch['metadata']) ? { metadata: input.patch['metadata'] } : {}),
    };
  }

  return applyObjectBodyReplace({
    record: input.record,
    blocks,
  });
}

export function applyObjectBodyBlockRemove(input: {
  record: CanonicalObjectRecord;
  blockId: string;
}): CanonicalObjectRecord {
  const blocks = (cloneContentBlocks(readContentBlocks(input.record)) ?? [])
    .filter((block) => block.id !== input.blockId);
  return applyObjectBodyReplace({
    record: input.record,
    blocks,
  });
}

export function applyObjectBodyBlockReorder(input: {
  record: CanonicalObjectRecord;
  blockId: string;
  toIndex: number;
}): CanonicalObjectRecord {
  const blocks = cloneContentBlocks(readContentBlocks(input.record)) ?? [];
  const index = blocks.findIndex((block) => block.id === input.blockId);
  if (index < 0) {
    throw cliError('INVALID_ARGUMENT', `Content block ${input.blockId} was not found.`, {
      details: { blockId: input.blockId },
    });
  }

  const [block] = blocks.splice(index, 1);
  const toIndex = Math.max(0, Math.min(input.toIndex, blocks.length));
  blocks.splice(toIndex, 0, block);
  return applyObjectBodyReplace({
    record: input.record,
    blocks,
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
