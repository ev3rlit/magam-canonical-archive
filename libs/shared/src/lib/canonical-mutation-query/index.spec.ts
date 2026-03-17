import { describe, expect, it } from 'vitest';
import {
  CANONICAL_CONCURRENCY_ERROR_CODES,
  CANONICAL_MUTATION_ERROR_CODES,
  CANONICAL_QUERY_ERROR_CODES,
  isCanonicalConcurrencyFailureCode,
  isCanonicalMutationFailureCode,
  isCanonicalMutationQueryFailureCode,
  isCanonicalQueryFailureCode,
  mapCanonicalFailureCode,
  makeFailureEnvelope,
} from './index';

describe('canonical-mutation-query module bootstrap', () => {
  it('exports contract-aligned canonical error code families', () => {
    expect(CANONICAL_MUTATION_ERROR_CODES).toContain('INVALID_MUTATION_OPERATION');
    expect(CANONICAL_MUTATION_ERROR_CODES).toContain('CANONICAL_CANVAS_BOUNDARY_VIOLATION');
    expect(CANONICAL_QUERY_ERROR_CODES).toContain('INVALID_QUERY_CURSOR');
    expect(CANONICAL_CONCURRENCY_ERROR_CODES).toContain('VERSION_CONFLICT');
  });

  it('classifies canonical failure code buckets', () => {
    expect(isCanonicalMutationFailureCode('RELATION_ENDPOINT_MISSING')).toBe(true);
    expect(isCanonicalQueryFailureCode('QUERY_SCOPE_NOT_FOUND')).toBe(true);
    expect(isCanonicalConcurrencyFailureCode('VERSION_BASE_REQUIRED')).toBe(true);
    expect(isCanonicalMutationQueryFailureCode('INVALID_REVISION_TOKEN')).toBe(true);
    expect(isCanonicalMutationQueryFailureCode('RANDOM_CODE')).toBe(false);
  });

  it('maps persistence-like codes to canonical contract errors and builds envelopes', () => {
    expect(mapCanonicalFailureCode('CANONICAL_CANVAS_BOUNDARY_VIOLATION')).toBe('CANONICAL_CANVAS_BOUNDARY_VIOLATION');
    expect(mapCanonicalFailureCode('EDITABLE_CANONICAL_SHARE_REQUIRES_CLONE')).toBe('EDITABLE_OBJECT_REQUIRES_CLONE');
    expect(mapCanonicalFailureCode('UNKNOWN_CODE')).toBeNull();

    const envelope = makeFailureEnvelope('INVALID_QUERY_INCLUDE', {
      path: 'query.include',
      details: { reason: 'unsupported field' },
    });

    expect(envelope).toEqual({
      ok: false,
      code: 'INVALID_QUERY_INCLUDE',
      message: envelope.message,
      path: 'query.include',
      details: { reason: 'unsupported field' },
    });
    expect(typeof envelope.message).toBe('string');
    expect(envelope.message.length).toBeGreaterThan(0);
  });
});
