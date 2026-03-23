import type { FileTreeNode } from '@/store/graph';
import type { RpcAdapterDescriptor } from '@/features/host/contracts';
import type { WorkspaceProbeResponse } from '@/components/editor/workspaceRegistry';

export interface RendererFileListResponse {
  files: string[];
}

export interface RendererFileCreateResponse {
  filePath: string;
  sourceVersion: string;
}

export interface CreateWorkspaceDocumentResult {
  filePath: string;
  sourceVersion: string;
}

export interface WorkspaceDocumentCreateInput {
  rootPath: string;
  filePath?: string | null;
}

export interface WorkspaceFileBrowserActionInput {
  rootPath: string;
  action: 'open' | 'reveal';
  filePath?: string | null;
  targetPath?: string | null;
}

export function isCreateWorkspaceDocumentResult(
  value: unknown,
): value is CreateWorkspaceDocumentResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.filePath === 'string'
    && typeof record.sourceVersion === 'string'
    && record.sourceVersion.startsWith('sha256:')
  );
}

export interface RendererRenderResponse {
  graph?: unknown;
  sourceVersion?: string;
  sourceVersions?: Record<string, string>;
  error?: string;
  type?: string;
  details?: unknown;
}

export interface ChatStreamRequest {
  currentFile?: string;
  fileMentions?: string[];
  groupId?: string | null;
  message: string;
  model?: string;
  nodeMentions?: unknown[];
  permissionMode?: string;
  providerId: string;
  reasoningEffort?: string;
  sessionId?: string | null;
}

export interface ChatSessionQuery {
  groupId?: string;
  limit?: number;
  providerId?: string;
  q?: string;
}

export interface ChatSessionCreateInput {
  groupId?: string | null;
  providerId: string;
  title?: string;
}

export interface ChatSessionUpdateInput {
  groupId?: string | null;
  providerId?: string;
  title?: string;
}

export interface ChatGroupCreateInput {
  color?: string;
  name: string;
  sortOrder?: number;
}

export interface ChatGroupUpdateInput {
  color?: string | null;
  name?: string;
  sortOrder?: number;
}

export interface RendererRpcClient {
  descriptor: RpcAdapterDescriptor;
  healthCheck: () => Promise<boolean>;
  listFiles: () => Promise<RendererFileListResponse>;
  probeWorkspace: (rootPath?: string | null) => Promise<WorkspaceProbeResponse>;
  ensureWorkspace: (rootPath: string) => Promise<WorkspaceProbeResponse>;
  listWorkspaceDocuments: (rootPath: string) => Promise<WorkspaceProbeResponse>;
  createWorkspaceDocument: (input: WorkspaceDocumentCreateInput) => Promise<CreateWorkspaceDocumentResult>;
  launchWorkspaceFileBrowser: (input: WorkspaceFileBrowserActionInput) => Promise<void>;
  createFile: (filePath: string) => Promise<RendererFileCreateResponse>;
  getFileTree: (rootPath?: string | null) => Promise<{ tree: FileTreeNode | null }>;
  renderFile: (filePath: string) => Promise<RendererRenderResponse>;
  getChatProviders: () => Promise<{ providers: unknown[] }>;
  sendChat: (request: ChatStreamRequest, options?: { signal?: AbortSignal }) => Promise<Response>;
  stopChat: (sessionId: string) => Promise<void>;
  listChatSessions: (query?: ChatSessionQuery) => Promise<{ sessions: unknown[] }>;
  createChatSession: (input: ChatSessionCreateInput) => Promise<{ session?: unknown }>;
  getChatSession: (sessionId: string) => Promise<{ session?: unknown }>;
  getChatSessionMessages: (sessionId: string, query?: { limit?: number }) => Promise<{ items: unknown[] }>;
  updateChatSession: (sessionId: string, patch: ChatSessionUpdateInput) => Promise<{ session?: unknown }>;
  deleteChatSession: (sessionId: string) => Promise<void>;
  listChatGroups: () => Promise<{ groups: unknown[] }>;
  createChatGroup: (input: ChatGroupCreateInput) => Promise<void>;
  updateChatGroup: (groupId: string, patch: ChatGroupUpdateInput) => Promise<void>;
  deleteChatGroup: (groupId: string) => Promise<void>;
}
