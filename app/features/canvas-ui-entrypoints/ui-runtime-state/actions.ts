import type {
  EntrypointAnchorKind,
  EntrypointAnchorSnapshot,
  EntrypointSurfaceKind,
  OpenSurfaceDescriptor,
  PendingUiAction,
} from './types';

export function createEntrypointAnchor(input: {
  anchorId: string;
  kind: EntrypointAnchorKind;
  ownerId?: string;
  nodeIds?: string[];
  screen?: EntrypointAnchorSnapshot['screen'];
  flow?: EntrypointAnchorSnapshot['flow'];
  viewport?: EntrypointAnchorSnapshot['viewport'];
}): EntrypointAnchorSnapshot {
  return {
    anchorId: input.anchorId,
    kind: input.kind,
    ...(input.ownerId ? { ownerId: input.ownerId } : {}),
    ...(input.nodeIds ? { nodeIds: input.nodeIds } : {}),
    ...(input.screen ? { screen: input.screen } : {}),
    ...(input.flow ? { flow: input.flow } : {}),
    ...(input.viewport ? { viewport: input.viewport } : {}),
  };
}

export function createOpenSurfaceDescriptor(input: {
  kind: EntrypointSurfaceKind;
  anchorId: string;
  ownerId?: string;
  dismissOnSelectionChange: boolean;
  dismissOnViewportChange: boolean;
}): OpenSurfaceDescriptor {
  return {
    kind: input.kind,
    anchorId: input.anchorId,
    ...(input.ownerId ? { ownerId: input.ownerId } : {}),
    dismissOnSelectionChange: input.dismissOnSelectionChange,
    dismissOnViewportChange: input.dismissOnViewportChange,
  };
}

export function createPendingUiAction(input: {
  requestId: string;
  actionType: string;
  targetIds: string[];
  startedAt?: number;
}): PendingUiAction {
  return {
    requestId: input.requestId,
    actionType: input.actionType,
    targetIds: [...input.targetIds],
    status: 'pending',
    startedAt: input.startedAt ?? Date.now(),
  };
}

export function createPendingUiRequestId(actionType: string, ownerId?: string): string {
  return [actionType, ownerId ?? 'global', Date.now(), Math.random().toString(36).slice(2, 8)].join(':');
}

export function getContextMenuSurfaceKind(type: 'node' | 'pane'): EntrypointSurfaceKind {
  return type === 'node' ? 'node-context-menu' : 'pane-context-menu';
}

