import type { HostMode } from './hostCapabilities';

export const CORE_RPC_LOGICAL_METHODS = [
  'files.list',
  'appState.workspaces.list',
  'appState.workspaces.upsert',
  'appState.workspaces.remove',
  'appState.session.get',
  'appState.session.set',
  'appState.recentDocuments.list',
  'appState.recentDocuments.upsert',
  'appState.recentDocuments.clear',
  'appState.preferences.get',
  'appState.preferences.set',
  'workspace.probe',
  'workspace.ensure',
  'workspace.documents.list',
  'workspace.document.create',
  'workspace.fileBrowser.launch',
  'fileTree.list',
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
