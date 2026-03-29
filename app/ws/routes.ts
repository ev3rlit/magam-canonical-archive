import { RPC_ERRORS } from './rpc';
import { appStateHandlers } from './handlers/appStateHandlers';
import { canvasHandlers } from './handlers/canvasHandlers';
import { historyHandlers } from './handlers/historyHandlers';
import { workspaceHandlers } from './handlers/workspaceHandlers';
import type { RpcMethodRegistry } from './shared/params';

export const routes: RpcMethodRegistry = {
  ...canvasHandlers,
  ...workspaceHandlers,
  ...appStateHandlers,
  ...historyHandlers,
};

export function getRouteHandler(method: string) {
  return routes[method] ?? null;
}

export { RPC_ERRORS };
