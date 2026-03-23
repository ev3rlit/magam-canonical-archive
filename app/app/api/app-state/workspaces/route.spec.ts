import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockClose,
  mockCreateAppStatePgliteDb,
  mockGetPreference,
  mockGetWorkspaceSession,
  mockListRecentDocuments,
  mockListWorkspaces,
  mockRemoveWorkspace,
  mockSetPreference,
  mockSetWorkspaceSession,
  mockUpsertRecentDocument,
  mockUpsertWorkspace,
  mockClearRecentDocuments,
} = vi.hoisted(() => ({
  mockClose: vi.fn(),
  mockCreateAppStatePgliteDb: vi.fn(),
  mockGetPreference: vi.fn(),
  mockGetWorkspaceSession: vi.fn(),
  mockListRecentDocuments: vi.fn(),
  mockListWorkspaces: vi.fn(),
  mockRemoveWorkspace: vi.fn(),
  mockSetPreference: vi.fn(),
  mockSetWorkspaceSession: vi.fn(),
  mockUpsertRecentDocument: vi.fn(),
  mockUpsertWorkspace: vi.fn(),
  mockClearRecentDocuments: vi.fn(),
}));

vi.mock('../../../../../libs/shared/src/lib/app-state-persistence', () => ({
  createAppStatePgliteDb: mockCreateAppStatePgliteDb,
  AppStatePersistenceRepository: class {
    constructor(_db: unknown) {}
    listWorkspaces() {
      return mockListWorkspaces();
    }
    upsertWorkspace(input: unknown) {
      return mockUpsertWorkspace(input);
    }
    removeWorkspace(workspaceId: string) {
      return mockRemoveWorkspace(workspaceId);
    }
    getWorkspaceSession() {
      return mockGetWorkspaceSession();
    }
    setWorkspaceSession(input: unknown) {
      return mockSetWorkspaceSession(input);
    }
    listRecentDocuments(workspaceId: string) {
      return mockListRecentDocuments(workspaceId);
    }
    upsertRecentDocument(input: unknown) {
      return mockUpsertRecentDocument(input);
    }
    clearRecentDocuments(workspaceId: string) {
      return mockClearRecentDocuments(workspaceId);
    }
    getPreference(key: string) {
      return mockGetPreference(key);
    }
    setPreference(input: unknown) {
      return mockSetPreference(input);
    }
  },
}));

import * as workspacesRoute from './route';
import * as sessionRoute from '../session/route';
import * as recentDocumentsRoute from '../recent-documents/route';
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

  it('lists, upserts, and clears recent documents', async () => {
    mockListRecentDocuments.mockResolvedValueOnce([
      { workspaceId: 'ws-1', documentPath: 'docs/alpha.graph.tsx' },
    ]);
    mockUpsertRecentDocument.mockResolvedValueOnce({
      workspaceId: 'ws-1',
      documentPath: 'docs/beta.graph.tsx',
    });

    const listResponse = await recentDocumentsRoute.GET(
      new Request('http://localhost/api/app-state/recent-documents?workspaceId=ws-1'),
    );
    expect(listResponse.status).toBe(200);
    expect(mockListRecentDocuments).toHaveBeenCalledWith('ws-1');
    expect(await listResponse.json()).toEqual([
      expect.objectContaining({ documentPath: 'docs/alpha.graph.tsx' }),
    ]);

    const upsertResponse = await recentDocumentsRoute.POST(new Request('http://localhost/api/app-state/recent-documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'ws-1',
        documentPath: 'docs/beta.graph.tsx',
      }),
    }));
    expect(upsertResponse.status).toBe(200);
    expect(mockUpsertRecentDocument).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      documentPath: 'docs/beta.graph.tsx',
      lastOpenedAt: undefined,
    });

    const clearResponse = await recentDocumentsRoute.DELETE(
      new Request('http://localhost/api/app-state/recent-documents?workspaceId=ws-1'),
    );
    expect(clearResponse.status).toBe(200);
    expect(mockClearRecentDocuments).toHaveBeenCalledWith('ws-1');
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
