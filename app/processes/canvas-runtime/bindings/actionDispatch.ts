import { RpcClientError } from '@/hooks/useFileSync';
import type { RpcMutationResult } from '@/hooks/useFileSync.shared';
import { createActionRoutingRegistry } from '@/features/editing/actionRoutingBridge/registry';
import { routeIntent } from '@/features/editing/actionRoutingBridge/routeIntent';
import type {
  ActionRoutingIntent as LegacyActionRoutingIntent,
  ActionRoutingResolvedContext as LegacyActionRoutingResolvedContext,
  ActionRoutingTrigger as LegacyActionRoutingTrigger,
  EntryPointSurface as LegacyEntryPointSurface,
} from '@/features/editing/actionRoutingBridge.types';
import {
  type ActionRoutingContext,
  type ActionRoutingError,
  type ActionRoutingHistoryEffect,
  type ActionRoutingPendingRecord,
  type ActionRoutingRegistryEntry,
  type ActionRoutingResult,
  type ActionRoutingSurfaceId,
  type MutationDispatchDescriptor,
  type OrderedDispatchPlan,
  type RuntimeActionDescriptor,
  type UIIntentEnvelope,
} from '@/features/editing/actionRoutingBridge/types';
import { RPC_ERRORS } from '@/ws/rpc';

type RouteIntentFunction = (input: {
  envelope: UIIntentEnvelope;
  context: ActionRoutingContext;
  registry?: Record<string, ActionRoutingRegistryEntry>;
}) => ActionRoutingResult<OrderedDispatchPlan>;

const ACTION_ROUTING_RPC_ERRORS: Record<ActionRoutingError['code'], { code: number; message: string }> = {
  INTENT_NOT_REGISTERED: RPC_ERRORS.INTENT_NOT_REGISTERED,
  INTENT_SURFACE_NOT_ALLOWED: RPC_ERRORS.INTENT_SURFACE_NOT_ALLOWED,
  INTENT_GATING_DENIED: RPC_ERRORS.INTENT_GATING_DENIED,
  INTENT_PAYLOAD_INVALID: RPC_ERRORS.INTENT_PAYLOAD_INVALID,
  DISPATCH_PLAN_INVALID: RPC_ERRORS.DISPATCH_PLAN_INVALID,
  OPTIMISTIC_CONFLICT: RPC_ERRORS.OPTIMISTIC_CONFLICT,
};

export type CanvasActionDispatchCompatIntent =
  | LegacyActionRoutingIntent
  | 'content-update'
  | 'duplicate-node'
  | 'delete-node'
  | 'toggle-node-lock'
  | 'select-node-group'
  | 'group-selection'
  | 'ungroup-selection'
  | 'bring-selection-to-front'
  | 'send-selection-to-back';

export interface CanvasActionDispatchRequest {
  surface: LegacyEntryPointSurface;
  intent: CanvasActionDispatchCompatIntent;
  resolvedContext: LegacyActionRoutingResolvedContext;
  uiPayload: Record<string, unknown>;
  trigger: LegacyActionRoutingTrigger;
}

export interface CanvasActionDispatchRuntimeSnapshot extends ActionRoutingContext {
  selectedNodeIds: string[];
}

export interface CanvasActionDispatchBindingInput {
  getRuntime: () => CanvasActionDispatchRuntimeSnapshot;
  applyRuntimeAction: (descriptor: RuntimeActionDescriptor) => void;
  executeMutationDescriptor: (descriptor: MutationDispatchDescriptor) => Promise<RpcMutationResult>;
  commitHistoryEffect: (
    effect: ActionRoutingHistoryEffect,
    result: RpcMutationResult,
  ) => void;
  registerPendingActionRouting: (record: ActionRoutingPendingRecord) => void;
  clearPendingActionRouting: (pendingKey: string) => void;
  registryEntries?: readonly ActionRoutingRegistryEntry[];
  routeIntentImpl?: RouteIntentFunction;
}

export interface CanvasActionDispatchBinding {
  executeBridgeIntent: (envelope: UIIntentEnvelope) => Promise<void>;
  dispatchActionRoutingIntentOrThrow: (request: CanvasActionDispatchRequest) => Promise<void>;
}

export function normalizeActionRoutingSurfaceId(input: {
  surfaceId?: ActionRoutingSurfaceId;
  surface?: LegacyEntryPointSurface;
}): ActionRoutingSurfaceId {
  if (input.surfaceId) {
    return input.surfaceId;
  }
  if (input.surface === 'canvas-toolbar') {
    return 'toolbar';
  }
  return input.surface ?? 'selection-floating-menu';
}

export function resolveLegacyEntrypointSurface(input: {
  surfaceId?: ActionRoutingSurfaceId;
  surface?: LegacyEntryPointSurface;
}): LegacyEntryPointSurface {
  if (input.surface) {
    return input.surface;
  }
  if (input.surfaceId === 'toolbar') {
    return 'canvas-toolbar';
  }
  return input.surfaceId ?? 'selection-floating-menu';
}

function toActionRoutingRpcError(error: ActionRoutingError): RpcClientError {
  const mapped = ACTION_ROUTING_RPC_ERRORS[error.code] ?? RPC_ERRORS.PATCH_FAILED;
  return new RpcClientError(mapped.code, mapped.message, error.details);
}

