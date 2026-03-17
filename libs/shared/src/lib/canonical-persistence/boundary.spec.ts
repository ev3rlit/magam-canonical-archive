import { describe, expect, it } from 'vitest';
import { validateCanvasNodeRecord } from './validators';

describe('canonical/canvas boundary', () => {
  it('rejects canonical payload leakage in canvas node props', () => {
    const result = validateCanvasNodeRecord({
      id: 'node-1',
      documentId: 'doc-1',
      surfaceId: 'surface-1',
      nodeKind: 'native',
      canonicalObjectId: 'object-1',
      props: {
        contentBlocks: [{ id: 'body-1', blockType: 'text', text: 'oops' }],
      },
      layout: { x: 0, y: 0 },
      zIndex: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('CANONICAL_CANVAS_BOUNDARY_VIOLATION');
    }
  });
});
