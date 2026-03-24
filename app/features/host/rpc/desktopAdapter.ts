import {
  CreateWorkspaceCanvasResult,
  RendererRpcClient,
  WorkspaceCanvasCreateInput,
  WorkspaceFileBrowserActionInput,
  isCreateWorkspaceCanvasResult,
} from '@/features/host/renderer/rpcClient';
import type {
  AppPreferenceRecord,
  AppPreferenceUpsertInput,
  AppRecentCanvasRecord,
  AppRecentCanvasUpsertInput,
  AppWorkspaceRecord,
  AppWorkspaceSessionRecord,
  AppWorkspaceSessionUpdateInput,
  AppWorkspaceUpsertInput,
} from '../../../../libs/shared/src/lib/app-state-persistence/contracts/types';
import {
  CORE_RPC_LOGICAL_METHODS,
  type DesktopRuntimeConfig,
  type RpcAdapterDescriptor,
} from '@/features/host/contracts';

function requireHttpBaseUrl(runtimeConfig?: DesktopRuntimeConfig | null): string {
  if (!runtimeConfig) {
    throw new Error('Desktop runtime config is missing.');
  }

  return runtimeConfig.httpBaseUrl;
}

function createJsonHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set('Content-Type', 'application/json');
  return headers;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

async function requestRenderJson<T>(
  baseUrl: string,
  pathname: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${baseUrl}${pathname}`, {
    cache: 'no-store',
    ...init,
  });
  return response.json() as Promise<T>;
}

async function requestWorkspaceCanvasCreate(
  baseUrl: string,
  pathname: string,
  init?: RequestInit,
): Promise<CreateWorkspaceCanvasResult> {
  const data = await fetch(`${baseUrl}${pathname}`, {
    cache: 'no-store',
    ...init,
  }).then(parseJsonResponse<unknown>);
  if (!isCreateWorkspaceCanvasResult(data)) {
    throw new Error('새 캔버스 생성 응답이 올바르지 않습니다.');
  }
  return data;
}

export function createDesktopRpcAdapter(input?: {
  runtimeConfig?: DesktopRuntimeConfig | null;
}): RendererRpcClient {
  const descriptor: RpcAdapterDescriptor = {
    hostMode: 'desktop-primary',
    transport: 'http',
    methods: CORE_RPC_LOGICAL_METHODS,
    async healthCheck() {
      if (!input?.runtimeConfig) {
        return false;
      }

      try {
        const response = await fetch(`${input.runtimeConfig.httpBaseUrl}/health`, { cache: 'no-store' });
        return response.ok;
      } catch {
        return false;
      }
    },
  };

  const getBaseUrl = () => requireHttpBaseUrl(input?.runtimeConfig);
  const requestJson = <T,>(pathname: string, init?: RequestInit) =>
    fetch(`${getBaseUrl()}${pathname}`, {
      cache: 'no-store',
      ...init,
    }).then(parseJsonResponse<T>);
  const buildRootPathQuery = (rootPath?: string | null) => (
    rootPath ? `?rootPath=${encodeURIComponent(rootPath)}` : ''
  );
  const buildQuery = (input: Record<string, string | null | undefined>) => {
    const params = new URLSearchParams();
    Object.entries(input).forEach(([key, value]) => {
      if (typeof value === 'string' && value.length > 0) {
        params.set(key, value);
      }
    });
    const serialized = params.toString();
    return serialized ? `?${serialized}` : '';
  };

  return {
    descriptor,
    healthCheck: descriptor.healthCheck,
    listFiles: () => requestJson('/files'),
    listAppStateWorkspaces: () => requestJson<AppWorkspaceRecord[]>('/app-state/workspaces'),
    upsertAppStateWorkspace: (input: AppWorkspaceUpsertInput) =>
      requestJson('/app-state/workspaces', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: createJsonHeaders(),
      }),
    async removeAppStateWorkspace(workspaceId: string) {
      await requestJson(`/app-state/workspaces${buildQuery({ workspaceId })}`, {
        method: 'DELETE',
      });
    },
    getAppStateWorkspaceSession: () =>
      requestJson<AppWorkspaceSessionRecord | null>('/app-state/session'),
    setAppStateWorkspaceSession: (input: AppWorkspaceSessionUpdateInput) =>
      requestJson('/app-state/session', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: createJsonHeaders(),
      }),
    listAppStateRecentCanvases: (workspaceId: string) =>
      requestJson<AppRecentCanvasRecord[]>(
        `/app-state/recent-canvases${buildQuery({ workspaceId })}`,
      ),
    upsertAppStateRecentCanvas: (input: AppRecentCanvasUpsertInput) =>
      requestJson('/app-state/recent-canvases', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: createJsonHeaders(),
      }),
    async clearAppStateRecentCanvases(workspaceId: string) {
      await requestJson(`/app-state/recent-canvases${buildQuery({ workspaceId })}`, {
        method: 'DELETE',
      });
    },
    getAppStatePreference: (key: string) =>
      requestJson<AppPreferenceRecord | null>(`/app-state/preferences${buildQuery({ key })}`),
    setAppStatePreference: (input: AppPreferenceUpsertInput) =>
      requestJson('/app-state/preferences', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: createJsonHeaders(),
      }),
    probeWorkspace: (rootPath?: string | null) =>
      requestJson(`/workspaces${buildRootPathQuery(rootPath)}`),
    ensureWorkspace: (rootPath: string) =>
      requestJson('/workspaces', {
        method: 'POST',
        body: JSON.stringify({ rootPath, action: 'ensure' }),
        headers: createJsonHeaders(),
      }),
    listWorkspaceCanvases: (rootPath: string) =>
      requestJson(`/canvases?rootPath=${encodeURIComponent(rootPath)}`),
    createWorkspaceCanvas: (input: WorkspaceCanvasCreateInput) =>
      requestWorkspaceCanvasCreate(getBaseUrl(), '/canvases', {
        method: 'POST',
        body: JSON.stringify({
          rootPath: input.rootPath,
          ...(typeof input.title === 'string' ? { title: input.title } : {}),
        }),
        headers: createJsonHeaders(),
      }),
    async launchWorkspaceFileBrowser(input: WorkspaceFileBrowserActionInput) {
      await requestJson('/workspaces', {
        method: 'POST',
        body: JSON.stringify({
          rootPath: input.rootPath,
          action: input.action,
          ...(input.filePath ? { filePath: input.filePath } : {}),
          ...(input.targetPath ? { targetPath: input.targetPath } : {}),
        }),
        headers: createJsonHeaders(),
      });
    },
    createFile: (filePath) =>
      requestJson('/files', {
        method: 'POST',
        body: JSON.stringify({ filePath }),
        headers: createJsonHeaders(),
      }),
    getFileTree: (rootPath?: string | null) =>
      requestJson(`/file-tree${buildRootPathQuery(rootPath)}`),
    renderCanvas: (input) =>
      requestRenderJson(getBaseUrl(), '/render', {
        method: 'POST',
        body: JSON.stringify({
          canvasId: input.canvasId,
          ...(input.rootPath ? { rootPath: input.rootPath } : {}),
        }),
        headers: createJsonHeaders(),
      }),
  };
}
