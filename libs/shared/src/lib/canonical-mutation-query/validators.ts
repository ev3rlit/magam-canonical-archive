import type { CapabilityBag } from '../canonical-object-contract';
import type {
  CanonicalMutationEnvelope,
  CanonicalQueryRequest,
  MutationFailure,
  MutationOperation,
  QueryIncludeKey,
  CanonicalQueryFailure,
} from './contracts';
import { QUERY_INCLUDE_KEYS } from './contracts';
import {
  validateCapabilityBag,
  validateContentBlocks,
} from '../canonical-persistence/validators';

type ValidationSuccess<T> = { ok: true; value: T };
type ValidationFailure<E> = { ok: false; error: E };
type ValidationResult<T, E> = ValidationSuccess<T> | ValidationFailure<E>;

const QUERY_INCLUDE_SET = new Set<string>(QUERY_INCLUDE_KEYS);
const CAPABILITY_KEY_SET = new Set<keyof CapabilityBag>([
  'frame',
  'material',
  'texture',
  'attach',
  'ports',
  'bubble',
  'content',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function toQueryFailure(
  code: CanonicalQueryFailure['code'],
  message: string,
  path?: string,
): CanonicalQueryFailure {
  return { code, message, ...(path ? { path } : {}) };
}

function toMutationFailure(
  code: MutationFailure['code'],
  message: string,
  path?: string,
  details?: Record<string, unknown>,
): MutationFailure {
  return {
    code,
    message,
    ...(path ? { path } : {}),
    ...(details ? { details } : {}),
  };
}

function validateIncludeKeys(include: string[]): ValidationResult<QueryIncludeKey[], CanonicalQueryFailure> {
  const invalid = include.filter((key) => !QUERY_INCLUDE_SET.has(key));
  if (invalid.length > 0) {
    return {
      ok: false,
      error: toQueryFailure(
        'INVALID_QUERY_INCLUDE',
        `Unsupported include fields: ${invalid.join(', ')}`,
        'include',
      ),
    };
  }

  return {
    ok: true,
    value: include as QueryIncludeKey[],
  };
}

function validateQueryBounds(request: CanonicalQueryRequest): ValidationResult<CanonicalQueryRequest, CanonicalQueryFailure> {
  if (!request.bounds) {
    return { ok: true, value: request };
  }

  const { x, y, width, height } = request.bounds;
  const numeric = [x, y, width, height].every((value) => typeof value === 'number' && Number.isFinite(value));
  if (!numeric || width <= 0 || height <= 0) {
    return {
      ok: false,
      error: toQueryFailure(
        'INVALID_QUERY_BOUNDS',
        'bounds must be finite numbers and width/height must be positive.',
        'bounds',
      ),
    };
  }

  return { ok: true, value: request };
}

function validateQueryFilters(request: CanonicalQueryRequest): ValidationResult<CanonicalQueryRequest, CanonicalQueryFailure> {
  const filters = request.filters;
  if (!filters) {
    return { ok: true, value: request };
  }

  if (filters.semanticRole && !filters.semanticRole.every((value) => hasNonEmptyString(value))) {
    return {
      ok: false,
      error: toQueryFailure('INVALID_QUERY_FILTER', 'filters.semanticRole must contain non-empty strings.', 'filters.semanticRole'),
    };
  }

  if (filters.primaryContentKind && !filters.primaryContentKind.every((value) => value === null || hasNonEmptyString(value))) {
    return {
      ok: false,
      error: toQueryFailure('INVALID_QUERY_FILTER', 'filters.primaryContentKind contains invalid values.', 'filters.primaryContentKind'),
    };
  }

  if (filters.hasCapability && !filters.hasCapability.every((value) => CAPABILITY_KEY_SET.has(value))) {
    return {
      ok: false,
      error: toQueryFailure('INVALID_QUERY_FILTER', 'filters.hasCapability contains unsupported capability keys.', 'filters.hasCapability'),
    };
  }

  if (filters.alias && !filters.alias.every((value) => hasNonEmptyString(value))) {
    return {
      ok: false,
      error: toQueryFailure('INVALID_QUERY_FILTER', 'filters.alias must contain non-empty strings.', 'filters.alias'),
    };
  }

  return { ok: true, value: request };
}

export function validateCanonicalQueryRequest(
  request: CanonicalQueryRequest,
): ValidationResult<CanonicalQueryRequest & { include: QueryIncludeKey[] }, CanonicalQueryFailure> {
  if (!hasNonEmptyString(request.workspaceId)) {
    return {
      ok: false,
      error: toQueryFailure('INVALID_QUERY_FILTER', 'workspaceId is required.', 'workspaceId'),
    };
  }

  if (!Array.isArray(request.include) || request.include.length === 0) {
    return {
      ok: false,
      error: toQueryFailure('INVALID_QUERY_INCLUDE', 'include must be a non-empty array.', 'include'),
    };
  }

  if (request.limit !== undefined && (!Number.isInteger(request.limit) || request.limit <= 0)) {
    return {
      ok: false,
      error: toQueryFailure('INVALID_QUERY_FILTER', 'limit must be a positive integer.', 'limit'),
    };
  }

  if (request.cursor !== undefined && !hasNonEmptyString(request.cursor)) {
    return {
      ok: false,
      error: toQueryFailure('INVALID_QUERY_CURSOR', 'cursor must be a non-empty string.', 'cursor'),
    };
  }

  const includeResult = validateIncludeKeys(request.include);
  if (!includeResult.ok) {
    return includeResult;
  }

  const boundsResult = validateQueryBounds(request);
  if (!boundsResult.ok) {
    return boundsResult;
  }

  const filtersResult = validateQueryFilters(request);
  if (!filtersResult.ok) {
    return filtersResult;
  }

  return {
    ok: true,
    value: {
      ...request,
      include: includeResult.value,
    },
  };
}

function validateMutationOperationShape(operation: MutationOperation, index: number): ValidationResult<MutationOperation, MutationFailure> {
  const path = `operations.${index}`;

  if (operation.op === 'object.create') {
    if (!isRecord(operation.input) || !isRecord(operation.input.record)) {
      return {
        ok: false,
        error: toMutationFailure('INVALID_MUTATION_OPERATION', 'object.create requires input.record.', `${path}.input.record`),
      };
    }
    return { ok: true, value: operation };
  }

  if ('objectId' in operation && !hasNonEmptyString(operation.objectId)) {
    return {
      ok: false,
      error: toMutationFailure('INVALID_MUTATION_OPERATION', 'operation.objectId must be a non-empty string.', `${path}.objectId`),
    };
  }

  if (operation.op === 'object.body.replace') {
    const blockValidation = validateContentBlocks({ contentBlocks: operation.blocks });
    if (!blockValidation.ok) {
      return {
        ok: false,
        error: toMutationFailure(
          blockValidation.code ?? 'INVALID_CONTENT_BLOCK',
          blockValidation.message ?? 'content blocks are invalid.',
          blockValidation.path ?? `${path}.blocks`,
        ),
      };
    }
  }

  if (operation.op === 'object.body.block.insert') {
    if (!Number.isInteger(operation.at) || operation.at < 0) {
      return {
        ok: false,
        error: toMutationFailure('INVALID_CONTENT_BLOCK', 'insert index must be a non-negative integer.', `${path}.at`),
      };
    }

    const blockValidation = validateContentBlocks({ contentBlocks: [operation.block] });
    if (!blockValidation.ok) {
      return {
        ok: false,
        error: toMutationFailure(
          blockValidation.code ?? 'INVALID_CONTENT_BLOCK',
          blockValidation.message ?? 'content block payload is invalid.',
          blockValidation.path ?? `${path}.block`,
        ),
      };
    }
  }

  if (operation.op === 'object.patch-capability') {
    const patch = operation.patch as Partial<CapabilityBag>;
    const bagValidation = validateCapabilityBag({
      ...(patch.frame !== undefined ? { frame: patch.frame } : {}),
      ...(patch.material !== undefined ? { material: patch.material } : {}),
      ...(patch.texture !== undefined ? { texture: patch.texture } : {}),
      ...(patch.attach !== undefined ? { attach: patch.attach } : {}),
      ...(patch.ports !== undefined ? { ports: patch.ports } : {}),
      ...(patch.bubble !== undefined ? { bubble: patch.bubble } : {}),
      ...(patch.content !== undefined ? { content: patch.content } : {}),
      ...Object.fromEntries(
        Object.keys(patch)
          .filter((key) => !CAPABILITY_KEY_SET.has(key as keyof CapabilityBag))
          .map((key) => [key, (patch as Record<string, unknown>)[key]]),
      ),
    } as CapabilityBag);

    if (!bagValidation.ok) {
      return {
        ok: false,
        error: toMutationFailure(
          bagValidation.code ?? 'INVALID_CAPABILITY_PAYLOAD',
          bagValidation.message ?? 'capability payload is invalid.',
          bagValidation.path ?? `${path}.patch`,
        ),
      };
    }
  }

  return { ok: true, value: operation };
}

export function validateCanonicalMutationEnvelope(
  envelope: CanonicalMutationEnvelope,
): ValidationResult<CanonicalMutationEnvelope, MutationFailure> {
  if (!hasNonEmptyString(envelope.workspaceId)) {
    return {
      ok: false,
      error: toMutationFailure('INVALID_MUTATION_OPERATION', 'workspaceId is required.', 'workspaceId'),
    };
  }

  if (!hasNonEmptyString(envelope.documentId)) {
    return {
      ok: false,
      error: toMutationFailure('INVALID_MUTATION_OPERATION', 'documentId is required.', 'documentId'),
    };
  }

  if (!hasNonEmptyString(envelope.baseRevision)) {
    return {
      ok: false,
      error: toMutationFailure('VERSION_BASE_REQUIRED', 'baseRevision is required.', 'baseRevision'),
    };
  }

  if (!isRecord(envelope.actor) || !hasNonEmptyString(envelope.actor.id)) {
    return {
      ok: false,
      error: toMutationFailure('INVALID_MUTATION_OPERATION', 'actor.id is required.', 'actor.id'),
    };
  }

  if (!['user', 'agent', 'system'].includes(envelope.actor.kind)) {
    return {
      ok: false,
      error: toMutationFailure('INVALID_MUTATION_OPERATION', 'actor.kind is invalid.', 'actor.kind'),
    };
  }

  if (!Array.isArray(envelope.operations) || envelope.operations.length === 0) {
    return {
      ok: false,
      error: toMutationFailure('INVALID_MUTATION_OPERATION', 'operations must be a non-empty array.', 'operations'),
    };
  }

  for (let index = 0; index < envelope.operations.length; index += 1) {
    const result = validateMutationOperationShape(envelope.operations[index], index);
    if (!result.ok) {
      return result;
    }
  }

  return {
    ok: true,
    value: envelope,
  };
}
