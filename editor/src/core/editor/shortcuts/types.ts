export type ShortcutPhase = 'down' | 'up';

export type ShortcutCommandId =
  | 'editor.clear-selection-context'
  | 'editor.undo'
  | 'editor.redo'
  | 'canvas.pan-temporary.start'
  | 'canvas.pan-temporary.end'
  | 'selection.copy'
  | 'selection.paste'
  | 'selection.delete'
  | 'selection.duplicate'
  | 'selection.group'
  | 'selection.ungroup'
  | 'viewport.zoom.in'
  | 'viewport.zoom.out';

export interface ShortcutKeyboardEventLike {
  key: string;
  code?: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
}

export interface NormalizedShortcutInput {
  chord: string;
  phase: ShortcutPhase;
  repeat: boolean;
}

export interface ShortcutBinding {
  phase: ShortcutPhase;
  commandId: ShortcutCommandId;
  chords: string[];
}

export interface ShortcutCommandDefinition {
  allowWhileTyping?: boolean;
  preventDefault?: boolean;
  execute: (input: NormalizedShortcutInput) => void;
}

export interface ShortcutDispatchResult {
  commandId: ShortcutCommandId | null;
  handled: boolean;
  preventDefault: boolean;
}
