import { RPC_ERRORS } from './rpc';
import { appStateHandlers } from './handlers/appStateHandlers';
import { canvasHandlers, canvasSubscriptionHandlers } from './handlers/canvasHandlers';
import {
  compatibilityHandlers,
  compatibilitySubscriptionHandlers,
} from './handlers/compatibilityHandlers';
import { historyHandlers } from './handlers/historyHandlers';
import { workspaceHandlers } from './handlers/workspaceHandlers';
import type { RpcMethodRegistry } from './shared/params';
import {
  isCompatibilitySubscriptionMethod,
  isSubscriptionMethod,
} from './shared/subscriptions';

export const subscriptionRoutes: RpcMethodRegistry = {
  ...canvasSubscriptionHandlers,
  ...compatibilitySubscriptionHandlers,
};

export const routes: RpcMethodRegistry = {
  ...subscriptionRoutes,
  ...canvasHandlers,
  ...workspaceHandlers,
  ...appStateHandlers,
  ...compatibilityHandlers,
  ...historyHandlers,
};

export function getRouteHandler(method: string) {
  return routes[method] ?? null;
}

export { isCompatibilitySubscriptionMethod, isSubscriptionMethod };

export { RPC_ERRORS };
