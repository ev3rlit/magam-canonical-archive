import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type RouteSpecMocks = {
  mockClose: ReturnType<typeof vi.fn>;
  mockCreateAppStatePgliteDb: ReturnType<typeof vi.fn>;
  mockGetPreference: ReturnType<typeof vi.fn>;
  mockGetWorkspaceSession: ReturnType<typeof vi.fn>;
  mockListRecentCanvases: ReturnType<typeof vi.fn>;
  mockListWorkspaces: ReturnType<typeof vi.fn>;
  mockRemoveWorkspace: ReturnType<typeof vi.fn>;
  mockSetPreference: ReturnType<typeof vi.fn>;
  mockSetWorkspaceSession: ReturnType<typeof vi.fn>;
  mockUpsertRecentCanvas: ReturnType<typeof vi.fn>;
  mockUpsertWorkspace: ReturnType<typeof vi.fn>;
  mockClearRecentCanvases: ReturnType<typeof vi.fn>;
};

function getRouteSpecMocks(): RouteSpecMocks {
  const globalState = globalThis as typeof globalThis & { __APP_STATE_ROUTE_SPEC_MOCKS__?: RouteSpecMocks };
  if (!globalState.__APP_STATE_ROUTE_SPEC_MOCKS__) {
    globalState.__APP_STATE_ROUTE_SPEC_MOCKS__ = {
      mockClose: vi.fn(),
      mockCreateAppStatePgliteDb: vi.fn(),
      mockGetPreference: vi.fn(),
      mockGetWorkspaceSession: vi.fn(),
      mockListRecentCanvases: vi.fn(),
      mockListWorkspaces: vi.fn(),
      mockRemoveWorkspace: vi.fn(),
      mockSetPreference: vi.fn(),
      mockSetWorkspaceSession: vi.fn(),
      mockUpsertRecentCanvas: vi.fn(),
      mockUpsertWorkspace: vi.fn(),
      mockClearRecentCanvases: vi.fn(),
    };
  }

  return globalState.__APP_STATE_ROUTE_SPEC_MOCKS__;
}

vi.mock('../../../../../libs/shared/src/lib/app-state-persistence', () => ({
  createAppStatePgliteDb: getRouteSpecMocks().mockCreateAppStatePgliteDb,
  AppStatePersistenceRepository: class {
    constructor(_db: unknown) {}
    listWorkspaces() {
      return getRouteSpecMocks().mockListWorkspaces();
    }
    upsertWorkspace(input: unknown) {
      return getRouteSpecMocks().mockUpsertWorkspace(input);
    }
    removeWorkspace(workspaceId: string) {
      return getRouteSpecMocks().mockRemoveWorkspace(workspaceId);
    }
    getWorkspaceSession() {
      return getRouteSpecMocks().mockGetWorkspaceSession();
    }
    setWorkspaceSession(input: unknown) {
      return getRouteSpecMocks().mockSetWorkspaceSession(input);
    }
    listRecentCanvases(workspaceId: string) {
      return getRouteSpecMocks().mockListRecentCanvases(workspaceId);
    }
    upsertRecentCanvas(input: unknown) {
      return getRouteSpecMocks().mockUpsertRecentCanvas(input);
    }
    clearRecentCanvases(workspaceId: string) {
      return getRouteSpecMocks().mockClearRecentCanvases(workspaceId);
    }
    getPreference(key: string) {
      return getRouteSpecMocks().mockGetPreference(key);
    }
    setPreference(input: unknown) {
      return getRouteSpecMocks().mockSetPreference(input);
    }
  },
}));

const {
  mockClose,
  mockCreateAppStatePgliteDb,
  mockGetPreference,
  mockGetWorkspaceSession,
  mockListRecentCanvases,
  mockListWorkspaces,
  mockRemoveWorkspace,
  mockSetPreference,
  mockSetWorkspaceSession,
  mockUpsertRecentCanvas,
  mockUpsertWorkspace,
  mockClearRecentCanvases,
} = getRouteSpecMocks();

import * as workspacesRoute from './route';
import * as sessionRoute from '../session/route';
import * as recentCanvasesRoute from '../recent-canvases/route';
import * as preferencesRoute from '../preferences/route';

