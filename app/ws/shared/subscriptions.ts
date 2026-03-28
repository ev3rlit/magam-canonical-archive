export const WS_SUBSCRIPTION_METHODS = {
  canvasSubscribe: 'canvas.subscribe',
  canvasUnsubscribe: 'canvas.unsubscribe',
  fileSubscribe: 'file.subscribe',
  fileUnsubscribe: 'file.unsubscribe',
} as const;

export const WS_NOTIFICATION_METHODS = {
  canvasChanged: 'canvas.changed',
  fileChanged: 'file.changed',
  filesChanged: 'files.changed',
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

export function matchesFileSubscription(
  resolvedFilePath: string,
  subscription: string,
): boolean {
  return (
    resolvedFilePath === subscription
    || resolvedFilePath.endsWith(subscription)
    || subscription.endsWith(resolvedFilePath)
  );
}

export function isCanvasSubscriptionMethod(method: string): boolean {
  return (
    method === WS_SUBSCRIPTION_METHODS.canvasSubscribe
    || method === WS_SUBSCRIPTION_METHODS.canvasUnsubscribe
  );
}

export function isCompatibilitySubscriptionMethod(method: string): boolean {
  return (
    method === WS_SUBSCRIPTION_METHODS.fileSubscribe
    || method === WS_SUBSCRIPTION_METHODS.fileUnsubscribe
  );
}

export function isSubscriptionMethod(method: string): boolean {
  return isCanvasSubscriptionMethod(method) || isCompatibilitySubscriptionMethod(method);
}
