import {
  CreateWorkspaceCanvasResult,
  RendererRpcClient,
  WorkspaceCanvasCreateInput,
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
  type RpcAdapterDescriptor,
} from '@/features/host/contracts';

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

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    cache: 'no-store',
    ...init,
  });
  return parseJsonResponse<T>(response);
}

async function requestRenderJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    cache: 'no-store',
    ...init,
  });
  return response.json() as Promise<T>;
}

async function requestWorkspaceCanvasCreate(
  path: string,
  init?: RequestInit,
): Promise<CreateWorkspaceCanvasResult> {
  const data = await requestJson<unknown>(path, init);
  if (!isCreateWorkspaceCanvasResult(data)) {
    throw new Error('새 캔버스 생성 응답이 올바르지 않습니다.');
  }
  return data;
}

function createDescriptor(): RpcAdapterDescriptor {
  return {
    hostMode: 'web-secondary',
    transport: 'http',
    methods: CORE_RPC_LOGICAL_METHODS,
    async healthCheck() {
      try {
        await requestJson('/api/workspaces');
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function createWebRpcAdapter(): RendererRpcClient {
  const descriptor = createDescriptor();
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
    listAppStateWorkspaces: () => requestJson<AppWorkspaceRecord[]>('/api/app-state/workspaces'),
    upsertAppStateWorkspace: (input: AppWorkspaceUpsertInput) =>
      requestJson('/api/app-state/workspaces', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: createJsonHeaders(),
      }),
    async removeAppStateWorkspace(workspaceId: string) {
      await requestJson(`/api/app-state/workspaces${buildQuery({ workspaceId })}`, {
        method: 'DELETE',
      });
    },
    getAppStateWorkspaceSession: () =>
      requestJson<AppWorkspaceSessionRecord | null>('/api/app-state/session'),
    setAppStateWorkspaceSession: (input: AppWorkspaceSessionUpdateInput) =>
      requestJson('/api/app-state/session', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: createJsonHeaders(),
      }),
    listAppStateRecentCanvases: (workspaceId: string) =>
      requestJson<AppRecentCanvasRecord[]>(
        `/api/app-state/recent-canvases${buildQuery({ workspaceId })}`,
      ),
    upsertAppStateRecentCanvas: (input: AppRecentCanvasUpsertInput) =>
      requestJson('/api/app-state/recent-canvases', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: createJsonHeaders(),
      }),
    async clearAppStateRecentCanvases(workspaceId: string) {
      await requestJson(`/api/app-state/recent-canvases${buildQuery({ workspaceId })}`, {
        method: 'DELETE',
      });
    },
    getAppStatePreference: (key: string) =>
      requestJson<AppPreferenceRecord | null>(`/api/app-state/preferences${buildQuery({ key })}`),
    setAppStatePreference: (input: AppPreferenceUpsertInput) =>
      requestJson('/api/app-state/preferences', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: createJsonHeaders(),
      }),
    probeWorkspace: (rootPath?: string | null) =>
      requestJson(`/api/workspaces${buildRootPathQuery(rootPath)}`),
    ensureWorkspace: (rootPath: string) =>
      requestJson('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({ rootPath, action: 'ensure' }),
        headers: createJsonHeaders(),
      }),
    listWorkspaceCanvases: (rootPath: string) =>
      requestJson(`/api/canvases?rootPath=${encodeURIComponent(rootPath)}`),
    createWorkspaceCanvas: (input: WorkspaceCanvasCreateInput) =>
      requestWorkspaceCanvasCreate('/api/canvases', {
        method: 'POST',
        body: JSON.stringify({
          rootPath: input.rootPath,
          ...(typeof input.title === 'string' ? { title: input.title } : {}),
          ...(typeof input.canvasId === 'string' ? { canvasId: input.canvasId } : {}),
        }),
        headers: createJsonHeaders(),
      }),
    renderCanvas: (input) =>
      requestRenderJson('/api/render', {
        method: 'POST',
        body: JSON.stringify({
          canvasId: input.canvasId,
          ...(input.rootPath ? { rootPath: input.rootPath } : {}),
        }),
        headers: createJsonHeaders(),
      }),
  };
}

export async function proxyCompatibilityRequest(input: {
  body?: BodyInit | null;
  headers?: HeadersInit;
  method?: string;
  pathname: string;
}): Promise<Response> {
  const httpPort = process.env.MAGAM_HTTP_PORT || '3002';

  try {
    const upstream = await fetch(`http://127.0.0.1:${httpPort}${input.pathname}`, {
      method: input.method,
      body: input.body,
      headers: input.headers,
      cache: 'no-store',
    });
    const contentType = upstream.headers.get('content-type') ?? 'application/json';
    const payload = await upstream.text();
    return new Response(payload, {
      status: upstream.status,
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json(
      { error: `Failed to connect to local backend: ${message}` },
      { status: 502 },
    );
  }
}
