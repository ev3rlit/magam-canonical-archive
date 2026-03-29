import type {
  CanvasRedoRequestV1,
  CanvasUndoRequestV1,
  CanvasRuntimeCommandV1,
  MutationResultEnvelopeV1,
} from '../contracts';
import { createMutationFailureEnvelope } from './mutationEnvelope';
import { dispatchCanvasHistoryReplay, type DispatchCanvasMutationResult } from './dispatchCanvasMutation';
import { publishRuntimeEvents } from './publishRuntimeEvents';
import type { RuntimeCanvasHistoryCursorRecord, RuntimeCanvasRevisionRecord } from './repositoryPorts';
import type { CanvasRuntimeServiceContext } from './serviceContext';

function createHistoryFailureResult(input: {
  context: CanvasRuntimeServiceContext;
  canvasId: string;
  code: 'NOT_FOUND' | 'VERSION_CONFLICT' | 'VALIDATION_FAILED';
  message: string;
  details?: Record<string, unknown>;
  causedByCommandName: string;
}): DispatchCanvasMutationResult {
  const envelope = createMutationFailureEnvelope({
    code: input.code,
    message: input.message,
    retryable: input.code === 'VERSION_CONFLICT',
    ...(input.details ? { details: input.details } : {}),
  });

  return {
    envelope,
    historyEntry: null,
    events: publishRuntimeEvents({
      context: input.context,
      canvasId: input.canvasId,
      result: envelope,
      causedByCommandName: input.causedByCommandName,
    }),
  };
}

function getStoredHistoryRecord(revision: RuntimeCanvasRevisionRecord) {
  return revision.runtimeHistory ?? null;
}

function matchesActorSession(revision: RuntimeCanvasRevisionRecord, actorId: string, sessionId: string): boolean {
  const history = getStoredHistoryRecord(revision);
  if (!history || history.kind !== 'mutation') {
    return false;
  }

  return history.entry.actor?.id === actorId
    && (history.entry.sessionId ?? revision.sessionId ?? null) === sessionId;
}

function listSourceRevisionRecords(
  revisions: RuntimeCanvasRevisionRecord[],
  actorId: string,
  sessionId: string,
): RuntimeCanvasRevisionRecord[] {
  return revisions
    .filter((revision) => matchesActorSession(revision, actorId, sessionId))
    .sort((left, right) => left.revisionNo - right.revisionNo);
}

function buildCursorFromPosition(input: {
  canvasId: string;
  actorId: string;
  sessionId: string;
  sourceRevisionNos: number[];
  positionIndex: number;
  now: Date;
}): RuntimeCanvasHistoryCursorRecord {
  return {
    canvasId: input.canvasId,
    actorId: input.actorId,
    sessionId: input.sessionId,
    undoRevisionNo: input.positionIndex >= 0 ? input.sourceRevisionNos[input.positionIndex] ?? null : null,
    redoRevisionNo: input.positionIndex + 1 < input.sourceRevisionNos.length
      ? input.sourceRevisionNos[input.positionIndex + 1] ?? null
      : null,
    updatedAt: input.now,
  };
}

function isUndoHeadCompatible(
  latest: RuntimeCanvasRevisionRecord | null,
  cursor: RuntimeCanvasHistoryCursorRecord,
): boolean {
  if (!latest) {
    return cursor.undoRevisionNo == null && cursor.redoRevisionNo == null;
  }

  const history = getStoredHistoryRecord(latest);
  if (!history) {
    return false;
  }

  if (cursor.redoRevisionNo !== null && cursor.redoRevisionNo !== undefined) {
    return history.kind === 'undo' && history.sourceRevisionNo === cursor.redoRevisionNo;
  }

  if (cursor.undoRevisionNo === null || cursor.undoRevisionNo === undefined) {
    return false;
  }

  return (history.kind === 'mutation' && latest.revisionNo === cursor.undoRevisionNo)
    || (history.kind === 'redo' && history.sourceRevisionNo === cursor.undoRevisionNo);
}

function isRedoHeadCompatible(
  latest: RuntimeCanvasRevisionRecord | null,
  cursor: RuntimeCanvasHistoryCursorRecord,
): boolean {
  if (!latest || cursor.redoRevisionNo === null || cursor.redoRevisionNo === undefined) {
    return false;
  }

  const history = getStoredHistoryRecord(latest);
  return Boolean(history && history.kind === 'undo' && history.sourceRevisionNo === cursor.redoRevisionNo);
}

