export const WS_SUBSCRIPTION_METHODS = {
  canvasSubscribe: 'canvas.subscribe',
  canvasUnsubscribe: 'canvas.unsubscribe',
} as const;

export const WS_NOTIFICATION_METHODS = {
  canvasChanged: 'canvas.changed',
} as const;

const CANVAS_SUBSCRIPTION_PREFIX = 'canvas:';

export function createCanvasSubscriptionKey(canvasId: string): string {
  return `${CANVAS_SUBSCRIPTION_PREFIX}${canvasId}`;
}

export function isCanvasSubscriptionKey(value: string): boolean {
  return value.startsWith(CANVAS_SUBSCRIPTION_PREFIX);
}

export function isMatchingCanvasSubscription(
  subscription: string,
  canvasId: string,
): boolean {
  return subscription === createCanvasSubscriptionKey(canvasId);
}

export function isCanvasSubscriptionMethod(method: string): boolean {
  return (
    method === WS_SUBSCRIPTION_METHODS.canvasSubscribe
    || method === WS_SUBSCRIPTION_METHODS.canvasUnsubscribe
  );
}

export function isSubscriptionMethod(method: string): boolean {
  return isCanvasSubscriptionMethod(method);
}
