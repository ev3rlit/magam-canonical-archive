export const CANVAS_KEYBOARD_COMMAND_IDS = {
  CLIPBOARD_COPY_SELECTION: 'clipboard.copy-selection',
  CLIPBOARD_PASTE_SELECTION: 'clipboard.paste-selection',
  HISTORY_REDO: 'history.redo',
  HISTORY_UNDO: 'history.undo',
  SELECTION_DELETE: 'selection.delete',
  SELECTION_DUPLICATE: 'selection.duplicate',
  SELECTION_GROUP: 'selection.group',
  SELECTION_SELECT_ALL: 'selection.select-all',
  SELECTION_FOCUS_NEXT_WASHI: 'selection.focus-next-washi',
  SELECTION_SELECT_ALL_WASHI: 'selection.select-all-washi',
  SELECTION_UNGROUP: 'selection.ungroup',
  VIEWPORT_ZOOM_IN: 'viewport.zoom-in',
  VIEWPORT_ZOOM_OUT: 'viewport.zoom-out',
} as const;

export type CanvasKeyboardCommandId =
  | (typeof CANVAS_KEYBOARD_COMMAND_IDS)[keyof typeof CANVAS_KEYBOARD_COMMAND_IDS]
  | (string & {});

export type CanvasKeyboardModifier = 'alt' | 'primary' | 'shift';

export type CanvasKeyboardDispatchOutcome =
  | 'executed'
  | 'skipped'
  | 'failed'
  | 'not-found';

export type CanvasKeyboardTraceOutcome =
  | 'resolved'
  | 'executed'
  | 'skipped'
  | 'failed';

export type CanvasKeyboardTraceLevel =
  | 'debug'
  | 'info'
  | 'warn'
  | 'error';

export interface CanvasKeyboardModifierState {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export interface NormalizedKeyChord {
  key: string;
  code?: string;
  modifiers: readonly CanvasKeyboardModifier[];
  modifierState: CanvasKeyboardModifierState;
  signature: string;
}

export interface CanvasKeyBinding {
  bindingId: string;
  chord: NormalizedKeyChord;
  commandId: CanvasKeyboardCommandId;
  description?: string;
}

export interface CanvasKeyboardFeedback {
  kind: 'error' | 'info' | 'success' | 'warning';
  messageKey: string;
  defaultMessage?: string;
  params?: Record<string, boolean | number | string | null | undefined>;
}

export interface CanvasKeyboardTraceEvent {
  category: 'canvas-keyboard';
  commandId?: CanvasKeyboardCommandId;
  event: string;
  bindingId?: string;
  outcome?: CanvasKeyboardTraceOutcome;
  level?: CanvasKeyboardTraceLevel;
  durationMs?: number;
  payload?: Record<string, unknown>;
  reason?: string;
  error?: unknown;
}

export interface CanvasKeyboardResult {
  outcome?: Exclude<CanvasKeyboardDispatchOutcome, 'not-found'>;
  preventDefault?: boolean;
  feedback?: CanvasKeyboardFeedback;
  trace?: CanvasKeyboardTraceEvent[];
}

export type CanvasKeyboardHistorySource =
  | 'edit-history'
  | 'clipboard-history'
  | 'none';

export interface CanvasKeyboardClipboardCopyResult {
  clipboardText: string;
  nodeCount: number;
}

export interface CanvasKeyboardClipboardPasteResult {
  pastedNodeIds: string[];
}

export interface CanvasKeyboardSelectionMutationResult {
  nodeIds: string[];
}

export interface CanvasKeyboardViewportResult {
  zoom: number | null;
}

export interface CanvasKeyboardContext {
  isTextInputFocused: boolean;
  deleteSelection: () => Promise<CanvasKeyboardSelectionMutationResult>;
  duplicateSelection: () => Promise<CanvasKeyboardSelectionMutationResult>;
  groupSelection: () => Promise<CanvasKeyboardSelectionMutationResult>;
  selectAllNodes: () => string[];
  focusNextWashi: () => string | null;
  selectAllWashi: () => string[];
  ungroupSelection: () => Promise<CanvasKeyboardSelectionMutationResult>;
  copySelectionToClipboard: () => Promise<CanvasKeyboardClipboardCopyResult>;
  pasteClipboardSelection: () => Promise<CanvasKeyboardClipboardPasteResult | null>;
  undo: () => Promise<{ source: CanvasKeyboardHistorySource }>;
  redo: () => Promise<{ source: CanvasKeyboardHistorySource }>;
  zoomIn: () => Promise<CanvasKeyboardViewportResult> | CanvasKeyboardViewportResult;
  zoomOut: () => Promise<CanvasKeyboardViewportResult> | CanvasKeyboardViewportResult;
  mapErrorToFeedback?: (input: {
    commandId: CanvasKeyboardCommandId;
    error: unknown;
  }) => CanvasKeyboardFeedback | null;
}

export type CanvasKeyboardCommandContext = CanvasKeyboardContext;

export interface CanvasKeyboardCommand<
  TContext extends CanvasKeyboardContext = CanvasKeyboardContext,
> {
  commandId: CanvasKeyboardCommandId;
  allowInTextInput?: boolean;
  when?: (context: TContext) => boolean;
  execute: (context: TContext) => CanvasKeyboardResult | Promise<CanvasKeyboardResult>;
  onFailure?: (error: unknown, context: TContext) => CanvasKeyboardResult;
}

export type CanvasKeyboardCommandRegistry<
  TContext extends CanvasKeyboardContext = CanvasKeyboardContext,
> = Partial<Record<CanvasKeyboardCommandId, CanvasKeyboardCommand<TContext>>>;

export interface CanvasResolvedKeyBinding {
  binding: CanvasKeyBinding;
  commandId: CanvasKeyboardCommandId;
}
