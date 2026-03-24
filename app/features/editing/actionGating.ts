import { pickStylePatch } from './editability';
import { createActionRoutingBridgeError } from './actionRoutingErrors';
import type {
  ActionRoutingBridgeRequest,
  ActionRoutingGateResult,
  ActionRoutingNormalizedPayload,
} from './actionRoutingBridge.types';

function failResult(
  errorCode: 'GATE_BLOCKED' | 'PATCH_SURFACE_VIOLATION',
  details?: Record<string, unknown>,
): ActionRoutingGateResult {
  return {
    ok: false,
    error: {
      errorCode,
      ...(details ? { details } : {}),
    },
  };
}

function expectAllowedCommand(
  request: ActionRoutingBridgeRequest,
  commandType: string,
): ActionRoutingGateResult | null {
  if (!request.resolvedContext.editability.canMutate) {
    return failResult('GATE_BLOCKED', {
      reason: request.resolvedContext.editability.reason ?? 'MUTATION_BLOCKED',
      commandType,
    });
  }

  if (!request.resolvedContext.editability.allowedCommands.includes(commandType as never)) {
    return failResult('GATE_BLOCKED', {
      reason: request.resolvedContext.editability.reason ?? 'COMMAND_NOT_ALLOWED',
      commandType,
    });
  }

  return null;
}

export function gateActionPayload(
  request: ActionRoutingBridgeRequest,
  normalized: ActionRoutingNormalizedPayload,
): ActionRoutingGateResult {
  const commandGate = expectAllowedCommand(request, normalized.commandType);
  if (commandGate) {
    return commandGate;
  }

  if (normalized.kind !== 'style-update') {
    return { ok: true, value: {} };
  }

  const { allowedPatch, rejectedKeys } = pickStylePatch(
    normalized.patch,
    request.resolvedContext.editability.styleEditableKeys,
  );

  if (rejectedKeys.length > 0) {
    return failResult('PATCH_SURFACE_VIOLATION', {
      rejectedKeys,
      allowedKeys: request.resolvedContext.editability.styleEditableKeys,
      semanticRole: request.resolvedContext.metadata.semanticRole,
      primaryContentKind: request.resolvedContext.metadata.primaryContentKind,
    });
  }

  if (Object.keys(allowedPatch).length === 0) {
    return failResult('PATCH_SURFACE_VIOLATION', {
      rejectedKeys: [],
      allowedKeys: request.resolvedContext.editability.styleEditableKeys,
    });
  }

  return {
    ok: true,
    value: {
      patch: allowedPatch,
    },
  };
}

export function assertActionPayloadGate(
  request: ActionRoutingBridgeRequest,
  normalized: ActionRoutingNormalizedPayload,
): { patch?: Record<string, unknown> } {
  const gate = gateActionPayload(request, normalized);
  if (gate.ok) {
    return gate.value ?? {};
  }

  throw createActionRoutingBridgeError({
    code: gate.error?.errorCode ?? 'GATE_BLOCKED',
    surface: request.surface,
    intent: request.intent,
    details: gate.error?.details,
  });
}
