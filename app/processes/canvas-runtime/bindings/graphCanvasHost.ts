import React from 'react';
import type { Node as FlowNode } from 'reactflow';
import { FloatingToolbar } from '@/components/FloatingToolbar';
import type { GraphCanvasCreateMode } from '@/components/GraphCanvas.drag';
import type {
  GraphCanvasCreateIntentInput,
  GraphCanvasRenameIntentInput,
} from '@/components/GraphCanvas';
import { buildPaneMenuContext } from '@/features/canvas-ui-entrypoints/pane-context-menu';
import { createSlotContribution, resolveToolbarAnchor } from '@/features/overlay-host';
import type { EntrypointInteractionMode } from '@/features/canvas-ui-entrypoints/ui-runtime-state';
import type { ContextMenuActionsContext, ContextMenuContext } from '@/types/contextMenu';
import type { CreatableNodeType } from '@/types/contextMenu';
import type { MaterialPresetId } from '@/types/washiTape';
import type { ToolbarPresenterWashiPresetOption } from './toolbarPresenter';
import type { GraphCanvasHostBindingContract } from '../types';

export interface GraphCanvasHostContextMenuActionsInput {
  copyImageToClipboard: (nodeIds?: string[]) => Promise<void> | void;
  handleFitView: () => void;
  selectMindMapGroupByNodeId: (nodeId: string) => void;
  openExportDialog: (scope: 'selection' | 'full', selectedNodeIds?: string[]) => void;
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
  resolveNode: (nodeId: string) => FlowNode | undefined;
  resolveParentNodeId: (nodeId: string) => string | null;
  onRenameNode?: (input: GraphCanvasRenameIntentInput) => Promise<void> | void;
  onCreateNode?: (input: GraphCanvasCreateIntentInput) => Promise<void> | void;
  buildRenameIntent: (nodeId: string) => GraphCanvasRenameIntentInput;
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
    selectMindMapGroupByNodeId: input.selectMindMapGroupByNodeId,
    renameNode: (nodeId: string) => input.onRenameNode?.(input.buildRenameIntent(nodeId)),
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
  return {
    type: 'node',
    position: input.eventPosition,
    nodeId: input.node.id,
    nodeFamily: input.resolveNodeFamily(input.node),
    selectedNodeIds: input.selectedNodeIds.includes(input.node.id)
      ? input.selectedNodeIds
      : [input.node.id],
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
