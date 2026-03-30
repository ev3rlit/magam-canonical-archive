import { useEditorStore } from '@/core/editor/model/editor-store';
import type { ShortcutCommandDefinition, ShortcutCommandId } from './types';

const shortcutCommands: Record<ShortcutCommandId, ShortcutCommandDefinition> = {
  'editor.clear-selection-context': {
    allowWhileTyping: true,
    preventDefault: false,
    execute: () => {
      const state = useEditorStore.getState();
      if (state.overlays.isBodyEditorOpen) {
        state.commitActiveBodyEditor();
        return;
      }
      state.setTemporaryToolOverride(null);
      state.setContextMenu(null);
      state.setMarquee(null);
      state.openMobilePanel(null);
      state.clearFocusRequest();
      state.clearSelection();
    },
  },
  'editor.undo': {
    execute: () => {
      useEditorStore.getState().undo();
    },
  },
  'editor.redo': {
    execute: () => {
      useEditorStore.getState().redo();
    },
  },
  'canvas.pan-temporary.start': {
    execute: (input) => {
      if (input.repeat) {
        return;
      }
      useEditorStore.getState().setTemporaryToolOverride('pan');
    },
  },
  'canvas.pan-temporary.end': {
    execute: () => {
      useEditorStore.getState().setTemporaryToolOverride(null);
    },
  },
  'selection.copy': {
    execute: () => {
      const state = useEditorStore.getState();
      if (state.selection.ids.length === 0) {
        return;
      }
      state.copySelection();
    },
  },
  'selection.paste': {
    execute: () => {
      const state = useEditorStore.getState();
      if (state.clipboard.rootIds.length === 0) {
        return;
      }
      state.pasteClipboard();
    },
  },
  'selection.delete': {
    execute: () => {
      const state = useEditorStore.getState();
      if (state.selection.ids.length === 0) {
        return;
      }
      state.deleteSelection();
    },
  },
  'selection.duplicate': {
    execute: () => {
      const state = useEditorStore.getState();
      if (state.selection.ids.length === 0) {
        return;
      }
      state.duplicateSelection();
    },
  },
  'selection.group': {
    execute: () => {
      const state = useEditorStore.getState();
      if (state.selection.ids.length < 2) {
        return;
      }
      state.groupSelection();
    },
  },
  'selection.ungroup': {
    execute: () => {
      const state = useEditorStore.getState();
      if (state.selection.ids.length === 0) {
        return;
      }
      state.ungroupSelection();
    },
  },
};

export function getShortcutCommand(commandId: ShortcutCommandId) {
  return shortcutCommands[commandId];
}
