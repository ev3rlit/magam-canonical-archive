import type { CanvasEntrypointCreateMode } from '@/features/canvas-ui-entrypoints/contracts';

export type EntrypointInteractionMode = 'pointer' | 'hand';

export type EntrypointSurfaceKind =
  | 'toolbar-create-menu'
  | 'toolbar-preset-menu'
  | 'pane-context-menu'
  | 'node-context-menu'
  | 'selection-floating-menu';

export type EntrypointAnchorKind =
  | 'pointer'
  | 'node'
  | 'selection-bounds'
  | 'toolbar-trigger';

export type PendingUiActionStatus =
  | 'pending'
  | 'rollback'
  | 'committed'
  | 'failed';

export interface ActiveToolState {
  interactionMode: EntrypointInteractionMode;
  createMode: CanvasEntrypointCreateMode;
}

export interface OpenSurfaceDescriptor {
  kind: EntrypointSurfaceKind;
  anchorId: string;
  ownerId?: string;
  dismissOnSelectionChange: boolean;
  dismissOnViewportChange: boolean;
}

export interface EntrypointAnchorSnapshot {
  anchorId: string;
  kind: EntrypointAnchorKind;
  ownerId?: string;
  nodeIds?: string[];
  screen?: {
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
  flow?: {
    x: number;
    y: number;
  };
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

export interface HoverRegistry {
  nodeIdsByGroupId: Record<string, string[]>;
  targetNodeId: string | null;
}

export interface PendingUiAction {
  requestId: string;
  actionType: string;
  targetIds: string[];
  status: PendingUiActionStatus;
  startedAt: number;
  errorMessage?: string;
}

export interface EntrypointRuntimeState {
  activeTool: ActiveToolState;
  openSurface: OpenSurfaceDescriptor | null;
  anchorsById: Record<string, EntrypointAnchorSnapshot>;
  hover: HoverRegistry;
  pendingByRequestId: Record<string, PendingUiAction>;
}

export type EntrypointRuntimeSliceHost = {
  entrypointRuntime: EntrypointRuntimeState;
};

export const DEFAULT_ACTIVE_TOOL_STATE: ActiveToolState = {
  interactionMode: 'pointer',
  createMode: null,
};

export const DEFAULT_ENTRYPOINT_RUNTIME_STATE: EntrypointRuntimeState = {
  activeTool: DEFAULT_ACTIVE_TOOL_STATE,
  openSurface: null,
  anchorsById: {},
  hover: {
    nodeIdsByGroupId: {},
    targetNodeId: null,
  },
  pendingByRequestId: {},
};
