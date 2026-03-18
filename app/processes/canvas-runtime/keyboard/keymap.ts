import { createNormalizedKeyChord } from './normalizeKeyEvent';
import {
  CANVAS_KEYBOARD_COMMAND_IDS,
  type CanvasKeyBinding,
  type CanvasResolvedKeyBinding,
  type NormalizedKeyChord,
} from './types';

export const DEFAULT_CANVAS_KEY_BINDINGS: readonly CanvasKeyBinding[] = [
  {
    bindingId: 'history.undo.primary-z',
    chord: createNormalizedKeyChord({ key: 'z', metaKey: true }),
    commandId: CANVAS_KEYBOARD_COMMAND_IDS.HISTORY_UNDO,
    description: 'Undo the most recent edit step.',
  },
  {
    bindingId: 'history.redo.primary-shift-z',
    chord: createNormalizedKeyChord({ key: 'z', metaKey: true, shiftKey: true }),
    commandId: CANVAS_KEYBOARD_COMMAND_IDS.HISTORY_REDO,
    description: 'Redo the most recent reverted edit step.',
  },
  {
    bindingId: 'history.redo.primary-y',
    chord: createNormalizedKeyChord({ key: 'y', metaKey: true }),
    commandId: CANVAS_KEYBOARD_COMMAND_IDS.HISTORY_REDO,
    description: 'Redo the most recent reverted edit step.',
  },
  {
    bindingId: 'clipboard.copy-selection.primary-c',
    chord: createNormalizedKeyChord({ key: 'c', metaKey: true }),
    commandId: CANVAS_KEYBOARD_COMMAND_IDS.CLIPBOARD_COPY_SELECTION,
    description: 'Copy the current graph selection.',
  },
  {
    bindingId: 'clipboard.paste-selection.primary-v',
    chord: createNormalizedKeyChord({ key: 'v', metaKey: true }),
    commandId: CANVAS_KEYBOARD_COMMAND_IDS.CLIPBOARD_PASTE_SELECTION,
    description: 'Paste the last copied graph selection.',
  },
  {
    bindingId: 'selection.focus-next-washi.primary-shift-f',
    chord: createNormalizedKeyChord({ key: 'f', metaKey: true, shiftKey: true }),
    commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_FOCUS_NEXT_WASHI,
    description: 'Move focus to the next Washi node.',
  },
  {
    bindingId: 'selection.select-all-washi.primary-shift-g',
    chord: createNormalizedKeyChord({ key: 'g', metaKey: true, shiftKey: true }),
    commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_SELECT_ALL_WASHI,
    description: 'Select every Washi node in the graph.',
  },
];

export function resolveCanvasKeyBinding(input: {
  chord: NormalizedKeyChord | null;
  bindings?: readonly CanvasKeyBinding[];
}): CanvasResolvedKeyBinding | null {
  if (!input.chord) {
    return null;
  }

  const bindings = input.bindings ?? DEFAULT_CANVAS_KEY_BINDINGS;
  for (let index = bindings.length - 1; index >= 0; index -= 1) {
    const binding = bindings[index];
    if (binding.chord.signature === input.chord.signature) {
      return {
        binding,
        commandId: binding.commandId,
      };
    }
  }

  return null;
}
