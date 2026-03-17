import { describe, expect, it } from 'vitest';
import { createCanonicalPgliteDb } from './pglite-db';
import {
  CanonicalPersistenceRepository,
  createDocumentRevisionToken,
} from './repository';

function buildNoteRecord(id: string) {
  return {
    id,
    workspaceId: 'ws-1',
    semanticRole: 'sticky-note' as const,
    publicAlias: 'Sticky' as const,
    sourceMeta: { sourceId: id, kind: 'canvas' as const },
    capabilities: {},
    contentBlocks: [{ id: 'body-1', blockType: 'text' as const, text: 'hello' }],
    primaryContentKind: 'text' as const,
    canonicalText: 'hello',
  };
}

function buildImageRecord(id: string) {
  return {
    id,
    workspaceId: 'ws-1',
    semanticRole: 'image' as const,
    publicAlias: 'Image' as const,
    sourceMeta: { sourceId: id, kind: 'canvas' as const },
    capabilities: {
      content: {
        kind: 'media' as const,
        src: '/asset.png',
        alt: 'asset',
      },
    },
    primaryContentKind: 'media' as const,
    canonicalText: 'asset',
  };
}

function buildShapeRecord(id: string) {
  return {
    id,
    workspaceId: 'ws-1',
    semanticRole: 'shape' as const,
    publicAlias: 'Shape' as const,
    sourceMeta: { sourceId: id, kind: 'canvas' as const },
    capabilities: {
      frame: {
        fill: '#fff',
      },
    },
    primaryContentKind: null,
    canonicalText: '',
  };
}

