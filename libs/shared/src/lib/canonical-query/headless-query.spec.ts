import { describe, expect, it } from 'vitest';
import { createCanonicalPgliteDb } from '../canonical-persistence/pglite-db';
import { CanonicalPersistenceRepository } from '../canonical-persistence/repository';
import type { HeadlessServiceContext } from '../canonical-cli/context';
import { getDocument, getWorkspaceDocument, listWorkspaceDocuments, listWorkspaces } from './workspace-document';
import { queryObjects, querySurfaceNodes, searchDocuments } from './object-surface-search';

function buildNoteRecord(id: string) {
  return {
    id,
    workspaceId: 'ws-1',
    semanticRole: 'sticky-note' as const,
    publicAlias: 'Sticky' as const,
    sourceMeta: { sourceId: id, kind: 'canvas' as const },
    capabilities: {},
    contentBlocks: [{ id: 'body-1', blockType: 'text' as const, text: 'launch checklist' }],
    primaryContentKind: 'text' as const,
    canonicalText: 'launch checklist',
  };
}

describe('headless query services', () => {
  it('lists workspaces and queries canonical objects with filters', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const repository = new CanonicalPersistenceRepository(handle.db);
    const context: HeadlessServiceContext = {
      db: handle.db,
      repository,
      targetDir: process.cwd(),
      dataDir: null,
      defaultWorkspaceId: 'ws-1',
    };

    await repository.createCanonicalObject({
      record: buildNoteRecord('note-1'),
      operation: 'create',
    });
    await repository.createCanvasNode({
      id: 'node-1',
      documentId: 'doc-1',
      surfaceId: 'main',
      nodeKind: 'native',
      canonicalObjectId: 'note-1',
      layout: { x: 16, y: 24, width: 120, height: 80 },
      zIndex: 1,
    });
    await repository.appendDocumentRevision({
      id: 'rev-1',
      documentId: 'doc-1',
      revisionNo: 1,
      authorKind: 'agent',
      authorId: 'test',
      mutationBatch: { op: 'seed' },
    });

    const workspaces = await listWorkspaces(context);
    expect(workspaces).toEqual([
      expect.objectContaining({
        id: 'ws-1',
        objectCount: 1,
        documentCount: 1,
        surfaceCount: 1,
      }),
    ]);

    const page = await queryObjects(context, {
      workspaceId: 'ws-1',
      semanticRole: 'sticky-note',
      include: ['semanticRole', 'primaryContentKind'],
    });

    expect(page.items).toEqual([
      {
        id: 'note-1',
        semanticRole: 'sticky-note',
        primaryContentKind: 'text',
      },
    ]);

    await handle.close();
  });

  it('queries surface nodes with canonical projections and searches documents by canonical text', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const repository = new CanonicalPersistenceRepository(handle.db);
    const context: HeadlessServiceContext = {
      db: handle.db,
      repository,
      targetDir: process.cwd(),
      dataDir: null,
      defaultWorkspaceId: 'ws-1',
    };

    await repository.createCanonicalObject({
      record: buildNoteRecord('note-2'),
      operation: 'create',
    });
    await repository.createCanvasNode({
      id: 'node-2',
      documentId: 'doc-2',
      surfaceId: 'main',
      nodeKind: 'native',
      canonicalObjectId: 'note-2',
      layout: { x: 20, y: 30, width: 160, height: 90 },
      zIndex: 2,
    });
    await repository.appendDocumentRevision({
      id: 'rev-2',
      documentId: 'doc-2',
      revisionNo: 2,
      authorKind: 'agent',
      authorId: 'test',
      mutationBatch: { op: 'seed' },
    });

    const nodes = await querySurfaceNodes(context, {
      documentId: 'doc-2',
      surfaceId: 'main',
      workspaceId: 'ws-1',
      bounds: { x: 0, y: 0, width: 400, height: 400 },
      include: ['layout', 'canonicalObject.semanticRole', 'canonicalObject.primaryContentKind'],
    });

    expect(nodes.items).toEqual([
      {
        id: 'node-2',
        documentId: 'doc-2',
        surfaceId: 'main',
        layout: { x: 20, y: 30, width: 160, height: 90 },
        canonicalObject: {
          semanticRole: 'sticky-note',
          primaryContentKind: 'text',
        },
      },
    ]);

    const document = await getDocument(context, 'doc-2');
    expect(document).toEqual({
      id: 'doc-2',
      surfaceIds: ['main'],
      nodeCount: 1,
      bindingCount: 0,
      latestRevision: 2,
    });

    const search = await searchDocuments(context, {
      workspaceId: 'ws-1',
      text: 'launch checklist',
    });
    expect(search.items).toEqual([
      expect.objectContaining({
        id: 'doc-2',
        matchedObjectIds: ['note-2'],
      }),
    ]);

    await handle.close();
  });

  it('lists canonical document shell summaries from revision metadata', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const repository = new CanonicalPersistenceRepository(handle.db);
    const context: HeadlessServiceContext = {
      db: handle.db,
      repository,
      targetDir: process.cwd(),
      dataDir: null,
      defaultWorkspaceId: 'ws-1',
    };

    await repository.appendDocumentRevision({
      id: 'docrev-1',
      documentId: 'doc-shell-1',
      revisionNo: 1,
      authorKind: 'system',
      authorId: 'test',
      mutationBatch: {
        op: 'document.create',
        documentShell: {
          workspaceId: 'ws-1',
          filePath: 'documents/doc-shell-1.graph.tsx',
        },
      },
    });

    await repository.appendDocumentRevision({
      id: 'docrev-2',
      documentId: 'doc-shell-1',
      revisionNo: 2,
      authorKind: 'agent',
      authorId: 'test',
      mutationBatch: {
        op: 'document.touch',
      },
    });

    await expect(getWorkspaceDocument(context, 'doc-shell-1')).resolves.toMatchObject({
      documentId: 'doc-shell-1',
      workspaceId: 'ws-1',
      filePath: 'documents/doc-shell-1.graph.tsx',
      latestRevision: 2,
    });

    await expect(listWorkspaceDocuments(context)).resolves.toEqual([
      expect.objectContaining({
        documentId: 'doc-shell-1',
        filePath: 'documents/doc-shell-1.graph.tsx',
      }),
    ]);

    await handle.close();
  });
});
