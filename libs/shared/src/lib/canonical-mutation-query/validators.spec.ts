import { describe, expect, it } from 'vitest';
import {
  validateCanonicalMutationEnvelope,
  validateCanonicalQueryRequest,
} from './validators';
import type { CanonicalMutationEnvelope } from './contracts';

function buildEnvelope(): CanonicalMutationEnvelope {
  return {
    workspaceId: 'ws-1',
    documentId: 'doc-1',
    baseRevision: 'rev:1',
    actor: { kind: 'user', id: 'u1' },
    operations: [
      {
        op: 'object.update-core',
        objectId: 'note-1',
        patch: {
          semanticRole: 'topic',
        },
      },
    ],
  };
}

describe('canonical-mutation-query validators', () => {
  it('rejects unsupported include values', () => {
    const result = validateCanonicalQueryRequest({
      workspaceId: 'ws-1',
      include: ['objects', 'not-supported'],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_QUERY_INCLUDE');
    }
  });

  it('rejects missing base revision with VERSION_BASE_REQUIRED', () => {
    const result = validateCanonicalMutationEnvelope({
      ...buildEnvelope(),
      baseRevision: '',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VERSION_BASE_REQUIRED');
    }
  });

  it('rejects invalid capability patch keys', () => {
    const result = validateCanonicalMutationEnvelope({
      ...buildEnvelope(),
      operations: [
        {
          op: 'object.patch-capability',
          objectId: 'note-1',
          patch: { unknown: true } as never,
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_CAPABILITY');
    }
  });

  it('accepts valid include/filter/bounds payload', () => {
    const result = validateCanonicalQueryRequest({
      workspaceId: 'ws-1',
      include: ['objects', 'documentRevision'],
      filters: {
        semanticRole: ['topic'],
        hasCapability: ['content'],
      },
      limit: 20,
      cursor: 'opaque-token',
      bounds: { x: 0, y: 0, width: 100, height: 80 },
      documentId: 'doc-1',
    });

    expect(result.ok).toBe(true);
  });
});
