import type { MutationExecutionResult } from '../../canonical-mutation';
import type {
  BodyBlockIdV1,
  CanvasIdV1,
  HistoryEntryIdV1,
  MutationFailureCodeV1,
  MutationIdV1,
} from '../contracts';
import type { CanvasHistoryEntryV1, MutationChangedSetV1, MutationResultEnvelopeV1 } from '../contracts';

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function createMutationChangedSet(input: {
  canvasId?: CanvasIdV1;
  result: MutationExecutionResult;
  bodyBlockIds?: BodyBlockIdV1[];
}): MutationChangedSetV1 {
  return {
    canvases: input.canvasId ? [input.canvasId] : [],
    nodes: unique(input.result.changed.nodes),
    objects: unique(input.result.changed.objects),
    bodyBlocks: unique(input.bodyBlockIds ?? []),
    edges: unique(input.result.changed.edges),
    pluginInstances: unique(input.result.changed.pluginInstances),
  };
}

export function createMutationSuccessEnvelope(input: {
  mutationId: MutationIdV1;
  result: MutationExecutionResult;
  canvasId?: CanvasIdV1;
  bodyBlockIds?: BodyBlockIdV1[];
  historyEntry?: CanvasHistoryEntryV1 | null;
}): MutationResultEnvelopeV1 {
  return {
    ok: true,
    data: {
      mutationId: input.mutationId,
      canvasRevisionBefore: input.result.canvasRevisionBefore,
      canvasRevisionAfter: input.result.canvasRevisionAfter,
      changed: createMutationChangedSet({
        canvasId: input.canvasId,
        result: input.result,
        bodyBlockIds: input.bodyBlockIds,
      }),
      dryRun: input.result.dryRun,
      diagnostics: {
        warnings: input.result.warnings,
      },
    },
    meta: {
      historyEntryId: input.historyEntry?.historyEntryId ?? null,
      undoable: Boolean(input.historyEntry?.undoable),
    },
  };
}

export function createMutationFailureEnvelope(input: {
  code: MutationFailureCodeV1;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
  historyEntryId?: HistoryEntryIdV1 | null;
}): MutationResultEnvelopeV1 {
  return {
    ok: false,
    error: {
      code: input.code,
      message: input.message,
      retryable: input.retryable,
      ...(input.details ? { details: input.details } : {}),
    },
    meta: {
      historyEntryId: input.historyEntryId ?? null,
    },
  };
}
