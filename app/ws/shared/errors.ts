import type { MutationResultEnvelopeV1 } from '../../../libs/shared/src';
import { RPC_ERRORS } from '../rpc';

export function createIntentScopedDiagnostics(input: {
  failedAction: string;
  stage: string;
  details?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    failedAction: input.failedAction,
    rollbackPolicy: 'intent-scoped',
    stage: input.stage,
    ...(input.details ?? {}),
  };
}

export function withDiagnostics(
  data: unknown,
  diagnostics: Record<string, unknown>,
): Record<string, unknown> {
  const base = typeof data === 'object' && data !== null && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {};
  const existingRollback = typeof base.rollback === 'object'
    && base.rollback !== null
    && !Array.isArray(base.rollback)
    ? base.rollback as Record<string, unknown>
    : {};
  return {
    ...base,
    rollback: {
      ...existingRollback,
      ...diagnostics,
    },
  };
}

export function runtimeFailureToRpcError(
  envelope: MutationResultEnvelopeV1,
): never {
  if (envelope.ok) {
    throw { ...RPC_ERRORS.INTERNAL_ERROR, data: 'Expected runtime mutation failure.' };
  }

  if (envelope.error.code === 'VERSION_CONFLICT') {
    throw {
      ...RPC_ERRORS.VERSION_CONFLICT,
      data: {
        expected: envelope.error.details?.expectedCanvasRevision,
        actual: envelope.error.details?.actualCanvasRevision,
        ...envelope.error.details,
      },
    };
  }

  if (envelope.error.code === 'NOT_FOUND') {
    throw {
      ...RPC_ERRORS.NODE_NOT_FOUND,
      data: envelope.error.details,
    };
  }

  if (envelope.error.code === 'VALIDATION_FAILED') {
    throw {
      ...RPC_ERRORS.CONTENT_CONTRACT_VIOLATION,
      data: envelope.error.details,
    };
  }

  throw {
    ...RPC_ERRORS.PATCH_FAILED,
    data: envelope.error.details ?? { reason: envelope.error.message },
  };
}
