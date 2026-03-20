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
    [CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_DELETE]: {
      commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_DELETE,
      execute: async (context) => {
        const deleted = await context.deleteSelection();
        if (deleted.nodeIds.length === 0) {
          return {
            outcome: 'skipped',
            preventDefault: false,
            trace: [
              createTraceEvent({
                event: 'selection.delete.skipped',
                commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_DELETE,
                outcome: 'skipped',
              }),
            ],
          };
        }

        return {
          outcome: 'executed',
          preventDefault: true,
          feedback: {
            kind: 'info',
            messageKey: 'selection.delete.success',
            params: {
              count: deleted.nodeIds.length,
            },
          },
          trace: [
            createTraceEvent({
              event: 'selection.delete',
              commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_DELETE,
              outcome: 'executed',
              payload: {
                count: deleted.nodeIds.length,
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
          commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_DELETE,
          error,
          fallbackMessageKey: 'selection.delete.failure',
          fallbackDefaultMessage: 'Failed to delete the current selection.',
        }),
      }),
    },
    [CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_DUPLICATE]: {
      commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_DUPLICATE,
      execute: async (context) => {
        const duplicated = await context.duplicateSelection();
        if (duplicated.nodeIds.length === 0) {
          return {
            outcome: 'skipped',
            preventDefault: false,
            trace: [
              createTraceEvent({
                event: 'selection.duplicate.skipped',
                commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_DUPLICATE,
                outcome: 'skipped',
              }),
            ],
          };
        }

        return {
          outcome: 'executed',
          preventDefault: true,
          feedback: {
            kind: 'info',
            messageKey: 'selection.duplicate.success',
            params: {
              count: duplicated.nodeIds.length,
            },
          },
          trace: [
            createTraceEvent({
              event: 'selection.duplicate',
              commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_DUPLICATE,
              outcome: 'executed',
              payload: {
                count: duplicated.nodeIds.length,
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
          commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_DUPLICATE,
          error,
          fallbackMessageKey: 'selection.duplicate.failure',
          fallbackDefaultMessage: 'Failed to duplicate the current selection.',
        }),
      }),
    },
    [CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_GROUP]: {
      commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_GROUP,
      execute: async (context) => {
        const grouped = await context.groupSelection();
        if (grouped.nodeIds.length === 0) {
          return {
            outcome: 'skipped',
            preventDefault: false,
            trace: [
              createTraceEvent({
                event: 'selection.group.skipped',
                commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_GROUP,
                outcome: 'skipped',
              }),
            ],
          };
        }

        return {
          outcome: 'executed',
          preventDefault: true,
          feedback: {
            kind: 'info',
            messageKey: 'selection.group.success',
            params: {
              count: grouped.nodeIds.length,
            },
          },
          trace: [
            createTraceEvent({
              event: 'selection.group',
              commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_GROUP,
              outcome: 'executed',
              payload: {
                count: grouped.nodeIds.length,
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
          commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_GROUP,
          error,
          fallbackMessageKey: 'selection.group.failure',
          fallbackDefaultMessage: 'Failed to group the current selection.',
        }),
      }),
    },
    [CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_SELECT_ALL]: {
      commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_SELECT_ALL,
      execute: (context): CanvasKeyboardResult => {
        const selectedNodeIds = context.selectAllNodes();
        if (selectedNodeIds.length === 0) {
          return {
            outcome: 'skipped',
            preventDefault: false,
            trace: [
              createTraceEvent({
                event: 'selection.select-all.skipped',
                commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_SELECT_ALL,
                outcome: 'skipped',
              }),
            ],
          };
        }

        return {
          outcome: 'executed',
          preventDefault: true,
          feedback: {
            kind: 'info',
            messageKey: 'selection.select-all.success',
            params: {
              count: selectedNodeIds.length,
            },
          },
          trace: [
            createTraceEvent({
              event: 'selection.select-all',
              commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_SELECT_ALL,
              outcome: 'executed',
              payload: {
                count: selectedNodeIds.length,
              },
            }),
          ],
        };
      },
    },
    [CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_UNGROUP]: {
      commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_UNGROUP,
      execute: async (context) => {
        const ungrouped = await context.ungroupSelection();
        if (ungrouped.nodeIds.length === 0) {
          return {
            outcome: 'skipped',
            preventDefault: false,
            trace: [
              createTraceEvent({
                event: 'selection.ungroup.skipped',
                commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_UNGROUP,
                outcome: 'skipped',
              }),
            ],
          };
        }

        return {
          outcome: 'executed',
          preventDefault: true,
          feedback: {
            kind: 'info',
            messageKey: 'selection.ungroup.success',
            params: {
              count: ungrouped.nodeIds.length,
            },
          },
          trace: [
            createTraceEvent({
              event: 'selection.ungroup',
              commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_UNGROUP,
              outcome: 'executed',
              payload: {
                count: ungrouped.nodeIds.length,
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
          commandId: CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_UNGROUP,
          error,
          fallbackMessageKey: 'selection.ungroup.failure',
          fallbackDefaultMessage: 'Failed to ungroup the current selection.',
        }),
      }),
    },
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
    [CANVAS_KEYBOARD_COMMAND_IDS.VIEWPORT_ZOOM_IN]: {
      commandId: CANVAS_KEYBOARD_COMMAND_IDS.VIEWPORT_ZOOM_IN,
      allowInTextInput: true,
      execute: async (context) => {
        const result = await context.zoomIn();
        return {
          outcome: 'executed',
          preventDefault: true,
          trace: [
            createTraceEvent({
              event: 'viewport.zoom-in',
              commandId: CANVAS_KEYBOARD_COMMAND_IDS.VIEWPORT_ZOOM_IN,
              outcome: 'executed',
              payload: {
                zoom: result.zoom,
              },
            }),
          ],
        };
      },
    },
    [CANVAS_KEYBOARD_COMMAND_IDS.VIEWPORT_ZOOM_OUT]: {
      commandId: CANVAS_KEYBOARD_COMMAND_IDS.VIEWPORT_ZOOM_OUT,
      allowInTextInput: true,
      execute: async (context) => {
        const result = await context.zoomOut();
        return {
          outcome: 'executed',
          preventDefault: true,
          trace: [
            createTraceEvent({
              event: 'viewport.zoom-out',
              commandId: CANVAS_KEYBOARD_COMMAND_IDS.VIEWPORT_ZOOM_OUT,
              outcome: 'executed',
              payload: {
                zoom: result.zoom,
              },
            }),
          ],
        };
      },
    },
  };
}
