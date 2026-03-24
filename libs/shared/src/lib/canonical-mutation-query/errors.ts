export type CanonicalMutationFailureCode =
  | 'INVALID_MUTATION_OPERATION'
  | 'PATCH_SURFACE_VIOLATION'
  | 'INVALID_CAPABILITY'
  | 'INVALID_CAPABILITY_PAYLOAD'
  | 'CONTENT_CONTRACT_VIOLATION'
  | 'INVALID_CONTENT_BLOCK'
  | 'CONTENT_BODY_CONFLICT'
  | 'EDITABLE_OBJECT_REQUIRES_CLONE'
  | 'RELATION_ENDPOINT_MISSING'
  | 'CANONICAL_CANVAS_BOUNDARY_VIOLATION';

export type CanonicalQueryFailureCode =
  | 'INVALID_QUERY_INCLUDE'
  | 'INVALID_QUERY_FILTER'
  | 'INVALID_QUERY_BOUNDS'
  | 'INVALID_QUERY_CURSOR'
  | 'QUERY_SCOPE_NOT_FOUND';

export type CanonicalConcurrencyFailureCode =
  | 'VERSION_CONFLICT'
  | 'VERSION_BASE_REQUIRED'
  | 'INVALID_REVISION_TOKEN'
  | 'REVISION_APPEND_FAILED';

export type CanonicalMutationQueryFailureCode =
  | CanonicalMutationFailureCode
  | CanonicalQueryFailureCode
  | CanonicalConcurrencyFailureCode;

export const CANONICAL_MUTATION_ERROR_CODES = [
  'INVALID_MUTATION_OPERATION',
  'PATCH_SURFACE_VIOLATION',
  'INVALID_CAPABILITY',
  'INVALID_CAPABILITY_PAYLOAD',
  'CONTENT_CONTRACT_VIOLATION',
  'INVALID_CONTENT_BLOCK',
  'CONTENT_BODY_CONFLICT',
  'EDITABLE_OBJECT_REQUIRES_CLONE',
  'RELATION_ENDPOINT_MISSING',
  'CANONICAL_CANVAS_BOUNDARY_VIOLATION',
] as const satisfies readonly CanonicalMutationFailureCode[];

export const CANONICAL_QUERY_ERROR_CODES = [
  'INVALID_QUERY_INCLUDE',
  'INVALID_QUERY_FILTER',
  'INVALID_QUERY_BOUNDS',
  'INVALID_QUERY_CURSOR',
  'QUERY_SCOPE_NOT_FOUND',
] as const satisfies readonly CanonicalQueryFailureCode[];

export const CANONICAL_CONCURRENCY_ERROR_CODES = [
  'VERSION_CONFLICT',
  'VERSION_BASE_REQUIRED',
  'INVALID_REVISION_TOKEN',
  'REVISION_APPEND_FAILED',
] as const satisfies readonly CanonicalConcurrencyFailureCode[];

export const CANONICAL_MUTATION_QUERY_ERROR_CODES = [
  ...CANONICAL_MUTATION_ERROR_CODES,
  ...CANONICAL_QUERY_ERROR_CODES,
  ...CANONICAL_CONCURRENCY_ERROR_CODES,
] as const satisfies readonly CanonicalMutationQueryFailureCode[];

const MESSAGE_BY_CODE: Readonly<Record<CanonicalMutationQueryFailureCode, string>> = {
  INVALID_MUTATION_OPERATION: 'mutation operation is invalid.',
  PATCH_SURFACE_VIOLATION: 'mutation patch targets an unsupported surface.',
  INVALID_CAPABILITY: 'invalid capability key provided.',
  INVALID_CAPABILITY_PAYLOAD: 'invalid capability payload.',
  CONTENT_CONTRACT_VIOLATION: 'content contract is violated.',
  INVALID_CONTENT_BLOCK: 'content block payload is invalid.',
  CONTENT_BODY_CONFLICT: 'content and contentBlocks cannot be used together.',
  EDITABLE_OBJECT_REQUIRES_CLONE: 'editable shared objects must be cloned before mutation.',
  RELATION_ENDPOINT_MISSING: 'relation endpoint is missing.',
  CANONICAL_CANVAS_BOUNDARY_VIOLATION: 'mutation attempted to cross canonical/canvas boundary.',
  INVALID_QUERY_INCLUDE: 'include list contains an unsupported field.',
  INVALID_QUERY_FILTER: 'query filter payload is invalid.',
  INVALID_QUERY_BOUNDS: 'query bounds payload is invalid.',
  INVALID_QUERY_CURSOR: 'pagination cursor is invalid.',
  QUERY_SCOPE_NOT_FOUND: 'requested scope could not be resolved.',
  VERSION_CONFLICT: 'base revision is stale.',
  VERSION_BASE_REQUIRED: 'base revision is required for mutation concurrency checks.',
  INVALID_REVISION_TOKEN: 'revision token is invalid.',
  REVISION_APPEND_FAILED: 'revision append failed while applying mutation.',
} as const;

