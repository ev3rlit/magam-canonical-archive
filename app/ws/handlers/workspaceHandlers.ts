import type { RpcMethodRegistry } from '../shared/params';

// Workspace-specific WS RPC methods do not exist in the current MVP inventory yet.
// Keep the registry explicit so route ownership is visible without reintroducing a
// technology-axis handler split later.
export const workspaceHandlers: RpcMethodRegistry = {};
