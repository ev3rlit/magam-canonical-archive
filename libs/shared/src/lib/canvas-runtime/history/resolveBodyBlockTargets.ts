import { readContentBlocks } from '../../canonical-object-contract';
import {
  contentBlocksToCanonicalBody,
  contentCapabilityToCanonicalBody,
  getBodyBlockIdAtIndex,
  getTopLevelBodyNodes,
  readCanonicalBody,
} from '../../canonical-body-document';
import type {
  BodyBlockPositionRefV1,
  BodyBlockTargetRefV1,
  ResolvedBodyBlockPositionV1,
} from '../contracts';

export interface ResolvedBodyBlockTarget {
  blockId: string;
  index: number;
}

function parseSelectionKey(selectionKey: string): { index: number; blockId: string } | null {
  const match = /^object:[^:]+:body:(\d+):(.+)$/.exec(selectionKey);
  if (!match) {
    return null;
  }
  return {
    index: Number.parseInt(match[1] ?? '', 10),
    blockId: match[2] ?? '',
  };
}

function parseAnchorId(anchorId: string): { blockId: string; position: 'before' | 'after' | 'content' } | null {
  const match = /^node:[^:]+:body-(before|after|content):(.+)$/.exec(anchorId);
  if (!match) {
    return null;
  }
  return {
    position: match[1] as 'before' | 'after' | 'content',
    blockId: match[2] ?? '',
  };
}

export function resolveBodyBlockTarget(input: {
  objectRecord: Parameters<typeof readContentBlocks>[0];
  target: BodyBlockTargetRefV1;
}): ResolvedBodyBlockTarget {
  const legacyBlocks = readContentBlocks(input.objectRecord) ?? [];
  const body = readCanonicalBody(input.objectRecord)
    ?? (legacyBlocks.length > 0 ? contentBlocksToCanonicalBody(legacyBlocks) : null)
    ?? ('capabilities' in input.objectRecord && input.objectRecord.capabilities?.content
      ? contentCapabilityToCanonicalBody(input.objectRecord.capabilities.content)
      : null);
  const blockIds = body
    ? getTopLevelBodyNodes(body).map((_, index) => getBodyBlockIdAtIndex(index))
    : legacyBlocks.map((block, index) => block.id ?? getBodyBlockIdAtIndex(index));
  if (input.target.mode === 'index') {
    const blockId = blockIds[input.target.index];
    const block = blockId ? { id: blockId } : null;
    if (!block) {
      throw new Error(`Body block index ${input.target.index} was not found.`);
    }
    return {
      blockId: block.id,
      index: input.target.index,
    };
  }

  if (input.target.mode === 'selection') {
    const parsed = parseSelectionKey(input.target.selectionKey);
    if (!parsed) {
      throw new Error(`Unsupported body selection key ${input.target.selectionKey}.`);
    }
    const block = blockIds.find((candidate) => candidate === parsed.blockId);
    if (!block) {
      throw new Error(`Body block ${parsed.blockId} was not found.`);
    }
    return {
      blockId: block,
      index: parsed.index,
    };
  }

  const parsed = parseAnchorId(input.target.anchorId);
  if (!parsed) {
    throw new Error(`Unsupported body anchor ${input.target.anchorId}.`);
  }
  const index = blockIds.findIndex((candidate) => candidate === parsed.blockId);
  if (index < 0) {
    throw new Error(`Body block ${parsed.blockId} was not found.`);
  }
  return {
    blockId: parsed.blockId,
    index,
  };
}

export function resolveBodyBlockPosition(input: {
  objectRecord: Parameters<typeof readContentBlocks>[0];
  position: BodyBlockPositionRefV1;
}): { resolved: ResolvedBodyBlockPositionV1; index: number } {
  const legacyBlocks = readContentBlocks(input.objectRecord) ?? [];
  const body = readCanonicalBody(input.objectRecord)
    ?? (legacyBlocks.length > 0 ? contentBlocksToCanonicalBody(legacyBlocks) : null)
    ?? ('capabilities' in input.objectRecord && input.objectRecord.capabilities?.content
      ? contentCapabilityToCanonicalBody(input.objectRecord.capabilities.content)
      : null);
  const blockIds = body
    ? getTopLevelBodyNodes(body).map((_, index) => getBodyBlockIdAtIndex(index))
    : legacyBlocks.map((block, index) => block.id ?? getBodyBlockIdAtIndex(index));
  if (input.position.mode === 'start') {
    return { resolved: { mode: 'start' }, index: 0 };
  }
  if (input.position.mode === 'end') {
    return { resolved: { mode: 'end' }, index: blockIds.length };
  }
  if (input.position.mode === 'index') {
    const index = Math.max(0, Math.min(input.position.index, blockIds.length));
    if (index === 0) {
      return { resolved: { mode: 'start' }, index };
    }
    const previous = blockIds[index - 1];
    return previous
      ? { resolved: { mode: 'after-block', blockId: previous }, index }
      : { resolved: { mode: 'start' }, index };
  }
  if (input.position.mode === 'selection') {
    const target = resolveBodyBlockTarget({
      objectRecord: input.objectRecord,
      target: { mode: 'selection', selectionKey: input.position.selectionKey },
    });
    return {
      resolved: { mode: 'before-block', blockId: target.blockId },
      index: target.index,
    };
  }

  const parsed = parseAnchorId(input.position.anchorId);
  if (!parsed) {
    throw new Error(`Unsupported body anchor ${input.position.anchorId}.`);
  }
  const index = blockIds.findIndex((candidate) => candidate === parsed.blockId);
  if (index < 0) {
    throw new Error(`Body block ${parsed.blockId} was not found.`);
  }
  if (parsed.position === 'before') {
    return {
      resolved: { mode: 'before-block', blockId: parsed.blockId },
      index,
    };
  }
  return {
    resolved: { mode: 'after-block', blockId: parsed.blockId },
    index: index + 1,
  };
}
