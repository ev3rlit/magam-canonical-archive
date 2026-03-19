import React from 'react';
import type { Node as FlowNode } from 'reactflow';
import { FloatingToolbar } from '@/components/FloatingToolbar';
import type { GraphCanvasCreateMode } from '@/components/GraphCanvas.drag';
import type {
  GraphCanvasCreateIntentInput,
  GraphCanvasNodeMenuIntentInput,
  GraphCanvasRenameIntentInput,
} from '@/components/GraphCanvas';
import { SelectionFloatingMenu } from '@/features/canvas-ui-entrypoints/selection-floating-menu/SelectionFloatingMenu';
import { resolveSelectionFloatingMenuModel } from '@/features/canvas-ui-entrypoints/selection-floating-menu/selectionModel';
import {
  SELECTION_FLOATING_MENU_ANCHOR_ID,
  type SelectionFloatingMenuPresetOption,
  type SelectionFloatingMenuRenderModel,
  type SelectionFloatingMenuStylePatchKey,
} from '@/features/canvas-ui-entrypoints/selection-floating-menu/types';
import {
  createOpenSurfaceDescriptor,
  type EntrypointInteractionMode,
  type EntrypointRuntimeState,
  type OpenSurfaceDescriptor,
} from '@/features/canvas-ui-entrypoints/ui-runtime-state';
import {
  createSlotContribution,
  resolveToolbarAnchor,
  type OverlayContribution,
  type OverlayDismissReason,
  type OverlayInstanceState,
} from '@/features/overlay-host';
import type { ActionRoutingPendingRecord } from '@/features/editing/actionRoutingBridge/types';
import { buildPaneMenuContext } from '@/features/canvas-ui-entrypoints/pane-context-menu';
import type { ContextMenuActionsContext, ContextMenuContext } from '@/types/contextMenu';
import type { CreatableNodeType } from '@/types/contextMenu';
import type { MaterialPresetId } from '@/types/washiTape';
import { resolveNodeActionRoutingContext } from '@/components/editor/workspaceEditUtils';
import type { ToolbarPresenterWashiPresetOption } from './toolbarPresenter';
import type { GraphCanvasHostBindingContract } from '../types';

export interface GraphCanvasHostContextMenuActionsInput {
  copyImageToClipboard: (nodeIds?: string[]) => Promise<void> | void;
  handleFitView: () => void;
  openExportDialog: (scope: 'selection' | 'full', selectedNodeIds?: string[]) => void;
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
  resolveNode: (nodeId: string) => FlowNode | undefined;
  resolveParentNodeId: (nodeId: string) => string | null;
  onRenameNode?: (input: GraphCanvasRenameIntentInput) => Promise<void> | void;
  onDuplicateNode?: (input: GraphCanvasNodeMenuIntentInput) => Promise<void> | void;
  onDeleteNode?: (input: GraphCanvasNodeMenuIntentInput) => Promise<void> | void;
  onToggleNodeLock?: (input: GraphCanvasNodeMenuIntentInput) => Promise<void> | void;
  onSelectNodeGroup?: (input: GraphCanvasNodeMenuIntentInput) => Promise<void> | void;
  onCreateNode?: (input: GraphCanvasCreateIntentInput) => Promise<void> | void;
  buildRenameIntent: (nodeId: string) => GraphCanvasRenameIntentInput;
  buildNodeMenuIntent: (nodeId: string) => GraphCanvasNodeMenuIntentInput;
  buildCreateIntent: (input: GraphCanvasCreateIntentInput) => GraphCanvasCreateIntentInput;
}

export interface GraphCanvasToolbarContributionInput extends GraphCanvasHostBindingContract {
  interactionMode: EntrypointInteractionMode;
  setEntrypointInteractionMode: (mode: EntrypointInteractionMode) => void;
  createMode: GraphCanvasCreateMode;
  setEntrypointCreateMode: (mode: GraphCanvasCreateMode) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleFitView: () => void;
  washiPresets: ToolbarPresenterWashiPresetOption[];
  activeWashiPresetId: MaterialPresetId | null;
  selectedWashiNodeIds: string[];
  onSelectWashiPreset: (presetId: string) => void;
}

