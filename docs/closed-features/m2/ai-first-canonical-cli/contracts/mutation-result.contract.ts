export interface MutationChangedSetV1 {
  objects: string[];
  nodes: string[];
  edges: string[];
  bindings: string[];
  pluginInstances: string[];
}

export interface MutationSuccessDataV1 {
  mutationId: string;
  canvasRevisionBefore: number | null;
  canvasRevisionAfter: number | null;
  changed: MutationChangedSetV1;
  warnings: string[];
  dryRun: boolean;
}

export interface MutationFailureV1 {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
}

export interface MutationSuccessEnvelopeV1 {
  ok: true;
  data: MutationSuccessDataV1;
  meta?: Record<string, unknown>;
}

export interface MutationFailureEnvelopeV1 {
  ok: false;
  error: MutationFailureV1;
  meta?: Record<string, unknown>;
}

export type MutationResultEnvelopeV1 =
  | MutationSuccessEnvelopeV1
  | MutationFailureEnvelopeV1;