async function resolveCursor(input: {
  context: CanvasRuntimeServiceContext;
  canvasId: string;
  actorId: string;
  sessionId: string;
  sourceRevisionRecords: RuntimeCanvasRevisionRecord[];
}): Promise<RuntimeCanvasHistoryCursorRecord> {
  const cursorResult = await input.context.repository.getCanvasHistoryCursor(
    input.canvasId,
    input.actorId,
    input.sessionId,
  );
  if (!cursorResult.ok) {
    throw new Error(cursorResult.message);
  }

  if (cursorResult.value) {
    return cursorResult.value;
  }

  return {
    canvasId: input.canvasId,
    actorId: input.actorId,
    sessionId: input.sessionId,
    undoRevisionNo: input.sourceRevisionRecords.at(-1)?.revisionNo ?? null,
    redoRevisionNo: null,
    updatedAt: input.context.now(),
  };
}

function toReplayActor(input: { actorId: string; fallbackKind?: 'agent' | 'user' | 'system' }) {
  return {
    kind: input.fallbackKind ?? 'user',
    id: input.actorId,
  } as const;
}

async function persistCursor(context: CanvasRuntimeServiceContext, cursor: RuntimeCanvasHistoryCursorRecord): Promise<void> {
  const result = await context.repository.upsertCanvasHistoryCursor(cursor);
  if (!result.ok) {
    throw new Error(result.message);
  }
}

export async function undoCanvasMutation(
  context: CanvasRuntimeServiceContext,
  request: CanvasUndoRequestV1,
): Promise<DispatchCanvasMutationResult> {
  const revisions = await context.repository.listCanvasRevisions(request.canvasId);
  const latest = revisions[0] ?? null;
  const sourceRevisionRecords = listSourceRevisionRecords(revisions, request.actorId, request.sessionId);
  if (sourceRevisionRecords.length === 0) {
    return createHistoryFailureResult({
      context,
      canvasId: request.canvasId,
      code: 'NOT_FOUND',
      message: 'No undoable runtime history is available for this session.',
      causedByCommandName: 'canvas.runtime.undo',
    });
  }

  const cursor = await resolveCursor({
    context,
    canvasId: request.canvasId,
    actorId: request.actorId,
    sessionId: request.sessionId,
    sourceRevisionRecords,
  });
  if (!isUndoHeadCompatible(latest, cursor)) {
    return createHistoryFailureResult({
      context,
      canvasId: request.canvasId,
      code: 'VERSION_CONFLICT',
      message: 'Runtime history cursor is stale against the latest canvas revision.',
      details: {
        expectedCanvasRevision: cursor.redoRevisionNo ?? cursor.undoRevisionNo ?? null,
        actualCanvasRevision: latest?.revisionNo ?? null,
      },
      causedByCommandName: 'canvas.runtime.undo',
    });
  }

  const targetRevisionNo = cursor.undoRevisionNo;
  if (targetRevisionNo === null || targetRevisionNo === undefined) {
    return createHistoryFailureResult({
      context,
      canvasId: request.canvasId,
      code: 'NOT_FOUND',
      message: 'No undoable runtime history is available for this session.',
      causedByCommandName: 'canvas.runtime.undo',
    });
  }

  const sourceIndex = sourceRevisionRecords.findIndex((revision) => revision.revisionNo === targetRevisionNo);
  if (sourceIndex < 0) {
    return createHistoryFailureResult({
      context,
      canvasId: request.canvasId,
      code: 'NOT_FOUND',
      message: `Runtime history revision ${targetRevisionNo} is not available for undo.`,
      causedByCommandName: 'canvas.runtime.undo',
    });
  }

  const sourceRecord = sourceRevisionRecords[sourceIndex]!;
  const sourceHistory = getStoredHistoryRecord(sourceRecord);
  if (!sourceHistory?.entry.inverseMutation) {
    return createHistoryFailureResult({
      context,
      canvasId: request.canvasId,
      code: 'VALIDATION_FAILED',
      message: `Runtime history revision ${targetRevisionNo} does not include an inverse replay batch.`,
      causedByCommandName: 'canvas.runtime.undo',
    });
  }

  const result = await dispatchCanvasHistoryReplay({
    context,
    batch: {
      workspaceId: sourceHistory.entry.inverseMutation.workspaceId,
      canvasId: request.canvasId,
      actor: toReplayActor({
        actorId: request.actorId,
        fallbackKind: sourceHistory.entry.actor?.kind ?? 'user',
      }),
      sessionId: request.sessionId,
      reason: sourceHistory.entry.inverseMutation.reason ?? `undo:${sourceHistory.entry.historyEntryId}`,
      preconditions: {
        canvasRevision: latest?.revisionNo ?? 0,
      },
      commands: sourceHistory.entry.inverseMutation.commands as CanvasRuntimeCommandV1[],
    },
    historyKind: 'undo',
    sourceRevisionNo: targetRevisionNo,
    sourceHistoryEntryId: sourceHistory.entry.historyEntryId,
    forwardCommands: sourceHistory.entry.inverseMutation.commands,
    inverseCommands: sourceHistory.entry.forwardMutation.commands,
  });

  if (!result.envelope.ok) {
    return result;
  }

  await persistCursor(context, buildCursorFromPosition({
    canvasId: request.canvasId,
    actorId: request.actorId,
    sessionId: request.sessionId,
    sourceRevisionNos: sourceRevisionRecords.map((revision) => revision.revisionNo),
    positionIndex: sourceIndex - 1,
    now: context.now(),
  }));

  return result;
}

