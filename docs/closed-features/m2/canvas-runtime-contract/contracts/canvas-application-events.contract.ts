import type {
  CanvasDomainEventMetaV1,
  CanvasIdV1,
  MutationFailureCodeV1,
} from './canvas-runtime-core.contract';

// Events emitted by application/history/control layers rather than aggregates.

export interface CanvasMutationDryRunValidatedEventV1 {
  name: 'CanvasMutationDryRunValidated';
  meta: CanvasDomainEventMetaV1;
  data: {
    canvasId?: CanvasIdV1;
    changedPreviewAvailable: boolean;
  };
}

export interface CanvasMutationRejectedEventV1 {
  name: 'CanvasMutationRejected';
  meta: CanvasDomainEventMetaV1;
  data: {
    code: MutationFailureCodeV1;
    message: string;
    retryable: boolean;
  };
}

export interface CanvasVersionConflictDetectedEventV1 {
  name: 'CanvasVersionConflictDetected';
  meta: CanvasDomainEventMetaV1;
  data: {
    canvasId?: CanvasIdV1;
    expectedCanvasRevision?: number | null;
    actualCanvasRevision?: number | null;
  };
}

export interface CanvasChangedEventV1 {
  name: 'CanvasChanged';
  meta: CanvasDomainEventMetaV1;
  data: {
    canvasId: CanvasIdV1;
  };
}

export type CanvasApplicationEventV1 =
  | CanvasMutationDryRunValidatedEventV1
  | CanvasMutationRejectedEventV1
  | CanvasVersionConflictDetectedEventV1
  | CanvasChangedEventV1;
