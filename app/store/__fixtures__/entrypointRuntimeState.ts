import {
  DEFAULT_ENTRYPOINT_RUNTIME_STATE,
  type EntrypointAnchorSnapshot,
  type EntrypointRuntimeState,
  type OpenSurfaceDescriptor,
  type PendingUiAction,
} from '@/features/canvas-ui-entrypoints/ui-runtime-state';

export function createEntrypointRuntimeStateFixture(
  input: Partial<EntrypointRuntimeState> = {},
): EntrypointRuntimeState {
  return {
    ...DEFAULT_ENTRYPOINT_RUNTIME_STATE,
    ...input,
    activeTool: {
      ...DEFAULT_ENTRYPOINT_RUNTIME_STATE.activeTool,
      ...(input.activeTool ?? {}),
    },
    openSurface: input.openSurface ?? DEFAULT_ENTRYPOINT_RUNTIME_STATE.openSurface,
    anchorsById: {
      ...DEFAULT_ENTRYPOINT_RUNTIME_STATE.anchorsById,
      ...(input.anchorsById ?? {}),
    },
    hover: {
      ...DEFAULT_ENTRYPOINT_RUNTIME_STATE.hover,
      ...(input.hover ?? {}),
      nodeIdsByGroupId: {
        ...DEFAULT_ENTRYPOINT_RUNTIME_STATE.hover.nodeIdsByGroupId,
        ...(input.hover?.nodeIdsByGroupId ?? {}),
      },
    },
    pendingByRequestId: {
      ...DEFAULT_ENTRYPOINT_RUNTIME_STATE.pendingByRequestId,
      ...(input.pendingByRequestId ?? {}),
    },
  };
}

export function createEntrypointAnchorFixture(
  input: Partial<EntrypointAnchorSnapshot> = {},
): EntrypointAnchorSnapshot {
  return {
    anchorId: input.anchorId ?? 'anchor-1',
    kind: input.kind ?? 'pointer',
    ...(input.ownerId ? { ownerId: input.ownerId } : {}),
    ...(input.nodeIds ? { nodeIds: input.nodeIds } : {}),
    ...(input.screen ? { screen: input.screen } : {}),
    ...(input.flow ? { flow: input.flow } : {}),
    ...(input.viewport ? { viewport: input.viewport } : {}),
  };
}

export function createOpenSurfaceFixture(
  input: Partial<OpenSurfaceDescriptor> = {},
): OpenSurfaceDescriptor {
  return {
    kind: input.kind ?? 'pane-context-menu',
    anchorId: input.anchorId ?? 'anchor-1',
    dismissOnSelectionChange: input.dismissOnSelectionChange ?? false,
    dismissOnViewportChange: input.dismissOnViewportChange ?? true,
    ...(input.ownerId ? { ownerId: input.ownerId } : {}),
  };
}

export function createPendingUiActionFixture(
  input: Partial<PendingUiAction> = {},
): PendingUiAction {
  return {
    requestId: input.requestId ?? 'request-1',
    actionType: input.actionType ?? 'node.create',
    targetIds: input.targetIds ?? ['node-1'],
    status: input.status ?? 'pending',
    startedAt: input.startedAt ?? 1,
    ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
  };
}
