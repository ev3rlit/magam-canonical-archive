import type {
  CanvasApplicationEventV1,
  CanvasChangedEventV1,
  CanvasMutationDryRunValidatedEventV1,
  CanvasMutationRejectedEventV1,
  CanvasVersionConflictDetectedEventV1,
  MutationResultEnvelopeV1,
} from '../contracts';
import type { CanvasRuntimeServiceContext } from './serviceContext';

function createBaseMeta(
  context: CanvasRuntimeServiceContext,
  input: {
    mutationId?: string;
    causedByCommandName?: string;
  },
) {
  return {
    eventId: context.createId(),
    occurredAt: context.now().toISOString(),
    ...(input.mutationId ? { mutationId: input.mutationId } : {}),
    ...(input.causedByCommandName ? { causedByCommandName: input.causedByCommandName } : {}),
  };
}

export function publishRuntimeEvents(input: {
  context: CanvasRuntimeServiceContext;
  canvasId?: string;
  result: MutationResultEnvelopeV1;
  causedByCommandName?: string;
}): CanvasApplicationEventV1[] {
  const { context, canvasId, result, causedByCommandName } = input;

  if (result.ok) {
    const events: CanvasApplicationEventV1[] = [];
    if (result.data.dryRun) {
      const dryRunEvent: CanvasMutationDryRunValidatedEventV1 = {
        name: 'CanvasMutationDryRunValidated',
        meta: createBaseMeta(context, {
          mutationId: result.data.mutationId,
          causedByCommandName,
        }),
        data: {
          ...(canvasId ? { canvasId } : {}),
          changedPreviewAvailable: true,
        },
      };
      events.push(dryRunEvent);
      return events;
    }

    if (canvasId) {
      const changedEvent: CanvasChangedEventV1 = {
        name: 'CanvasChanged',
        meta: createBaseMeta(context, {
          mutationId: result.data.mutationId,
          causedByCommandName,
        }),
        data: {
          canvasId,
        },
      };
      events.push(changedEvent);
    }

    return events;
  }

  if (result.error.code === 'VERSION_CONFLICT') {
    const conflictEvent: CanvasVersionConflictDetectedEventV1 = {
      name: 'CanvasVersionConflictDetected',
      meta: createBaseMeta(context, {
        causedByCommandName,
      }),
      data: {
        ...(canvasId ? { canvasId } : {}),
        expectedCanvasRevision: result.error.details?.expectedCanvasRevision as number | null | undefined,
        actualCanvasRevision: result.error.details?.actualCanvasRevision as number | null | undefined,
      },
    };
    return [conflictEvent];
  }

  const rejectedEvent: CanvasMutationRejectedEventV1 = {
    name: 'CanvasMutationRejected',
    meta: createBaseMeta(context, {
      causedByCommandName,
    }),
    data: {
      code: result.error.code,
      message: result.error.message,
      retryable: result.error.retryable,
    },
  };
  return [rejectedEvent];
}