export interface GraphCanvasSelectionFloatingMenuContributionInput extends GraphCanvasHostBindingContract {
  nodes: FlowNode[];
  selectedNodeIds: string[];
  currentFile: string | null;
  activeTextEditNodeId: string | null;
  runtimeState: EntrypointRuntimeState;
  pendingActionRoutingByKey: Record<string, ActionRoutingPendingRecord>;
  washiPresets: SelectionFloatingMenuPresetOption[];
  onApplyStylePatch?: (input: {
    nodeIds: string[];
    patch: Record<string, unknown>;
    patchKey: SelectionFloatingMenuStylePatchKey;
  }) => Promise<void> | void;
  onCommitContent?: (input: {
    nodeId: string;
    content: string;
  }) => Promise<void> | void;
}

export interface GraphCanvasSelectionFloatingMenuSyncInput {
  activeOverlayId: string | null;
  contribution: OverlayContribution | null;
  currentOpenSurfaceKind: OpenSurfaceDescriptor['kind'] | null;
  getActiveOverlays: () => Array<Pick<OverlayInstanceState, 'instanceId'>>;
  openOverlayHost: (contribution: OverlayContribution) => string;
  replaceOverlayHost: (instanceId: string, contribution: OverlayContribution) => string;
  closeOverlayHost: (instanceId: string, reason: OverlayDismissReason) => void;
  openEntrypointSurface: (surface: OpenSurfaceDescriptor) => void;
  closeEntrypointSurface: () => void;
}

function resolveSelectionFloatingMenuAnchor(
  runtimeState: EntrypointRuntimeState,
): { type: 'selection-bounds'; x: number; y: number; width: number; height: number } | null {
  const anchor = runtimeState.anchorsById[SELECTION_FLOATING_MENU_ANCHOR_ID];
  if (anchor?.kind !== 'selection-bounds' || !anchor.screen) {
    return null;
  }

  return {
    type: 'selection-bounds',
    x: anchor.screen.x,
    y: anchor.screen.y,
    width: anchor.screen.width ?? 0,
    height: anchor.screen.height ?? 0,
  };
}

function filterSelectionFloatingMenuModelBySlotItems(
  model: SelectionFloatingMenuRenderModel,
  allowedItemIds: readonly string[],
): SelectionFloatingMenuRenderModel {
  const allowed = new Set(allowedItemIds);
  const controls = model.controls.filter((control) => allowed.has(control.inventory.itemId));
  const overflowControls = controls.filter(
    (control) => control.inventory.group === 'overflow' && control.visible,
  );
  const primaryControls = controls.filter((control) => (
    control.inventory.group === 'primary'
    && control.visible
    && (
      control.inventory.controlId !== 'more'
      || overflowControls.length > 0
    )
  ));

  return {
    ...model,
    controls,
    primaryControls,
    overflowControls,
  };
}

