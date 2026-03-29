export interface EditorEvent<TPayload = void> {
  type: string;
  payload: TPayload;
}

export type EditorEventListener<TPayload = void> = (
  event: EditorEvent<TPayload>,
) => void;

export function createEventBus() {
  const listeners = new Map<string, Set<EditorEventListener<unknown>>>();

  return {
    subscribe<TPayload>(type: string, listener: EditorEventListener<TPayload>) {
      const bucket = listeners.get(type) ?? new Set<EditorEventListener<unknown>>();
      bucket.add(listener as EditorEventListener<unknown>);
      listeners.set(type, bucket);
      return () => {
        bucket.delete(listener as EditorEventListener<unknown>);
      };
    },
    emit<TPayload>(event: EditorEvent<TPayload>) {
      const bucket = listeners.get(event.type);
      if (!bucket) {
        return;
      }
      bucket.forEach((listener) => {
        listener(event as EditorEvent<unknown>);
      });
    },
  };
}