function resolveIntentEnvelopeMeta(
  intent: CanvasActionDispatchCompatIntent,
): Pick<UIIntentEnvelope, 'intentId' | 'optimistic'> {
  if (intent === 'style-update') {
    return {
      intentId: 'selection.style.update',
      optimistic: true,
    };
  }
  if (intent === 'rename-node') {
    return {
      intentId: 'node.rename',
      optimistic: false,
    };
  }
  if (intent === 'duplicate-node') {
    return {
      intentId: 'node.duplicate',
      optimistic: false,
    };
  }
  if (intent === 'delete-node') {
    return {
      intentId: 'node.delete',
      optimistic: false,
    };
  }
  if (intent === 'toggle-node-lock') {
    return {
      intentId: 'node.lock.toggle',
      optimistic: false,
    };
  }
  if (intent === 'select-node-group') {
    return {
      intentId: 'node.group.select',
      optimistic: false,
    };
  }
  if (intent === 'group-selection') {
    return {
      intentId: 'selection.group',
      optimistic: false,
    };
  }
  if (intent === 'ungroup-selection') {
    return {
      intentId: 'selection.ungroup',
      optimistic: false,
    };
  }
  if (intent === 'bring-selection-to-front') {
    return {
      intentId: 'selection.z-order.bring-to-front',
      optimistic: false,
    };
  }
  if (intent === 'send-selection-to-back') {
    return {
      intentId: 'selection.z-order.send-to-back',
      optimistic: false,
    };
  }
  if (
    intent === 'create-node'
    || intent === 'create-mindmap-child'
    || intent === 'create-mindmap-sibling'
  ) {
    return {
      intentId: 'node.create',
      optimistic: false,
    };
  }
  return {
    intentId: 'selection.content.update',
    optimistic: true,
  };
}

export function createCanvasActionDispatchBinding(
  input: CanvasActionDispatchBindingInput,
): CanvasActionDispatchBinding {
  const routeBridgeIntent = input.routeIntentImpl ?? routeIntent;
  const registry = {
    ...createActionRoutingRegistry(),
    ...Object.fromEntries((input.registryEntries ?? []).map((entry) => [entry.intentId, entry])),
  };

  const executeBridgeIntent = async (envelope: UIIntentEnvelope) => {
    const runtime = input.getRuntime();
    const routed = routeBridgeIntent({
      envelope,
      context: {
        nodes: runtime.nodes,
        edges: runtime.edges,
        currentFile: runtime.currentFile,
        sourceVersions: runtime.sourceVersions,
      },
      registry,
    });
    if (!routed.ok) {
      throw toActionRoutingRpcError(routed.error);
    }

    const registeredPendingKeys: string[] = [];

    try {
      for (const step of routed.value.steps) {
        if (step.kind === 'runtime-only-action') {
          input.applyRuntimeAction(step);
          continue;
        }

        if (step.optimisticMeta) {
          input.registerPendingActionRouting(step.optimisticMeta);
          registeredPendingKeys.push(step.optimisticMeta.pendingKey);
        }

        if (step.kind === 'canonical-query') {
          throw new RpcClientError(RPC_ERRORS.INVALID_PARAMS.code, RPC_ERRORS.INVALID_PARAMS.message, {
            stage: 'CanvasActionDispatchBinding.executeBridgeIntent',
            kind: step.kind,
          });
        }

        const result = await input.executeMutationDescriptor(step);
        if (step.historyEffect) {
          input.commitHistoryEffect(step.historyEffect, result);
        }

        if (step.optimisticMeta) {
          input.clearPendingActionRouting(step.optimisticMeta.pendingKey);
        }
      }
    } catch (error) {
      const rollbackSteps = routed.value.rollbackSteps.filter(
        (step): step is RuntimeActionDescriptor => step.kind === 'runtime-only-action',
      );
      rollbackSteps.forEach((step) => input.applyRuntimeAction(step));
      registeredPendingKeys.forEach((pendingKey) => input.clearPendingActionRouting(pendingKey));
      throw error;
    }
  };

  const dispatchActionRoutingIntentOrThrow = async (
    request: CanvasActionDispatchRequest,
  ) => {
    const runtime = input.getRuntime();
    const uiPayloadTarget = request.uiPayload as {
      filePath?: unknown;
      scopeId?: unknown;
      frameScope?: unknown;
    };
    const targetRef = request.resolvedContext.target || typeof uiPayloadTarget.filePath === 'string'
      ? {
        renderedNodeId: request.resolvedContext.target?.renderedNodeId,
        filePath: request.resolvedContext.target?.filePath
          ?? (typeof uiPayloadTarget.filePath === 'string' ? uiPayloadTarget.filePath : undefined),
        scopeId: request.resolvedContext.target?.scopeId
          ?? (typeof uiPayloadTarget.scopeId === 'string' ? uiPayloadTarget.scopeId : undefined),
        frameScope: request.resolvedContext.target?.frameScope
          ?? (typeof uiPayloadTarget.frameScope === 'string' ? uiPayloadTarget.frameScope : undefined),
      }
      : undefined;
    const envelopeMeta = resolveIntentEnvelopeMeta(request.intent);

    await executeBridgeIntent({
      surfaceId: normalizeActionRoutingSurfaceId({ surface: request.surface }),
      intentId: envelopeMeta.intentId,
      selectionRef: {
        selectedNodeIds: request.resolvedContext.selection.nodeIds,
        currentFile: runtime.currentFile,
      },
      targetRef,
      rawPayload: request.uiPayload,
      optimistic: envelopeMeta.optimistic,
    });
  };

  return {
    executeBridgeIntent,
    dispatchActionRoutingIntentOrThrow,
  };
}
