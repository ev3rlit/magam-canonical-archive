import type { NormalizedShortcutInput, ShortcutCommandId, ShortcutPhase } from './types';

export const defaultEditorKeymap: Record<ShortcutPhase, Record<string, ShortcutCommandId>> = {
  down: {
    Escape: 'editor.clear-selection-context',
    'Mod+Z': 'editor.undo',
    'Mod+Shift+Z': 'editor.redo',
    Space: 'canvas.pan-temporary.start',
    'Mod+C': 'selection.copy',
    'Mod+V': 'selection.paste',
    Delete: 'selection.delete',
    Backspace: 'selection.delete',
    'Mod+D': 'selection.duplicate',
    'Mod+G': 'selection.group',
    'Mod+Shift+G': 'selection.ungroup',
  },
  up: {
    Space: 'canvas.pan-temporary.end',
  },
};

export function resolveShortcutCommandId(input: NormalizedShortcutInput) {
  return defaultEditorKeymap[input.phase][input.chord] ?? null;
}
