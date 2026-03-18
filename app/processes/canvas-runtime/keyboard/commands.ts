import {
  CANVAS_KEYBOARD_COMMAND_IDS,
  type CanvasKeyboardCommandContext,
  type CanvasKeyboardCommandRegistry,
  type CanvasKeyboardFeedback,
  type CanvasKeyboardResult,
  type CanvasKeyboardTraceEvent,
} from './types';

function createTraceEvent(input: {
  event: string;
  commandId: string;
  level?: CanvasKeyboardTraceEvent['level'];
  outcome?: CanvasKeyboardTraceEvent['outcome'];
  payload?: Record<string, unknown>;
}): CanvasKeyboardTraceEvent {
  return {
    category: 'canvas-keyboard',
    event: input.event,
    commandId: input.commandId,
    level: input.level,
    outcome: input.outcome,
    payload: input.payload,
  };
}

function resolveFailureFeedback(input: {
  context: CanvasKeyboardCommandContext;
  commandId: string;
  error: unknown;
  fallbackMessageKey: string;
  fallbackDefaultMessage: string;
}): CanvasKeyboardFeedback {
  const mapped = input.context.mapErrorToFeedback?.({
    commandId: input.commandId,
    error: input.error,
  });

  return mapped ?? {
    kind: 'error',
    messageKey: input.fallbackMessageKey,
    defaultMessage: input.fallbackDefaultMessage,
  };
}

