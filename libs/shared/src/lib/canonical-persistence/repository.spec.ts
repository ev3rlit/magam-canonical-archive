import { describe, expect, it } from 'vitest';
import { createCanonicalPgliteDb } from './pglite-db';
import { CanonicalPersistenceRepository } from './repository';
import { LIBRARY_MAX_BINARY_BYTES } from './validators';

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

function buildLibraryCollection(id: string) {
  return {
    id,
    workspaceId: 'ws-1',
    name: `Collection ${id}`,
    description: 'Library collection',
    sortOrder: 1,
  };
}

function buildTemplateItem(id: string) {
  return {
    id,
    workspaceId: 'ws-1',
    type: 'template' as const,
    title: `Template ${id}`,
    summary: 'Reusable scene fragment',
    tags: ['flow'],
    collectionIds: [],
    isFavorite: false,
    createdBy: {
      kind: 'user' as const,
      id: 'tester',
    },
    visibility: 'curated' as const,
    payload: {
      sourceCanvasId: 'canvas-1',
      sourceSelection: {
        nodeIds: ['node-1'],
        bindingIds: [],
      },
      previewText: 'Launch template',
      previewImageAssetId: null,
      snapshot: {
        objects: [{ id: 'node-1', kind: 'sticky' }],
      },
    },
  };
}

function buildAssetItem(id: string, visibility: 'imported' | 'curated' = 'imported') {
  return {
    id,
    workspaceId: 'ws-1',
    type: 'asset' as const,
    title: `Asset ${id}`,
    summary: 'Reference image asset',
    tags: [],
    collectionIds: [],
    isFavorite: false,
    createdBy: {
      kind: 'system' as const,
      id: 'importer',
    },
    visibility,
    payload: {
      mimeType: 'image/png',
      byteSize: 4,
      binaryData: Uint8Array.from([1, 2, 3, 4]),
      originalFilename: 'asset.png',
      sha256: 'hash-asset',
      importSource: 'clipboard' as const,
      previewText: 'Imported asset',
      imageMetadata: {
        width: 32,
        height: 24,
      },
    },
  };
}

