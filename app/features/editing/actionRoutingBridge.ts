import {
  buildCreateCommand,
  buildRenameCommand,
  buildStyleUpdateCommand,
  toCreateNodeInput,
  toUpdateNodeProps,
} from './commands';
import { getActionDispatchRecipe } from './actionDispatchRecipes';
import { assertActionPayloadGate } from './actionGating';
import { getActionIntentCatalogEntry } from './actionIntentCatalog';
import {
  createActionRoutingBridgeError,
  toActionRoutingBridgeResponseError,
} from './actionRoutingErrors';
import {
  createOptimisticLifecycleTokens,
  emitActionOptimisticLifecycleEvent,
} from './actionOptimisticLifecycle';
import { normalizeActionPayload } from './actionPayloadNormalizer';
import type {
  ActionRoutingBridgeDependencies,
  ActionRoutingBridgeRequest,
  ActionRoutingBridgeResponse,
  ActionRoutingDispatchedAction,
  ActionRoutingNormalizedPayload,
} from './actionRoutingBridge.types';

function createId(deps: ActionRoutingBridgeDependencies): string {
  return deps.createId?.() ?? crypto.randomUUID();
}

function now(deps: ActionRoutingBridgeDependencies): number {
  return deps.now?.() ?? Date.now();
}

function resolveNextVersion(
  normalized: ActionRoutingNormalizedPayload,
  response: { newVersion?: string },
  deps: ActionRoutingBridgeDependencies,
): string {
  const canvasId = normalized.editTarget.canvasId!;
  return response.newVersion
    ?? deps.runtime.canvasVersions[canvasId]
    ?? normalized.baseVersion;
}

async function dispatchCreateNode(
  normalized: Extract<ActionRoutingNormalizedPayload, { kind: 'create-node' }>,
  deps: ActionRoutingBridgeDependencies,
): Promise<ActionRoutingBridgeResponse> {
  const command = buildCreateCommand({
    type: normalized.commandType,
    target: normalized.editTarget,
    payload: {
      nodeType: normalized.nodeType,
      id: normalized.createInput.id,
      initialProps: normalized.initialProps,
      initialContent: normalized.initialContent,
      placement: normalized.placement,
    },
  });
  const createInput = toCreateNodeInput(command);
  const result = await deps.createNode(
    createInput,
    normalized.editTarget.canvasId,
  );
  const commandId = result.commandId ?? createId(deps);
  deps.setPendingSelectionNodeId?.(normalized.renderedId);
  deps.pushEditCompletionEvent?.({
    eventId: createId(deps),
    type: 'NODE_CREATED',
    nodeId: normalized.editTarget.sourceId,
    canvasId: normalized.editTarget.canvasId!,
    commandId,
    baseVersion: normalized.baseVersion,
    nextVersion: resolveNextVersion(normalized, result, deps),
    before: { created: false },
    after: { create: createInput, renderedId: normalized.renderedId },
    committedAt: now(deps),
  });
  deps.onFileChange?.();

  return {
    dispatchedActions: [
      { action: normalized.commandType, status: 'applied' },
    ],
  };
}

async function dispatchRenameNode(
  normalized: Extract<ActionRoutingNormalizedPayload, { kind: 'rename-node' }>,
  deps: ActionRoutingBridgeDependencies,
): Promise<ActionRoutingBridgeResponse> {
  const command = buildRenameCommand({
    target: normalized.editTarget,
    previousId: normalized.previousId,
    nextId: normalized.nextId,
  });
  const result = await deps.updateNode(
    command.target.sourceId,
    toUpdateNodeProps(command),
    { commandType: command.type },
    command.target.canvasId,
  );
  const commandId = result.commandId ?? createId(deps);
  deps.pushEditCompletionEvent?.({
    eventId: createId(deps),
    type: 'NODE_RENAMED',
    nodeId: command.target.sourceId,
    canvasId: command.target.canvasId!,
    commandId,
    baseVersion: normalized.baseVersion,
    nextVersion: resolveNextVersion(normalized, result, deps),
    before: command.payload.previous,
    after: command.payload.next,
    committedAt: now(deps),
  });
  deps.onFileChange?.();

  return {
    dispatchedActions: [
      { action: normalized.commandType, status: 'applied' },
    ],
  };
}

async function dispatchStyleUpdate(
  request: ActionRoutingBridgeRequest,
  normalized: Extract<ActionRoutingNormalizedPayload, { kind: 'style-update' }>,
  deps: ActionRoutingBridgeDependencies,
): Promise<ActionRoutingBridgeResponse> {
  const { patch } = assertActionPayloadGate(request, normalized);
  const nextPatch = patch ?? normalized.patch;
  const command = buildStyleUpdateCommand({
    target: normalized.editTarget,
    previous: normalized.previousPatch,
    patch: nextPatch,
  });

  deps.updateNodeData?.(normalized.renderedNodeId, nextPatch);

  try {
    const result = await deps.updateNode(
      command.target.sourceId,
      toUpdateNodeProps(command),
      { commandType: command.type },
      command.target.canvasId,
    );
    const commandId = result.commandId ?? createId(deps);
    deps.pushEditCompletionEvent?.({
      eventId: createId(deps),
      type: 'STYLE_UPDATED',
      nodeId: command.target.sourceId,
      canvasId: command.target.canvasId!,
      commandId,
      baseVersion: normalized.baseVersion,
      nextVersion: resolveNextVersion(normalized, result, deps),
      before: command.payload.previous,
      after: command.payload.patch,
      committedAt: now(deps),
    });

    return {
      dispatchedActions: [
        { action: normalized.commandType, status: 'applied' },
      ],
    };
  } catch (error) {
    deps.restoreNodeData?.(normalized.renderedNodeId, normalized.previousNodeData);
    throw error;
  }
}

