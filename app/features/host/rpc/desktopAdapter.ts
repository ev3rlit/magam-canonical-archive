import {
  ChatGroupCreateInput,
  ChatGroupUpdateInput,
  ChatSessionCreateInput,
  ChatSessionQuery,
  CreateWorkspaceDocumentResult,
  ChatSessionUpdateInput,
  ChatStreamRequest,
  RendererRpcClient,
  WorkspaceDocumentCreateInput,
  WorkspaceFileBrowserActionInput,
  isCreateWorkspaceDocumentResult,
} from '@/features/host/renderer/rpcClient';
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

function toSearchParams(query?: ChatSessionQuery | { limit?: number }): string {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, rawValue]) => {
    const value = rawValue as string | number | null | undefined;
    if (value === undefined || value === null) {
      return;
    }

    if (typeof value === 'string' && value.length === 0) {
      return;
    }

    params.set(key, String(value));
  });
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
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

async function requestWorkspaceDocumentCreate(
  baseUrl: string,
  pathname: string,
  init?: RequestInit,
): Promise<CreateWorkspaceDocumentResult> {
  const data = await fetch(`${baseUrl}${pathname}`, {
    cache: 'no-store',
    ...init,
  }).then(parseJsonResponse<unknown>);
  if (!isCreateWorkspaceDocumentResult(data)) {
    throw new Error('새 문서 생성 응답이 올바르지 않습니다.');
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

  return {
    descriptor,
    healthCheck: descriptor.healthCheck,
    listFiles: () => requestJson('/files'),
    probeWorkspace: (rootPath?: string | null) =>
      requestJson(`/workspaces${buildRootPathQuery(rootPath)}`),
    ensureWorkspace: (rootPath: string) =>
      requestJson('/workspaces', {
        method: 'POST',
        body: JSON.stringify({ rootPath, action: 'ensure' }),
        headers: createJsonHeaders(),
      }),
    listWorkspaceDocuments: (rootPath: string) =>
      requestJson(`/documents?rootPath=${encodeURIComponent(rootPath)}`),
    createWorkspaceDocument: (input: WorkspaceDocumentCreateInput) =>
      requestWorkspaceDocumentCreate(getBaseUrl(), '/documents', {
        method: 'POST',
        body: JSON.stringify({
          rootPath: input.rootPath,
          ...(input.filePath ? { filePath: input.filePath } : {}),
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
    renderFile: (filePath) =>
      requestRenderJson(getBaseUrl(), '/render', {
        method: 'POST',
        body: JSON.stringify({ filePath }),
        headers: createJsonHeaders(),
      }),
    getChatProviders: () => requestJson('/chat/providers'),
    sendChat: (request: ChatStreamRequest, options) =>
      fetch(`${getBaseUrl()}/chat/send`, {
        method: 'POST',
        body: JSON.stringify(request),
        headers: createJsonHeaders(),
        signal: options?.signal,
      }),
    async stopChat(sessionId: string) {
      await requestJson('/chat/stop', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
        headers: createJsonHeaders(),
      });
    },
    listChatSessions: (query?: ChatSessionQuery) =>
      requestJson(`/chat/sessions${toSearchParams(query)}`),
    createChatSession: (input: ChatSessionCreateInput) =>
      requestJson('/chat/sessions', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: createJsonHeaders(),
      }),
    getChatSession: (sessionId: string) =>
      requestJson(`/chat/sessions/${encodeURIComponent(sessionId)}`),
    getChatSessionMessages: (sessionId: string, query?: { limit?: number }) =>
      requestJson(
        `/chat/sessions/${encodeURIComponent(sessionId)}/messages${toSearchParams(query)}`,
      ),
    updateChatSession: (sessionId: string, patch: ChatSessionUpdateInput) =>
      requestJson(`/chat/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
        headers: createJsonHeaders(),
      }),
    async deleteChatSession(sessionId: string) {
      await requestJson(`/chat/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      });
    },
    listChatGroups: () => requestJson('/chat/groups'),
    async createChatGroup(input: ChatGroupCreateInput) {
      await requestJson('/chat/groups', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: createJsonHeaders(),
      });
    },
    async updateChatGroup(groupId: string, patch: ChatGroupUpdateInput) {
      await requestJson(`/chat/groups/${encodeURIComponent(groupId)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
        headers: createJsonHeaders(),
      });
    },
    async deleteChatGroup(groupId: string) {
      await requestJson(`/chat/groups/${encodeURIComponent(groupId)}`, {
        method: 'DELETE',
      });
    },
  };
}
