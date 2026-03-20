import type { HostAppEvent } from '@/features/host/contracts';

export type HostAppEventListener = (event: HostAppEvent) => void;

export interface LifecycleEventBridge {
  emit: (event: HostAppEvent) => void;
  subscribe: (listener: HostAppEventListener) => () => void;
}

export function createLifecycleEventBridge(): LifecycleEventBridge {
  const listeners = new Set<HostAppEventListener>();

  return {
    emit(event) {
      listeners.forEach((listener) => listener(event));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
