import type { HostMode } from './hostCapabilities';

export const CORE_RPC_LOGICAL_METHODS = [
  'appState.workspaces.list',
  'appState.workspaces.upsert',
  'appState.workspaces.remove',
  'appState.session.get',
  'appState.session.set',
  'appState.recentCanvases.list',
  'appState.recentCanvases.upsert',
  'appState.recentCanvases.clear',
  'appState.preferences.get',
  'appState.preferences.set',
  'workspace.probe',
  'workspace.ensure',
  'workspace.canvases.list',
  'workspace.canvas.create',
  'render.generate',
  'edit.apply',
  'sync.watch',
] as const;

export type RpcLogicalMethod = (typeof CORE_RPC_LOGICAL_METHODS)[number];

export type RpcTransport = 'http' | 'ipc' | 'ws';

export interface RpcAdapterDescriptor {
  hostMode: HostMode;
  transport: RpcTransport;
  methods: readonly RpcLogicalMethod[];
  healthCheck: () => Promise<boolean>;
}
