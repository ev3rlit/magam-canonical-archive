import type {
  CanonicalObject,
  CanonicalObjectAlias,
  CanonicalObjectRecord,
  ContentBlock,
  ContentBlocksCarrier,
  ContentCapability,
  PrimaryContentKind,
} from '../canonical-object-contract';
import {
  cloneContentBlocks,
  readContentBlocks,
} from '../canonical-object-contract';

function trimOrEmpty(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function projectTextFromDirectContent(content: ContentCapability | undefined): string {
  if (!content) {
    return '';
  }

  switch (content.kind) {
    case 'text':
      return trimOrEmpty(content.value);
    case 'markdown':
      return trimOrEmpty(content.source);
    case 'media':
      return trimOrEmpty(content.alt) || trimOrEmpty(content.src);
    case 'sequence':
      return [
        ...content.participants.map((participant) => JSON.stringify(participant)),
        ...content.messages.map((message) => JSON.stringify(message)),
      ].join('\n').trim();
    default:
      return '';
  }
}

function projectTextFromBlock(block: ContentBlock): string {
  switch (block.blockType) {
    case 'text':
      return trimOrEmpty(block.text);
    case 'markdown':
      return trimOrEmpty(block.source);
    default:
      return trimOrEmpty(block.textualProjection);
  }
}

export function derivePrimaryContentKind(input: {
  capabilities?: { content?: ContentCapability };
} & ContentBlocksCarrier): PrimaryContentKind {
  const directContent = input.capabilities?.content;
  if (directContent) {
    return directContent.kind;
  }

  const contentBlocks = readContentBlocks(input);
  if (!contentBlocks || contentBlocks.length === 0) {
    return null;
  }

  if (contentBlocks.some((block) => block.blockType === 'markdown')) {
    return 'markdown';
  }

  if (contentBlocks.some((block) => block.blockType === 'text')) {
    return 'text';
  }

  return null;
}

export function deriveCanonicalText(input: {
  capabilities?: { content?: ContentCapability };
} & ContentBlocksCarrier): string {
  const contentBlocks = readContentBlocks(input);
  if (contentBlocks && contentBlocks.length > 0) {
    return contentBlocks
      .map(projectTextFromBlock)
      .filter((value) => value.length > 0)
      .join('\n')
      .trim();
  }

  return projectTextFromDirectContent(input.capabilities?.content);
}

export function toCanonicalObjectRecord(input: {
  canonical: CanonicalObject;
  workspaceId: string;
  publicAlias?: CanonicalObjectAlias;
  extensions?: Record<string, unknown>;
  deletedAt?: string | null;
}): CanonicalObjectRecord {
  const contentBlocks = cloneContentBlocks(readContentBlocks(input.canonical));

  return {
    id: input.canonical.core.id,
    workspaceId: input.workspaceId,
    semanticRole: input.canonical.semanticRole,
    sourceMeta: input.canonical.core.sourceMeta,
    capabilities: input.canonical.capabilities,
    canonicalText: deriveCanonicalText(input.canonical),
    primaryContentKind: derivePrimaryContentKind(input.canonical),
    ...(input.publicAlias || input.canonical.alias ? { publicAlias: input.publicAlias ?? input.canonical.alias } : {}),
    ...(input.canonical.capabilitySources ? { capabilitySources: input.canonical.capabilitySources } : {}),
    ...(contentBlocks ? { contentBlocks } : {}),
    ...(input.extensions ? { extensions: input.extensions } : {}),
    ...(input.deletedAt !== undefined ? { deletedAt: input.deletedAt } : {}),
  };
}

export function fromCanonicalObjectRecord(record: CanonicalObjectRecord): CanonicalObject {
  const contentBlocks = cloneContentBlocks(readContentBlocks(record));

  return {
    core: {
      id: record.id,
      sourceMeta: record.sourceMeta,
    },
    semanticRole: record.semanticRole,
    capabilities: record.capabilities,
    ...(record.capabilitySources ? { capabilitySources: record.capabilitySources } : {}),
    ...(record.publicAlias ? { alias: record.publicAlias } : {}),
    ...(record.primaryContentKind !== undefined ? { primaryContentKind: record.primaryContentKind } : {}),
    ...(contentBlocks ? { contentBlocks } : {}),
  };
}
