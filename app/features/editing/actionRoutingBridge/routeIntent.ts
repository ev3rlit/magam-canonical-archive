import { createActionRoutingRegistry } from '@/features/editing/actionRoutingBridge/registry';
import {
  fail,
  isActionRoutingSurfaceId,
  ok,
  type ActionRoutingContext,
  type ActionRoutingRegistryEntry,
  type ActionRoutingResult,
  type OrderedDispatchPlan,
  type UIIntentEnvelope,
} from '@/features/editing/actionRoutingBridge/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateIntentEnvelope(envelope: UIIntentEnvelope): ActionRoutingResult<UIIntentEnvelope> {
  if (!isActionRoutingSurfaceId(envelope.surfaceId)) {
    return fail('INTENT_PAYLOAD_INVALID', 'surfaceId is invalid');
  }
  if (typeof envelope.intentId !== 'string' || envelope.intentId.trim().length === 0) {
    return fail('INTENT_PAYLOAD_INVALID', 'intentId is required');
  }
  if (!Array.isArray(envelope.selectionRef.selectedNodeIds)) {
    return fail('INTENT_PAYLOAD_INVALID', 'selectionRef.selectedNodeIds must be an array');
  }
  if (!isRecord(envelope.rawPayload)) {
    return fail('INTENT_PAYLOAD_INVALID', 'rawPayload must be an object');
  }
  return ok(envelope);
}

export function routeIntent(input: {
  envelope: UIIntentEnvelope;
  context: ActionRoutingContext;
  registry?: Record<string, ActionRoutingRegistryEntry>;
}): ActionRoutingResult<OrderedDispatchPlan> {
  const validation = validateIntentEnvelope(input.envelope);
  if (!validation.ok) {
    return validation;
  }

  const registry = input.registry ?? createActionRoutingRegistry();
  const entry = registry[input.envelope.intentId];
  if (!entry) {
    return fail('INTENT_NOT_REGISTERED', 'intent is not registered', {
      intentId: input.envelope.intentId,
    });
  }
  if (!entry.supportedSurfaces.includes(input.envelope.surfaceId)) {
    return fail('INTENT_SURFACE_NOT_ALLOWED', 'surface is not allowed for this intent', {
      intentId: input.envelope.intentId,
      surfaceId: input.envelope.surfaceId,
    });
  }

  const gating = entry.isEnabled({
    envelope: input.envelope,
    context: input.context,
  });
  if (!gating.ok) {
    return gating;
  }

  const normalized = entry.normalizePayload({
    envelope: input.envelope,
    context: input.context,
  });
  if (!normalized.ok) {
    return normalized;
  }

  const plan = entry.buildDispatch({
    envelope: input.envelope,
    context: input.context,
    normalized: normalized.value,
  });
  if (!plan.ok) {
    return plan;
  }

  if (plan.value.steps.length === 0) {
    return fail('DISPATCH_PLAN_INVALID', 'dispatch plan must include at least one step', {
      intentId: input.envelope.intentId,
    });
  }

  return ok(plan.value);
}
