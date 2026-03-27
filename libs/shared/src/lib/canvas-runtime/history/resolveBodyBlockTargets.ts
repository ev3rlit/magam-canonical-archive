import { readContentBlocks } from '../../canonical-object-contract';
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
  const blocks = readContentBlocks(input.objectRecord) ?? [];
  if (input.target.mode === 'index') {
    const block = blocks[input.target.index];
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
    const block = blocks.find((candidate) => candidate.id === parsed.blockId);
    if (!block) {
      throw new Error(`Body block ${parsed.blockId} was not found.`);
    }
    return {
      blockId: block.id,
      index: parsed.index,
    };
  }

  const parsed = parseAnchorId(input.target.anchorId);
  if (!parsed) {
    throw new Error(`Unsupported body anchor ${input.target.anchorId}.`);
  }
  const index = blocks.findIndex((candidate) => candidate.id === parsed.blockId);
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
  const blocks = readContentBlocks(input.objectRecord) ?? [];
  if (input.position.mode === 'start') {
    return { resolved: { mode: 'start' }, index: 0 };
  }
  if (input.position.mode === 'end') {
    return { resolved: { mode: 'end' }, index: blocks.length };
  }
  if (input.position.mode === 'index') {
    const index = Math.max(0, Math.min(input.position.index, blocks.length));
    if (index === 0) {
      return { resolved: { mode: 'start' }, index };
    }
    const previous = blocks[index - 1];
    return previous
      ? { resolved: { mode: 'after-block', blockId: previous.id }, index }
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
  const index = blocks.findIndex((candidate) => candidate.id === parsed.blockId);
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
