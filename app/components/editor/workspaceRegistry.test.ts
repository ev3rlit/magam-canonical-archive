import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  AppPreferenceRecord,
  AppWorkspaceRecord,
} from '../../../libs/shared/src/lib/app-state-persistence/contracts/types';
import {
  buildSidebarDocuments,
  hydrateWorkspaceRegistryFromAppState,
  LEGACY_WORKSPACE_REGISTRY_IMPORT_PREFERENCE_KEY,
  LAST_ACTIVE_DOCUMENT_SESSION_PREFERENCE_KEY,
  type LastActiveDocumentMap,
  type RegisteredWorkspace,
  type WorkspaceRegistryAppStateRpcClient,
} from './workspaceRegistry';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  key(index: number): string | null;
  readonly length: number;
}

function createMemoryStorage(seed?: Record<string, string>): StorageLike {
  const state = new Map(Object.entries(seed ?? {}));

  return {
    getItem(key) {
      return state.get(key) ?? null;
    },
    setItem(key, value) {
      state.set(key, value);
    },
    removeItem(key) {
      state.delete(key);
    },
    clear() {
      state.clear();
    },
    key(index) {
      return Array.from(state.keys())[index] ?? null;
    },
    get length() {
      return state.size;
    },
  };
}

function installWindowLocalStorage(seed?: Record<string, string>): void {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: createMemoryStorage(seed),
    },
  });
}

function buildWorkspace(id: string, patch?: Partial<RegisteredWorkspace>): RegisteredWorkspace {
  return {
    id,
    name: `Workspace ${id}`,
    rootPath: `/tmp/${id}`,
    status: 'ok',
    documentCount: 0,
    lastModifiedAt: Date.parse('2026-03-23T00:00:00Z'),
    lastOpenedAt: Date.parse('2026-03-23T00:00:00Z'),
    ...patch,
  };
}

