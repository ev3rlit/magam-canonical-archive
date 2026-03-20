import type { HostMode } from './hostCapabilities';

export const CORE_RPC_LOGICAL_METHODS = [
  'files.list',
  'fileTree.list',
  'render.generate',
  'edit.apply',
  'sync.watch',
  'chat.send',
  'chat.stop',
  'chat.sessions.list',
] as const;

export type RpcLogicalMethod = (typeof CORE_RPC_LOGICAL_METHODS)[number];

export type RpcTransport = 'http' | 'ipc' | 'ws';

export interface RpcAdapterDescriptor {
  hostMode: HostMode;
  transport: RpcTransport;
  methods: readonly RpcLogicalMethod[];
  healthCheck: () => Promise<boolean>;
}