export function createGraphCanvasContextMenuActions(
  input: GraphCanvasHostContextMenuActionsInput,
): ContextMenuActionsContext {
  return {
    fitView: () => {
      input.handleFitView();
    },
    copyImageToClipboard: (ids?: string[]) => input.copyImageToClipboard(ids),
    openExportDialog: (scope: 'selection' | 'full', selectedNodeIds?: string[]) => {
      input.openExportDialog(scope, selectedNodeIds);
    },
    renameNode: (nodeId: string) => input.onRenameNode?.(input.buildRenameIntent(nodeId)),
    duplicateNode: (nodeId: string) => input.onDuplicateNode?.(input.buildNodeMenuIntent(nodeId)),
    deleteNode: (nodeId: string) => input.onDeleteNode?.(input.buildNodeMenuIntent(nodeId)),
    toggleNodeLock: (nodeId: string) => input.onToggleNodeLock?.(input.buildNodeMenuIntent(nodeId)),
    selectNodeGroup: (nodeId: string) => input.onSelectNodeGroup?.(input.buildNodeMenuIntent(nodeId)),
    createCanvasNode: (nodeType: CreatableNodeType, screenPosition: { x: number; y: number }) => {
      if (!input.onCreateNode) {
        return;
      }

      const position = input.screenToFlowPosition(screenPosition);
      return input.onCreateNode(input.buildCreateIntent({
        surfaceId: 'pane-context-menu',
        surface: 'pane-context-menu',
        trigger: { source: 'menu' },
        nodeType,
        placement: { mode: 'canvas-absolute', x: position.x, y: position.y },
      }));
    },
    createMindMapChild: (renderedNodeId: string) => {
      if (!input.onCreateNode) {
        return;
      }

      const targetNode = input.resolveNode(renderedNodeId);
      const sourceMeta = (targetNode?.data as { sourceMeta?: Record<string, unknown> } | undefined)?.sourceMeta;
      const parentId = typeof sourceMeta?.sourceId === 'string' ? sourceMeta.sourceId : renderedNodeId;
      return input.onCreateNode(input.buildCreateIntent({
        surfaceId: 'node-context-menu',
        surface: 'node-context-menu',
        trigger: { source: 'menu' },
        nodeType: 'shape',
        placement: { mode: 'mindmap-child', parentId },
        targetRenderedNodeId: renderedNodeId,
        filePath: typeof sourceMeta?.filePath === 'string' ? sourceMeta.filePath : undefined,
        scopeId: typeof sourceMeta?.scopeId === 'string' ? sourceMeta.scopeId : undefined,
        frameScope: typeof sourceMeta?.frameScope === 'string' ? sourceMeta.frameScope : undefined,
      }));
    },
    createMindMapSibling: (renderedNodeId: string) => {
      if (!input.onCreateNode) {
        return;
      }

      const targetNode = input.resolveNode(renderedNodeId);
      const sourceMeta = (targetNode?.data as { sourceMeta?: Record<string, unknown> } | undefined)?.sourceMeta;
      const parentNodeId = input.resolveParentNodeId(renderedNodeId);
      const parentNode = parentNodeId ? input.resolveNode(parentNodeId) : null;
      const parentSourceMeta = (parentNode?.data as { sourceMeta?: Record<string, unknown> } | undefined)?.sourceMeta;
      const parentId = parentSourceMeta && typeof parentSourceMeta.sourceId === 'string'
        ? parentSourceMeta.sourceId
        : null;
      const siblingOf = typeof sourceMeta?.sourceId === 'string' ? sourceMeta.sourceId : renderedNodeId;
      return input.onCreateNode(input.buildCreateIntent({
        surfaceId: 'node-context-menu',
        surface: 'node-context-menu',
        trigger: { source: 'menu' },
        nodeType: 'shape',
        placement: { mode: 'mindmap-sibling', siblingOf, parentId },
        targetRenderedNodeId: renderedNodeId,
        filePath: typeof sourceMeta?.filePath === 'string' ? sourceMeta.filePath : undefined,
        scopeId: typeof sourceMeta?.scopeId === 'string' ? sourceMeta.scopeId : undefined,
        frameScope: typeof sourceMeta?.frameScope === 'string' ? sourceMeta.frameScope : undefined,
      }));
    },
  };
}

export function createGraphCanvasNodeContextMenu(input: {
  eventPosition: { x: number; y: number };
  node: FlowNode;
  selectedNodeIds: string[];
  resolveNodeFamily: (node: FlowNode) => string | undefined;
  actions: ContextMenuActionsContext;
}): ContextMenuContext {
  const selectedNodeIds = input.selectedNodeIds.includes(input.node.id)
    ? input.selectedNodeIds
    : [input.node.id];

  return {
    type: 'node',
    position: input.eventPosition,
    nodeId: input.node.id,
    nodeFamily: input.resolveNodeFamily(input.node),
    nodeContext: resolveNodeActionRoutingContext(input.node, null, selectedNodeIds),
    selectedNodeIds,
    actions: input.actions,
  };
}

