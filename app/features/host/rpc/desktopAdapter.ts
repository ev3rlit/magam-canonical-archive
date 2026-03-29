import {
  CreateWorkspaceCanvasResult,
  RendererRpcClient,
  WorkspaceCanvasCreateInput,
  isCreateWorkspaceCanvasResult,
} from '@/features/host/renderer/rpcClient';
import type { DesktopHostBridge } from '@/features/host/contracts';
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

type DesktopRpcEnvelope<T> =
  | { ok: true; result: T }
  | { ok: false; error: { code?: number | string; message: string; data?: unknown } };

function requireBridge(bridge?: DesktopHostBridge | null): DesktopHostBridge {
  if (!bridge) {
    throw new Error('Desktop host bridge is missing.');
  }
  return bridge;
}

async function invokeDesktopRpc<T>(
  bridge: DesktopHostBridge,
  method: string,
  payload?: unknown,
): Promise<T> {
  const envelope = await bridge.rpc.invoke<DesktopRpcEnvelope<T>>(method, payload);
  if (!envelope.ok) {
    throw new Error(envelope.error.message);
  }
  return envelope.result;
}

export function createDesktopRpcAdapter(input?: {
  bridge?: DesktopHostBridge | null;
}): RendererRpcClient {
  const bridge = requireBridge(input?.bridge ?? null);
  const descriptor: RpcAdapterDescriptor = {
    hostMode: 'desktop-primary',
    transport: 'ipc',
    methods: CORE_RPC_LOGICAL_METHODS,
    healthCheck: () => bridge.rpc.healthCheck(),
  };

  return {
    descriptor,
    healthCheck: descriptor.healthCheck,
    listAppStateWorkspaces: () => invokeDesktopRpc<AppWorkspaceRecord[]>(bridge, 'appState.workspaces.list'),
    upsertAppStateWorkspace: (workspaceInput: AppWorkspaceUpsertInput) =>
      invokeDesktopRpc(bridge, 'appState.workspaces.upsert', workspaceInput),
    removeAppStateWorkspace: (workspaceId: string) =>
      invokeDesktopRpc<void>(bridge, 'appState.workspaces.remove', { workspaceId }),
    getAppStateWorkspaceSession: () =>
      invokeDesktopRpc<AppWorkspaceSessionRecord | null>(bridge, 'appState.session.get'),
    setAppStateWorkspaceSession: (sessionInput: AppWorkspaceSessionUpdateInput) =>
      invokeDesktopRpc(bridge, 'appState.session.set', sessionInput),
    listAppStateRecentCanvases: (workspaceId: string) =>
      invokeDesktopRpc<AppRecentCanvasRecord[]>(bridge, 'appState.recentCanvases.list', { workspaceId }),
    upsertAppStateRecentCanvas: (recentCanvasInput: AppRecentCanvasUpsertInput) =>
      invokeDesktopRpc(bridge, 'appState.recentCanvases.upsert', recentCanvasInput),
    clearAppStateRecentCanvases: (workspaceId: string) =>
      invokeDesktopRpc<void>(bridge, 'appState.recentCanvases.clear', { workspaceId }),
    getAppStatePreference: (key: string) =>
      invokeDesktopRpc<AppPreferenceRecord | null>(bridge, 'appState.preferences.get', { key }),
    setAppStatePreference: (preferenceInput: AppPreferenceUpsertInput) =>
      invokeDesktopRpc(bridge, 'appState.preferences.set', preferenceInput),
    probeWorkspace: (rootPath?: string | null) =>
      invokeDesktopRpc(bridge, 'workspace.probe', rootPath ? { rootPath } : {}),
    ensureWorkspace: (rootPath: string) =>
      invokeDesktopRpc(bridge, 'workspace.ensure', { rootPath }),
    listWorkspaceCanvases: (rootPath: string) =>
      invokeDesktopRpc(bridge, 'workspace.canvases.list', { rootPath }),
    async createWorkspaceCanvas(canvasInput: WorkspaceCanvasCreateInput) {
      const data = await invokeDesktopRpc<unknown>(bridge, 'workspace.canvas.create', canvasInput);
      if (!isCreateWorkspaceCanvasResult(data)) {
        throw new Error('새 캔버스 생성 응답이 올바르지 않습니다.');
      }
      return data;
    },
    renderCanvas: (renderInput) =>
      invokeDesktopRpc(bridge, 'render.generate', renderInput),
  };
}
