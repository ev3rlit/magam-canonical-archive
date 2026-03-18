import { describe, expect, it } from 'bun:test';
import {
  createCanvasKeyboardTraceSink,
  type CanvasKeyboardLoggerLike,
} from './trace';

type LoggedEntry = {
  level: 'debug' | 'info' | 'warn' | 'error';
  payload: Record<string, unknown>;
  message?: string;
};

function createFakeLogger() {
  const childBindings: Record<string, unknown>[] = [];
  const entries: LoggedEntry[] = [];

  const childLogger: CanvasKeyboardLoggerLike = {
    child(bindings) {
      childBindings.push(bindings);
      return childLogger;
    },
    debug(payload, message) {
      entries.push({ level: 'debug', payload, message });
    },
    info(payload, message) {
      entries.push({ level: 'info', payload, message });
    },
    warn(payload, message) {
      entries.push({ level: 'warn', payload, message });
    },
    error(payload, message) {
      entries.push({ level: 'error', payload, message });
    },
  };

  return {
    logger: childLogger,
    childBindings,
    entries,
  };
}

describe('createCanvasKeyboardTraceSink', () => {
  it('creates a child logger scoped to the keyboard subsystem', () => {
    const fake = createFakeLogger();

    createCanvasKeyboardTraceSink({
      logger: fake.logger,
    });

    expect(fake.childBindings).toEqual([
      { subsystem: 'canvas-keyboard' },
    ]);
  });

  it('maps failed outcomes to error logs and preserves structured fields', () => {
    const fake = createFakeLogger();
    const sink = createCanvasKeyboardTraceSink({
      logger: fake.logger,
      subsystem: 'keyboard-test',
    });

    sink.write({
      event: 'command.failed',
      outcome: 'failed',
      commandId: 'history.undo',
      bindingId: 'primary+z',
      durationMs: 14,
      reason: 'rpc-conflict',
      payload: {
        selectedNodeCount: 2,
      },
      error: new Error('Undo failed'),
    });

    expect(fake.childBindings).toEqual([
      { subsystem: 'keyboard-test' },
    ]);
    expect(fake.entries).toEqual([
      {
        level: 'error',
        message: 'command.failed',
        payload: {
          event: 'command.failed',
          outcome: 'failed',
          commandId: 'history.undo',
          bindingId: 'primary+z',
          durationMs: 14,
          reason: 'rpc-conflict',
          payload: {
            selectedNodeCount: 2,
          },
          error: {
            name: 'Error',
            message: 'Undo failed',
            stack: expect.any(String),
          },
        },
      },
    ]);
  });

  it('maps skipped outcomes to debug logs and respects an explicit level override', () => {
    const fake = createFakeLogger();
    const sink = createCanvasKeyboardTraceSink({
      logger: fake.logger,
    });

    sink.write({
      event: 'command.skipped',
      outcome: 'skipped',
      commandId: 'clipboard.paste',
      reason: 'text-input-focused',
    });
    sink.write({
      event: 'command.resolved',
      outcome: 'resolved',
      commandId: 'selection.select-all-washi',
      level: 'warn',
    });

    expect(fake.entries).toEqual([
      {
        level: 'debug',
        message: 'command.skipped',
        payload: {
          event: 'command.skipped',
          outcome: 'skipped',
          commandId: 'clipboard.paste',
          reason: 'text-input-focused',
        },
      },
      {
        level: 'warn',
        message: 'command.resolved',
        payload: {
          event: 'command.resolved',
          outcome: 'resolved',
          commandId: 'selection.select-all-washi',
        },
      },
    ]);
  });
});
