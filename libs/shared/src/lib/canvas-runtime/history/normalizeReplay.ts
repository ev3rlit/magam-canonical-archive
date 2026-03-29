import type { CanvasHistoryReplayBatchV1, CanvasRuntimeCommandV1 } from '../contracts';
import type { ResolvedBodyBlockPositionV1 } from '../contracts';

export function normalizeReplayBatch(input: {
  workspaceId: string;
  canvasId: string;
  commands: CanvasRuntimeCommandV1[];
  resolvedAgainstRevision: number | null;
  actor?: { kind: 'agent' | 'user' | 'system'; id: string; displayName?: string };
  sessionId?: string;
  reason?: string;
}): CanvasHistoryReplayBatchV1 {
  return {
    workspaceId: input.workspaceId,
    canvasId: input.canvasId,
    ...(input.actor ? { actor: input.actor } : {}),
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
    commands: input.commands as CanvasHistoryReplayBatchV1['commands'],
    normalization: {
      source: 'resolved-before-commit',
      resolvedAgainstRevision: input.resolvedAgainstRevision,
    },
  };
}

export function createResolvedPositionFromIndex(input: {
  index: number;
  blockIds: string[];
}): ResolvedBodyBlockPositionV1 {
  if (input.index <= 0 || input.blockIds.length === 0) {
    return { mode: 'start' };
  }
  if (input.index >= input.blockIds.length) {
    return { mode: 'end' };
  }
  return {
    mode: 'before-block',
    blockId: input.blockIds[input.index] as string,
  };
}
