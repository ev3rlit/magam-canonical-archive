import type { MutableRefObject } from 'react';
import type { Edge, Node } from 'reactflow';
import {
  applyGraphSnapshot,
  createGraphClipboardPayload,
  createPastedGraphState,
  isGraphClipboardPayload,
  serializeNodeIdsForClipboard,
  snapshotGraphState,
  type GraphClipboardPayload,
  type GraphSnapshot,
} from '@/utils/clipboardGraph';
import { createCanvasKeyboardCommands } from '../keyboard/commands';
import { dispatchKeyCommand, type DispatchKeyCommandResult } from '../keyboard/dispatchKeyCommand';
import { resolveCanvasKeyboardFeedback } from '../keyboard/feedback';
import { resolveCanvasKeyBinding } from '../keyboard/keymap';
import { normalizeKeyEvent } from '../keyboard/normalizeKeyEvent';
import { canvasKeyboardTrace, type CanvasKeyboardTraceSink } from '../keyboard/trace';
import {
  CANVAS_KEYBOARD_COMMAND_IDS,
  type CanvasKeyBinding,
  type CanvasKeyboardCommandContext,
  type CanvasKeyboardCommandRegistry,
  type CanvasKeyboardFeedback,
  type CanvasKeyboardTraceEvent,
} from '../keyboard/types';

type GraphCanvasClipboardState = {
  payload: GraphClipboardPayload;
  text: string;
} | null;

type GraphCanvasSnapshotState = {
  nodes: Node[];
  edges: Edge[];
  selectedNodeIds: string[];
};

type GraphClipboardHistoryState = {
  past: GraphSnapshot[];
  future: GraphSnapshot[];
};

export interface GraphCanvasKeyboardHostInput {
  clipboardHistoryRef: MutableRefObject<GraphClipboardHistoryState>;
  graphClipboardRef: MutableRefObject<GraphCanvasClipboardState>;
  focusNextNodeByType: (nodeType: string) => string | null;
  selectNodesByType: (nodeType: string) => string[];
  showToast: (message: string) => void;
  getGraphState: () => GraphCanvasSnapshotState;
  setGraphState: (next: GraphCanvasSnapshotState) => void;
  mapEditErrorToToast?: (error: unknown) => string | null;
  onUndoEditStep?: () => Promise<boolean> | boolean;
  onRedoEditStep?: () => Promise<boolean> | boolean;
  commands?: CanvasKeyboardCommandRegistry;
  bindings?: readonly CanvasKeyBinding[];
  traceSink?: CanvasKeyboardTraceSink;
  getActiveElement?: () => Element | null;
  getClipboard?: () => Pick<Clipboard, 'readText' | 'writeText'> | null | undefined;
}

export interface GraphCanvasKeyboardHost {
  handleKeyDown: (event: KeyboardEvent) => Promise<DispatchKeyCommandResult | null>;
}

export function isCanvasKeyboardTextInputFocused(element: Element | null): boolean {
  return element instanceof HTMLInputElement
    || element instanceof HTMLTextAreaElement
    || (element as HTMLElement | null)?.isContentEditable === true;
}

function pushClipboardHistory(
  historyRef: MutableRefObject<GraphClipboardHistoryState>,
  snapshot: GraphSnapshot,
) {
  const history = historyRef.current;
  history.past.push(snapshot);
  if (history.past.length > 50) {
    history.past.shift();
  }
  history.future = [];
}

function createHostTraceEvent(input: {
  event: string;
  commandId: string;
  bindingId?: string;
  outcome: CanvasKeyboardTraceEvent['outcome'];
  level?: CanvasKeyboardTraceEvent['level'];
  reason?: string;
  payload?: Record<string, unknown>;
  error?: unknown;
}): CanvasKeyboardTraceEvent {
  return {
    category: 'canvas-keyboard',
    event: input.event,
    commandId: input.commandId,
    bindingId: input.bindingId,
    outcome: input.outcome,
    level: input.level,
    reason: input.reason,
    payload: input.payload,
    error: input.error,
  };
}

