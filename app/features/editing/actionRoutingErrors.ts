import { RPC_ERRORS } from '@/ws/rpc';
import type {
  ActionRoutingBridgeErrorCode,
  ActionRoutingBridgeResponseError,
  ActionRoutingIntent,
  EntryPointSurface,
} from './actionRoutingBridge.types';

type ActionRoutingBridgeError = Error & {
  code: number;
  bridgeCode: ActionRoutingBridgeErrorCode;
  data?: {
    surface: EntryPointSurface;
    intent: ActionRoutingIntent;
    details?: Record<string, unknown>;
  };
};

const ACTION_ROUTING_ERROR_TEMPLATES: Record<
  ActionRoutingBridgeErrorCode,
  { code: number; message: string }
> = {
  INVALID_INTENT: RPC_ERRORS.INVALID_INTENT,
  NORMALIZATION_FAILED: RPC_ERRORS.NORMALIZATION_FAILED,
  GATE_BLOCKED: RPC_ERRORS.GATE_BLOCKED,
  PATCH_SURFACE_VIOLATION: RPC_ERRORS.PATCH_SURFACE_VIOLATION,
  EXECUTION_FAILED: RPC_ERRORS.EXECUTION_FAILED,
  ADOPTION_VIOLATION: RPC_ERRORS.ADOPTION_VIOLATION,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createActionRoutingBridgeError(input: {
  code: ActionRoutingBridgeErrorCode;
  surface: EntryPointSurface;
  intent: ActionRoutingIntent;
  details?: Record<string, unknown>;
}): ActionRoutingBridgeError {
  const template = ACTION_ROUTING_ERROR_TEMPLATES[input.code];
  const error = new Error(template.message) as ActionRoutingBridgeError;
  error.name = 'ActionRoutingBridgeError';
  error.code = template.code;
  error.bridgeCode = input.code;
  error.data = {
    surface: input.surface,
    intent: input.intent,
    ...(input.details ? { details: input.details } : {}),
  };
  return error;
}

export function isActionRoutingBridgeError(error: unknown): error is ActionRoutingBridgeError {
  return isRecord(error)
    && typeof error.code === 'number'
    && typeof error.bridgeCode === 'string';
}

export function toActionRoutingBridgeResponseError(
  error: unknown,
  input: {
    fallbackCode?: ActionRoutingBridgeErrorCode;
    surface: EntryPointSurface;
    intent: ActionRoutingIntent;
  },
): ActionRoutingBridgeResponseError {
  if (isActionRoutingBridgeError(error)) {
    return {
      code: error.bridgeCode,
      message: error.message,
      surface: input.surface,
      intent: input.intent,
      details: error.data?.details,
      rpcCode: error.code,
    };
  }

  const fallbackCode = input.fallbackCode ?? 'EXECUTION_FAILED';
  const fallbackTemplate = ACTION_ROUTING_ERROR_TEMPLATES[fallbackCode];
  if (isRecord(error)) {
    const rpcCode = typeof error.code === 'number' ? error.code : undefined;
    const rpcMessage = typeof error.message === 'string' ? error.message : undefined;
    const details: Record<string, unknown> = {
      ...(rpcMessage ? { rpcMessage } : {}),
      ...(isRecord(error.data) ? { rpcData: error.data } : error.data !== undefined ? { rpcData: error.data } : {}),
    };

    return {
      code: fallbackCode,
      message: fallbackTemplate.message,
      surface: input.surface,
      intent: input.intent,
      ...(Object.keys(details).length > 0 ? { details } : {}),
      ...(rpcCode !== undefined ? { rpcCode } : {}),
    };
  }

  return {
    code: fallbackCode,
    message: fallbackTemplate.message,
    surface: input.surface,
    intent: input.intent,
  };
}
