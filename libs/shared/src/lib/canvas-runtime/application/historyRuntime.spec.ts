import { describe, expect, it } from 'vitest';
import { createCanonicalPgliteDb } from '../../canonical-persistence/pglite-db';
import { CanonicalPersistenceRepository } from '../../canonical-persistence/repository';
import { createCanvasRuntimeServiceContext } from './serviceContext';
import { dispatchCanvasMutation } from './dispatchCanvasMutation';
import { redoCanvasMutation, undoCanvasMutation } from './historyRuntime';

function buildRuntimeContext(handle: Awaited<ReturnType<typeof createCanonicalPgliteDb>>) {
  return createCanvasRuntimeServiceContext({
    db: handle.db,
    repository: new CanonicalPersistenceRepository(handle.db),
    targetDir: process.cwd(),
    dataDir: null,
    defaultWorkspaceId: 'ws-1',
  });
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

describe('runtime-owned history', () => {
  it('persists mutation history and replays undo/redo through revision log state', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const context = buildRuntimeContext(handle);

    await context.headless.repository.createCanonicalObject({
      record: buildSeedRecord(),
      operation: 'create',
    });
    await context.headless.repository.createCanvasNode({
      id: 'node-1',
      canvasId: 'doc-1',
      surfaceId: 'main',
      nodeKind: 'native',
      canonicalObjectId: 'note-1',
      layout: { x: 0, y: 0 },
      zIndex: 1,
    });

    const applied = await dispatchCanvasMutation(context, {
      workspaceId: 'ws-1',
      canvasId: 'doc-1',
      actor: { kind: 'user', id: 'client-1' },
      sessionId: 'session-1',
      preconditions: { canvasRevision: 0 },
      commands: [{
        name: 'object.content.update',
        objectId: 'note-1',
        kind: 'markdown',
        patch: { source: '# after', value: '# after' },
        expectedContentKind: 'text',
      }],
    });

    expect(applied.envelope.ok).toBe(true);
    if (!applied.envelope.ok) {
      await handle.close();
      return;
    }

    expect(applied.historyEntry).toMatchObject({
      sessionId: 'session-1',
      revisionAfter: 1,
      inverseMutation: expect.objectContaining({
        commands: expect.any(Array),
      }),
    });

    const revisions = await context.repository.listCanvasRevisions('doc-1');
    expect(revisions[0]).toMatchObject({
      revisionNo: 1,
      sessionId: 'session-1',
      runtimeHistory: expect.objectContaining({
        kind: 'mutation',
        entry: expect.objectContaining({
          historyEntryId: applied.historyEntry?.historyEntryId,
        }),
      }),
    });

    const cursor = await context.repository.getCanvasHistoryCursor('doc-1', 'client-1', 'session-1');
    expect(cursor).toEqual({
      ok: true,
      value: expect.objectContaining({
        undoRevisionNo: 1,
        redoRevisionNo: null,
      }),
    });

    const undone = await undoCanvasMutation(context, {
      canvasId: 'doc-1',
      actorId: 'client-1',
      sessionId: 'session-1',
    });

    expect(undone.envelope.ok).toBe(true);
    const objectAfterUndo = await context.repository.getCanonicalObject('ws-1', 'note-1');
    expect(objectAfterUndo.ok).toBe(true);
    if (objectAfterUndo.ok) {
      expect(objectAfterUndo.value.primaryContentKind).toBe('document');
      expect(objectAfterUndo.value.canonicalText).toBe('before');
    }

    const cursorAfterUndo = await context.repository.getCanvasHistoryCursor('doc-1', 'client-1', 'session-1');
    expect(cursorAfterUndo).toEqual({
      ok: true,
      value: expect.objectContaining({
        undoRevisionNo: null,
        redoRevisionNo: 1,
      }),
    });

    const redone = await redoCanvasMutation(context, {
      canvasId: 'doc-1',
      actorId: 'client-1',
      sessionId: 'session-1',
    });

    expect(redone.envelope.ok).toBe(true);
    const objectAfterRedo = await context.repository.getCanonicalObject('ws-1', 'note-1');
    expect(objectAfterRedo.ok).toBe(true);
    if (objectAfterRedo.ok) {
      expect(objectAfterRedo.value.primaryContentKind).toBe('document');
      expect(objectAfterRedo.value.canonicalText).toBe('after');
    }

    const cursorAfterRedo = await context.repository.getCanvasHistoryCursor('doc-1', 'client-1', 'session-1');
    expect(cursorAfterRedo).toEqual({
      ok: true,
      value: expect.objectContaining({
        undoRevisionNo: 1,
        redoRevisionNo: null,
      }),
    });

    await handle.close();
  });
});
