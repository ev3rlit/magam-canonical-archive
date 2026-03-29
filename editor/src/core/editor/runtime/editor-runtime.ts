import { initialEditorState, type EditorState } from '@/core/editor/model/editor-state';
import { createCommandBus } from '@/core/editor/runtime/command-bus';
import { createEventBus } from '@/core/editor/runtime/event-bus';

export interface EditorRuntime {
  commands: ReturnType<typeof createCommandBus>;
  events: ReturnType<typeof createEventBus>;
  state: EditorState;
}

export function createEditorRuntime(): EditorRuntime {
  return {
    commands: createCommandBus(),
    events: createEventBus(),
    state: initialEditorState,
  };
}
