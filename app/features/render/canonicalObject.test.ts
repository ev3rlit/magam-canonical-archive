import { describe, expect, it } from 'bun:test';

import {
  invalidValidation,
  isContentKind,
  isSemanticRole,
  okValidation,
  validateObjectCore,
} from './canonicalObject';

describe('canonicalObject', () => {
  it('recognizes supported semantic roles', () => {
    expect(isSemanticRole('topic')).toBe(true);
    expect(isSemanticRole('sticky-note')).toBe(true);
    expect(isSemanticRole('generic')).toBe(false);
  });

  it('recognizes supported content kinds', () => {
    expect(isContentKind('text')).toBe(true);
    expect(isContentKind('media')).toBe(true);
    expect(isContentKind('html')).toBe(false);
  });

  it('creates ok and invalid validation results', () => {
    expect(okValidation()).toEqual({ ok: true });
    expect(
      invalidValidation('INVALID_OBJECT_CORE', 'invalid core', 'core.id'),
    ).toEqual({
      ok: false,
      code: 'INVALID_OBJECT_CORE',
      message: 'invalid core',
      path: 'core.id',
    });
  });

  it('validates object core shape', () => {
    expect(
      validateObjectCore({
        id: 'node-1',
        sourceMeta: { sourceId: 'node-1', kind: 'canvas' },
      }),
    ).toEqual({ ok: true });

    expect(validateObjectCore(null)).toEqual({
      ok: false,
      code: 'INVALID_OBJECT_CORE',
      message: 'Object core must be an object.',
    });

    expect(
      validateObjectCore({
        id: '',
        sourceMeta: { sourceId: 'node-1' },
      }),
    ).toEqual({
      ok: false,
      code: 'INVALID_OBJECT_CORE',
      message: 'Object core requires a non-empty id.',
      path: 'core.id',
    });

    expect(
      validateObjectCore({
        id: 'node-1',
        sourceMeta: {},
      }),
    ).toEqual({
      ok: false,
      code: 'INVALID_OBJECT_CORE',
      message: 'Object core requires sourceMeta.sourceId.',
      path: 'core.sourceMeta.sourceId',
    });
  });
});
