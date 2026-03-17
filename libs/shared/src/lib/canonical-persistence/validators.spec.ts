import { describe, expect, it } from 'vitest';
import type { CanonicalObjectRecord } from '../canonical-object-contract';
import { deriveCanonicalText, derivePrimaryContentKind } from './mappers';
import {
  createEmptyTextBlock,
  seedEditableNoteContentBlocks,
  validateCanonicalObjectRecord,
} from './validators';

function buildBaseRecord(overrides?: Partial<CanonicalObjectRecord>): CanonicalObjectRecord {
  return {
    id: 'note-1',
    workspaceId: 'ws-1',
    semanticRole: 'sticky-note',
    publicAlias: 'Sticky',
    sourceMeta: { sourceId: 'note-1', kind: 'canvas' },
    capabilities: {},
    contentBlocks: [{ id: 'body-1', blockType: 'text', text: 'hello' }],
    primaryContentKind: 'text',
    canonicalText: 'hello',
    ...overrides,
  };
}

describe('canonical-persistence validators', () => {
  it('accepts canonical fixtures for all supported public aliases without alias-specific storage tables', () => {
    const sequenceParticipants = [{ id: 'actor-1' }];
    const sequenceMessages = [{ id: 'msg-1', from: 'actor-1', to: 'actor-2' }];
    const fixtures: CanonicalObjectRecord[] = [
      buildBaseRecord({
        semanticRole: 'topic',
        publicAlias: 'Node',
        contentBlocks: [{ id: 'body-1', blockType: 'text', text: 'node body' }],
        primaryContentKind: 'text',
        canonicalText: 'node body',
      }),
      buildBaseRecord({
        semanticRole: 'shape',
        publicAlias: 'Shape',
        contentBlocks: undefined,
        primaryContentKind: null,
        canonicalText: '',
      }),
      buildBaseRecord({
        semanticRole: 'sticky-note',
        publicAlias: 'Sticky',
        contentBlocks: [{ id: 'body-1', blockType: 'text', text: 'sticky body' }],
        primaryContentKind: 'text',
        canonicalText: 'sticky body',
      }),
      buildBaseRecord({
        semanticRole: 'image',
        publicAlias: 'Image',
        contentBlocks: undefined,
        capabilities: {
          content: {
            kind: 'media',
            src: '/image.png',
            alt: 'image alt',
          },
        },
        primaryContentKind: 'media',
        canonicalText: 'image alt',
      }),
      buildBaseRecord({
        semanticRole: 'topic',
        publicAlias: 'Markdown',
        contentBlocks: undefined,
        capabilities: {
          content: {
            kind: 'markdown',
            source: '# heading',
          },
        },
        primaryContentKind: 'markdown',
        canonicalText: '# heading',
      }),
      buildBaseRecord({
        semanticRole: 'sticker',
        publicAlias: 'Sticker',
        contentBlocks: undefined,
        primaryContentKind: null,
        canonicalText: '',
      }),
      buildBaseRecord({
        semanticRole: 'sequence',
        publicAlias: 'Sequence',
        contentBlocks: undefined,
        capabilities: {
          content: {
            kind: 'sequence',
            participants: sequenceParticipants,
            messages: sequenceMessages,
          },
        },
        primaryContentKind: 'sequence',
        canonicalText: `${JSON.stringify(sequenceParticipants[0])}\n${JSON.stringify(sequenceMessages[0])}`,
      }),
    ];

    for (const fixture of fixtures) {
      const validation = validateCanonicalObjectRecord(fixture);
      expect(validation.ok).toBe(true);
    }
  });

  it('derives primary content kind and canonical text from content blocks', () => {
    const record = buildBaseRecord({
      contentBlocks: [
        { id: 'body-1', blockType: 'text', text: 'plain body' },
        { id: 'body-2', blockType: 'markdown', source: '# heading' },
      ],
    });

    expect(derivePrimaryContentKind(record)).toBe('markdown');
    expect(deriveCanonicalText(record)).toBe('plain body\n# heading');
  });

  it('uses textualProjection for custom blocks and allows NULL primary kind when only custom blocks exist', () => {
    const record = buildBaseRecord({
      contentBlocks: [
        {
          id: 'custom-1',
          blockType: 'plugin.table',
          payload: { rows: 2 },
          textualProjection: 'table summary',
        },
      ],
      primaryContentKind: null,
      canonicalText: 'table summary',
    });

    expect(derivePrimaryContentKind(record)).toBeNull();
    expect(deriveCanonicalText(record)).toBe('table summary');
    expect(validateCanonicalObjectRecord(record).ok).toBe(true);
  });

  it('rejects invalid custom block namespaces', () => {
    const record = buildBaseRecord({
      contentBlocks: [
        {
          id: 'custom-1',
          blockType: 'table',
          payload: { rows: 2 },
        } as any,
      ],
      primaryContentKind: null,
      canonicalText: '',
    });

    const validation = validateCanonicalObjectRecord(record);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.code).toBe('INVALID_CUSTOM_BLOCK_TYPE');
    }
  });

  it('rejects direct content and contentBlocks conflicts', () => {
    const validation = validateCanonicalObjectRecord(buildBaseRecord({
      capabilities: {
        content: {
          kind: 'text',
          value: 'duplicate body',
        },
      },
      canonicalText: 'hello',
      primaryContentKind: 'text',
    }));

    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.code).toBe('CONTENT_BODY_CONFLICT');
    }
  });

  it('seeds an empty text block for editable notes with no initial body', () => {
    const seeded = seedEditableNoteContentBlocks(buildBaseRecord({
      contentBlocks: undefined,
      primaryContentKind: 'text',
      canonicalText: '',
    }));

    expect(seeded.contentBlocks).toEqual([createEmptyTextBlock()]);
  });

  it('rejects duplicate content block ids to preserve ordered block invariants', () => {
    const validation = validateCanonicalObjectRecord(buildBaseRecord({
      contentBlocks: [
        { id: 'body-1', blockType: 'text', text: 'first' },
        { id: 'body-1', blockType: 'markdown', source: '# second' },
      ],
      primaryContentKind: 'markdown',
      canonicalText: 'first\n# second',
    }));

    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.code).toBe('INVALID_CONTENT_BLOCK');
      expect(validation.path).toBe('contentBlocks.1.id');
    }
  });
});