async function dispatchNormalizedIntent(
  request: ActionRoutingBridgeRequest,
  normalized: ActionRoutingNormalizedPayload,
  deps: ActionRoutingBridgeDependencies,
): Promise<ActionRoutingBridgeResponse> {
  if (normalized.kind === 'create-node') {
    return dispatchCreateNode(normalized, deps);
  }

  if (normalized.kind === 'rename-node') {
    return dispatchRenameNode(normalized, deps);
  }

  if (normalized.kind === 'style-update') {
    return dispatchStyleUpdate(request, normalized, deps);
  }

  throw createActionRoutingBridgeError({
    code: 'INVALID_INTENT',
    surface: request.surface,
    intent: request.intent,
  });
}

export async function dispatchActionRoutingIntent(
  request: ActionRoutingBridgeRequest,
  deps: ActionRoutingBridgeDependencies,
): Promise<ActionRoutingBridgeResponse> {
  const catalogEntry = getActionIntentCatalogEntry(request.surface, request.intent);
  if (!catalogEntry) {
    return {
      dispatchedActions: [],
      error: toActionRoutingBridgeResponseError(
        createActionRoutingBridgeError({
          code: 'INVALID_INTENT',
          surface: request.surface,
          intent: request.intent,
        }),
        {
          surface: request.surface,
          intent: request.intent,
        },
      ),
    };
  }

  const recipe = getActionDispatchRecipe(catalogEntry.dispatchRecipeId);
  if (!recipe) {
    return {
      dispatchedActions: [],
      error: toActionRoutingBridgeResponseError(
        createActionRoutingBridgeError({
          code: 'INVALID_INTENT',
          surface: request.surface,
          intent: request.intent,
          details: { dispatchRecipeId: catalogEntry.dispatchRecipeId },
        }),
        {
          surface: request.surface,
          intent: request.intent,
        },
      ),
    };
  }

  let normalized: ActionRoutingNormalizedPayload;
  try {
    normalized = normalizeActionPayload(request, deps.runtime);
  } catch (error) {
    return {
      dispatchedActions: [],
      error: toActionRoutingBridgeResponseError(error, {
        surface: request.surface,
        intent: request.intent,
      }),
      rawError: error,
    };
  }

  try {
    assertActionPayloadGate(request, normalized);
  } catch (error) {
    return {
      dispatchedActions: [],
      error: toActionRoutingBridgeResponseError(error, {
        surface: request.surface,
        intent: request.intent,
      }),
      rawError: error,
    };
  }

  const dispatchedActions: ActionRoutingDispatchedAction[] = recipe.steps.map((step) => ({
    action: step.action,
    status: 'skipped',
  }));
  const tokens = recipe.requiresOptimistic ? createOptimisticLifecycleTokens() : null;

  if (tokens) {
    emitActionOptimisticLifecycleEvent({
      phase: 'apply',
      surface: request.surface,
      intent: request.intent,
      optimisticToken: tokens.optimisticToken,
      rollbackToken: tokens.rollbackToken,
    });
  }

  try {
    const result = await dispatchNormalizedIntent(request, normalized, deps);
    const nextActions = dispatchedActions.map((action) => ({
      ...action,
      status: result.dispatchedActions.some((item) => item.action === action.action && item.status === 'applied')
        ? 'applied'
        : action.status,
    }));

    if (tokens) {
      emitActionOptimisticLifecycleEvent({
        phase: 'commit',
        surface: request.surface,
        intent: request.intent,
        optimisticToken: tokens.optimisticToken,
        rollbackToken: tokens.rollbackToken,
      });
    }

    return {
      dispatchedActions: nextActions,
      ...(tokens ? tokens : {}),
    };
  } catch (error) {
    if (tokens) {
      emitActionOptimisticLifecycleEvent({
        phase: 'reject',
        surface: request.surface,
        intent: request.intent,
        optimisticToken: tokens.optimisticToken,
        rollbackToken: tokens.rollbackToken,
        reason: error instanceof Error ? error.message : 'EXECUTION_FAILED',
      });
    }

    return {
      dispatchedActions: dispatchedActions.map((action) => ({
        ...action,
        status: 'failed',
      })),
      ...(tokens ? tokens : {}),
      error: toActionRoutingBridgeResponseError(error, {
        surface: request.surface,
        intent: request.intent,
      }),
      rawError: error,
    };
  }
}

export async function dispatchActionRoutingIntentOrThrow(
  request: ActionRoutingBridgeRequest,
  deps: ActionRoutingBridgeDependencies,
): Promise<ActionRoutingBridgeResponse> {
  const response = await dispatchActionRoutingIntent(request, deps);
  if (response.error) {
    throw response.rawError ?? createActionRoutingBridgeError({
      code: response.error.code,
      surface: response.error.surface,
      intent: response.error.intent,
      details: response.error.details,
    });
  }
  return response;
}
