import {
  DEFAULT_ACTIVE_TOOL_STATE,
  DEFAULT_ENTRYPOINT_RUNTIME_STATE,
  type ActiveToolState,
  type EntrypointAnchorSnapshot,
  type EntrypointRuntimeState,
  type OpenSurfaceDescriptor,
  type PendingUiAction,
} from './types';

function areStringSetsEqual(left: string[] | undefined, right: string[]): boolean {
  if (!left) {
    return right.length === 0;
  }
  if (left.length !== right.length) {
    return false;
  }

  const leftSet = new Set(left);
  return right.every((value) => leftSet.has(value));
}

export function createDefaultEntrypointRuntimeState(): EntrypointRuntimeState {
  return {
    activeTool: { ...DEFAULT_ACTIVE_TOOL_STATE },
    openSurface: null,
    anchorsById: {},
    hover: {
      nodeIdsByGroupId: {},
      targetNodeId: null,
    },
    pendingByRequestId: {},
  };
}

export function mergeActiveTool(
  state: EntrypointRuntimeState,
  patch: Partial<ActiveToolState>,
): EntrypointRuntimeState {
  return {
    ...state,
    activeTool: {
      ...state.activeTool,
      ...patch,
    },
  };
}

export function registerEntrypointAnchor(
  state: EntrypointRuntimeState,
  anchor: EntrypointAnchorSnapshot,
): EntrypointRuntimeState {
  return {
    ...state,
    anchorsById: {
      ...state.anchorsById,
      [anchor.anchorId]: anchor,
    },
  };
}

export function clearEntrypointAnchor(
  state: EntrypointRuntimeState,
  anchorId: string,
): EntrypointRuntimeState {
  if (!state.anchorsById[anchorId]) {
    return state;
  }

  const nextAnchors = { ...state.anchorsById };
  delete nextAnchors[anchorId];

  return {
    ...state,
    anchorsById: nextAnchors,
    openSurface: state.openSurface?.anchorId === anchorId ? null : state.openSurface,
  };
}

export function clearEntrypointAnchorsForNode(
  state: EntrypointRuntimeState,
  nodeId: string,
): EntrypointRuntimeState {
  let nextState = state;
  Object.values(state.anchorsById).forEach((anchor) => {
    if (anchor.ownerId === nodeId || anchor.nodeIds?.includes(nodeId)) {
      nextState = clearEntrypointAnchor(nextState, anchor.anchorId);
    }
  });
  return nextState;
}

export function clearEntrypointAnchorsForSelection(
  state: EntrypointRuntimeState,
  selectedNodeIds: string[],
): EntrypointRuntimeState {
  let nextState = state;
  Object.values(state.anchorsById).forEach((anchor) => {
    if (anchor.kind !== 'selection-bounds') {
      return;
    }
    if (!areStringSetsEqual(anchor.nodeIds, selectedNodeIds)) {
      nextState = clearEntrypointAnchor(nextState, anchor.anchorId);
    }
  });
  return nextState;
}

export function openEntrypointSurface(
  state: EntrypointRuntimeState,
  surface: OpenSurfaceDescriptor,
): EntrypointRuntimeState {
  if (!state.anchorsById[surface.anchorId]) {
    return state;
  }

  return {
    ...state,
    openSurface: surface,
  };
}

export function closeEntrypointSurface(state: EntrypointRuntimeState): EntrypointRuntimeState {
  if (!state.openSurface) {
    return state;
  }

  return {
    ...state,
    openSurface: null,
  };
}

export function dismissEntrypointSurfaceOnSelectionChange(
  state: EntrypointRuntimeState,
): EntrypointRuntimeState {
  if (!state.openSurface?.dismissOnSelectionChange) {
    return state;
  }

  return closeEntrypointSurface(state);
}

export function dismissEntrypointSurfaceOnViewportChange(
  state: EntrypointRuntimeState,
): EntrypointRuntimeState {
  if (!state.openSurface?.dismissOnViewportChange) {
    return state;
  }

  return closeEntrypointSurface(state);
}

export function syncGroupHoverRegistry(
  state: EntrypointRuntimeState,
  nodeIdsByGroupId: Record<string, string[]>,
): EntrypointRuntimeState {
  return {
    ...state,
    hover: {
      ...state.hover,
      nodeIdsByGroupId,
    },
  };
}

export function setHoverTargetNodeId(
  state: EntrypointRuntimeState,
  targetNodeId: string | null,
): EntrypointRuntimeState {
  return {
    ...state,
    hover: {
      ...state.hover,
      targetNodeId,
    },
  };
}

export function beginPendingUiAction(
  state: EntrypointRuntimeState,
  pending: PendingUiAction,
): EntrypointRuntimeState {
  return {
    ...state,
    pendingByRequestId: {
      ...state.pendingByRequestId,
      [pending.requestId]: pending,
    },
  };
}

export function commitPendingUiAction(
  state: EntrypointRuntimeState,
  requestId: string,
): EntrypointRuntimeState {
  const current = state.pendingByRequestId[requestId];
  if (!current) {
    return state;
  }

  return {
    ...state,
    pendingByRequestId: {
      ...state.pendingByRequestId,
      [requestId]: {
        ...current,
        status: 'committed',
        errorMessage: undefined,
      },
    },
  };
}

export function failPendingUiAction(
  state: EntrypointRuntimeState,
  requestId: string,
  errorMessage?: string,
): EntrypointRuntimeState {
  const current = state.pendingByRequestId[requestId];
  if (!current) {
    return state;
  }

  return {
    ...state,
    pendingByRequestId: {
      ...state.pendingByRequestId,
      [requestId]: {
        ...current,
        status: 'failed',
        ...(errorMessage ? { errorMessage } : {}),
      },
    },
  };
}

export function rollbackPendingUiAction(
  state: EntrypointRuntimeState,
  requestId: string,
  errorMessage?: string,
): EntrypointRuntimeState {
  const current = state.pendingByRequestId[requestId];
  if (!current) {
    return state;
  }

  return {
    ...state,
    pendingByRequestId: {
      ...state.pendingByRequestId,
      [requestId]: {
        ...current,
        status: 'rollback',
        ...(errorMessage ? { errorMessage } : {}),
      },
    },
  };
}

export function clearPendingUiAction(
  state: EntrypointRuntimeState,
  requestId: string,
): EntrypointRuntimeState {
  if (!state.pendingByRequestId[requestId]) {
    return state;
  }

  const nextPending = { ...state.pendingByRequestId };
  delete nextPending[requestId];
  return {
    ...state,
    pendingByRequestId: nextPending,
  };
}

export function clearResolvedPendingUiActions(state: EntrypointRuntimeState): EntrypointRuntimeState {
  const nextPending: Record<string, PendingUiAction> = {};

  Object.entries(state.pendingByRequestId).forEach(([requestId, pending]) => {
    if (pending.status === 'pending') {
      nextPending[requestId] = pending;
    }
  });

  if (Object.keys(nextPending).length === Object.keys(state.pendingByRequestId).length) {
    return state;
  }

  return {
    ...state,
    pendingByRequestId: nextPending,
  };
}

export {
  DEFAULT_ENTRYPOINT_RUNTIME_STATE,
};

