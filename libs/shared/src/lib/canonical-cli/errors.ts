import type { CanonicalPersistenceFailureCode, PersistenceFailure } from '../canonical-persistence/records';

export type CanonicalCliErrorCode =
  | CanonicalPersistenceFailureCode
  | 'WORKSPACE_NOT_FOUND'
  | 'WORKSPACE_BOOTSTRAP_FAILED'
  | 'DOCUMENT_NOT_FOUND'
  | 'SURFACE_NOT_FOUND'
  | 'OBJECT_NOT_FOUND'
  | 'NODE_NOT_FOUND'
  | 'DOCUMENT_REVISION_CONFLICT'
  | 'INVALID_ARGUMENT'
  | 'INVALID_JSON_INPUT'
  | 'UNSUPPORTED_MUTATION_OPERATION';

export interface CanonicalCliErrorOptions {
  details?: Record<string, unknown>;
  retryable?: boolean;
  exitCode?: number;
}

export class CanonicalCliError extends Error {
  readonly code: CanonicalCliErrorCode;
  readonly details?: Record<string, unknown>;
  readonly retryable: boolean;
  readonly exitCode: number;

  constructor(code: CanonicalCliErrorCode, message: string, options?: CanonicalCliErrorOptions) {
    super(message);
    this.name = 'CanonicalCliError';
    this.code = code;
    this.details = options?.details;
    this.retryable = options?.retryable ?? false;
    this.exitCode = options?.exitCode ?? 1;
  }
}

export function cliError(
  code: CanonicalCliErrorCode,
  message: string,
  options?: CanonicalCliErrorOptions,
): CanonicalCliError {
  return new CanonicalCliError(code, message, options);
}

export function isCanonicalCliError(error: unknown): error is CanonicalCliError {
  return error instanceof CanonicalCliError;
}

export function persistenceFailureToCliError(
  failure: PersistenceFailure,
  options?: CanonicalCliErrorOptions,
): CanonicalCliError {
  return cliError(failure.code, failure.message, {
    ...options,
    details: {
      ...(failure.path ? { path: failure.path } : {}),
      ...(failure.details ?? {}),
      ...(options?.details ?? {}),
    },
  });
}

export function toCanonicalCliError(
  error: unknown,
  fallbackCode: CanonicalCliErrorCode = 'WORKSPACE_BOOTSTRAP_FAILED',
  fallbackMessage = 'Unexpected CLI failure.',
): CanonicalCliError {
  if (isCanonicalCliError(error)) {
    return error;
  }

  if (
    error
    && typeof error === 'object'
    && 'ok' in error
    && (error as { ok?: unknown }).ok === false
    && 'code' in error
    && 'message' in error
  ) {
    return persistenceFailureToCliError(error as PersistenceFailure);
  }

  if (error instanceof Error) {
    return cliError(fallbackCode, error.message || fallbackMessage);
  }

  return cliError(fallbackCode, fallbackMessage);
}
