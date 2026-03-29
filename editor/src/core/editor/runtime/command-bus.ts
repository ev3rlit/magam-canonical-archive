export interface EditorCommand<TPayload = void> {
  id: string;
  type: string;
  payload: TPayload;
}

export type EditorCommandHandler<TPayload = void> = (
  command: EditorCommand<TPayload>,
) => void | Promise<void>;

export function createCommandBus() {
  const handlers = new Map<string, EditorCommandHandler<unknown>>();

  return {
    register<TPayload>(type: string, handler: EditorCommandHandler<TPayload>) {
      handlers.set(type, handler as EditorCommandHandler<unknown>);
    },
    async dispatch<TPayload>(command: EditorCommand<TPayload>) {
      const handler = handlers.get(command.type);
      if (!handler) {
        return;
      }
      await handler(command);
    },
  };
}
