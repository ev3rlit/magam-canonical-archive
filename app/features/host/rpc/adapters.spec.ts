import { afterEach, describe, expect, it, vi } from 'vitest';
import { CORE_RPC_LOGICAL_METHODS } from '../contracts/rpcMethods';
import { createDesktopRpcAdapter } from './desktopAdapter';
import { validateAdapterParity } from './validateParity';
import { createWebRpcAdapter } from './webAdapter';

const originalFetch = globalThis.fetch;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function createDesktopBridge() {
  return {
    runtime: {
      mode: 'desktop-primary' as const,
      appStateDbPath: '/tmp/app-state-pgdata',
      workspacePath: null,
      workspaceMode: 'transient' as const,
      storageBackend: 'memory' as const,
      transientCanvasId: 'transient-canvas-test',
    },
    capabilities: {
      workspace: {
        async selectWorkspace() {
          return null;
        },
        async chooseSaveLocation() {
          return null;
        },
        async revealInOs() {
          return;
        },
      },
      shell: {
        async openExternal() {
          return;
        },
      },
      lifecycle: {
        onAppEvent() {
          return () => undefined;
        },
      },
    },
    bootstrap: {
      async getSession() {
        return null;
      },
      async markRendererLoading() {
        return null;
      },
      async markRendererReady() {
        return null;
      },
      async markRendererFailed() {
        return null;
      },
    },
    rpc: {
      healthCheck: vi.fn(async () => true),
      invoke: vi.fn(),
    },
  };
}