export async function redoCanvasMutation(
  context: CanvasRuntimeServiceContext,
  request: CanvasRedoRequestV1,
): Promise<DispatchCanvasMutationResult> {
  const revisions = await context.repository.listCanvasRevisions(request.canvasId);
  const latest = revisions[0] ?? null;
  const sourceRevisionRecords = listSourceRevisionRecords(revisions, request.actorId, request.sessionId);
  if (sourceRevisionRecords.length === 0) {
    return createHistoryFailureResult({
      context,
      canvasId: request.canvasId,
      code: 'NOT_FOUND',
      message: 'No redoable runtime history is available for this session.',
      causedByCommandName: 'canvas.runtime.redo',
    });
  }

  const cursor = await resolveCursor({
    context,
    canvasId: request.canvasId,
    actorId: request.actorId,
    sessionId: request.sessionId,
    sourceRevisionRecords,
  });
  if (!isRedoHeadCompatible(latest, cursor)) {
    return createHistoryFailureResult({
      context,
      canvasId: request.canvasId,
      code: 'VERSION_CONFLICT',
      message: 'Runtime redo cursor is stale against the latest canvas revision.',
      details: {
        expectedCanvasRevision: cursor.redoRevisionNo ?? null,
        actualCanvasRevision: latest?.revisionNo ?? null,
      },
      causedByCommandName: 'canvas.runtime.redo',
    });
  }

  const targetRevisionNo = cursor.redoRevisionNo;
  if (targetRevisionNo === null || targetRevisionNo === undefined) {
    return createHistoryFailureResult({
      context,
      canvasId: request.canvasId,
      code: 'NOT_FOUND',
      message: 'No redoable runtime history is available for this session.',
      causedByCommandName: 'canvas.runtime.redo',
    });
  }

  const sourceIndex = sourceRevisionRecords.findIndex((revision) => revision.revisionNo === targetRevisionNo);
  if (sourceIndex < 0) {
    return createHistoryFailureResult({
      context,
      canvasId: request.canvasId,
      code: 'NOT_FOUND',
      message: `Runtime history revision ${targetRevisionNo} is not available for redo.`,
      causedByCommandName: 'canvas.runtime.redo',
    });
  }

  const sourceRecord = sourceRevisionRecords[sourceIndex]!;
  const sourceHistory = getStoredHistoryRecord(sourceRecord);
  if (!sourceHistory) {
    return createHistoryFailureResult({
      context,
      canvasId: request.canvasId,
      code: 'NOT_FOUND',
      message: `Runtime history revision ${targetRevisionNo} could not be loaded for redo.`,
      causedByCommandName: 'canvas.runtime.redo',
    });
  }

  const result = await dispatchCanvasHistoryReplay({
    context,
    batch: {
      workspaceId: sourceHistory.entry.forwardMutation.workspaceId,
      canvasId: request.canvasId,
      actor: toReplayActor({
        actorId: request.actorId,
        fallbackKind: sourceHistory.entry.actor?.kind ?? 'user',
      }),
      sessionId: request.sessionId,
      reason: sourceHistory.entry.forwardMutation.reason ?? `redo:${sourceHistory.entry.historyEntryId}`,
      preconditions: {
        canvasRevision: latest?.revisionNo ?? 0,
      },
      commands: sourceHistory.entry.forwardMutation.commands as CanvasRuntimeCommandV1[],
    },
    historyKind: 'redo',
    sourceRevisionNo: targetRevisionNo,
    sourceHistoryEntryId: sourceHistory.entry.historyEntryId,
    forwardCommands: sourceHistory.entry.forwardMutation.commands,
    inverseCommands: sourceHistory.entry.inverseMutation?.commands ?? [],
  });

  if (!result.envelope.ok) {
    return result;
  }

  await persistCursor(context, buildCursorFromPosition({
    canvasId: request.canvasId,
    actorId: request.actorId,
    sessionId: request.sessionId,
    sourceRevisionNos: sourceRevisionRecords.map((revision) => revision.revisionNo),
    positionIndex: sourceIndex,
    now: context.now(),
  }));

  return result;
}