describe('app-state routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAppStatePgliteDb.mockResolvedValue({
      db: {},
      close: mockClose,
    });
  });

  afterEach(() => {
    expect(mockClose).toHaveBeenCalled();
  });

  it('lists and upserts app-state workspaces', async () => {
    mockListWorkspaces.mockResolvedValueOnce([
      {
        id: 'ws-1',
        rootPath: '/tmp/workspace',
        displayName: 'Workspace',
        status: 'ok',
        isPinned: false,
      },
    ]);
    mockUpsertWorkspace.mockResolvedValueOnce({
      id: 'ws-1',
      rootPath: '/tmp/workspace',
      displayName: 'Workspace',
      status: 'ok',
      isPinned: true,
    });

    const listResponse = await workspacesRoute.GET();
    const listBody = await listResponse.json();
    expect(listResponse.status).toBe(200);
    expect(listBody).toEqual([
      expect.objectContaining({ id: 'ws-1', rootPath: '/tmp/workspace' }),
    ]);

    const upsertResponse = await workspacesRoute.POST(new Request('http://localhost/api/app-state/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'ws-1',
        rootPath: '/tmp/workspace',
        displayName: 'Workspace',
        status: 'ok',
        isPinned: true,
      }),
    }));
    const upsertBody = await upsertResponse.json();
    expect(upsertResponse.status).toBe(200);
    expect(mockUpsertWorkspace).toHaveBeenCalledWith({
      id: 'ws-1',
      rootPath: '/tmp/workspace',
      displayName: 'Workspace',
      status: 'ok',
      isPinned: true,
      lastOpenedAt: undefined,
      lastSeenAt: undefined,
    });
    expect(upsertBody).toEqual(expect.objectContaining({ isPinned: true }));
  });

  it('deletes a workspace through the query-string id', async () => {
    const response = await workspacesRoute.DELETE(
      new Request('http://localhost/api/app-state/workspaces?workspaceId=ws-1'),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockRemoveWorkspace).toHaveBeenCalledWith('ws-1');
    expect(body).toEqual({ deleted: true });
  });

  it('gets and updates the workspace session', async () => {
    mockGetWorkspaceSession.mockResolvedValueOnce({
      singletonKey: 'global',
      activeWorkspaceId: 'ws-1',
    });
    mockSetWorkspaceSession.mockResolvedValueOnce({
      singletonKey: 'global',
      activeWorkspaceId: null,
    });

    const getResponse = await sessionRoute.GET();
    expect(getResponse.status).toBe(200);
    expect(await getResponse.json()).toEqual(
      expect.objectContaining({ activeWorkspaceId: 'ws-1' }),
    );

    const setResponse = await sessionRoute.POST(new Request('http://localhost/api/app-state/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeWorkspaceId: null }),
    }));
    expect(setResponse.status).toBe(200);
    expect(mockSetWorkspaceSession).toHaveBeenCalledWith({ activeWorkspaceId: null });
    expect(await setResponse.json()).toEqual(
      expect.objectContaining({ activeWorkspaceId: null }),
    );
  });

  it('lists, upserts, and clears recent canvases', async () => {
    mockListRecentCanvases.mockResolvedValueOnce([
      { workspaceId: 'ws-1', canvasPath: 'docs/alpha.graph.tsx' },
    ]);
    mockUpsertRecentCanvas.mockResolvedValueOnce({
      workspaceId: 'ws-1',
      canvasPath: 'docs/beta.graph.tsx',
    });

    const listResponse = await recentCanvasesRoute.GET(
      new Request('http://localhost/api/app-state/recent-canvases?workspaceId=ws-1'),
    );
    expect(listResponse.status).toBe(200);
    expect(mockListRecentCanvases).toHaveBeenCalledWith('ws-1');
    expect(await listResponse.json()).toEqual([
      expect.objectContaining({ canvasPath: 'docs/alpha.graph.tsx' }),
    ]);

    const upsertResponse = await recentCanvasesRoute.POST(new Request('http://localhost/api/app-state/recent-canvases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'ws-1',
        canvasPath: 'docs/beta.graph.tsx',
      }),
    }));
    expect(upsertResponse.status).toBe(200);
    expect(mockUpsertRecentCanvas).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      canvasPath: 'docs/beta.graph.tsx',
      lastOpenedAt: undefined,
    });

    const clearResponse = await recentCanvasesRoute.DELETE(
      new Request('http://localhost/api/app-state/recent-canvases?workspaceId=ws-1'),
    );
    expect(clearResponse.status).toBe(200);
    expect(mockClearRecentCanvases).toHaveBeenCalledWith('ws-1');
    expect(await clearResponse.json()).toEqual({ deleted: true });
  });

  it('gets and upserts preferences', async () => {
    mockGetPreference.mockResolvedValueOnce({
      key: 'theme.mode',
      valueJson: 'dark',
    });
    mockSetPreference.mockResolvedValueOnce({
      key: 'theme.mode',
      valueJson: 'light',
    });

    const getResponse = await preferencesRoute.GET(
      new Request('http://localhost/api/app-state/preferences?key=theme.mode'),
    );
    expect(getResponse.status).toBe(200);
    expect(mockGetPreference).toHaveBeenCalledWith('theme.mode');
    expect(await getResponse.json()).toEqual(
      expect.objectContaining({ valueJson: 'dark' }),
    );

    const setResponse = await preferencesRoute.POST(new Request('http://localhost/api/app-state/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'theme.mode',
        valueJson: 'light',
      }),
    }));
    expect(setResponse.status).toBe(200);
    expect(mockSetPreference).toHaveBeenCalledWith({
      key: 'theme.mode',
      valueJson: 'light',
    });
    expect(await setResponse.json()).toEqual(
      expect.objectContaining({ valueJson: 'light' }),
    );
  });
});
