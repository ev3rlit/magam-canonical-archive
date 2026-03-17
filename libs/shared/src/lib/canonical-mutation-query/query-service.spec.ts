import { describe, expect, it } from 'vitest';
import { CanonicalQueryService } from './query-service';
import type {
  CanonicalQueryRepository,
  QueryIncludeKey,
} from './contracts';
import type {
  CanvasBindingRecord,
  CanvasNodeRecord,
  ObjectRelationRecord,
} from '../canonical-persistence/records';
import type { CanonicalObjectRecord } from '../canonical-object-contract';

const OBJECTS: CanonicalObjectRecord[] = [
  {
    id: 'note-1',
    workspaceId: 'ws-1',
    semanticRole: 'topic',
    sourceMeta: { sourceId: 'note-1', kind: 'canvas' },
    capabilities: {},
    canonicalText: 'hello',
    primaryContentKind: 'text',
    contentBlocks: [{ id: 'b1', blockType: 'text', text: 'hello' }],
  },
  {
    id: 'img-1',
    workspaceId: 'ws-1',
    semanticRole: 'image',
    sourceMeta: { sourceId: 'img-1', kind: 'canvas' },
    capabilities: { content: { kind: 'media', src: '/a.png', alt: 'a' } },
    canonicalText: 'a',
    primaryContentKind: 'media',
  },
];

const RELATIONS: ObjectRelationRecord[] = [
  {
    id: 'rel-1',
    workspaceId: 'ws-1',
    fromObjectId: 'note-1',
    toObjectId: 'img-1',
    relationType: 'depends-on',
  },
];

const NODES: CanvasNodeRecord[] = [
  {
    id: 'node-1',
    documentId: 'doc-1',
    surfaceId: 'surface-1',
    nodeKind: 'native',
    canonicalObjectId: 'note-1',
    layout: { x: 0, y: 0 },
    zIndex: 1,
  },
];

const BINDINGS: CanvasBindingRecord[] = [
  {
    id: 'binding-1',
    documentId: 'doc-1',
    nodeId: 'node-1',
    bindingKind: 'object',
    sourceRef: { kind: 'object', workspaceId: 'ws-1', objectId: 'note-1' },
    mapping: { field: 'title' },
  },
];

function buildRepository(): CanonicalQueryRepository {
  return {
    async queryCanonicalObjects(input) {
      const filtered = OBJECTS.filter((record) => {
        if (record.workspaceId !== input.workspaceId) {
          return false;
        }
        if (input.filters?.semanticRole && !input.filters.semanticRole.includes(record.semanticRole)) {
          return false;
        }
        return true;
      });
      return { objects: filtered, cursor: filtered.length > 0 ? 'next-cursor' : undefined };
    },
    async listObjectRelations() {
      return RELATIONS;
    },
    async listCanvasNodes() {
      return NODES;
    },
    async listCanvasBindings() {
      return BINDINGS;
    },
    async getRevisionState(documentId) {
      if (documentId !== 'doc-1') {
        return null;
      }
      return {
        documentId,
        headRevision: 'rev:4',
        revisionNo: 4,
      };
    },
  };
}

describe('CanonicalQueryService', () => {
  it('returns only requested include resources', async () => {
    const service = new CanonicalQueryService(buildRepository());
    const result = await service.execute({
      workspaceId: 'ws-1',
      include: ['objects'],
      filters: { semanticRole: ['topic'] },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.objects?.map((record) => record.id)).toEqual(['note-1']);
      expect('relations' in result.data).toBe(false);
      expect('canvasNodes' in result.data).toBe(false);
    }
  });

  it('rejects unsupported include requests without partial success', async () => {
    const service = new CanonicalQueryService(buildRepository());
    const result = await service.execute({
      workspaceId: 'ws-1',
      include: ['objects', 'unsupported'],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INVALID_QUERY_INCLUDE');
    }
  });

  it('requires document scope for canvas and revision includes', async () => {
    const service = new CanonicalQueryService(buildRepository());
    const result = await service.execute({
      workspaceId: 'ws-1',
      include: ['canvasNodes', 'documentRevision'] as QueryIncludeKey[],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('QUERY_SCOPE_NOT_FOUND');
      expect(result.path).toBe('documentId');
    }
  });

  it('loads object+relation+surface+binding+revision with a unified envelope', async () => {
    const service = new CanonicalQueryService(buildRepository());
    const result = await service.execute({
      workspaceId: 'ws-1',
      documentId: 'doc-1',
      include: ['objects', 'relations', 'canvasNodes', 'bindings', 'documentRevision'],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.objects?.length).toBe(2);
      expect(result.data.relations?.length).toBe(1);
      expect(result.data.canvasNodes?.length).toBe(1);
      expect(result.data.bindings?.length).toBe(1);
      expect(result.data.documentRevision?.revision).toBe('rev:4');
      expect(result.page?.cursor).toBe('next-cursor');
    }
  });
});
