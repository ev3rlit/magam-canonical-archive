import { describe, expect, it } from 'bun:test';
import { createCanvasKeyboardCommands } from './commands';
import { dispatchKeyCommand } from './dispatchKeyCommand';
import type {
  CanvasKeyboardCommandContext,
  CanvasKeyboardTraceEvent,
} from './types';

function createContext(
  overrides: Partial<CanvasKeyboardCommandContext> = {},
): CanvasKeyboardCommandContext {
  return {
    deleteSelection: async () => ({ nodeIds: ['shape-1'] }),
    duplicateSelection: async () => ({ nodeIds: ['shape-2'] }),
    selectAllNodes: () => ['shape-1', 'shape-2', 'shape-3'],
    focusNextWashi: () => 'washi-1',
    selectAllWashi: () => ['washi-1', 'washi-2'],
    copySelectionToClipboard: async () => ({
      clipboardText: 'washi-1\nwashi-2',
      nodeCount: 2,
    }),
    pasteClipboardSelection: async () => ({
      pastedNodeIds: ['paste-1', 'paste-2'],
    }),
    undo: async () => ({ source: 'edit-history' }),
    redo: async () => ({ source: 'clipboard-history' }),
    zoomIn: async () => ({ zoom: 1.2 }),
    zoomOut: async () => ({ zoom: 0.8 }),
    mapErrorToFeedback: () => null,
    ...overrides,
  };
}

describe('dispatchKeyCommand', () => {
  it('returns not-found when no command id is resolved', async () => {
    const result = await dispatchKeyCommand({
      commandId: null,
      context: createContext(),
    });

    expect(result).toEqual({
      commandId: null,
      outcome: 'not-found',
      handled: false,
      preventDefault: false,
      trace: [],
    });
  });

  it('dispatches focus-next-washi with feedback and emitted trace events', async () => {
    const emitted: CanvasKeyboardTraceEvent[] = [];
    const result = await dispatchKeyCommand({
      commandId: 'selection.focus-next-washi',
      context: createContext(),
      emitTrace: (event) => {
        emitted.push(event);
      },
    });

    expect(result.outcome).toBe('executed');
    expect(result.preventDefault).toBe(true);
    expect(result.feedback).toEqual({
      kind: 'info',
      messageKey: 'selection.focus-next-washi.success',
    });
    expect(emitted.map((event) => event.event)).toEqual([
      'selection.focus-next-washi',
      'command.executed',
    ]);
  });

  it('dispatches delete, duplicate, select-all, and zoom commands through the shared command registry', async () => {
    const deleteResult = await dispatchKeyCommand({
      commandId: 'selection.delete',
      context: createContext(),
    });
    const duplicateResult = await dispatchKeyCommand({
      commandId: 'selection.duplicate',
      context: createContext(),
    });
    const selectAllResult = await dispatchKeyCommand({
      commandId: 'selection.select-all',
      context: createContext(),
    });
    const zoomResult = await dispatchKeyCommand({
      commandId: 'viewport.zoom-in',
      context: createContext(),
    });

    expect(deleteResult.outcome).toBe('executed');
    expect(deleteResult.preventDefault).toBe(true);
    expect(deleteResult.feedback).toMatchObject({
      messageKey: 'selection.delete.success',
    });

    expect(duplicateResult.outcome).toBe('executed');
    expect(duplicateResult.feedback).toMatchObject({
      messageKey: 'selection.duplicate.success',
    });

    expect(selectAllResult.outcome).toBe('executed');
    expect(selectAllResult.feedback).toMatchObject({
      messageKey: 'selection.select-all.success',
    });

    expect(zoomResult.outcome).toBe('executed');
    expect(zoomResult.preventDefault).toBe(true);
    expect(zoomResult.trace.at(0)).toMatchObject({
      event: 'viewport.zoom-in',
    });
  });

  it('treats a missing paste payload as a skipped command that still prevents default', async () => {
    const result = await dispatchKeyCommand({
      commandId: 'clipboard.paste-selection',
      context: createContext({
        pasteClipboardSelection: async () => null,
      }),
    });

    expect(result.outcome).toBe('skipped');
    expect(result.handled).toBe(true);
    expect(result.preventDefault).toBe(true);
    expect(result.trace.map((event) => event.event)).toEqual([
      'clipboard.paste.skipped',
      'command.skipped',
    ]);
  });

  it('returns command-specific feedback for edit-history undo success while keeping clipboard-history redo silent', async () => {
    const undoResult = await dispatchKeyCommand({
      commandId: 'history.undo',
      context: createContext({
        undo: async () => ({ source: 'edit-history' }),
      }),
    });
    const redoResult = await dispatchKeyCommand({
      commandId: 'history.redo',
      context: createContext({
        redo: async () => ({ source: 'clipboard-history' }),
      }),
    });

    expect(undoResult.feedback).toEqual({
      kind: 'success',
      messageKey: 'history.undo.success',
    });
    expect(redoResult.feedback).toBeUndefined();
    expect(redoResult.preventDefault).toBe(true);
  });

  it('maps failures through the command failure hook and emits a failed trace', async () => {
    const result = await dispatchKeyCommand({
      commandId: 'history.undo',
      context: createContext({
        undo: async () => {
          throw new Error('boom');
        },
        mapErrorToFeedback: () => ({
          kind: 'error',
          messageKey: 'keyboard.history.undo.mapped-error',
        }),
      }),
    });

    expect(result.outcome).toBe('failed');
    expect(result.preventDefault).toBe(true);
    expect(result.feedback).toEqual({
      kind: 'error',
      messageKey: 'keyboard.history.undo.mapped-error',
    });
    expect(result.trace.at(-1)).toMatchObject({
      event: 'command.failed',
      commandId: 'history.undo',
      outcome: 'failed',
      level: 'error',
    });
  });

  it('allows callers to inject a narrowed registry for isolated command tests', async () => {
    const commands = createCanvasKeyboardCommands();
    commands['selection.select-all-washi'].when = () => false;

    const result = await dispatchKeyCommand({
      commandId: 'selection.select-all-washi',
      context: createContext(),
      commands,
    });

    expect(result.outcome).toBe('skipped');
    expect(result.preventDefault).toBe(false);
    expect(result.trace.at(0)).toMatchObject({
      event: 'command.skipped',
      payload: {
        reason: 'condition-failed',
      },
    });
  });
});
