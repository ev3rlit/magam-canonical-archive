import type {
  BodyBlockIdV1,
  CanvasIdV1,
  HistoryEntryIdV1,
  MutationFailureCodeV1,
  MutationActorV1,
  MutationIdV1,
  ResolvedBodyBlockPositionV1,
  WorkspaceIdV1,
} from './core';
import type {
  CanvasRuntimeCommandV1,
  ObjectBodyBlockInsertCommandV1,
  ObjectBodyBlockRemoveCommandV1,
  ObjectBodyBlockReorderCommandV1,
  ObjectBodyBlockUpdateCommandV1,
} from './commands';

export interface MutationChangedSetV1 {
  canvases: CanvasIdV1[];
  nodes: string[];
  objects: string[];
  bodyBlocks: string[];
  edges: string[];
  pluginInstances: string[];
}

export interface MutationDiagnosticsV1 {
  warnings: string[];
  notes?: string[];
  rollbackHint?: string | null;
}

export interface MutationSuccessDataV1 {
  mutationId: MutationIdV1;
  canvasRevisionBefore: number | null;
  canvasRevisionAfter: number | null;
  changed: MutationChangedSetV1;
  dryRun: boolean;
  diagnostics: MutationDiagnosticsV1;
}

export interface MutationFailureV1 {
  code: MutationFailureCodeV1;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
  diagnostics?: MutationDiagnosticsV1;
}

export interface MutationSuccessEnvelopeV1 {
  ok: true;
  data: MutationSuccessDataV1;
  meta?: {
    historyEntryId?: HistoryEntryIdV1 | null;
    undoable?: boolean;
  };
}

export interface MutationFailureEnvelopeV1 {
  ok: false;
  error: MutationFailureV1;
  meta?: {
    historyEntryId?: HistoryEntryIdV1 | null;
  };
}

export interface CanvasVersionConflictEnvelopeV1 extends MutationFailureEnvelopeV1 {
  error: MutationFailureV1 & {
    code: 'VERSION_CONFLICT';
    retryable: true;
    details?: {
      expectedCanvasRevision?: number | null;
      actualCanvasRevision?: number | null;
      expectedVersion?: string;
      actualVersion?: string;
    };
  };
}

export type MutationResultEnvelopeV1 =
  | MutationSuccessEnvelopeV1
  | MutationFailureEnvelopeV1
  | CanvasVersionConflictEnvelopeV1;

export interface CanvasHistoryEntrySummaryV1 {
  historyEntryId: HistoryEntryIdV1;
  mutationId: MutationIdV1;
  actor?: MutationActorV1;
  undoable: boolean;
  redoable: boolean;
}

export interface CanvasUndoRequestV1 {
  canvasId: CanvasIdV1;
  actorId: string;
  sessionId: string;
}

export interface CanvasRedoRequestV1 {
  canvasId: CanvasIdV1;
  actorId: string;
  sessionId: string;
}

export type CanvasHistoryBodyBlockTargetRefV1 = {
  mode: 'block-id';
  blockId: BodyBlockIdV1;
};

export interface HistoryReplayObjectBodyBlockInsertCommandV1
  extends Omit<ObjectBodyBlockInsertCommandV1, 'position'> {
  position: ResolvedBodyBlockPositionV1;
}

export interface HistoryReplayObjectBodyBlockUpdateCommandV1
  extends Omit<ObjectBodyBlockUpdateCommandV1, 'target'> {
  target: CanvasHistoryBodyBlockTargetRefV1;
}

export interface HistoryReplayObjectBodyBlockRemoveCommandV1
  extends Omit<ObjectBodyBlockRemoveCommandV1, 'target'> {
  target: CanvasHistoryBodyBlockTargetRefV1;
}

export interface HistoryReplayObjectBodyBlockReorderCommandV1
  extends Omit<ObjectBodyBlockReorderCommandV1, 'target' | 'position'> {
  target: CanvasHistoryBodyBlockTargetRefV1;
  position: ResolvedBodyBlockPositionV1;
}

export type CanvasHistoryReplayCommandV1 =
  | Exclude<
      CanvasRuntimeCommandV1,
      | ObjectBodyBlockInsertCommandV1
      | ObjectBodyBlockUpdateCommandV1
      | ObjectBodyBlockRemoveCommandV1
      | ObjectBodyBlockReorderCommandV1
    >
  | HistoryReplayObjectBodyBlockInsertCommandV1
  | HistoryReplayObjectBodyBlockUpdateCommandV1
  | HistoryReplayObjectBodyBlockRemoveCommandV1
  | HistoryReplayObjectBodyBlockReorderCommandV1;

export interface CanvasHistoryReplayBatchV1 {
  workspaceId: WorkspaceIdV1;
  canvasId: CanvasIdV1;
  actor?: MutationActorV1;
  reason?: string;
  commands: CanvasHistoryReplayCommandV1[];
  normalization: {
    source: 'resolved-before-commit';
    resolvedAgainstRevision: number | null;
  };
}

export interface CanvasHistoryEntryV1 {
  historyEntryId: HistoryEntryIdV1;
  canvasId: CanvasIdV1;
  actor?: MutationActorV1;
  sessionId?: string;
  mutationId: MutationIdV1;
  forwardMutation: CanvasHistoryReplayBatchV1;
  inverseMutation?: CanvasHistoryReplayBatchV1;
  revisionBefore: number | null;
  revisionAfter: number | null;
  changed: MutationChangedSetV1;
  undoable: boolean;
}
