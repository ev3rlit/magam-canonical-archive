import type { ActionOptimisticLifecycleEvent } from './actionRoutingBridge.types';

type LifecycleListener = (event: ActionOptimisticLifecycleEvent) => void;

const listeners = new Set<LifecycleListener>();

export function createOptimisticLifecycleTokens(): {
  optimisticToken: string;
  rollbackToken: string;
} {
  return {
    optimisticToken: crypto.randomUUID(),
    rollbackToken: crypto.randomUUID(),
  };
}

export function emitActionOptimisticLifecycleEvent(event: ActionOptimisticLifecycleEvent): void {
  listeners.forEach((listener) => {
    listener(event);
  });
}

export function subscribeActionOptimisticLifecycle(
  listener: LifecycleListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