export function createCanvasKeyboardCommands(): CanvasKeyboardCommandRegistry {
  return {
    [CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_FOCUS_NEXT_WASHI]: {
      commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_FOCUS_NEXT_WASHI,
      execute: (context): CanvasKeyboardResult => {
        const nextNodeId = context.focusNextWashi();
        return {
          outcome: 'executed',
          preventDefault: true,
          feedback: {
            kind: 'info',
            messageKey: nextNodeId
              ? 'selection.focus-next-washi.success'
              : 'selection.focus-next-washi.empty',
          },
          trace: [
            createTraceEvent({
              event: 'selection.focus-next-washi',
              commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_FOCUS_NEXT_WASHI,
              outcome: 'executed',
              payload: { nextNodeId },
            }),
          ],
        };
      },
    },
    [CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_SELECT_ALL_WASHI]: {
      commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_SELECT_ALL_WASHI,
      execute: (context): CanvasKeyboardResult => {
        const selectedNodeIds = context.selectAllWashi();
        return {
          outcome: 'executed',
          preventDefault: true,
          feedback: {
            kind: 'info',
            messageKey: selectedNodeIds.length > 0
              ? 'selection.select-all-washi.success'
              : 'selection.select-all-washi.empty',
            params: {
              count: selectedNodeIds.length,
            },
          },
          trace: [
            createTraceEvent({
              event: 'selection.select-all-washi',
              commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_SELECT_ALL_WASHI,
              outcome: 'executed',
              payload: { count: selectedNodeIds.length },
            }),
          ],
        };
      },
    },
    [CANVAS_KEYBOARD_COMMAND_IDS.CLIPBOARD_COPY_SELECTION]: {
      commandId: CANVAS_KEYBOARD_COMMAND_IDS.CLIPBOARD_COPY_SELECTION,
      execute: async (context) => {
        const copied = await context.copySelectionToClipboard();
        return {
          outcome: 'executed',
          preventDefault: true,
          trace: [
            createTraceEvent({
              event: 'clipboard.copy',
              commandId: CANVAS_KEYBOARD_COMMAND_IDS.CLIPBOARD_COPY_SELECTION,
              outcome: 'executed',
              payload: {
                nodeCount: copied.nodeCount,
                clipboardTextLength: copied.clipboardText.length,
              },
            }),
          ],
        };
      },
      onFailure: (error, context) => ({
        outcome: 'failed',
        preventDefault: true,
        feedback: resolveFailureFeedback({
          context,
          commandId: CANVAS_KEYBOARD_COMMAND_IDS.CLIPBOARD_COPY_SELECTION,
          error,
          fallbackMessageKey: 'clipboard.copy.failure',
          fallbackDefaultMessage: 'Failed to copy the current selection.',
        }),
      }),
    },
    [CANVAS_KEYBOARD_COMMAND_IDS.CLIPBOARD_PASTE_SELECTION]: {
      commandId: CANVAS_KEYBOARD_COMMAND_IDS.CLIPBOARD_PASTE_SELECTION,
      execute: async (context) => {
        const pasted = await context.pasteClipboardSelection();
        if (!pasted) {
          return {
            outcome: 'skipped',
            preventDefault: true,
            trace: [
              createTraceEvent({
                event: 'clipboard.paste.skipped',
                commandId: CANVAS_KEYBOARD_COMMAND_IDS.CLIPBOARD_PASTE_SELECTION,
                outcome: 'skipped',
              }),
            ],
          };
        }

        return {
          outcome: 'executed',
          preventDefault: true,
          trace: [
            createTraceEvent({
              event: 'clipboard.paste',
              commandId: CANVAS_KEYBOARD_COMMAND_IDS.CLIPBOARD_PASTE_SELECTION,
              outcome: 'executed',
              payload: {
                pastedNodeCount: pasted.pastedNodeIds.length,
              },
            }),
          ],
        };
      },
      onFailure: (error, context) => ({
        outcome: 'failed',
        preventDefault: true,
        feedback: resolveFailureFeedback({
          context,
          commandId: CANVAS_KEYBOARD_COMMAND_IDS.CLIPBOARD_PASTE_SELECTION,
          error,
          fallbackMessageKey: 'clipboard.paste.failure',
          fallbackDefaultMessage: 'Failed to paste the current clipboard payload.',
        }),
      }),
    },
    [CANVAS_KEYBOARD_COMMAND_IDS.HISTORY_UNDO]: {
      commandId: CANVAS_KEYBOARD_COMMAND_IDS.HISTORY_UNDO,
      execute: async (context) => {
        const result = await context.undo();
        if (result.source === 'none') {
          return {
            outcome: 'skipped',
            preventDefault: false,
            trace: [
              createTraceEvent({
                event: 'history.undo.skipped',
                commandId: CANVAS_KEYBOARD_COMMAND_IDS.HISTORY_UNDO,
                outcome: 'skipped',
                payload: { source: result.source },
              }),
            ],
          };
        }

        return {
          outcome: 'executed',
          preventDefault: true,
          feedback: result.source === 'edit-history'
            ? {
                kind: 'success',
                messageKey: 'history.undo.success',
              }
            : undefined,
          trace: [
            createTraceEvent({
              event: 'history.undo',
              commandId: CANVAS_KEYBOARD_COMMAND_IDS.HISTORY_UNDO,
              outcome: 'executed',
              payload: { source: result.source },
            }),
          ],
        };
      },
      onFailure: (error, context) => ({
        outcome: 'failed',
        preventDefault: true,
        feedback: resolveFailureFeedback({
          context,
          commandId: CANVAS_KEYBOARD_COMMAND_IDS.HISTORY_UNDO,
          error,
          fallbackMessageKey: 'history.undo.failure',
          fallbackDefaultMessage: 'Failed to undo the latest edit step.',
        }),
      }),
    },
    [CANVAS_KEYBOARD_COMMAND_IDS.HISTORY_REDO]: {
      commandId: CANVAS_KEYBOARD_COMMAND_IDS.HISTORY_REDO,
      execute: async (context) => {
        const result = await context.redo();
        if (result.source === 'none') {
          return {
            outcome: 'skipped',
            preventDefault: false,
            trace: [
              createTraceEvent({
                event: 'history.redo.skipped',
                commandId: CANVAS_KEYBOARD_COMMAND_IDS.HISTORY_REDO,
                outcome: 'skipped',
                payload: { source: result.source },
              }),
            ],
          };
        }

        return {
          outcome: 'executed',
          preventDefault: true,
          feedback: result.source === 'edit-history'
            ? {
                kind: 'success',
                messageKey: 'history.redo.success',
              }
            : undefined,
          trace: [
            createTraceEvent({
              event: 'history.redo',
              commandId: CANVAS_KEYBOARD_COMMAND_IDS.HISTORY_REDO,
              outcome: 'executed',
              payload: { source: result.source },
            }),
          ],
        };
      },
      onFailure: (error, context) => ({
        outcome: 'failed',
        preventDefault: true,
        feedback: resolveFailureFeedback({
          context,
          commandId: CANVAS_KEYBOARD_COMMAND_IDS.HISTORY_REDO,
          error,
          fallbackMessageKey: 'history.redo.failure',
          fallbackDefaultMessage: 'Failed to redo the latest edit step.',
        }),
      }),
    },
  };
}