function buildReferenceItem(id: string, target = 'https://example.com') {
  return {
    id,
    workspaceId: 'ws-1',
    type: 'reference' as const,
    title: `Reference ${id}`,
    summary: null,
    tags: ['research'],
    collectionIds: [],
    isFavorite: false,
    createdBy: {
      kind: 'user' as const,
      id: 'tester',
    },
    visibility: 'curated' as const,
    payload: {
      targetKind: 'url' as const,
      target,
      displayHint: 'Reference link',
      metadata: {
        label: 'Example',
      },
    },
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
        primaryContentKind: 'document',
      },
      operation: 'create',
    });

    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.body).toEqual({
        type: 'doc',
        content: [{ type: 'paragraph' }],
      });
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
      canvasId: 'doc-1',
      surfaceId: 'surface-1',
      nodeKind: 'native',
      canonicalObjectId: 'note-binding',
      layout: { x: 0, y: 0 },
      zIndex: 1,
    });
    await repository.createCanvasBinding({
      id: 'binding-1',
      canvasId: 'doc-1',
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
      canvasId: 'doc-1',
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
      canvasId: 'doc-1',
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

  it('lists canvas revisions newest-first and resolves the latest revision number', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const repository = new CanonicalPersistenceRepository(handle.db);

    await repository.appendCanvasRevision({
      id: 'rev-1',
      canvasId: 'doc-1',
      revisionNo: 1,
      authorKind: 'system',
      authorId: 'seed',
      mutationBatch: { op: 'seed-1' },
    });
    await repository.appendCanvasRevision({
      id: 'rev-2',
      canvasId: 'doc-1',
      revisionNo: 2,
      authorKind: 'system',
      authorId: 'seed',
      mutationBatch: { op: 'seed-2' },
    });

    await expect(repository.getLatestCanvasRevision('doc-1')).resolves.toBe(2);
    await expect(repository.listCanvasRevisions('doc-1')).resolves.toEqual([
      expect.objectContaining({ id: 'rev-2', revisionNo: 2 }),
      expect.objectContaining({ id: 'rev-1', revisionNo: 1 }),
    ]);

    await handle.close();
  });

  it('persists runtime history payloads with session cursors', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const repository = new CanonicalPersistenceRepository(handle.db);

    await repository.appendCanvasRevision({
      id: 'rev-runtime-1',
      canvasId: 'doc-history',
      revisionNo: 1,
      authorKind: 'user',
      authorId: 'client-1',
      sessionId: 'session-1',
      mutationBatch: {
        workspaceId: 'ws-1',
        canvasId: 'doc-history',
        commands: [{
          name: 'object.content.update',
          objectId: 'note-1',
          kind: 'markdown',
          patch: { source: '# after', value: '# after' },
        }],
      },
      runtimeHistory: {
        kind: 'mutation',
        entry: {
          historyEntryId: 'history-1',
          canvasId: 'doc-history',
          actor: { kind: 'user', id: 'client-1' },
          sessionId: 'session-1',
          mutationId: 'mutation-1',
          forwardMutation: {
            workspaceId: 'ws-1',
            canvasId: 'doc-history',
            actor: { kind: 'user', id: 'client-1' },
            sessionId: 'session-1',
            commands: [],
            normalization: {
              source: 'resolved-before-commit',
              resolvedAgainstRevision: 1,
            },
          },
          inverseMutation: {
            workspaceId: 'ws-1',
            canvasId: 'doc-history',
            actor: { kind: 'user', id: 'client-1' },
            sessionId: 'session-1',
            commands: [],
            normalization: {
              source: 'resolved-before-commit',
              resolvedAgainstRevision: 1,
            },
          },
          revisionBefore: 0,
          revisionAfter: 1,
          changed: {
            canvases: ['doc-history'],
            nodes: [],
            objects: ['note-1'],
            bodyBlocks: [],
            edges: [],
            pluginInstances: [],
          },
          undoable: true,
        },
      },
    });

    const revisions = await repository.listCanvasRevisions('doc-history');
    expect(revisions).toEqual([
      expect.objectContaining({
        id: 'rev-runtime-1',
        revisionNo: 1,
        sessionId: 'session-1',
        runtimeHistory: expect.objectContaining({
          kind: 'mutation',
          entry: expect.objectContaining({
            historyEntryId: 'history-1',
            sessionId: 'session-1',
          }),
        }),
      }),
    ]);

    const cursor = await repository.upsertCanvasHistoryCursor({
      canvasId: 'doc-history',
      actorId: 'client-1',
      sessionId: 'session-1',
      undoRevisionNo: 1,
      redoRevisionNo: null,
    });
    expect(cursor.ok).toBe(true);

    const fetchedCursor = await repository.getCanvasHistoryCursor('doc-history', 'client-1', 'session-1');
    expect(fetchedCursor).toEqual({
      ok: true,
      value: expect.objectContaining({
        canvasId: 'doc-history',
        actorId: 'client-1',
        sessionId: 'session-1',
        undoRevisionNo: 1,
        redoRevisionNo: null,
      }),
    });

    await handle.close();
  });

  it('creates and searches workspace-scoped library items', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const repository = new CanonicalPersistenceRepository(handle.db);

    const collection = await repository.createLibraryCollection(buildLibraryCollection('collection-1'));
    expect(collection.ok).toBe(true);

    const created = await repository.createLibraryItem({
      ...buildTemplateItem('template-1'),
      collectionIds: ['collection-1'],
    });
    expect(created.ok).toBe(true);

    const duplicateWorkspace = await repository.createLibraryItem({
      ...buildTemplateItem('template-1'),
      workspaceId: 'ws-2',
    });
    expect(duplicateWorkspace.ok).toBe(true);

    const listed = await repository.listLibraryItems('ws-1');
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value).toHaveLength(1);
      expect(listed.value[0]?.collectionIds).toEqual(['collection-1']);
    }

    const searched = await repository.searchLibraryItems('ws-1', 'Launch');
    expect(searched.ok).toBe(true);
    if (searched.ok) {
      expect(searched.value).toHaveLength(1);
      expect(searched.value[0]?.id).toBe('template-1');
    }

    await handle.close();
  });

  it('promotes imported assets to curated when metadata curation is explicit', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const repository = new CanonicalPersistenceRepository(handle.db);

    await repository.createLibraryCollection(buildLibraryCollection('collection-curated'));
    const created = await repository.createLibraryItem(buildAssetItem('asset-imported'));
    expect(created.ok).toBe(true);

    const imported = await repository.listLibraryItems('ws-1', { visibility: 'imported' });
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.value.map((item) => item.id)).toEqual(['asset-imported']);
    }

    const updated = await repository.updateLibraryItemMetadata({
      workspaceId: 'ws-1',
      itemId: 'asset-imported',
      tags: ['brand'],
      collectionIds: ['collection-curated'],
      changeSummary: 'Curated imported asset',
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.value.visibility).toBe('curated');
      expect(updated.value.tags).toEqual(['brand']);
      expect(updated.value.collectionIds).toEqual(['collection-curated']);
    }

    const curated = await repository.listLibraryItems('ws-1', { visibility: 'curated' });
    expect(curated.ok).toBe(true);
    if (curated.ok) {
      expect(curated.value.map((item) => item.id)).toContain('asset-imported');
    }

    const versions = await repository.listLibraryItemVersions('ws-1', 'asset-imported');
    expect(versions.ok).toBe(true);
    if (versions.ok) {
      expect(versions.value).toHaveLength(2);
      expect(versions.value[0]?.changeSummary).toBe('Curated imported asset');
      expect(versions.value[1]?.changeSummary).toBe('Created library item');
    }

    await handle.close();
  });

  it('rejects oversize assets and missing reference targets', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const repository = new CanonicalPersistenceRepository(handle.db);

    const oversize = await repository.createLibraryItem({
      ...buildAssetItem('asset-oversize'),
      payload: {
        ...buildAssetItem('asset-oversize').payload,
        byteSize: LIBRARY_MAX_BINARY_BYTES + 1,
        binaryData: new Uint8Array(LIBRARY_MAX_BINARY_BYTES + 1),
      },
    });
    expect(oversize.ok).toBe(false);
    if (!oversize.ok) {
      expect(oversize.code).toBe('LIBRARY_BINARY_TOO_LARGE');
    }

    const missingReference = await repository.createLibraryItem(buildReferenceItem('reference-missing', ''));
    expect(missingReference.ok).toBe(false);
    if (!missingReference.ok) {
      expect(missingReference.code).toBe('LIBRARY_REFERENCE_TARGET_MISSING');
    }

    await handle.close();
  });
});
