import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createAppStatePgliteDb } from './pglite-db';
import { AppStatePersistenceRepository } from './repository';

describe('AppStatePersistenceRepository', () => {
  it('stores and reads workspaces, session, recent canvases, and preferences', async () => {
    const handle = await createAppStatePgliteDb(process.cwd(), { dataDir: null });
    const repository = new AppStatePersistenceRepository(handle.db);

    await repository.upsertWorkspace({
      id: 'ws-older',
      rootPath: '/tmp/ws-older',
      displayName: 'Older Workspace',
      status: 'ok',
      isPinned: false,
      lastOpenedAt: new Date('2026-03-20T00:00:00Z'),
      lastSeenAt: new Date('2026-03-20T00:00:00Z'),
    });
    const pinnedWorkspace = await repository.upsertWorkspace({
      id: 'ws-pinned',
      rootPath: '/tmp/ws-pinned',
      displayName: 'Pinned Workspace',
      status: 'ok',
      isPinned: true,
      lastOpenedAt: new Date('2026-03-22T00:00:00Z'),
      lastSeenAt: new Date('2026-03-22T01:00:00Z'),
    });

    const session = await repository.setWorkspaceSession({
      activeWorkspaceId: pinnedWorkspace.id,
    });
    const recentCanvas = await repository.upsertRecentCanvas({
      workspaceId: pinnedWorkspace.id,
      canvasPath: '/tmp/ws-pinned/doc-1.tsx',
      lastOpenedAt: new Date('2026-03-23T00:00:00Z'),
    });
    await repository.setPreference({
      key: 'theme.mode',
      valueJson: 'light',
    });
    await repository.setPreference({
      key: 'workspace.lastActiveCanvasSession',
      valueJson: {
        workspaceId: pinnedWorkspace.id,
        canvasPath: recentCanvas.canvasPath,
      },
    });

    const workspaces = await repository.listWorkspaces();
    const storedSession = await repository.getWorkspaceSession();
    const recentCanvases = await repository.listRecentCanvases(pinnedWorkspace.id);
    const themePreference = await repository.getPreference('theme.mode');
    const lastActivePreference = await repository.getPreference('workspace.lastActiveCanvasSession');

    expect(workspaces.map((workspace) => workspace.id)).toEqual(['ws-pinned', 'ws-older']);
    expect(session.activeWorkspaceId).toBe('ws-pinned');
    expect(storedSession).toEqual(expect.objectContaining({
      activeWorkspaceId: 'ws-pinned',
    }));
    expect(recentCanvases).toEqual([
      expect.objectContaining({
        workspaceId: 'ws-pinned',
        canvasPath: '/tmp/ws-pinned/doc-1.tsx',
      }),
    ]);
    expect(themePreference).toEqual(expect.objectContaining({
      key: 'theme.mode',
      valueJson: 'light',
    }));
    expect(lastActivePreference).toEqual(expect.objectContaining({
      key: 'workspace.lastActiveCanvasSession',
      valueJson: {
        workspaceId: 'ws-pinned',
        canvasPath: '/tmp/ws-pinned/doc-1.tsx',
      },
    }));

    await handle.close();
  }, 15_000);

  it('removes workspace-owned state and clears the active session when deleting the active workspace', async () => {
    const handle = await createAppStatePgliteDb(process.cwd(), { dataDir: null });
    const repository = new AppStatePersistenceRepository(handle.db);

    const workspace = await repository.upsertWorkspace({
      id: 'ws-remove',
      rootPath: '/tmp/ws-remove',
      displayName: 'Remove Workspace',
      status: 'missing',
      isPinned: false,
      lastOpenedAt: new Date('2026-03-21T00:00:00Z'),
      lastSeenAt: null,
    });

    await repository.setWorkspaceSession({
      activeWorkspaceId: workspace.id,
    });
    await repository.upsertRecentCanvas({
      workspaceId: workspace.id,
      canvasPath: '/tmp/ws-remove/doc-a.tsx',
      lastOpenedAt: new Date('2026-03-23T01:00:00Z'),
    });
    await repository.upsertRecentCanvas({
      workspaceId: workspace.id,
      canvasPath: '/tmp/ws-remove/doc-b.tsx',
      lastOpenedAt: new Date('2026-03-23T02:00:00Z'),
    });

    await repository.removeWorkspace(workspace.id);

    expect(await repository.listWorkspaces()).toEqual([]);
    expect(await repository.listRecentCanvases(workspace.id)).toEqual([]);
    expect(await repository.getWorkspaceSession()).toEqual(expect.objectContaining({
      activeWorkspaceId: null,
    }));

    await handle.close();
  }, 15_000);

  it('restores imported workspace/session/canvas preference state after reopening the same app-state DB', async () => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'magam-app-state-reopen-'));

    const firstHandle = await createAppStatePgliteDb(process.cwd(), { dataDir });
    const firstRepository = new AppStatePersistenceRepository(firstHandle.db);

    await firstRepository.upsertWorkspace({
      id: 'ws-import-1',
      rootPath: '/tmp/ws-import-1',
      displayName: 'Imported Workspace 1',
      status: 'ok',
      isPinned: false,
      lastOpenedAt: new Date('2026-03-23T00:00:00Z'),
      lastSeenAt: new Date('2026-03-23T00:10:00Z'),
    });
    await firstRepository.upsertWorkspace({
      id: 'ws-import-2',
      rootPath: '/tmp/ws-import-2',
      displayName: 'Imported Workspace 2',
      status: 'missing',
      isPinned: false,
      lastOpenedAt: new Date('2026-03-24T00:00:00Z'),
      lastSeenAt: null,
    });
    await firstRepository.setWorkspaceSession({
      activeWorkspaceId: 'ws-import-2',
    });
    await firstRepository.upsertRecentCanvas({
      workspaceId: 'ws-import-2',
      canvasPath: 'docs/imported.graph.tsx',
      lastOpenedAt: new Date('2026-03-24T00:30:00Z'),
    });
    await firstRepository.setPreference({
      key: 'workspace.lastActiveCanvasSession',
      valueJson: {
        'ws-import-2': 'docs/imported.graph.tsx',
      },
    });
    await firstHandle.close();

    const secondHandle = await createAppStatePgliteDb(process.cwd(), { dataDir });
    const secondRepository = new AppStatePersistenceRepository(secondHandle.db);

    expect(await secondRepository.listWorkspaces()).toEqual([
      expect.objectContaining({ id: 'ws-import-2', displayName: 'Imported Workspace 2' }),
      expect.objectContaining({ id: 'ws-import-1', displayName: 'Imported Workspace 1' }),
    ]);
    expect(await secondRepository.getWorkspaceSession()).toEqual(
      expect.objectContaining({ activeWorkspaceId: 'ws-import-2' }),
    );
    expect(await secondRepository.listRecentCanvases('ws-import-2')).toEqual([
      expect.objectContaining({ canvasPath: 'docs/imported.graph.tsx' }),
    ]);
    expect(await secondRepository.getPreference('workspace.lastActiveCanvasSession')).toEqual(
      expect.objectContaining({
        valueJson: {
          'ws-import-2': 'docs/imported.graph.tsx',
        },
      }),
    );

    await secondHandle.close();
    await rm(dataDir, { recursive: true, force: true });
  }, 15_000);
});
