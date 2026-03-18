import pino, { type Logger as PinoLogger } from 'pino';
import type {
  CanvasKeyboardTraceEvent,
  CanvasKeyboardTraceLevel,
} from './types';

export interface CanvasKeyboardLoggerLike {
  child(bindings: Record<string, unknown>): CanvasKeyboardLoggerLike;
  debug(obj: Record<string, unknown>, msg?: string): void;
  info(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
}

export interface CanvasKeyboardTraceSink {
  write(event: CanvasKeyboardTraceEvent): void;
}

const KEYBOARD_TRACE_SUBSYSTEM = 'canvas-keyboard';

let rootLogger: PinoLogger | undefined;

function getRootLogger(): PinoLogger {
  if (rootLogger) {
    return rootLogger;
  }

  const logger = pino({
    name: 'magam-app',
    level: process.env.NODE_ENV === 'test'
      ? 'silent'
      : process.env.LOG_LEVEL ?? process.env.NEXT_PUBLIC_LOG_LEVEL ?? 'info',
    browser: {
      asObject: true,
    },
  });

  rootLogger = logger;
  return rootLogger;
}

function resolveTraceLevel(event: CanvasKeyboardTraceEvent): CanvasKeyboardTraceLevel {
  if (event.level) {
    return event.level;
  }

  if (event.outcome === 'failed') {
    return 'error';
  }
  if (event.outcome === 'skipped') {
    return 'debug';
  }
  return 'info';
}

function serializeTraceError(error: unknown): Record<string, unknown> | undefined {
  if (!error) {
    return undefined;
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === 'object') {
    return { ...(error as Record<string, unknown>) };
  }

  return {
    message: String(error),
  };
}

export function createCanvasKeyboardTraceSink(input?: {
  logger?: CanvasKeyboardLoggerLike;
  subsystem?: string;
}): CanvasKeyboardTraceSink {
  const logger = (input?.logger ?? getRootLogger()).child({
    subsystem: input?.subsystem ?? KEYBOARD_TRACE_SUBSYSTEM,
  });

  return {
    write(event) {
      const level = resolveTraceLevel(event);
      const logPayload: Record<string, unknown> = {
        event: event.event,
        outcome: event.outcome,
      };

      if (event.commandId) {
        logPayload.commandId = event.commandId;
      }
      if (event.bindingId) {
        logPayload.bindingId = event.bindingId;
      }
      if (typeof event.durationMs === 'number') {
        logPayload.durationMs = event.durationMs;
      }
      if (event.reason) {
        logPayload.reason = event.reason;
      }
      if (event.payload) {
        logPayload.payload = event.payload;
      }

      const serializedError = serializeTraceError(event.error);
      if (serializedError) {
        logPayload.error = serializedError;
      }

      logger[level](logPayload, event.event);
    },
  };
}

export const canvasKeyboardTrace = createCanvasKeyboardTraceSink();
