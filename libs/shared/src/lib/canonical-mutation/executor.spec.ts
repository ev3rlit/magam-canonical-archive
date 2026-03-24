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
      canvasId: 'doc-1',
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
        canvasRef: 'doc-1',
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

    expect(result.canvasRevisionBefore).toBe(0);
    expect(result.canvasRevisionAfter).toBe(1);
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
      where: (table, { and, eq }) => and(eq(table.canvasId, 'doc-1'), eq(table.id, 'node-1')),
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
      canvasId: 'doc-1',
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
        canvasRef: 'doc-1',
        preconditions: {
          canvasRevision: 0,
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

    expect(applied.canvasRevisionBefore).toBe(0);
    expect(applied.canvasRevisionAfter).toBe(1);

    const objectRecord = await context.repository.getCanonicalObject('ws-1', 'note-1');
    expect(objectRecord.ok).toBe(true);
    if (objectRecord.ok) {
      expect(objectRecord.value.capabilities.frame).toEqual({ fill: '#FDE68A' });
    }

    const nodeRow = await context.db.query.canvasNodes.findFirst({
      where: (table, { and, eq }) => and(eq(table.canvasId, 'doc-1'), eq(table.id, 'node-1')),
    });
    expect(nodeRow?.parentNodeId).toBe('group-1');

    await expect(executeMutationBatch({
      context,
      batch: {
        workspaceRef: 'ws-1',
        canvasRef: 'doc-1',
        preconditions: {
          canvasRevision: 0,
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

  it('continues revision sequencing after a document-shell create revision already exists', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const context = buildContext(handle);

    await context.repository.createCanonicalObject({
      record: buildSeedRecord(),
      operation: 'create',
    });
    await context.repository.createCanvasNode({
      id: 'node-1',
      canvasId: 'doc-1',
      surfaceId: 'main',
      nodeKind: 'native',
      canonicalObjectId: 'note-1',
      layout: { x: 0, y: 0 },
      zIndex: 1,
    });
    await context.repository.appendCanvasRevision({
      id: 'docrev-0',
      canvasId: 'doc-1',
      revisionNo: 1,
      authorKind: 'system',
      authorId: 'document-shell',
      mutationBatch: {
        op: 'document.create',
        documentShell: {
          workspaceId: 'ws-1',
          filePath: 'documents/doc-1.graph.tsx',
        },
      },
    });

    const applied = await executeMutationBatch({
      context,
      batch: {
        workspaceRef: 'ws-1',
        canvasRef: 'doc-1',
        preconditions: {
          canvasRevision: 1,
        },
        operations: [{
          op: 'canvas.node.move',
          nodeId: 'node-1',
          patch: { x: 12, y: 24 },
        }],
      },
    });

    expect(applied.canvasRevisionBefore).toBe(1);
    expect(applied.canvasRevisionAfter).toBe(2);

    await handle.close();
  });

  it('creates a canonical canvas node with a markdown-first seed and appends a revision', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const context = buildContext(handle);

    const applied = await executeMutationBatch({
      context,
      batch: {
        workspaceRef: 'ws-1',
        canvasRef: 'doc-create-1',
        operations: [{
          op: 'canvas.node.create',
          nodeId: 'shape-root-1',
          nodeType: 'shape',
          props: {
            type: 'rectangle',
            content: '# New root',
          },
          placement: {
            mode: 'canvas-absolute',
            x: 120,
            y: 180,
          },
        }],
      },
    });

    expect(applied.canvasRevisionBefore).toBe(0);
    expect(applied.canvasRevisionAfter).toBe(1);
    expect(applied.changed).toEqual({
      objects: ['shape-root-1'],
      nodes: ['shape-root-1'],
      edges: [],
      bindings: [],
      pluginInstances: [],
    });

    const objectRecord = await context.repository.getCanonicalObject('ws-1', 'shape-root-1');
    expect(objectRecord.ok).toBe(true);
    if (objectRecord.ok) {
      expect(objectRecord.value.contentBlocks).toEqual([
        {
          id: 'body-1',
          blockType: 'markdown',
          source: '# New root',
        },
      ]);
      expect(objectRecord.value.primaryContentKind).toBe('markdown');
      expect(objectRecord.value.canonicalText).toBe('# New root');
    }

    const nodeRecord = await context.repository.getCanvasNode('doc-create-1', 'shape-root-1');
    expect(nodeRecord.ok).toBe(true);
    if (nodeRecord.ok) {
      expect(nodeRecord.value.layout).toEqual({ x: 120, y: 180 });
      expect(nodeRecord.value.canonicalObjectId).toBe('shape-root-1');
    }

    await handle.close();
  });

  it('normalizes mindmap sibling create and ordered block insert through canonical mutations', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const context = buildContext(handle);

    await context.repository.createCanonicalObject({
      record: {
        id: 'root-1',
        workspaceId: 'ws-1',
        semanticRole: 'topic',
        publicAlias: 'Node',
        sourceMeta: { sourceId: 'root-1', kind: 'mindmap' },
        capabilities: {},
        contentBlocks: [{ id: 'body-1', blockType: 'markdown', source: '# Root' }],
        primaryContentKind: 'markdown',
        canonicalText: '# Root',
      },
      operation: 'create',
    });
    await context.repository.createCanvasNode({
      id: 'root-1',
      canvasId: 'doc-create-2',
      surfaceId: 'main',
      nodeKind: 'native',
      nodeType: 'shape',
      canonicalObjectId: 'root-1',
      layout: { x: 0, y: 0 },
      zIndex: 1,
    });
    await context.repository.createCanonicalObject({
      record: {
        id: 'child-1',
        workspaceId: 'ws-1',
        semanticRole: 'topic',
        publicAlias: 'Node',
        sourceMeta: { sourceId: 'child-1', kind: 'mindmap' },
        capabilities: {},
        contentBlocks: [{ id: 'body-1', blockType: 'markdown', source: 'child' }],
        primaryContentKind: 'markdown',
        canonicalText: 'child',
      },
      operation: 'create',
    });
    await context.repository.createCanvasNode({
      id: 'child-1',
      canvasId: 'doc-create-2',
      surfaceId: 'main',
      nodeKind: 'native',
      nodeType: 'shape',
      canonicalObjectId: 'child-1',
      parentNodeId: 'root-1',
      layout: { x: 220, y: 120 },
      zIndex: 2,
    });

    await executeMutationBatch({
      context,
      batch: {
        workspaceRef: 'ws-1',
        canvasRef: 'doc-create-2',
        operations: [
          {
            op: 'canvas.node.create',
            nodeId: 'child-2',
            nodeType: 'shape',
            props: {
              content: '',
            },
            placement: {
              mode: 'mindmap-sibling',
              siblingOf: 'child-1',
              parentId: 'root-1',
            },
          },
          {
            op: 'object.body.block.insert',
            objectId: 'child-1',
            afterBlockId: 'body-1',
            block: {
              id: 'body-2',
              blockType: 'markdown',
              source: 'second',
            },
          },
        ],
      },
    });

    const siblingRecord = await context.repository.getCanvasNode('doc-create-2', 'child-2');
    expect(siblingRecord.ok).toBe(true);
    if (siblingRecord.ok) {
      expect(siblingRecord.value.parentNodeId).toBe('root-1');
      expect(siblingRecord.value.layout).toEqual({ x: 220, y: 240 });
    }

    const objectRecord = await context.repository.getCanonicalObject('ws-1', 'child-1');
    expect(objectRecord.ok).toBe(true);
    if (objectRecord.ok) {
      expect(objectRecord.value.contentBlocks).toEqual([
        { id: 'body-1', blockType: 'markdown', source: 'child' },
        { id: 'body-2', blockType: 'markdown', source: 'second' },
      ]);
    }

    await handle.close();
  });

  it('updates shell props and z-order through canvas node mutations', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const context = buildContext(handle);

    await context.repository.createCanonicalObject({
      record: buildSeedRecord(),
      operation: 'create',
    });
    await context.repository.createCanvasNode({
      id: 'node-update-1',
      canvasId: 'doc-update-1',
      surfaceId: 'main',
      nodeKind: 'native',
      canonicalObjectId: 'note-1',
      props: { locked: false },
      style: { fill: '#fff' },
      layout: { x: 0, y: 0 },
      zIndex: 1,
    });

    await executeMutationBatch({
      context,
      batch: {
        workspaceRef: 'ws-1',
        canvasRef: 'doc-update-1',
        operations: [
          {
            op: 'canvas.node.update',
            nodeId: 'node-update-1',
            propsPatch: { groupId: 'group-1', locked: true },
            stylePatch: { fill: '#0f172a', stroke: '#38bdf8' },
          },
          {
            op: 'canvas.node.z-order.update',
            nodeId: 'node-update-1',
            zIndex: 9,
          },
        ],
      },
    });

    const nodeRecord = await context.repository.getCanvasNode('doc-update-1', 'node-update-1');
    expect(nodeRecord.ok).toBe(true);
    if (nodeRecord.ok) {
      expect(nodeRecord.value.props).toMatchObject({
        groupId: 'group-1',
        locked: true,
      });
      expect(nodeRecord.value.style).toMatchObject({
        fill: '#0f172a',
        stroke: '#38bdf8',
      });
      expect(nodeRecord.value.zIndex).toBe(9);
    }

    await handle.close();
  });

  it('renames native node/object ids and tombstones deleted native nodes through canonical mutations', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const context = buildContext(handle);

    await context.repository.createCanonicalObject({
      record: {
        id: 'root-rename-1',
        workspaceId: 'ws-1',
        semanticRole: 'sticky-note',
        publicAlias: 'Sticky',
        sourceMeta: { sourceId: 'root-rename-1', kind: 'mindmap' },
        capabilities: {},
        contentBlocks: [{ id: 'body-1', blockType: 'markdown', source: 'root' }],
        primaryContentKind: 'markdown',
        canonicalText: 'root',
      },
      operation: 'create',
    });
    await context.repository.createCanvasNode({
      id: 'root-rename-1',
      canvasId: 'doc-rename-1',
      surfaceId: 'main',
      nodeKind: 'native',
      nodeType: 'shape',
      canonicalObjectId: 'root-rename-1',
      layout: { x: 0, y: 0 },
      zIndex: 1,
    });
    await context.repository.createCanonicalObject({
      record: {
        id: 'child-rename-1',
        workspaceId: 'ws-1',
        semanticRole: 'sticky-note',
        publicAlias: 'Sticky',
        sourceMeta: { sourceId: 'child-rename-1', kind: 'mindmap' },
        capabilities: {},
        contentBlocks: [{ id: 'body-1', blockType: 'markdown', source: 'child' }],
        primaryContentKind: 'markdown',
        canonicalText: 'child',
      },
      operation: 'create',
    });
    await context.repository.createCanvasNode({
      id: 'child-rename-1',
      canvasId: 'doc-rename-1',
      surfaceId: 'main',
      nodeKind: 'native',
      nodeType: 'shape',
      canonicalObjectId: 'child-rename-1',
      parentNodeId: 'root-rename-1',
      layout: { x: 220, y: 120 },
      zIndex: 2,
    });

    await executeMutationBatch({
      context,
      batch: {
        workspaceRef: 'ws-1',
        canvasRef: 'doc-rename-1',
        operations: [{
          op: 'canvas.node.rename',
          nodeId: 'root-rename-1',
          nextNodeId: 'root-renamed',
        }],
      },
    });

    const renamedNode = await context.repository.getCanvasNode('doc-rename-1', 'root-renamed');
    expect(renamedNode.ok).toBe(true);
    const renamedObject = await context.repository.getCanonicalObject('ws-1', 'root-renamed');
    expect(renamedObject.ok).toBe(true);
    if (renamedObject.ok) {
      expect(renamedObject.value.sourceMeta.sourceId).toBe('root-renamed');
    }
    const childNode = await context.repository.getCanvasNode('doc-rename-1', 'child-rename-1');
    expect(childNode.ok).toBe(true);
    if (childNode.ok) {
      expect(childNode.value.parentNodeId).toBe('root-renamed');
    }

    await executeMutationBatch({
      context,
      batch: {
        workspaceRef: 'ws-1',
        canvasRef: 'doc-rename-1',
        operations: [{
          op: 'canvas.node.delete',
          nodeId: 'root-renamed',
        }],
      },
    });

    const deletedNode = await context.repository.getCanvasNode('doc-rename-1', 'root-renamed');
    expect(deletedNode.ok).toBe(false);
    const tombstonedObject = await context.repository.getCanonicalObject('ws-1', 'root-renamed');
    expect(tombstonedObject.ok).toBe(true);
    if (tombstonedObject.ok) {
      expect(tombstonedObject.value.deletedAt).not.toBeNull();
    }
    const orphanedChild = await context.repository.getCanvasNode('doc-rename-1', 'child-rename-1');
    expect(orphanedChild.ok).toBe(true);
    if (orphanedChild.ok) {
      expect(orphanedChild.value.parentNodeId).toBeNull();
    }

    await handle.close();
  });
});