function buildRpcMock(overrides?: Partial<WorkspaceRegistryAppStateRpcClient>): WorkspaceRegistryAppStateRpcClient {
  return {
    listAppStateWorkspaces: vi.fn(async () => []),
    upsertAppStateWorkspace: vi.fn(async (input) => ({
      ...input,
      isPinned: false,
      createdAt: new Date('2026-03-23T00:00:00Z'),
      updatedAt: new Date('2026-03-23T00:00:00Z'),
    })),
    getAppStateWorkspaceSession: vi.fn(async () => null),
    setAppStateWorkspaceSession: vi.fn(async (input) => ({
      singletonKey: 'global',
      activeWorkspaceId: input.activeWorkspaceId ?? null,
      updatedAt: new Date('2026-03-23T00:00:00Z'),
    })),
    listAppStateRecentDocuments: vi.fn(async () => []),
    upsertAppStateRecentDocument: vi.fn(async (input) => ({
      workspaceId: input.workspaceId,
      documentPath: input.documentPath,
      lastOpenedAt: input.lastOpenedAt ?? null,
      updatedAt: new Date('2026-03-23T00:00:00Z'),
    })),
    getAppStatePreference: vi.fn(async () => null),
    setAppStatePreference: vi.fn(async (input) => ({
      key: input.key,
      valueJson: input.valueJson,
      updatedAt: new Date('2026-03-23T00:00:00Z'),
    })),
    ...overrides,
  };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('hydrateWorkspaceRegistryFromAppState', () => {
  it('hydrates canonical workspace registry state from app-state and ignores conflicting localStorage', async () => {
    installWindowLocalStorage({
      'magam:workspaceRegistry:v1': JSON.stringify([buildWorkspace('legacy-ws')]),
      'magam:activeWorkspaceId:v1': JSON.stringify('legacy-ws'),
      'magam:lastActiveDocuments:v1': JSON.stringify({ 'legacy-ws': '/tmp/legacy/doc.tsx' }),
    });

    const lastActivePreference: AppPreferenceRecord = {
      key: LAST_ACTIVE_DOCUMENT_SESSION_PREFERENCE_KEY,
      valueJson: {
        'ws-2': '/tmp/ws-2/doc-pref.tsx',
      },
      updatedAt: new Date('2026-03-23T00:00:00Z'),
    };
    const appStateWorkspaces: AppWorkspaceRecord[] = [
      {
        id: 'ws-1',
        rootPath: '/tmp/ws-1',
        displayName: 'Workspace 1',
        status: 'ok',
        isPinned: false,
        lastOpenedAt: new Date('2026-03-20T00:00:00Z'),
        lastSeenAt: new Date('2026-03-21T00:00:00Z'),
      },
      {
        id: 'ws-2',
        rootPath: '/tmp/ws-2',
        displayName: 'Workspace 2',
        status: 'missing',
        isPinned: false,
        lastOpenedAt: new Date('2026-03-22T00:00:00Z'),
        lastSeenAt: null,
      },
    ];
    const rpc = buildRpcMock({
      listAppStateWorkspaces: vi.fn(async () => appStateWorkspaces),
      getAppStateWorkspaceSession: vi.fn(async () => ({
        singletonKey: 'global',
        activeWorkspaceId: 'ws-2',
        updatedAt: new Date('2026-03-23T00:00:00Z'),
      })),
      getAppStatePreference: vi.fn(async (key: string) => {
        if (key === LAST_ACTIVE_DOCUMENT_SESSION_PREFERENCE_KEY) {
          return lastActivePreference;
        }

        return null;
      }),
      listAppStateRecentDocuments: vi.fn(async (workspaceId: string) => {
        const recentDocuments: Record<string, { workspaceId: string; documentPath: string; lastOpenedAt: Date }[]> = {
          'ws-1': [{
            workspaceId: 'ws-1',
            documentPath: '/tmp/ws-1/doc-recent.tsx',
            lastOpenedAt: new Date('2026-03-23T00:00:00Z'),
          }],
          'ws-2': [],
        };
        return recentDocuments[workspaceId] ?? [];
      }),
    });

    const result = await hydrateWorkspaceRegistryFromAppState(rpc);

    expect(result).toEqual({
      workspaces: [
        expect.objectContaining({ id: 'ws-2', name: 'Workspace 2', status: 'missing' }),
        expect.objectContaining({ id: 'ws-1', name: 'Workspace 1', status: 'ok' }),
      ],
      activeWorkspaceId: 'ws-2',
      lastActiveDocuments: {
        'ws-1': '/tmp/ws-1/doc-recent.tsx',
        'ws-2': '/tmp/ws-2/doc-pref.tsx',
      },
      migratedFromLegacyStorage: false,
    });
    expect(rpc.upsertAppStateWorkspace).not.toHaveBeenCalled();
    expect(rpc.setAppStateWorkspaceSession).not.toHaveBeenCalled();
    expect(rpc.setAppStatePreference).not.toHaveBeenCalled();
  });

  it('imports legacy localStorage state into app-state once when no app-state workspaces exist yet', async () => {
    const legacyWorkspaces = [
      buildWorkspace('ws-1', {
        name: 'Workspace 1',
        lastModifiedAt: Date.parse('2026-03-23T01:00:00Z'),
        lastOpenedAt: Date.parse('2026-03-23T02:00:00Z'),
      }),
      buildWorkspace('ws-2', {
        name: 'Workspace 2',
        status: 'missing',
        lastModifiedAt: null,
        lastOpenedAt: Date.parse('2026-03-22T00:00:00Z'),
      }),
    ];
    const lastActiveDocuments: LastActiveDocumentMap = {
      'ws-1': '/tmp/ws-1/doc-a.tsx',
      orphan: '/tmp/orphan/doc-z.tsx',
    };
    installWindowLocalStorage({
      'magam:workspaceRegistry:v1': JSON.stringify(legacyWorkspaces),
      'magam:activeWorkspaceId:v1': JSON.stringify('ws-1'),
      'magam:lastActiveDocuments:v1': JSON.stringify(lastActiveDocuments),
    });

    const rpc = buildRpcMock();

    const result = await hydrateWorkspaceRegistryFromAppState(rpc);

    expect(result).toEqual({
      workspaces: [
        expect.objectContaining({ id: 'ws-1', name: 'Workspace 1' }),
        expect.objectContaining({ id: 'ws-2', name: 'Workspace 2' }),
      ],
      activeWorkspaceId: 'ws-1',
      lastActiveDocuments: {
        'ws-1': '/tmp/ws-1/doc-a.tsx',
      },
      migratedFromLegacyStorage: true,
    });
    expect(rpc.upsertAppStateWorkspace).toHaveBeenCalledTimes(2);
    expect(rpc.upsertAppStateWorkspace).toHaveBeenNthCalledWith(1, expect.objectContaining({
      id: 'ws-1',
      rootPath: '/tmp/ws-1',
      displayName: 'Workspace 1',
      status: 'ok',
    }));
    expect(rpc.upsertAppStateWorkspace).toHaveBeenNthCalledWith(2, expect.objectContaining({
      id: 'ws-2',
      rootPath: '/tmp/ws-2',
      displayName: 'Workspace 2',
      status: 'missing',
    }));
    expect(rpc.setAppStateWorkspaceSession).toHaveBeenCalledWith({
      activeWorkspaceId: 'ws-1',
    });
    expect(rpc.upsertAppStateRecentDocument).toHaveBeenCalledTimes(1);
    expect(rpc.upsertAppStateRecentDocument).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'ws-1',
      documentPath: '/tmp/ws-1/doc-a.tsx',
    }));
    expect(rpc.setAppStatePreference).toHaveBeenCalledWith({
      key: LAST_ACTIVE_DOCUMENT_SESSION_PREFERENCE_KEY,
      valueJson: {
        'ws-1': '/tmp/ws-1/doc-a.tsx',
      },
    });
    expect(rpc.setAppStatePreference).toHaveBeenCalledWith({
      key: LEGACY_WORKSPACE_REGISTRY_IMPORT_PREFERENCE_KEY,
      valueJson: true,
    });
  });

  it('skips legacy import when the completion preference is already set', async () => {
    installWindowLocalStorage({
      'magam:workspaceRegistry:v1': JSON.stringify([buildWorkspace('legacy-ws')]),
      'magam:activeWorkspaceId:v1': JSON.stringify('legacy-ws'),
      'magam:lastActiveDocuments:v1': JSON.stringify({ 'legacy-ws': '/tmp/legacy/doc.tsx' }),
    });

    const rpc = buildRpcMock({
      getAppStatePreference: vi.fn(async (key: string) => {
        if (key === LEGACY_WORKSPACE_REGISTRY_IMPORT_PREFERENCE_KEY) {
          return {
            key,
            valueJson: true,
            updatedAt: new Date('2026-03-23T00:00:00Z'),
          };
        }

        return null;
      }),
    });

    const result = await hydrateWorkspaceRegistryFromAppState(rpc);

    expect(result).toEqual({
      workspaces: [],
      activeWorkspaceId: null,
      lastActiveDocuments: {},
      migratedFromLegacyStorage: false,
    });
    expect(rpc.upsertAppStateWorkspace).not.toHaveBeenCalled();
    expect(rpc.setAppStateWorkspaceSession).not.toHaveBeenCalled();
    expect(rpc.upsertAppStateRecentDocument).not.toHaveBeenCalled();
  });
});

describe('buildSidebarDocuments', () => {
  it('preserves canonical document metadata while projecting absolute paths', () => {
    expect(buildSidebarDocuments('/tmp/ws-1', [{
      documentId: 'doc-1',
      workspaceId: 'ws-1',
      filePath: 'docs/alpha.graph.tsx',
      latestRevision: 3,
    }])).toEqual([
      {
        documentId: 'doc-1',
        workspaceId: 'ws-1',
        latestRevision: 3,
        absolutePath: '/tmp/ws-1/docs/alpha.graph.tsx',
        relativePath: 'docs/alpha.graph.tsx',
        title: 'alpha.graph.tsx',
      },
    ]);
  });
});
