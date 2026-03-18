import {
  type CanonicalCliError,
  cliError,
  isCanonicalCliError,
  toCanonicalCliError,
  type CanonicalCliErrorCode,
} from './errors';

export interface JsonEnvelopeMeta {
  [key: string]: unknown;
}

export interface JsonFailurePayload {
  code: CanonicalCliErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
}

export interface JsonSuccessEnvelope<T> {
  ok: true;
  data: T;
  meta?: JsonEnvelopeMeta;
}

export interface JsonFailureEnvelope {
  ok: false;
  error: JsonFailurePayload;
  meta?: JsonEnvelopeMeta;
}

export type JsonEnvelope<T> = JsonSuccessEnvelope<T> | JsonFailureEnvelope;

export function createSuccessEnvelope<T>(
  data: T,
  meta?: JsonEnvelopeMeta,
): JsonSuccessEnvelope<T> {
  return {
    ok: true,
    data,
    ...(meta ? { meta } : {}),
  };
}

export function toFailurePayload(error: CanonicalCliError): JsonFailurePayload {
  return {
    code: error.code,
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
    retryable: error.retryable,
  };
}

export function createFailureEnvelope(
  error: CanonicalCliError | unknown,
  meta?: JsonEnvelopeMeta,
): JsonFailureEnvelope {
  const resolved = isCanonicalCliError(error)
    ? error
    : toCanonicalCliError(error);

  return {
    ok: false,
    error: toFailurePayload(resolved),
    ...(meta ? { meta } : {}),
  };
}

export function ensureJsonEnvelope<T>(
  value: JsonEnvelope<T> | T,
  meta?: JsonEnvelopeMeta,
): JsonEnvelope<T> {
  if (value && typeof value === 'object' && 'ok' in (value as Record<string, unknown>)) {
    return value as JsonEnvelope<T>;
  }

  return createSuccessEnvelope(value as T, meta);
}

export function failEnvelope(
  code: CanonicalCliErrorCode,
  message: string,
  meta?: JsonEnvelopeMeta,
  details?: Record<string, unknown>,
): JsonFailureEnvelope {
  return createFailureEnvelope(cliError(code, message, { details }), meta);
}