describe('CanonicalPersistenceRepository', () => {
  it('stores and reads canonical objects', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const repository = new CanonicalPersistenceRepository(handle.db);

    const created = await repository.createCanonicalObject({
      record: buildImageRecord('image-1'),
      operation: 'create',
    });

    expect(created.ok).toBe(true);
    const fetched = await repository.getCanonicalObject('ws-1', 'image-1');
    expect(fetched.ok).toBe(true);
    if (fetched.ok) {
      expect(fetched.value.primaryContentKind).toBe('media');
    }

    await handle.close();
  });

  it('allows workspace-scoped reuse of the same canonical id for non-note objects', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const repository = new CanonicalPersistenceRepository(handle.db);

    const first = await repository.createCanonicalObject({
      record: buildImageRecord('shared-image'),
      operation: 'create',
    });
    const second = await repository.createCanonicalObject({
      record: {
        ...buildImageRecord('shared-image'),
        workspaceId: 'ws-2',
      },
      operation: 'create',
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);

    const ws1Record = await repository.getCanonicalObject('ws-1', 'shared-image');
    const ws2Record = await repository.getCanonicalObject('ws-2', 'shared-image');

    expect(ws1Record.ok).toBe(true);
    expect(ws2Record.ok).toBe(true);
    if (ws1Record.ok && ws2Record.ok) {
      expect(ws1Record.value.workspaceId).toBe('ws-1');
      expect(ws2Record.value.workspaceId).toBe('ws-2');
      expect(ws1Record.value.publicAlias).toBe('Image');
      expect(ws2Record.value.primaryContentKind).toBe('media');
    }

    await handle.close();
  });

  it('enforces clone-on-create semantics for editable note duplicates', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const repository = new CanonicalPersistenceRepository(handle.db);

    const original = await repository.createCanonicalObject({
      record: buildNoteRecord('note-1'),
      operation: 'create',
    });
    expect(original.ok).toBe(true);

    const cloned = await repository.cloneEditableNote({
      workspaceId: 'ws-1',
      sourceId: 'note-1',
      clonedId: 'note-2',
    });

    expect(cloned.ok).toBe(true);
    if (cloned.ok) {
      expect(cloned.value.id).toBe('note-2');
      expect(cloned.value.contentBlocks?.[0].id).toBe('body-1');
    }

    const duplicateCreate = await repository.createCanonicalObject({
      record: buildNoteRecord('note-1'),
      operation: 'duplicate',
    });

    expect(duplicateCreate.ok).toBe(false);
    if (!duplicateCreate.ok) {
      expect(duplicateCreate.code).toBe('EDITABLE_OBJECT_REQUIRES_CLONE');
    }

    await handle.close();
  });

  it('seeds empty note bodies on create and rejects shared-note reuse during import', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const repository = new CanonicalPersistenceRepository(handle.db);

    const created = await repository.createCanonicalObject({
      record: {
        ...buildNoteRecord('note-empty'),
        contentBlocks: undefined,
        canonicalText: '',
        primaryContentKind: 'text',
      },
      operation: 'create',
    });

    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.contentBlocks).toEqual([
        { id: 'body-1', blockType: 'text', text: '' },
      ]);
    }

    const imported = await repository.createCanonicalObject({
      record: buildNoteRecord('note-empty'),
      operation: 'import',
    });

    expect(imported.ok).toBe(false);
    if (!imported.ok) {
      expect(imported.code).toBe('EDITABLE_OBJECT_REQUIRES_CLONE');
    }

    await handle.close();
  });

  it('rejects relation writes when endpoints are missing or tombstoned', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const repository = new CanonicalPersistenceRepository(handle.db);

    await repository.createCanonicalObject({
      record: buildImageRecord('image-1'),
      operation: 'create',
    });

    const missingSource = await repository.createObjectRelation({
      id: 'rel-1',
      workspaceId: 'ws-1',
      fromObjectId: 'missing',
      toObjectId: 'image-1',
      relationType: 'depends-on',
    });

    expect(missingSource.ok).toBe(false);
    if (!missingSource.ok) {
      expect(missingSource.code).toBe('RELATION_ENDPOINT_MISSING');
    }

    await repository.createCanonicalObject({
      record: buildImageRecord('image-2'),
      operation: 'create',
    });
    await repository.tombstoneCanonicalObject('ws-1', 'image-2');

    const tombstonedTarget = await repository.createObjectRelation({
      id: 'rel-2',
      workspaceId: 'ws-1',
      fromObjectId: 'image-1',
      toObjectId: 'image-2',
      relationType: 'depends-on',
    });

    expect(tombstonedTarget.ok).toBe(false);
    if (!tombstonedTarget.ok) {
      expect(tombstonedTarget.code).toBe('RELATION_ENDPOINT_MISSING');
    }

    await handle.close();
  });

  it('resolves tombstoned canonical object bindings through placeholder diagnostics', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const repository = new CanonicalPersistenceRepository(handle.db);

    await repository.createCanonicalObject({
      record: buildNoteRecord('note-binding'),
      operation: 'create',
    });
    await repository.createCanvasNode({
      id: 'node-1',
      documentId: 'doc-1',
      surfaceId: 'surface-1',
      nodeKind: 'native',
      canonicalObjectId: 'note-binding',
      layout: { x: 0, y: 0 },
      zIndex: 1,
    });
    await repository.createCanvasBinding({
      id: 'binding-1',
      documentId: 'doc-1',
      nodeId: 'node-1',
      bindingKind: 'object',
      sourceRef: {
        kind: 'object',
        workspaceId: 'ws-1',
        objectId: 'note-binding',
      },
      mapping: { field: 'title' },
    });
    await repository.tombstoneCanonicalObject('ws-1', 'note-binding');

    const resolved = await repository.resolveCanvasBinding('doc-1', 'binding-1');

    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.value.placeholder).toBe(true);
      expect(resolved.value.canonicalObjectId).toBe('note-binding');
      expect(resolved.value.record.sourceRef).toEqual({
        kind: 'object',
        workspaceId: 'ws-1',
        objectId: 'note-binding',
      });
      expect(resolved.value.diagnostics).toEqual([{
        code: 'TOMBSTONED_CANONICAL_OBJECT',
        message: 'Canonical object note-binding is tombstoned; binding resolves through placeholder mode.',
        bindingId: 'binding-1',
        nodeId: 'node-1',
        canonicalObjectId: 'note-binding',
      }]);
    }

    await handle.close();
  });

  it('fails binding placeholder resolution when object bindings omit canonical identifiers', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const repository = new CanonicalPersistenceRepository(handle.db);

    await repository.createCanvasBinding({
      id: 'binding-bad',
      documentId: 'doc-1',
      nodeId: 'node-1',
      bindingKind: 'object',
      sourceRef: {
        kind: 'object',
      },
      mapping: { field: 'title' },
    });

    const resolved = await repository.resolveCanvasBinding('doc-1', 'binding-bad');

    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.code).toBe('TOMBSTONE_PLACEHOLDER_RESOLUTION_FAILED');
      expect(resolved.path).toBe('sourceRef');
    }

    await handle.close();
  });

  it('does not misclassify query bindings that happen to contain objectId fields', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const repository = new CanonicalPersistenceRepository(handle.db);

    await repository.createCanvasBinding({
      id: 'binding-query',
      documentId: 'doc-1',
      nodeId: 'node-1',
      bindingKind: 'query',
      sourceRef: {
        kind: 'query',
        objectId: 'query-fragment',
      },
      mapping: { field: 'title' },
    });

    const resolved = await repository.resolveCanvasBinding('doc-1', 'binding-query');

    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.value.placeholder).toBe(false);
      expect(resolved.value.diagnostics).toEqual([]);
      expect(resolved.value.canonicalObjectId).toBeUndefined();
    }

    await handle.close();
  });

  it('supports filtered canonical object query with cursor pagination', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const repository = new CanonicalPersistenceRepository(handle.db);

    await repository.createCanonicalObject({
      record: buildShapeRecord('shape-1'),
      operation: 'create',
    });
    await repository.createCanonicalObject({
      record: buildImageRecord('image-1'),
      operation: 'create',
    });
    await repository.createCanonicalObject({
      record: buildImageRecord('image-2'),
      operation: 'create',
    });

    const filtered = await repository.listCanonicalObjectsByFilters({
      workspaceId: 'ws-1',
      filters: {
        semanticRole: ['image'],
        primaryContentKind: ['media'],
        alias: ['Image'],
        hasCapability: ['content'],
      },
      limit: 10,
    });

    expect(filtered.ok).toBe(true);
    if (filtered.ok) {
      expect(filtered.value.objects.map((record) => record.id)).toEqual(['image-1', 'image-2']);
    }

    const firstPage = await repository.listCanonicalObjectsByFilters({
      workspaceId: 'ws-1',
      limit: 1,
    });
    expect(firstPage.ok).toBe(true);
    if (!firstPage.ok || !firstPage.value.cursor) {
      throw new Error('expected first page cursor');
    }

    const secondPage = await repository.listCanonicalObjectsByFilters({
      workspaceId: 'ws-1',
      limit: 1,
      cursor: firstPage.value.cursor,
    });
    expect(secondPage.ok).toBe(true);
    if (secondPage.ok) {
      expect(secondPage.value.objects.length).toBe(1);
      expect(secondPage.value.objects[0]?.id).not.toBe(firstPage.value.objects[0]?.id);
    }

    await handle.close();
  });

  it('loads document surface view with bounds, bindings, objects, and head revision', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const repository = new CanonicalPersistenceRepository(handle.db);

    await repository.createCanonicalObject({
      record: buildNoteRecord('note-surface-1'),
      operation: 'create',
    });
    await repository.createCanonicalObject({
      record: buildImageRecord('image-surface-1'),
      operation: 'create',
    });
    await repository.createCanvasNode({
      id: 'node-surface-a',
      documentId: 'doc-surface-1',
      surfaceId: 'surface-main',
      nodeKind: 'native',
      canonicalObjectId: 'note-surface-1',
      layout: { x: 10, y: 10 },
      zIndex: 1,
    });
    await repository.createCanvasNode({
      id: 'node-surface-b',
      documentId: 'doc-surface-1',
      surfaceId: 'surface-main',
      nodeKind: 'native',
      canonicalObjectId: 'image-surface-1',
      layout: { x: 400, y: 40 },
      zIndex: 2,
    });
    await repository.createCanvasNode({
      id: 'node-other-surface',
      documentId: 'doc-surface-1',
      surfaceId: 'surface-other',
      nodeKind: 'native',
      canonicalObjectId: 'image-surface-1',
      layout: { x: 1, y: 1 },
      zIndex: 1,
    });
    await repository.createCanvasBinding({
      id: 'binding-surface-a',
      documentId: 'doc-surface-1',
      nodeId: 'node-surface-a',
      bindingKind: 'object',
      sourceRef: {
        kind: 'object',
        workspaceId: 'ws-1',
        objectId: 'note-surface-1',
      },
      mapping: { field: 'title' },
    });
    await repository.createCanvasBinding({
      id: 'binding-surface-b',
      documentId: 'doc-surface-1',
      nodeId: 'node-surface-b',
      bindingKind: 'object',
      sourceRef: {
        kind: 'object',
        workspaceId: 'ws-1',
        objectId: 'image-surface-1',
      },
      mapping: { field: 'src' },
    });
    await repository.appendDocumentRevision({
      id: 'rev-surface-1',
      documentId: 'doc-surface-1',
      revisionNo: 1,
      authorKind: 'user',
      authorId: 'tester',
      mutationBatch: { operations: [] },
    });

    const loaded = await repository.loadDocumentSurface({
      workspaceId: 'ws-1',
      documentId: 'doc-surface-1',
      surfaceId: 'surface-main',
      bounds: {
        minX: 0,
        minY: 0,
        maxX: 100,
        maxY: 100,
      },
      limit: 10,
    });

    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.value.canvasNodes.map((node) => node.id)).toEqual(['node-surface-a']);
      expect(loaded.value.bindings.map((binding) => binding.id)).toEqual(['binding-surface-a']);
      expect(loaded.value.objects.map((record) => record.id)).toEqual(['note-surface-1']);
      expect(loaded.value.documentRevision.headRevision).toBe(
        createDocumentRevisionToken({
          documentId: 'doc-surface-1',
          revisionNo: 1,
          revisionId: 'rev-surface-1',
        }),
      );
    }

    await handle.close();
  });

  it('provides revision-token helper primitives for mutation executor integration', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const repository = new CanonicalPersistenceRepository(handle.db);

    const initialHead = await repository.getDocumentHeadRevision('doc-revision-1');
    expect(initialHead.ok).toBe(true);
    if (!initialHead.ok) {
      throw new Error('expected initial revision head');
    }

    expect(initialHead.value.revisionNo).toBe(0);
    expect(initialHead.value.headRevision).toBe(
      createDocumentRevisionToken({
        documentId: 'doc-revision-1',
        revisionNo: 0,
        revisionId: 'initial',
      }),
    );

    const nextNo = await repository.getNextDocumentRevisionNo('doc-revision-1');
    expect(nextNo.ok).toBe(true);
    if (nextNo.ok) {
      expect(nextNo.value).toBe(1);
    }

    const missingBase = await repository.ensureBaseRevision('doc-revision-1', undefined);
    expect(missingBase.ok).toBe(false);
    if (!missingBase.ok) {
      expect(missingBase.code).toBe('VERSION_BASE_REQUIRED');
    }

    const invalidBase = await repository.ensureBaseRevision('doc-revision-1', 'invalid-token');
    expect(invalidBase.ok).toBe(false);
    if (!invalidBase.ok) {
      expect(invalidBase.code).toBe('INVALID_REVISION_TOKEN');
    }

    await repository.appendDocumentRevision({
      id: 'rev-doc-1',
      documentId: 'doc-revision-1',
      revisionNo: 1,
      authorKind: 'agent',
      authorId: 'agent-1',
      mutationBatch: { operations: ['noop'] },
    });

    const staleBase = await repository.ensureBaseRevision('doc-revision-1', initialHead.value.headRevision);
    expect(staleBase.ok).toBe(false);
    if (!staleBase.ok) {
      expect(staleBase.code).toBe('VERSION_CONFLICT');
      expect(staleBase.details?.expected).toBe(initialHead.value.headRevision);
      expect(typeof staleBase.details?.actual).toBe('string');
    }

    const latestHead = await repository.getDocumentHeadRevision('doc-revision-1');
    expect(latestHead.ok).toBe(true);
    if (!latestHead.ok) {
      throw new Error('expected latest revision head');
    }

    const matchedBase = await repository.ensureBaseRevision('doc-revision-1', latestHead.value.headRevision);
    expect(matchedBase.ok).toBe(true);
    if (matchedBase.ok) {
      expect(matchedBase.value.revisionNo).toBe(1);
      expect(matchedBase.value.revisionId).toBe('rev-doc-1');
    }

    await handle.close();
  });
});
