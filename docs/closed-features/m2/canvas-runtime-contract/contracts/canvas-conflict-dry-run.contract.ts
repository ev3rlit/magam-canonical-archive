// Shared conflict and dry-run semantics for the canvas runtime.
// These envelopes are consumed by both interactive clients and headless transports.

export interface CanvasMutationPreconditionsV1 {
  canvasRevision?: number;
}

export interface CanvasDryRunRequestV1 {
  dryRun: true;
}

export interface CanvasConflictEnvelopeV1 {
  ok: false;
  error: {
    code: 'VERSION_CONFLICT';
    message: string;
    retryable: true;
    details?: {
      expectedCanvasRevision?: number | null;
      actualCanvasRevision?: number | null;
      expectedVersion?: string;
      actualVersion?: string;
    };
  };
  meta?: Record<string, unknown>;
}

export interface CanvasDryRunSuccessMetaV1 {
  dryRun: true;
  changedPreviewAvailable: boolean;
}
