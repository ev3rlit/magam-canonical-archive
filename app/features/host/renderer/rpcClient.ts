import type { FileTreeNode } from '@/store/graph';
import type { RpcAdapterDescriptor } from '@/features/host/contracts';
import type { WorkspaceProbeResponse } from '@/components/editor/workspaceRegistry';
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

export interface RendererFileListResponse {
  files: string[];
}

export interface RendererFileCreateResponse {
  filePath: string;
  sourceVersion: string;
}

export interface CreateWorkspaceCanvasResult {
  sourceVersion: string;
  canvasId: string;
  workspaceId: string;
  title?: string | null;
  latestRevision: number | null;
}

export interface WorkspaceCanvasCreateInput {
  rootPath: string;
  title?: string | null;
}

export interface WorkspaceFileBrowserActionInput {
  rootPath: string;
  action: 'open' | 'reveal';
  filePath?: string | null;
  targetPath?: string | null;
}

export function isCreateWorkspaceCanvasResult(
  value: unknown,
): value is CreateWorkspaceCanvasResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.sourceVersion === 'string'
    && typeof record.canvasId === 'string'
    && typeof record.workspaceId === 'string'
    && (typeof record.latestRevision === 'number' || record.latestRevision === null)
    && record.sourceVersion.startsWith('sha256:')
  );
}

export interface RendererRenderResponse {
  graph?: unknown;
  canvasId?: string;
  title?: string | null;
  sourceVersion?: string;
  error?: string;
  type?: string;
  details?: unknown;
}

export interface RendererRpcClient {
  descriptor: RpcAdapterDescriptor;
  healthCheck: () => Promise<boolean>;
  listFiles: () => Promise<RendererFileListResponse>;
  listAppStateWorkspaces: () => Promise<AppWorkspaceRecord[]>;
  upsertAppStateWorkspace: (input: AppWorkspaceUpsertInput) => Promise<AppWorkspaceRecord>;
  removeAppStateWorkspace: (workspaceId: string) => Promise<void>;
  getAppStateWorkspaceSession: () => Promise<AppWorkspaceSessionRecord | null>;
  setAppStateWorkspaceSession: (input: AppWorkspaceSessionUpdateInput) => Promise<AppWorkspaceSessionRecord>;
  listAppStateRecentCanvases: (workspaceId: string) => Promise<AppRecentCanvasRecord[]>;
  upsertAppStateRecentCanvas: (input: AppRecentCanvasUpsertInput) => Promise<AppRecentCanvasRecord>;
  clearAppStateRecentCanvases: (workspaceId: string) => Promise<void>;
  getAppStatePreference: (key: string) => Promise<AppPreferenceRecord | null>;
  setAppStatePreference: (input: AppPreferenceUpsertInput) => Promise<AppPreferenceRecord>;
  probeWorkspace: (rootPath?: string | null) => Promise<WorkspaceProbeResponse>;
  ensureWorkspace: (rootPath: string) => Promise<WorkspaceProbeResponse>;
  listWorkspaceCanvases: (rootPath: string) => Promise<WorkspaceProbeResponse>;
  createWorkspaceCanvas: (input: WorkspaceCanvasCreateInput) => Promise<CreateWorkspaceCanvasResult>;
  launchWorkspaceFileBrowser: (input: WorkspaceFileBrowserActionInput) => Promise<void>;
  createFile: (filePath: string) => Promise<RendererFileCreateResponse>;
  getFileTree: (rootPath?: string | null) => Promise<{ tree: FileTreeNode | null }>;
  renderCanvas: (input: { canvasId: string; rootPath?: string | null }) => Promise<RendererRenderResponse>;
}
