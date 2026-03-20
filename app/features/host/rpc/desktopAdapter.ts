import type {
  ChatGroupCreateInput,
  ChatGroupUpdateInput,
  ChatSessionCreateInput,
  ChatSessionQuery,
  ChatSessionUpdateInput,
  ChatStreamRequest,
  RendererRpcClient,
} from '@/features/host/renderer/rpcClient';
import {
  CORE_RPC_LOGICAL_METHODS,
  type DesktopRuntimeConfig,
  type RpcAdapterDescriptor,
} from '@/features/host/contracts';

function resolveHttpBaseUrl(runtimeConfig?: DesktopRuntimeConfig | null): string {
  return runtimeConfig?.httpBaseUrl
    ?? `http://127.0.0.1:${process.env.NEXT_PUBLIC_MAGAM_HTTP_PORT || '3002'}`;
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

export function createDesktopRpcAdapter(input?: {
  runtimeConfig?: DesktopRuntimeConfig | null;
}): RendererRpcClient {
  const baseUrl = resolveHttpBaseUrl(input?.runtimeConfig);
  const descriptor: RpcAdapterDescriptor = {
    hostMode: 'desktop-primary',
    transport: 'http',
    methods: CORE_RPC_LOGICAL_METHODS,
    async healthCheck() {
      try {
        const response = await fetch(`${baseUrl}/health`, { cache: 'no-store' });
        return response.ok;
      } catch {
        return false;
      }
    },
  };

  const requestJson = <T,>(pathname: string, init?: RequestInit) =>
    fetch(`${baseUrl}${pathname}`, {
      cache: 'no-store',
      ...init,
    }).then(parseJsonResponse<T>);

  return {
    descriptor,
    healthCheck: descriptor.healthCheck,
    listFiles: () => requestJson('/files'),
    createFile: (filePath) =>
      requestJson('/files', {
        method: 'POST',
        body: JSON.stringify({ filePath }),
        headers: createJsonHeaders(),
      }),
    getFileTree: () => requestJson('/file-tree'),
    renderFile: (filePath) =>
      requestRenderJson(baseUrl, '/render', {
        method: 'POST',
        body: JSON.stringify({ filePath }),
        headers: createJsonHeaders(),
      }),
    getChatProviders: () => requestJson('/chat/providers'),
    sendChat: (request: ChatStreamRequest, options) =>
      fetch(`${baseUrl}/chat/send`, {
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
