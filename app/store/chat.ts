'use client';

import { create } from 'zustand';
import { useGraphStore } from '@/store/graph';

export type ChatProviderStatus = 'available' | 'unavailable' | 'unknown';

export interface ChatProvider {
  id: string;
  name: string;
  description?: string;
  status: ChatProviderStatus;
}

export type ChatMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  createdAt: number;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  groupId?: string | null;
  providerId: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatSessionGroup {
  id: string;
  name: string;
  color?: string | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export type ChatStoreStatus =
  | 'idle'
  | 'loadingProviders'
  | 'ready'
  | 'sending'
  | 'error';

export type ChatPermissionMode = 'interactive' | 'auto';
export type ChatReasoningEffort = 'low' | 'medium' | 'high';

export const CHAT_MODEL_PRESETS: Record<string, string[]> = {
  claude: ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-haiku-3-5'],
  codex: [
    'gpt-5.3-codex',
    'gpt-5.3-codex-spark',
    'gpt-5.2-codex',
    'gpt-5.1-codex-max',
    'gpt-5.1-codex-mini',
  ],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
};

export type ChatProgressStage =
  | 'preparing'
  | 'starting'
  | 'working'
  | 'writing'
  | 'finishing';

export interface ChatProgressEvent {
  id: string;
  type: 'tool_use' | 'file_change' | 'done';
  content: string;
  stage: ChatProgressStage;
  createdAt: number;
}

interface ParsedSSEEvent {
  event: string;
  data: string;
}

interface ChatSSEChunk {
  type: 'text' | 'tool_use' | 'file_change' | 'error' | 'done';
  content: string;
  metadata?: Record<string, unknown>;
}

const PROGRESS_LOG_LIMIT = 12;

export interface ChatSendRequest {
  content: string;
  model?: string;
  reasoningEffort?: ChatReasoningEffort;
  fileMentions?: string[];
  nodeMentions?: unknown[];
}

export interface ChatState {
  status: ChatStoreStatus;
  providers: ChatProvider[];
  selectedProviderId: string | null;
  selectedModelByProvider: Record<string, string>;
  reasoningEffort: ChatReasoningEffort;
  sessionId: string | null;
  messages: ChatMessage[];
  sessions: ChatSessionSummary[];
  groups: ChatSessionGroup[];
  currentSessionTitle: string | null;
  progressEvents: ChatProgressEvent[];
  currentStage: ChatProgressStage | null;
  activeRequestId: string | null;
  permissionMode: ChatPermissionMode;
  error: string | null;
  loadProviders: () => Promise<void>;
  selectProvider: (providerId: string) => void;
  setSelectedModel: (model: string) => void;
  setReasoningEffort: (effort: ChatReasoningEffort) => void;
  setPermissionMode: (mode: ChatPermissionMode) => void;
  sendMessage: (request: string | ChatSendRequest) => Promise<void>;
  stopGeneration: () => Promise<void>;
  loadSessions: (query?: { groupId?: string; providerId?: string; q?: string; limit?: number }) => Promise<void>;
  createSession: (input?: { title?: string; providerId?: string; groupId?: string | null }) => Promise<string | null>;
  openSession: (sessionId: string) => Promise<void>;
  updateSession: (sessionId: string, patch: { title?: string; providerId?: string; groupId?: string | null }) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  loadGroups: () => Promise<void>;
  createGroup: (input: { name: string; color?: string; sortOrder?: number }) => Promise<void>;
  updateGroup: (groupId: string, patch: { name?: string; color?: string | null; sortOrder?: number }) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  clearMessages: () => void;
}

let activeAbortController: AbortController | null = null;

const now = () => Date.now();
const createId = () =>
  `${now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const parseSSE = (raw: string): ParsedSSEEvent[] => {
  const blocks = raw
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    const lines = block.split(/\r?\n/);
    let event = 'message';
    const data: string[] = [];

    for (const line of lines) {
      if (line.startsWith(':')) {
        continue;
      }

      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        data.push(line.slice(5).trim());
      }
    }

    return { event, data: data.join('\n') };
  });
};

const extractSessionId = (chunk: ChatSSEChunk | null): string | null => {
  if (!chunk) return null;
  const sessionId = chunk.metadata?.sessionId;
  return typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : null;
};

const inferProgressStage = (
  chunk: Pick<ChatSSEChunk, 'type' | 'content' | 'metadata'>,
): ChatProgressStage => {
  const rawStage =
    typeof chunk.metadata?.stage === 'string'
      ? chunk.metadata.stage.toLowerCase()
      : '';
  const content = chunk.content.toLowerCase();

  if (chunk.type === 'done' || rawStage.includes('done') || rawStage.includes('finish')) {
    return 'finishing';
  }

  if (rawStage.includes('prompt') || content.includes('prompt') || content.includes('context')) {
    return 'preparing';
  }

  if (rawStage.includes('adapter') || content.includes('adapter')) {
    return 'starting';
  }

  if (
    chunk.type === 'file_change' ||
    rawStage.includes('write') ||
    rawStage.includes('file') ||
    content.includes('write') ||
    content.includes('file') ||
    content.includes('수정')
  ) {
    return 'writing';
  }

  return 'working';
};

const appendProgressEvent = (
  events: ChatProgressEvent[],
  chunk: ChatSSEChunk,
): ChatProgressEvent[] => {
  const stage = inferProgressStage(chunk);
  const next: ChatProgressEvent = {
    id: createId(),
    type:
      chunk.type === 'done'
        ? 'done'
        : chunk.type === 'file_change'
          ? 'file_change'
          : 'tool_use',
    content: chunk.content,
    stage,
    createdAt: now(),
  };

  const merged = [...events, next];
  return merged.slice(Math.max(0, merged.length - PROGRESS_LOG_LIMIT));
};

export const __chatTestUtils = {
  parseSSE,
  extractSessionId,
  inferProgressStage,
  appendProgressEvent,
};

export const useChatStore = create<ChatState>((set, get) => ({
  status: 'idle',
  providers: [],
  selectedProviderId: null,
  selectedModelByProvider: {},
  reasoningEffort: 'medium',
  sessionId: null,
  messages: [],
  sessions: [],
  groups: [],
  currentSessionTitle: null,
  progressEvents: [],
  currentStage: null,
  activeRequestId: null,
  permissionMode: 'auto',
  error: null,

  loadProviders: async () => {
    set({ status: 'loadingProviders', error: null });

    try {
      const res = await fetch('/api/chat/providers', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Failed to load providers (${res.status})`);
      }

      const data = await res.json();
      const providers = Array.isArray(data?.providers)
        ? data.providers.map((provider: any): ChatProvider => ({
            id: String(provider.id),
            name: String(provider.displayName ?? provider.name ?? provider.id),
            description: provider.version
              ? `v${provider.version}`
              : provider.command,
            status:
              provider.isInstalled === true
                ? 'available'
                : provider.isInstalled === false
                  ? 'unavailable'
                  : 'unknown',
          }))
        : [];

      set((state) => {
        const selectedProviderId =
          state.selectedProviderId &&
          providers.some((p: ChatProvider) => p.id === state.selectedProviderId)
            ? state.selectedProviderId
            : (providers.find((p: ChatProvider) => p.status === 'available')?.id ??
              providers[0]?.id ??
              null);

        const selectedModelByProvider = { ...state.selectedModelByProvider };
        for (const provider of providers) {
          if (!selectedModelByProvider[provider.id]) {
            selectedModelByProvider[provider.id] = CHAT_MODEL_PRESETS[provider.id]?.[0] ?? '';
          }
        }

        return {
          providers,
          selectedProviderId,
          selectedModelByProvider,
          status: 'ready' as const,
        };
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown provider loading error';
      set({ status: 'error', error: message });
    }
  },

  selectProvider: (providerId) =>
    set((state) => ({
      selectedProviderId: providerId,
      selectedModelByProvider: {
        ...state.selectedModelByProvider,
        [providerId]:
          state.selectedModelByProvider[providerId] ??
          CHAT_MODEL_PRESETS[providerId]?.[0] ??
          '',
      },
    })),
  setSelectedModel: (model) =>
    set((state) => {
      const providerId = state.selectedProviderId;
      if (!providerId) return state;
      return {
        selectedModelByProvider: {
          ...state.selectedModelByProvider,
          [providerId]: model,
        },
      };
    }),
  setReasoningEffort: (reasoningEffort) => set({ reasoningEffort }),
  setPermissionMode: (permissionMode) => set({ permissionMode }),

  sendMessage: async (request) => {
    const payload: ChatSendRequest =
      typeof request === 'string' ? { content: request } : request;
    const trimmed = payload.content.trim();
    if (!trimmed) return;

    const {
      selectedProviderId,
      selectedModelByProvider,
      reasoningEffort,
      messages,
      sessionId,
      permissionMode,
    } = get();
    if (!selectedProviderId) {
      set({ error: 'Please select an AI provider first.' });
      return;
    }

    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content: trimmed,
      createdAt: now(),
    };

    const assistantMessageId = createId();
    const assistantPlaceholder: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      createdAt: now(),
    };

    set({
      error: null,
      status: 'sending',
      currentStage: 'preparing',
      activeRequestId: assistantMessageId,
      progressEvents: [],
      messages: [...messages, userMessage, assistantPlaceholder],
    });

    activeAbortController?.abort();
    activeAbortController = new AbortController();

    try {
      const currentFile = useGraphStore.getState().currentFile ?? undefined;

      const normalizedFileMentions = Array.isArray(payload.fileMentions)
        ? payload.fileMentions.filter(
            (item): item is string => typeof item === 'string' && item.trim().length > 0,
          )
        : [];
      const normalizedNodeMentions = Array.isArray(payload.nodeMentions)
        ? payload.nodeMentions
        : [];
      const normalizedModel =
        typeof payload.model === 'string' && payload.model.trim().length > 0
          ? payload.model.trim()
          : selectedModelByProvider[selectedProviderId]?.trim() || undefined;
      const normalizedReasoningEffort =
        payload.reasoningEffort ?? reasoningEffort;

      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          providerId: selectedProviderId,
          sessionId,
          currentFile,
          permissionMode,
          ...(normalizedModel ? { model: normalizedModel } : {}),
          ...(normalizedReasoningEffort
            ? { reasoningEffort: normalizedReasoningEffort }
            : {}),
          ...(normalizedFileMentions.length > 0
            ? { fileMentions: normalizedFileMentions }
            : {}),
          ...(normalizedNodeMentions.length > 0
            ? { nodeMentions: normalizedNodeMentions }
            : {}),
        }),
        signal: activeAbortController.signal,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(
          detail
            ? `Failed to send chat message (${res.status}): ${detail}`
            : `Failed to send chat message (${res.status})`,
        );
      }

      if (!res.body) {
        throw new Error('Missing response stream from chat endpoint.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';

      const processEvents = (rawEvents: string) => {
        const events = parseSSE(rawEvents);

        for (const event of events) {
          let chunk: ChatSSEChunk | null = null;

          if (event.data) {
            try {
              chunk = JSON.parse(event.data) as ChatSSEChunk;
            } catch {
              continue;
            }
          }

          const nextSessionId = extractSessionId(chunk);
          if (nextSessionId) {
            set({ sessionId: nextSessionId });
          }

          if (event.event === 'error' || chunk?.type === 'error') {
            throw new Error(chunk?.content || 'Chat stream error');
          }

          if (!chunk) {
            continue;
          }

          if (chunk.type === 'text') {
            assistantText += chunk.content;
            set((state) => ({
              currentStage: state.currentStage ?? 'working',
              messages: state.messages.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, content: assistantText }
                  : message,
              ),
            }));
            continue;
          }

          if (
            chunk.type === 'tool_use' ||
            chunk.type === 'file_change' ||
            chunk.type === 'done' ||
            event.event === 'done'
          ) {
            set((state) => {
              const progressEvents = appendProgressEvent(state.progressEvents, chunk);
              return {
                progressEvents,
                currentStage:
                  chunk.type === 'done' || event.event === 'done'
                    ? 'finishing'
                    : inferProgressStage(chunk),
              };
            });
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

        const delimiterIndex = buffer.lastIndexOf('\n\n');
        if (delimiterIndex < 0) {
          continue;
        }

        const complete = buffer.slice(0, delimiterIndex);
        buffer = buffer.slice(delimiterIndex + 2);
        processEvents(complete);
      }

      const trailing = buffer + decoder.decode().replace(/\r\n/g, '\n');
      if (trailing.trim()) {
        processEvents(trailing);
      }

      set((state) => ({
        status: state.status === 'sending' ? 'ready' : state.status,
        currentStage: state.status === 'sending' ? null : state.currentStage,
        activeRequestId: state.status === 'sending' ? null : state.activeRequestId,
      }));
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        set({ status: 'ready', currentStage: null, activeRequestId: null });
        return;
      }

      const message =
        error instanceof Error ? error.message : 'Unknown chat send error';

      set((state) => ({
        status: 'error',
        error: message,
        currentStage: null,
        activeRequestId: null,
        messages: state.messages.map((chatMessage) =>
          chatMessage.id === assistantMessageId
            ? {
                ...chatMessage,
                content:
                  chatMessage.content ||
                  `Error: ${message.includes('TIMEOUT') ? '응답 시간이 초과되었습니다. (잠시 후 다시 시도하거나 요청을 더 짧게 나눠주세요)' : message}`,
              }
            : chatMessage,
        ),
      }));
    } finally {
      activeAbortController = null;
    }
  },

  stopGeneration: async () => {
    activeAbortController?.abort();
    activeAbortController = null;

    const { sessionId } = get();

    if (!sessionId) {
      set({ status: 'ready', currentStage: null, activeRequestId: null });
      return;
    }

    try {
      await fetch('/api/chat/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown stop request error';
      set({ error: message });
    } finally {
      set({ status: 'ready', currentStage: null, activeRequestId: null });
    }
  },

  loadSessions: async (query) => {
    try {
      const params = new URLSearchParams();
      if (query?.groupId) params.set('groupId', query.groupId);
      if (query?.providerId) params.set('providerId', query.providerId);
      if (query?.q) params.set('q', query.q);
      if (query?.limit) params.set('limit', String(query.limit));

      const res = await fetch(`/api/chat/sessions${params.size ? `?${params.toString()}` : ''}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`Failed to load sessions (${res.status})`);

      const data = await res.json();
      const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
      set({ sessions });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown session loading error';
      set({ error: message });
    }
  },

  createSession: async (input) => {
    try {
      const providerId = input?.providerId ?? get().selectedProviderId;
      if (!providerId) {
        set({ error: 'Please select an AI provider first.' });
        return null;
      }

      const res = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: input?.title,
          providerId,
          groupId: input?.groupId,
        }),
      });

      if (!res.ok) throw new Error(`Failed to create session (${res.status})`);

      const data = await res.json();
      const session = data?.session as ChatSessionSummary | undefined;
      if (!session) return null;

      set((state) => ({
        sessionId: session.id,
        currentSessionTitle: session.title,
        selectedProviderId: session.providerId,
        sessions: [session, ...state.sessions.filter((item) => item.id !== session.id)],
        messages: [],
        progressEvents: [],
        currentStage: null,
      }));

      return session.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown session create error';
      set({ error: message });
      return null;
    }
  },

  openSession: async (sessionId) => {
    try {
      const [sessionRes, messagesRes] = await Promise.all([
        fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, { cache: 'no-store' }),
        fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}/messages?limit=200`, {
          cache: 'no-store',
        }),
      ]);

      if (!sessionRes.ok) throw new Error(`Failed to open session (${sessionRes.status})`);
      if (!messagesRes.ok) throw new Error(`Failed to load messages (${messagesRes.status})`);

      const sessionData = await sessionRes.json();
      const messagesData = await messagesRes.json();

      const session = sessionData?.session as ChatSessionSummary | undefined;
      const messages = Array.isArray(messagesData?.items)
        ? messagesData.items.map((message: any) => ({
            id: String(message.id),
            role: String(message.role) as ChatMessageRole,
            content: String(message.content ?? ''),
            createdAt: Number(message.createdAt ?? Date.now()),
          }))
        : [];

      if (!session) return;

      set({
        sessionId: session.id,
        currentSessionTitle: session.title,
        selectedProviderId: session.providerId,
        messages,
        progressEvents: [],
        currentStage: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown session open error';
      set({ error: message });
    }
  },

  updateSession: async (sessionId, patch) => {
    try {
      const res = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`Failed to update session (${res.status})`);

      const data = await res.json();
      const updated = data?.session as ChatSessionSummary | undefined;
      if (!updated) return;

      set((state) => ({
        sessions: state.sessions.map((session) => (session.id === sessionId ? updated : session)),
        ...(state.sessionId === sessionId
          ? {
              currentSessionTitle: updated.title,
              selectedProviderId: updated.providerId,
            }
          : {}),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown session update error';
      set({ error: message });
    }
  },

  deleteSession: async (sessionId) => {
    try {
      const res = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`Failed to delete session (${res.status})`);

      set((state) => {
        const nextSessions = state.sessions.filter((session) => session.id !== sessionId);
        const isCurrent = state.sessionId === sessionId;
        return {
          sessions: nextSessions,
          ...(isCurrent
            ? {
                sessionId: null,
                currentSessionTitle: null,
                messages: [],
                progressEvents: [],
                currentStage: null,
              }
            : {}),
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown session delete error';
      set({ error: message });
    }
  },

  loadGroups: async () => {
    try {
      const res = await fetch('/api/chat/groups', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load groups (${res.status})`);

      const data = await res.json();
      const groups = Array.isArray(data?.groups) ? data.groups : [];
      set({ groups });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown group loading error';
      set({ error: message });
    }
  },

  createGroup: async (input) => {
    try {
      const res = await fetch('/api/chat/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`Failed to create group (${res.status})`);
      await Promise.all([get().loadGroups(), get().loadSessions({ limit: 100 })]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown group create error';
      set({ error: message });
    }
  },

  updateGroup: async (groupId, patch) => {
    try {
      const res = await fetch(`/api/chat/groups/${encodeURIComponent(groupId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`Failed to update group (${res.status})`);
      await Promise.all([get().loadGroups(), get().loadSessions({ limit: 100 })]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown group update error';
      set({ error: message });
    }
  },

  deleteGroup: async (groupId) => {
    try {
      const res = await fetch(`/api/chat/groups/${encodeURIComponent(groupId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`Failed to delete group (${res.status})`);
      await Promise.all([get().loadGroups(), get().loadSessions({ limit: 100 })]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown group delete error';
      set({ error: message });
    }
  },

  clearMessages: () =>
    set({
      messages: [],
      sessionId: null,
      progressEvents: [],
      currentStage: null,
      activeRequestId: null,
    }),
}));