export function createGraphCanvasPaneContextMenu(input: {
  eventPosition: { x: number; y: number };
  selectedNodeIds: string[];
  canCreateNode: boolean;
  actions: ContextMenuActionsContext;
}): ContextMenuContext {
  return buildPaneMenuContext({
    position: input.eventPosition,
    selectedNodeIds: input.selectedNodeIds,
    canCreateNode: input.canCreateNode,
    actions: input.actions,
  });
}

export function createGraphCanvasSelectionFloatingMenuContribution(
  input: GraphCanvasSelectionFloatingMenuContributionInput,
): OverlayContribution | null {
  if (input.selectionFloatingMenuSlot.items.length === 0) {
    return null;
  }

  if (input.activeTextEditNodeId) {
    return null;
  }

  const anchor = resolveSelectionFloatingMenuAnchor(input.runtimeState);
  if (!anchor) {
    return null;
  }

  const model = filterSelectionFloatingMenuModelBySlotItems(
    resolveSelectionFloatingMenuModel({
      nodes: input.nodes,
      selectedNodeIds: input.selectedNodeIds,
      currentFile: input.currentFile,
      runtimeState: input.runtimeState,
      pendingActionRoutingByKey: input.pendingActionRoutingByKey,
    }),
    input.selectionFloatingMenuSlot.items.map((item) => item.itemId),
  );

  if (!model.visible || (model.primaryControls.length === 0 && model.overflowControls.length === 0)) {
    return null;
  }

  return createSlotContribution(input.selectionFloatingMenuSlot.overlaySlot, {
    anchor,
    focusPolicy: {
      openTarget: 'none',
      restoreTarget: 'none',
    },
    render: () => React.createElement(SelectionFloatingMenu, {
      model,
      washiPresets: input.washiPresets,
      onApplyStylePatch: input.onApplyStylePatch,
      onCommitContent: input.onCommitContent,
    }),
  });
}

export function syncGraphCanvasSelectionFloatingMenuOverlay(
  input: GraphCanvasSelectionFloatingMenuSyncInput,
): string | null {
  const activeId = input.activeOverlayId;
  const hasActiveOverlay = Boolean(
    activeId && input.getActiveOverlays().some((overlay) => overlay.instanceId === activeId),
  );

  if (!input.contribution) {
    if (hasActiveOverlay && activeId) {
      input.closeOverlayHost(activeId, 'programmatic-close');
    }
    if (input.currentOpenSurfaceKind === 'selection-floating-menu') {
      input.closeEntrypointSurface();
    }
    return null;
  }

  if (
    input.currentOpenSurfaceKind === null
    || input.currentOpenSurfaceKind === 'selection-floating-menu'
  ) {
    input.openEntrypointSurface(createOpenSurfaceDescriptor({
      kind: 'selection-floating-menu',
      anchorId: SELECTION_FLOATING_MENU_ANCHOR_ID,
      dismissOnSelectionChange: true,
      dismissOnViewportChange: false,
    }));
  }

  if (hasActiveOverlay && activeId) {
    return input.replaceOverlayHost(activeId, input.contribution);
  }

  return input.openOverlayHost(input.contribution);
}

export function createGraphCanvasToolbarContribution(input: GraphCanvasToolbarContributionInput) {
  return createSlotContribution(input.toolbarSlot.overlaySlot, {
    anchor: resolveToolbarAnchor(
      typeof window !== 'undefined'
        ? { width: window.innerWidth, height: window.innerHeight }
        : { width: 1024, height: 768 },
    ),
    focusPolicy: {
      openTarget: 'none',
      restoreTarget: 'none',
    },
    render: () => React.createElement(FloatingToolbar, {
      positioning: 'hosted',
      interactionMode: input.interactionMode,
      onInteractionModeChange: input.setEntrypointInteractionMode,
      createMode: input.createMode,
      onCreateModeChange: input.setEntrypointCreateMode,
      onZoomIn: input.handleZoomIn,
      onZoomOut: input.handleZoomOut,
      onFitView: input.handleFitView,
      washiPresets: input.washiPresets,
      washiPresetEnabled: input.selectedWashiNodeIds.length > 0,
      activeWashiPresetId: input.activeWashiPresetId,
      onSelectWashiPreset: input.onSelectWashiPreset,
    }),
  });
}