function createGraphCanvasKeyboardCommandContext(
  input: GraphCanvasKeyboardHostInput,
  traceSink: CanvasKeyboardTraceSink,
): CanvasKeyboardCommandContext {
  return {
    isTextInputFocused: false,
    focusNextWashi: () => input.focusNextNodeByType('washi-tape'),
    selectAllWashi: () => input.selectNodesByType('washi-tape'),
    copySelectionToClipboard: async () => {
      const { nodes, edges, selectedNodeIds } = input.getGraphState();
      const payload = createGraphClipboardPayload(nodes, edges, selectedNodeIds);
      const clipboardText = serializeNodeIdsForClipboard(payload);
      input.graphClipboardRef.current = {
        payload,
        text: clipboardText,
      };

      const clipboard = input.getClipboard?.();
      if (clipboard?.writeText) {
        try {
          await clipboard.writeText(clipboardText);
        } catch (error) {
          traceSink.write(createHostTraceEvent({
            event: 'clipboard.copy.external-write.failed',
            commandId: CANVAS_KEYBOARD_COMMAND_IDS.CLIPBOARD_COPY_SELECTION,
            outcome: 'failed',
            level: 'warn',
            payload: {
              clipboardTextLength: clipboardText.length,
              nodeCount: payload.nodes.length,
            },
            error,
          }));
        }
      }

      return {
        clipboardText,
        nodeCount: payload.nodes.length,
      };
    },
    pasteClipboardSelection: async () => {
      const clipboard = input.getClipboard?.();
      let clipboardText: string | null = null;

      if (clipboard?.readText) {
        try {
          clipboardText = await clipboard.readText();
        } catch (error) {
          traceSink.write(createHostTraceEvent({
            event: 'clipboard.read.failed',
            commandId: CANVAS_KEYBOARD_COMMAND_IDS.CLIPBOARD_PASTE_SELECTION,
            outcome: 'failed',
            level: 'warn',
            error,
          }));
        }
      }

      const copiedGraph = input.graphClipboardRef.current;
      let parsedPayload: GraphClipboardPayload | null = null;

      if (copiedGraph && (clipboardText === null || clipboardText === copiedGraph.text)) {
        parsedPayload = copiedGraph.payload;
      } else if (clipboardText) {
        try {
          const parsed = JSON.parse(clipboardText);
          if (!isGraphClipboardPayload(parsed)) {
            traceSink.write(createHostTraceEvent({
              event: 'clipboard.paste.invalid',
              commandId: CANVAS_KEYBOARD_COMMAND_IDS.CLIPBOARD_PASTE_SELECTION,
              outcome: 'skipped',
              reason: 'invalid-payload-shape',
            }));
            return null;
          }
          parsedPayload = parsed;
        } catch (error) {
          traceSink.write(createHostTraceEvent({
            event: 'clipboard.paste.invalid',
            commandId: CANVAS_KEYBOARD_COMMAND_IDS.CLIPBOARD_PASTE_SELECTION,
            outcome: 'skipped',
            reason: 'invalid-json',
            error,
          }));
          return null;
        }
      }

      if (!parsedPayload) {
        return null;
      }

      const currentState = input.getGraphState();
      pushClipboardHistory(
        input.clipboardHistoryRef,
        snapshotGraphState(currentState.nodes, currentState.edges),
      );

      const next = createPastedGraphState(parsedPayload, currentState.nodes, currentState.edges);
      input.setGraphState(next);

      return {
        pastedNodeIds: next.selectedNodeIds,
      };
    },
    undo: async () => {
      if (input.onUndoEditStep) {
        const handled = await input.onUndoEditStep();
        if (handled) {
          return { source: 'edit-history' as const };
        }
      }

      const previous = input.clipboardHistoryRef.current.past.pop();
      if (!previous) {
        return { source: 'none' as const };
      }

      const currentState = input.getGraphState();
      input.clipboardHistoryRef.current.future.push(
        snapshotGraphState(currentState.nodes, currentState.edges),
      );
      input.setGraphState(applyGraphSnapshot(previous));
      return { source: 'clipboard-history' as const };
    },
    redo: async () => {
      if (input.onRedoEditStep) {
        const handled = await input.onRedoEditStep();
        if (handled) {
          return { source: 'edit-history' as const };
        }
      }

      const nextSnapshot = input.clipboardHistoryRef.current.future.pop();
      if (!nextSnapshot) {
        return { source: 'none' as const };
      }

      const currentState = input.getGraphState();
      input.clipboardHistoryRef.current.past.push(
        snapshotGraphState(currentState.nodes, currentState.edges),
      );
      input.setGraphState(applyGraphSnapshot(nextSnapshot));
      return { source: 'clipboard-history' as const };
    },
    mapErrorToFeedback: ({ commandId, error }): CanvasKeyboardFeedback | null => {
      const mapped = input.mapEditErrorToToast?.(error);
      if (!mapped) {
        return null;
      }

      return {
        kind: 'error',
        messageKey: `${commandId}.mapped-error`,
        defaultMessage: mapped,
      };
    },
  };
}

export function createGraphCanvasKeyboardHost(
  input: GraphCanvasKeyboardHostInput,
): GraphCanvasKeyboardHost {
  const traceSink = input.traceSink ?? canvasKeyboardTrace;
  const commands = input.commands ?? createCanvasKeyboardCommands();

  return {
    async handleKeyDown(event) {
      const chord = normalizeKeyEvent(event);
      if (!chord) {
        return null;
      }

      const resolvedBinding = resolveCanvasKeyBinding({
        chord,
        bindings: input.bindings,
      });
      if (!resolvedBinding) {
        return null;
      }

      const activeElement = input.getActiveElement?.() ?? document.activeElement;
      if (isCanvasKeyboardTextInputFocused(activeElement)) {
        traceSink.write(createHostTraceEvent({
          event: 'command.skipped',
          commandId: resolvedBinding.commandId,
          bindingId: resolvedBinding.binding.bindingId,
          outcome: 'skipped',
          reason: 'text-input-focused',
          payload: {
            signature: chord.signature,
          },
        }));
        return {
          commandId: resolvedBinding.commandId,
          outcome: 'skipped',
          handled: true,
          preventDefault: false,
          trace: [],
        };
      }

      traceSink.write(createHostTraceEvent({
        event: 'command.resolved',
        commandId: resolvedBinding.commandId,
        bindingId: resolvedBinding.binding.bindingId,
        outcome: 'resolved',
        payload: {
          signature: chord.signature,
        },
      }));

      const result = await dispatchKeyCommand({
        commandId: resolvedBinding.commandId,
        context: createGraphCanvasKeyboardCommandContext(input, traceSink),
        commands,
        emitTrace: (traceEvent) => {
          traceSink.write({
            ...traceEvent,
            bindingId: traceEvent.bindingId ?? resolvedBinding.binding.bindingId,
          });
        },
      });

      if (result.preventDefault) {
        event.preventDefault();
      }

      if (result.feedback) {
        input.showToast(resolveCanvasKeyboardFeedback(result.feedback).defaultMessage);
      }

      return result;
    },
  };
}
