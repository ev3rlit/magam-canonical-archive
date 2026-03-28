import type { WorkspaceProbeResponse } from '@/components/editor/workspaceRegistry';
import { getHostRuntime } from '@/features/host/renderer/createHostRuntime';
import type { CreateWorkspaceCanvasResult } from '@/features/host/renderer/rpcClient';

export type { CreateWorkspaceCanvasResult } from '@/features/host/renderer/rpcClient';

export async function createWorkspaceCanvas(
  input: {
    rootPath: string;
    title?: string | null;
  },
  _fetchImpl: typeof fetch = fetch,
): Promise<CreateWorkspaceCanvasResult> {
  return getHostRuntime().rpc.createWorkspaceCanvas(input);
}

export async function fetchWorkspaceProbe(
  rootPath?: string | null,
  _fetchImpl: typeof fetch = fetch,
): Promise<WorkspaceProbeResponse> {
  return getHostRuntime().rpc.probeWorkspace(rootPath);
}

export async function ensureWorkspaceProbe(
  rootPath: string,
  _fetchImpl: typeof fetch = fetch,
): Promise<WorkspaceProbeResponse> {
  return getHostRuntime().rpc.ensureWorkspace(rootPath);
}

export async function fetchWorkspaceCanvases(
  rootPath: string,
  _fetchImpl: typeof fetch = fetch,
): Promise<WorkspaceProbeResponse> {
  return getHostRuntime().rpc.listWorkspaceCanvases(rootPath);
}