export interface CanonicalFailureDetails {
  [key: string]: unknown;
}

export interface CanonicalFailureEnvelope<TCode extends CanonicalMutationQueryFailureCode = CanonicalMutationQueryFailureCode> {
  ok: false;
  code: TCode;
  message: string;
  path?: string;
  details?: CanonicalFailureDetails;
}

function isCanonicalErrorCodeFromList(
  value: unknown,
  list: readonly string[],
): value is CanonicalMutationQueryFailureCode {
  if (typeof value !== 'string') {
    return false;
  }
  return (list as readonly string[]).includes(value);
}

export function isCanonicalMutationFailureCode(
  value: unknown,
): value is CanonicalMutationFailureCode {
  return isCanonicalErrorCodeFromList(value, CANONICAL_MUTATION_ERROR_CODES);
}

export function isCanonicalQueryFailureCode(value: unknown): value is CanonicalQueryFailureCode {
  return isCanonicalErrorCodeFromList(value, CANONICAL_QUERY_ERROR_CODES);
}

export function isCanonicalConcurrencyFailureCode(
  value: unknown,
): value is CanonicalConcurrencyFailureCode {
  return isCanonicalErrorCodeFromList(value, CANONICAL_CONCURRENCY_ERROR_CODES);
}

export function isCanonicalMutationQueryFailureCode(
  value: unknown,
): value is CanonicalMutationQueryFailureCode {
  return isCanonicalErrorCodeFromList(value, CANONICAL_MUTATION_QUERY_ERROR_CODES);
}

const CANONICAL_CODE_FROM_PERSISTENCE: Readonly<Record<string, CanonicalMutationQueryFailureCode>> = {
  CANONICAL_REFERENCE_REQUIRED: 'PATCH_SURFACE_VIOLATION',
  CANONICAL_CANVAS_BOUNDARY_VIOLATION: 'CANONICAL_CANVAS_BOUNDARY_VIOLATION',
  RELATION_ENDPOINT_MISSING: 'RELATION_ENDPOINT_MISSING',
  INVALID_CAPABILITY: 'INVALID_CAPABILITY',
  INVALID_CAPABILITY_PAYLOAD: 'INVALID_CAPABILITY_PAYLOAD',
  INVALID_CONTENT_BLOCK: 'INVALID_CONTENT_BLOCK',
  INVALID_CUSTOM_BLOCK_TYPE: 'INVALID_CONTENT_BLOCK',
  CONTENT_BODY_CONFLICT: 'CONTENT_BODY_CONFLICT',
  CONTENT_CONTRACT_VIOLATION: 'CONTENT_CONTRACT_VIOLATION',
  EDITABLE_CANONICAL_SHARE_REQUIRES_CLONE: 'EDITABLE_OBJECT_REQUIRES_CLONE',
  CANONICAL_RECORD_NOT_FOUND: 'QUERY_SCOPE_NOT_FOUND',
  CANONICAL_RECORD_TOMBSTONED: 'QUERY_SCOPE_NOT_FOUND',
  TOMBSTONE_PLACEHOLDER_RESOLUTION_FAILED: 'QUERY_SCOPE_NOT_FOUND',
  EDITABLE_OBJECT_REQUIRES_CLONE: 'EDITABLE_OBJECT_REQUIRES_CLONE',
  PERSISTENCE_REQUIRED_FIELD_MISSING: 'INVALID_MUTATION_OPERATION',
};

export function mapCanonicalFailureCode(code: string): CanonicalMutationQueryFailureCode | null {
  if (isCanonicalMutationQueryFailureCode(code)) {
    return code;
  }

  return CANONICAL_CODE_FROM_PERSISTENCE[code] ?? null;
}

export function getCanonicalFailureMessage(
  code: CanonicalMutationQueryFailureCode,
): string {
  return MESSAGE_BY_CODE[code];
}

export function makeFailureEnvelope<TCode extends CanonicalMutationQueryFailureCode>(
  code: TCode,
  options?: {
    path?: string;
    details?: CanonicalFailureDetails;
    message?: string;
  },
): CanonicalFailureEnvelope<TCode> {
  return {
    ok: false,
    code,
    message: options?.message ?? getCanonicalFailureMessage(code),
    ...(options?.path ? { path: options.path } : {}),
    ...(options?.details ? { details: options.details } : {}),
  };
}
