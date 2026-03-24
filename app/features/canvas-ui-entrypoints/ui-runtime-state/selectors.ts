import type {
  EntrypointAnchorSnapshot,
  EntrypointRuntimeSliceHost,
  EntrypointRuntimeState,
  EntrypointSurfaceKind,
  PendingUiAction,
} from './types';

export function selectEntrypointRuntime(state: EntrypointRuntimeSliceHost): EntrypointRuntimeState {
  return state.entrypointRuntime;
}

export function selectEntrypointActiveTool(state: EntrypointRuntimeSliceHost) {
  return state.entrypointRuntime.activeTool;
}

export function selectEntrypointOpenSurface(state: EntrypointRuntimeSliceHost) {
  return state.entrypointRuntime.openSurface;
}

export function selectIsEntrypointSurfaceOpen(
  state: EntrypointRuntimeSliceHost,
  kind: EntrypointSurfaceKind,
): boolean {
  return state.entrypointRuntime.openSurface?.kind === kind;
}

export function selectEntrypointAnchorById(
  state: EntrypointRuntimeSliceHost,
  anchorId: string | null | undefined,
): EntrypointAnchorSnapshot | null {
  if (!anchorId) {
    return null;
  }

  return state.entrypointRuntime.anchorsById[anchorId] ?? null;
}

export function selectEntrypointOpenSurfaceAnchor(
  state: EntrypointRuntimeSliceHost,
): EntrypointAnchorSnapshot | null {
  return selectEntrypointAnchorById(state, state.entrypointRuntime.openSurface?.anchorId);
}

export function selectEntrypointHoverRegistry(state: EntrypointRuntimeSliceHost) {
  return state.entrypointRuntime.hover;
}

export function selectEntrypointPendingAction(
  state: EntrypointRuntimeSliceHost,
  requestId: string | null | undefined,
): PendingUiAction | null {
  if (!requestId) {
    return null;
  }

  return state.entrypointRuntime.pendingByRequestId[requestId] ?? null;
}

export function selectHasPendingEntrypointActions(state: EntrypointRuntimeSliceHost): boolean {
  return Object.keys(state.entrypointRuntime.pendingByRequestId).length > 0;
}

