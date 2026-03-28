import { RPC_ERRORS } from './rpc';
import { appStateHandlers } from './handlers/appStateHandlers';
import { canvasHandlers, canvasSubscriptionHandlers } from './handlers/canvasHandlers';
import { historyHandlers } from './handlers/historyHandlers';
import { workspaceHandlers } from './handlers/workspaceHandlers';
import type { RpcMethodRegistry } from './shared/params';
import { isSubscriptionMethod } from './shared/subscriptions';

export const subscriptionRoutes: RpcMethodRegistry = {
  ...canvasSubscriptionHandlers,
};

export const routes: RpcMethodRegistry = {
  ...subscriptionRoutes,
  ...canvasHandlers,
  ...workspaceHandlers,
  ...appStateHandlers,
  ...historyHandlers,
};

export function getRouteHandler(method: string) {
  return routes[method] ?? null;
}

export { isSubscriptionMethod };

export { RPC_ERRORS };
