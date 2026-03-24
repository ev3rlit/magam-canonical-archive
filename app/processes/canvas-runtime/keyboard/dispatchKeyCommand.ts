import { createCanvasKeyboardCommands } from './commands';
import type {
  CanvasKeyboardCommandContext,
  CanvasKeyboardCommandRegistry,
  CanvasKeyboardDispatchOutcome,
  CanvasKeyboardFeedback,
  CanvasKeyboardTraceEvent,
} from './types';

export interface DispatchKeyCommandInput {
  commandId: string | null | undefined;
  context: CanvasKeyboardCommandContext;
  commands?: CanvasKeyboardCommandRegistry;
  emitTrace?: (event: CanvasKeyboardTraceEvent) => void;
}

export interface DispatchKeyCommandResult {
  commandId: string | null;
  outcome: CanvasKeyboardDispatchOutcome;
  handled: boolean;
  preventDefault: boolean;
  feedback?: CanvasKeyboardFeedback;
  trace: CanvasKeyboardTraceEvent[];
  error?: unknown;
}

function createDispatcherTrace(input: {
  event: string;
  commandId: string;
  outcome: Exclude<CanvasKeyboardDispatchOutcome, 'not-found'>;
  level?: CanvasKeyboardTraceEvent['level'];
  payload?: Record<string, unknown>;
}): CanvasKeyboardTraceEvent {
  return {
    category: 'canvas-keyboard',
    event: input.event,
    commandId: input.commandId,
    outcome: input.outcome,
    level: input.level,
    payload: input.payload,
  };
}

function emitTraceEvents(
  events: readonly CanvasKeyboardTraceEvent[],
  emitTrace?: (event: CanvasKeyboardTraceEvent) => void,
) {
  events.forEach((event) => emitTrace?.(event));
}

export async function dispatchKeyCommand(
  input: DispatchKeyCommandInput,
): Promise<DispatchKeyCommandResult> {
  const registry = input.commands ?? createCanvasKeyboardCommands();

  if (!input.commandId) {
    return {
      commandId: null,
      outcome: 'not-found',
      handled: false,
      preventDefault: false,
      trace: [],
    };
  }

  const command = registry[input.commandId];
  if (!command) {
    return {
      commandId: input.commandId,
      outcome: 'not-found',
      handled: false,
      preventDefault: false,
      trace: [],
    };
  }

  if (command.when && !command.when(input.context)) {
    const trace = [
      createDispatcherTrace({
        event: 'command.skipped',
        commandId: command.commandId,
        outcome: 'skipped',
        payload: {
          reason: 'condition-failed',
        },
      }),
    ];
    emitTraceEvents(trace, input.emitTrace);
    return {
      commandId: command.commandId,
      outcome: 'skipped',
      handled: true,
      preventDefault: false,
      trace,
    };
  }

  try {
    const result = await command.execute(input.context);
    const outcome = result.outcome ?? 'executed';
    const trace = [
      ...(result.trace ?? []),
      createDispatcherTrace({
        event: outcome === 'skipped'
          ? 'command.skipped'
          : 'command.executed',
        commandId: command.commandId,
        outcome,
      }),
    ];
    emitTraceEvents(trace, input.emitTrace);

    return {
      commandId: command.commandId,
      outcome,
      handled: true,
      preventDefault: result.preventDefault ?? false,
      feedback: result.feedback,
      trace,
    };
  } catch (error) {
    const failure = command.onFailure?.(error, input.context);
    const trace = [
      ...(failure?.trace ?? []),
      createDispatcherTrace({
        event: 'command.failed',
        commandId: command.commandId,
        outcome: 'failed',
        level: 'error',
      }),
    ];
    emitTraceEvents(trace, input.emitTrace);

    return {
      commandId: command.commandId,
      outcome: 'failed',
      handled: true,
      preventDefault: failure?.preventDefault ?? false,
      feedback: failure?.feedback,
      trace,
      error,
    };
  }
}
