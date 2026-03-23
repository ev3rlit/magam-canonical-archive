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

describe('host RPC adapters', () => {
  it('keeps desktop and web adapter parity in sync with the logical method inventory', () => {
    const web = createWebRpcAdapter();
    const desktop = createDesktopRpcAdapter({
      runtimeConfig: {
        mode: 'desktop-primary',
        httpBaseUrl: 'http://127.0.0.1:3003',
        wsUrl: 'ws://127.0.0.1:3004',
        appStateDbPath: '/tmp/app-state-pgdata',
        workspacePath: null,
      },
    });

    expect(web.descriptor.methods).toEqual(CORE_RPC_LOGICAL_METHODS);
    expect(desktop.descriptor.methods).toEqual(CORE_RPC_LOGICAL_METHODS);
    expect(CORE_RPC_LOGICAL_METHODS).not.toContain('chat.send');
    expect(CORE_RPC_LOGICAL_METHODS).not.toContain('chat.stop');
    expect(CORE_RPC_LOGICAL_METHODS).not.toContain('chat.sessions.list');
    expect('sendChat' in web).toBe(false);
    expect('sendChat' in desktop).toBe(false);
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
        documentCount: 1,
        documents: [{ filePath: 'docs/alpha.graph.tsx' }],
        lastModifiedAt: 10,
      }))
      .mockResolvedValueOnce(jsonResponse({
        documentId: 'doc-1',
        workspaceId: 'ws-1',
        filePath: 'docs/untitled-1.graph.tsx',
        sourceVersion: 'sha256:created-document',
        latestRevision: 1,
      }, 201));
    globalThis.fetch = fetchMock as typeof fetch;

    const adapter = createWebRpcAdapter();
    await expect(adapter.probeWorkspace('/tmp/workspace')).resolves.toMatchObject({
      rootPath: '/tmp/workspace',
      workspaceName: 'workspace',
    });
    await expect(adapter.createWorkspaceDocument({ rootPath: '/tmp/workspace' })).resolves.toEqual({
      documentId: 'doc-1',
      workspaceId: 'ws-1',
      filePath: 'docs/untitled-1.graph.tsx',
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
      '/api/documents',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        body: JSON.stringify({ rootPath: '/tmp/workspace' }),
      }),
    );
  });

  it('uses the desktop runtime HTTP base URL for workspace shell requests without falling back to 3002', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        rootPath: '/tmp/workspace',
        workspaceName: 'workspace',
        health: { state: 'ok' },
        documentCount: 0,
        documents: [],
        lastModifiedAt: null,
      }))
      .mockResolvedValueOnce(jsonResponse({ launched: true }));
    globalThis.fetch = fetchMock as typeof fetch;

    const adapter = createDesktopRpcAdapter({
      runtimeConfig: {
        mode: 'desktop-primary',
        httpBaseUrl: 'http://127.0.0.1:3003',
        wsUrl: 'ws://127.0.0.1:3004',
        appStateDbPath: '/tmp/app-state-pgdata',
        workspacePath: null,
      },
    });

    await adapter.ensureWorkspace('/tmp/workspace');
    await adapter.launchWorkspaceFileBrowser({
      rootPath: '/tmp/workspace',
      action: 'open',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:3003/workspaces',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        body: JSON.stringify({ rootPath: '/tmp/workspace', action: 'ensure' }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:3003/workspaces',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        body: JSON.stringify({ rootPath: '/tmp/workspace', action: 'open' }),
      }),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('127.0.0.1:3002'),
      expect.anything(),
    );
  });

  it('passes workspace root overrides into file-tree requests for both transports', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ tree: null }));
    globalThis.fetch = fetchMock as typeof fetch;

    await createWebRpcAdapter().getFileTree('/tmp/workspace');
    await createDesktopRpcAdapter({
      runtimeConfig: {
        mode: 'desktop-primary',
        httpBaseUrl: 'http://127.0.0.1:3003',
        wsUrl: 'ws://127.0.0.1:3004',
        appStateDbPath: '/tmp/app-state-pgdata',
        workspacePath: null,
      },
    }).getFileTree('/tmp/workspace');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/file-tree?rootPath=%2Ftmp%2Fworkspace',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:3003/file-tree?rootPath=%2Ftmp%2Fworkspace',
      expect.objectContaining({ cache: 'no-store' }),
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
          documentPath: 'docs/alpha.graph.tsx',
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
    await expect(adapter.listAppStateRecentDocuments('ws-1')).resolves.toEqual([
      expect.objectContaining({ documentPath: 'docs/alpha.graph.tsx' }),
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
      '/api/app-state/recent-documents?workspaceId=ws-1',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/app-state/preferences?key=theme.mode',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('uses the desktop runtime HTTP base URL for app-state requests without falling back to 3002', async () => {
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
          documentPath: 'docs/alpha.graph.tsx',
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        key: 'theme.mode',
        valueJson: 'dark',
      }))
      .mockResolvedValueOnce(jsonResponse({ deleted: true }));
    globalThis.fetch = fetchMock as typeof fetch;

    const adapter = createDesktopRpcAdapter({
      runtimeConfig: {
        mode: 'desktop-primary',
        httpBaseUrl: 'http://127.0.0.1:3003',
        wsUrl: 'ws://127.0.0.1:3004',
        appStateDbPath: '/tmp/app-state-pgdata',
        workspacePath: null,
      },
    });

    await adapter.listAppStateWorkspaces();
    await adapter.getAppStateWorkspaceSession();
    await adapter.listAppStateRecentDocuments('ws-1');
    await adapter.getAppStatePreference('theme.mode');
    await adapter.removeAppStateWorkspace('ws-1');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:3003/app-state/workspaces',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:3003/app-state/session',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://127.0.0.1:3003/app-state/recent-documents?workspaceId=ws-1',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'http://127.0.0.1:3003/app-state/preferences?key=theme.mode',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'http://127.0.0.1:3003/app-state/workspaces?workspaceId=ws-1',
      expect.objectContaining({ method: 'DELETE', cache: 'no-store' }),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('127.0.0.1:3002'),
      expect.anything(),
    );
  });
});