describe('host RPC adapters', () => {
  it('keeps desktop and web adapter parity in sync with the logical method inventory', () => {
    const web = createWebRpcAdapter();
    const desktop = createDesktopRpcAdapter({
      bridge: createDesktopBridge(),
    });

    expect(web.descriptor.methods).toEqual(CORE_RPC_LOGICAL_METHODS);
    expect(desktop.descriptor.methods).toEqual(CORE_RPC_LOGICAL_METHODS);
    expect(validateAdapterParity({
      desktop: desktop.descriptor,
      web: web.descriptor,
    })).toEqual({
      desktopOnly: [],
      shared: [...CORE_RPC_LOGICAL_METHODS],
      webOnly: [],
    });
  });

  it('maps workspace shell requests through same-origin web API routes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        rootPath: '/tmp/workspace',
        workspaceName: 'workspace',
        health: { state: 'ok' },
        canvasCount: 1,
        canvases: [{ canvasId: 'doc-0', workspaceId: 'ws-1', title: 'Alpha', latestRevision: 1 }],
        lastModifiedAt: 10,
      }))
      .mockResolvedValueOnce(jsonResponse({
        canvasId: 'doc-1',
        workspaceId: 'ws-1',
        title: null,
        sourceVersion: 'sha256:created-document',
        latestRevision: 1,
      }, 201));
    globalThis.fetch = fetchMock as typeof fetch;

    const adapter = createWebRpcAdapter();
    await expect(adapter.probeWorkspace('/tmp/workspace')).resolves.toMatchObject({
      rootPath: '/tmp/workspace',
      workspaceName: 'workspace',
    });
    await expect(adapter.createWorkspaceCanvas({ rootPath: '/tmp/workspace' })).resolves.toEqual({
      canvasId: 'doc-1',
      workspaceId: 'ws-1',
      title: null,
      sourceVersion: 'sha256:created-document',
      latestRevision: 1,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/workspaces?rootPath=%2Ftmp%2Fworkspace',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/canvases',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        body: JSON.stringify({ rootPath: '/tmp/workspace' }),
      }),
    );
  });

  it('routes desktop workspace shell requests through the IPC bridge', async () => {
    const bridge = createDesktopBridge();
    bridge.rpc.invoke = vi.fn()
      .mockResolvedValueOnce({ ok: true, result: {
        rootPath: '/tmp/workspace',
        workspaceName: 'workspace',
        health: { state: 'ok' },
        canvasCount: 0,
        documents: [],
        lastModifiedAt: null,
      }});

    const adapter = createDesktopRpcAdapter({
      bridge,
    });

    await adapter.ensureWorkspace('/tmp/workspace');

    expect(bridge.rpc.invoke).toHaveBeenNthCalledWith(
      1,
      'workspace.ensure',
      { rootPath: '/tmp/workspace' },
    );
  });

  it('maps app-state requests through same-origin web API routes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 'ws-1',
          rootPath: '/tmp/workspace',
          displayName: 'workspace',
          status: 'ok',
          isPinned: false,
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        singletonKey: 'global',
        activeWorkspaceId: 'ws-1',
      }))
      .mockResolvedValueOnce(jsonResponse([
        {
          workspaceId: 'ws-1',
          canvasId: 'canvas-alpha',
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        key: 'theme.mode',
        valueJson: 'light',
      }));
    globalThis.fetch = fetchMock as typeof fetch;

    const adapter = createWebRpcAdapter();

    await expect(adapter.listAppStateWorkspaces()).resolves.toEqual([
      expect.objectContaining({
        id: 'ws-1',
        rootPath: '/tmp/workspace',
      }),
    ]);
    await expect(adapter.getAppStateWorkspaceSession()).resolves.toEqual(
      expect.objectContaining({ activeWorkspaceId: 'ws-1' }),
    );
    await expect(adapter.listAppStateRecentCanvases('ws-1')).resolves.toEqual([
      expect.objectContaining({ canvasId: 'canvas-alpha' }),
    ]);
    await expect(adapter.getAppStatePreference('theme.mode')).resolves.toEqual(
      expect.objectContaining({ key: 'theme.mode', valueJson: 'light' }),
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/app-state/workspaces',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/app-state/session',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/app-state/recent-canvases?workspaceId=ws-1',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/app-state/preferences?key=theme.mode',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('routes desktop app-state requests through the IPC bridge', async () => {
    const bridge = createDesktopBridge();
    bridge.rpc.invoke = vi.fn()
      .mockResolvedValueOnce({ ok: true, result: [
        {
          id: 'ws-1',
          rootPath: '/tmp/workspace',
          displayName: 'workspace',
          status: 'ok',
          isPinned: false,
        },
      ]})
      .mockResolvedValueOnce({ ok: true, result: {
        singletonKey: 'global',
        activeWorkspaceId: 'ws-1',
      }})
      .mockResolvedValueOnce({ ok: true, result: [
        {
          workspaceId: 'ws-1',
          canvasId: 'canvas-alpha',
        },
      ]})
      .mockResolvedValueOnce({ ok: true, result: {
        key: 'theme.mode',
        valueJson: 'dark',
      }})
      .mockResolvedValueOnce({ ok: true, result: undefined });

    const adapter = createDesktopRpcAdapter({
      bridge,
    });

    await adapter.listAppStateWorkspaces();
    await adapter.getAppStateWorkspaceSession();
    await adapter.listAppStateRecentCanvases('ws-1');
    await adapter.getAppStatePreference('theme.mode');
    await adapter.removeAppStateWorkspace('ws-1');

    expect(bridge.rpc.invoke).toHaveBeenNthCalledWith(
      1,
      'appState.workspaces.list',
      undefined,
    );
    expect(bridge.rpc.invoke).toHaveBeenNthCalledWith(
      2,
      'appState.session.get',
      undefined,
    );
    expect(bridge.rpc.invoke).toHaveBeenNthCalledWith(
      3,
      'appState.recentCanvases.list',
      { workspaceId: 'ws-1' },
    );
    expect(bridge.rpc.invoke).toHaveBeenNthCalledWith(
      4,
      'appState.preferences.get',
      { key: 'theme.mode' },
    );
    expect(bridge.rpc.invoke).toHaveBeenNthCalledWith(
      5,
      'appState.workspaces.remove',
      { workspaceId: 'ws-1' },
    );
  });
});
