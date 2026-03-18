import { describe, expect, it } from 'vitest';
import { createCanonicalPgliteDb } from '../canonical-persistence/pglite-db';
import { CanonicalPersistenceRepository } from '../canonical-persistence/repository';
import type { HeadlessServiceContext } from '../canonical-cli/context';
import { executeMutationBatch } from './executor';

function buildContext(handle: Awaited<ReturnType<typeof createCanonicalPgliteDb>>): HeadlessServiceContext {
  return {
    db: handle.db,
    repository: new CanonicalPersistenceRepository(handle.db),
    targetDir: process.cwd(),
    dataDir: null,
    defaultWorkspaceId: 'ws-1',
  };
}

function buildSeedRecord() {
  return {
    id: 'note-1',
    workspaceId: 'ws-1',
    semanticRole: 'sticky-note' as const,
    publicAlias: 'Sticky' as const,
    sourceMeta: { sourceId: 'note-1', kind: 'canvas' as const },
    capabilities: {},
    contentBlocks: [{ id: 'body-1', blockType: 'text' as const, text: 'before' }],
    primaryContentKind: 'text' as const,
    canonicalText: 'before',
  };
}

describe('headless mutation executor', () => {
  it('dry-runs mutations without persisting object or node changes', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const context = buildContext(handle);

    await context.repository.createCanonicalObject({
      record: buildSeedRecord(),
      operation: 'create',
    });
    await context.repository.createCanvasNode({
      id: 'node-1',
      documentId: 'doc-1',
      surfaceId: 'main',
      nodeKind: 'native',
      canonicalObjectId: 'note-1',
      layout: { x: 0, y: 0 },
      zIndex: 1,
    });

    const result = await executeMutationBatch({
      context,
      dryRun: true,
      batch: {
        workspaceRef: 'ws-1',
        documentRef: 'doc-1',
        operations: [
          {
            op: 'object.content.update',
            objectId: 'note-1',
            kind: 'markdown',
            patch: { source: '# after' },
          },
          {
            op: 'canvas.node.move',
            nodeId: 'node-1',
            patch: { x: 40, y: 80 },
          },
        ],
      },
    });

    expect(result.documentRevisionBefore).toBe(0);
    expect(result.documentRevisionAfter).toBe(1);
    expect(result.changed).toEqual({
      objects: ['note-1'],
      nodes: ['node-1'],
      edges: [],
      bindings: [],
      pluginInstances: [],
    });

    const objectRecord = await context.repository.getCanonicalObject('ws-1', 'note-1');
    expect(objectRecord.ok).toBe(true);
    if (objectRecord.ok) {
      expect(objectRecord.value.primaryContentKind).toBe('text');
      expect(objectRecord.value.canonicalText).toBe('before');
    }

    const row = await context.db.query.canvasNodes.findFirst({
      where: (table, { and, eq }) => and(eq(table.documentId, 'doc-1'), eq(table.id, 'node-1')),
    });
    expect(row?.layout).toEqual({ x: 0, y: 0 });

    await handle.close();
  });

  it('applies mutations, appends revisions, and rejects stale preconditions', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const context = buildContext(handle);

    await context.repository.createCanonicalObject({
      record: buildSeedRecord(),
      operation: 'create',
    });
    await context.repository.createCanvasNode({
      id: 'node-1',
      documentId: 'doc-1',
      surfaceId: 'main',
      nodeKind: 'native',
      canonicalObjectId: 'note-1',
      layout: { x: 0, y: 0 },
      zIndex: 1,
    });

    const applied = await executeMutationBatch({
      context,
      batch: {
        workspaceRef: 'ws-1',
        documentRef: 'doc-1',
        preconditions: {
          documentRevision: 0,
        },
        operations: [
          {
            op: 'object.capability.patch',
            objectId: 'note-1',
            capability: 'frame',
            patch: { fill: '#FDE68A' },
          },
          {
            op: 'canvas.node.reparent',
            nodeId: 'node-1',
            parentNodeId: 'group-1',
          },
        ],
      },
    });

    expect(applied.documentRevisionBefore).toBe(0);
    expect(applied.documentRevisionAfter).toBe(1);

    const objectRecord = await context.repository.getCanonicalObject('ws-1', 'note-1');
    expect(objectRecord.ok).toBe(true);
    if (objectRecord.ok) {
      expect(objectRecord.value.capabilities.frame).toEqual({ fill: '#FDE68A' });
    }

    const nodeRow = await context.db.query.canvasNodes.findFirst({
      where: (table, { and, eq }) => and(eq(table.documentId, 'doc-1'), eq(table.id, 'node-1')),
    });
    expect(nodeRow?.parentNodeId).toBe('group-1');

    await expect(executeMutationBatch({
      context,
      batch: {
        workspaceRef: 'ws-1',
        documentRef: 'doc-1',
        preconditions: {
          documentRevision: 0,
        },
        operations: [{
          op: 'canvas.node.move',
          nodeId: 'node-1',
          patch: { x: 12, y: 24 },
        }],
      },
    })).rejects.toMatchObject({
      code: 'DOCUMENT_REVISION_CONFLICT',
    });

    await handle.close();
  });
});
