import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  OnSelectionChangeParams,
  Node as FlowNode,
  useNodesInitialized,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useGraphStore } from '@/store/graph';
import StickyNode from './nodes/StickyNode';
import ShapeNode from './nodes/ShapeNode';
import TextNode from './nodes/TextNode';
import ImageNode from './nodes/ImageNode';
import StickerNode from './nodes/StickerNode';
import WashiTapeNode from './nodes/WashiTapeNode';
import MarkdownNode from './nodes/MarkdownNode';
import SequenceDiagramNode from './nodes/SequenceDiagramNode';
import PluginNode from './nodes/PluginNode';
import PluginFallbackNode from './nodes/PluginFallbackNode';
import FloatingEdge from './edges/FloatingEdge';
import { useLayout } from '../hooks/useLayout';
import { resolveAnchors } from '@/utils/anchorResolver';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { ZoomProvider, useZoom } from '@/contexts/ZoomContext';
import { BubbleProvider } from '@/contexts/BubbleContext';
import { BubbleOverlay } from './BubbleOverlay';
import { Loader2, Check } from 'lucide-react';
import { useExportImage } from '@/hooks/useExportImage';
import { useContextMenu } from '@/hooks/useContextMenu';
import { ExportDialog } from './ExportDialog';
import { CustomBackground } from './CustomBackground';
import {
  resolveViewportToRestore,
  toTabViewportState,
} from './GraphCanvas.viewport';
import { resolveFontFamilyCssValue } from '@/utils/fontHierarchy';
import { areNodesMeasured, getMindMapSizeSignaturesByGroup } from '@/utils/layoutUtils';
import {
  AUTO_RELAYOUT_COOLDOWN_MS,
  AUTO_RELAYOUT_DEBOUNCE_MS,
  AUTO_RELAYOUT_MAX_ATTEMPTS,
  AUTO_RELAYOUT_QUANTIZATION_PX,
  getChangedMindMapGroupIds,
  getEligibleAutoRelayoutGroupIds,
  shouldScheduleAutoRelayout,
} from './GraphCanvas.relayout';
import {
  type GraphSnapshot,
  type GraphClipboardPayload,
} from '@/utils/clipboardGraph';
import { editDebugLog } from '@/utils/editDebug';
import { getWashiPresetPatternCatalog } from '@/utils/washiTapeDefaults';
import {
  createEntrypointAnchor,
  type EntrypointInteractionMode,
} from '@/features/canvas-ui-entrypoints/ui-runtime-state';
import type { CanvasEntrypointSurface } from '@/features/canvas-ui-entrypoints/contracts';
import {
  resolveMindMapDragFeedback,
  resolvePointerTypeFromEvent,
  shouldCommitDragStop,
  shouldHandlePaneCreate,
  shouldSuppressDragStopErrorToast,
  type GraphCanvasCreateMode,
} from './GraphCanvas.drag';
import type { ActionRoutingSurfaceId } from '@/features/editing/actionRoutingBridge/types';
import { createPendingRequestIdForCommand } from '@/features/editing/commands';
import type { CreatePayload } from '@/features/editing/commands';
import { resolveNodeEditContext } from '@/components/editor/workspaceEditUtils';
import type { CreatableNodeType } from '@/types/contextMenu';
import {
  OverlayHostProvider,
  useOverlayHost,
} from '@/features/overlay-host';
import { PluginRuntimeProvider } from '@/features/plugin-runtime';
import { canvasRuntime } from '@/processes/canvas-runtime/createCanvasRuntime';
import {
  createGraphCanvasContextMenuActions,
  createGraphCanvasNodeContextMenu,
  createGraphCanvasPaneContextMenu,
  createGraphCanvasSelectionFloatingMenuContribution,
  createGraphCanvasToolbarContribution,
  syncGraphCanvasSelectionFloatingMenuOverlay,
} from '@/processes/canvas-runtime/bindings/graphCanvasHost';
import { createGraphCanvasKeyboardHost } from '@/processes/canvas-runtime/bindings/keyboardHost';
import type { SelectionFloatingMenuStylePatchKey } from '@/features/canvas-ui-entrypoints/selection-floating-menu/types';

type GraphCanvasProps = {
  onNodeDragStop?: (payload: {
    nodeId: string;
    x: number;
    y: number;
    originX: number;
    originY: number;
  }) => Promise<void> | void;
  onUndoEditStep?: () => Promise<boolean> | boolean;
  onRedoEditStep?: () => Promise<boolean> | boolean;
  mapEditErrorToToast?: (error: unknown) => string | null;
  onRenameNode?: (input: GraphCanvasRenameIntentInput) => Promise<void> | void;
  onDuplicateNode?: (input: GraphCanvasNodeMenuIntentInput) => Promise<void> | void;
  onDeleteNode?: (input: GraphCanvasNodeMenuIntentInput) => Promise<void> | void;
  onToggleNodeLock?: (input: GraphCanvasNodeMenuIntentInput) => Promise<void> | void;
  onSelectNodeGroup?: (input: GraphCanvasNodeMenuIntentInput) => Promise<void> | void;
  onCreateNode?: (input: GraphCanvasCreateIntentInput) => Promise<void> | void;
  onApplySelectionStyle?: (input: {
    nodeIds: string[];
    patch: Record<string, unknown>;
    patchKey: SelectionFloatingMenuStylePatchKey;
  }) => Promise<void> | void;
  onCommitSelectionContent?: (input: {
    nodeId: string;
    content: string;
  }) => Promise<void> | void;
};

export interface GraphCanvasNodeMenuIntentInput {
  nodeId: string;
  surfaceId: ActionRoutingSurfaceId;
  surface?: Extract<CanvasEntrypointSurface, 'node-context-menu'>;
  trigger?: { source: 'menu' };
}

export type GraphCanvasRenameIntentInput = GraphCanvasNodeMenuIntentInput;

export interface GraphCanvasCreateIntentInput {
  surfaceId: Exclude<ActionRoutingSurfaceId, 'selection-floating-menu'>;
  surface?: Exclude<CanvasEntrypointSurface, 'selection-floating-menu'>;
  trigger?: { source: 'click' | 'menu' };
  nodeType: CreatableNodeType;
  placement: CreatePayload['placement'];
  targetRenderedNodeId?: string;
  targetNodeId?: string;
  filePath?: string;
  scopeId?: string;
  frameScope?: string;
}

export function buildGraphCanvasNodeMenuIntent(nodeId: string): GraphCanvasNodeMenuIntentInput {
  return {
    nodeId,
    surfaceId: 'node-context-menu',
    surface: 'node-context-menu',
    trigger: { source: 'menu' },
  };
}

export function buildGraphCanvasRenameIntent(nodeId: string): GraphCanvasRenameIntentInput {
  return buildGraphCanvasNodeMenuIntent(nodeId);
}

export function buildGraphCanvasCreateIntent(
  input: GraphCanvasCreateIntentInput,
): GraphCanvasCreateIntentInput {
  const surface = input.surface
    ?? (input.surfaceId === 'toolbar'
      ? 'canvas-toolbar'
      : input.surfaceId);
  const trigger = input.trigger
    ?? { source: surface === 'canvas-toolbar' ? 'click' as const : 'menu' as const };

  return {
    ...input,
    surface,
    trigger,
    targetNodeId: input.targetNodeId ?? input.targetRenderedNodeId,
  };
}

type DragOriginState = {
  x: number;
  y: number;
  generation: number;
  pointerType: 'mouse' | 'pen' | 'touch' | 'unknown';
};

type DragFeedbackState =
  | { kind: 'reparent-ready'; parentLabel: string }
  | { kind: 'reparent-hint' }
  | null;

function getCanvasNodeLabel(node: Pick<FlowNode, 'id' | 'data'> | null | undefined): string {
  if (!node) {
    return '새 부모';
  }

  const data = (node.data || {}) as Record<string, unknown>;
  const label = typeof data.label === 'string' && data.label.trim().length > 0
    ? data.label.trim()
    : node.id;

  return label.length > 24 ? `${label.slice(0, 24)}...` : label;
}

type SelectionAnchorNode = Pick<FlowNode, 'id' | 'position' | 'width' | 'height' | 'data'> & {
  measured?: {
    width?: number;
    height?: number;
  };
};

type CanvasDismissNode = Pick<FlowNode, 'id' | 'data'>;
type SelectionShellNode = SelectionAnchorNode & Pick<FlowNode, 'type' | 'data'>;

type SelectionShellGestureState = 'move' | 'resize' | 'rotate' | null;

type SelectionShellGestureSession =
  | {
      kind: 'resize';
      nodeId: string;
      originScreen: { x: number; y: number };
      originalData: Record<string, unknown>;
      zoom: number;
      lastPatch: Record<string, unknown> | null;
    }
  | {
      kind: 'rotate';
      nodeId: string;
      originalData: Record<string, unknown>;
      screenBounds: NonNullable<GraphCanvasSelectionShellState['screenBounds']>;
      lastPatch: Record<string, unknown> | null;
    };

export type GraphCanvasDismissalKind =
  | 'commit-text-edit'
  | 'cancel-text-edit'
  | 'expand-group-selection'
  | 'clear-selection'
  | 'noop';

export interface GraphCanvasDismissalDecision {
  kind: GraphCanvasDismissalKind;
  nodeIds?: string[];
  activeTextEditNodeId?: string;
}

export interface GraphCanvasSelectionShellState {
  visible: boolean;
  canResize: boolean;
  canRotate: boolean;
  activeGesture: 'move' | 'resize' | 'rotate' | null;
  screenBounds: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function resolveSelectionNodeDimensions(
  node: Pick<SelectionAnchorNode, 'width' | 'height' | 'measured' | 'data'>,
) {
  const nodeData = (node.data || {}) as Record<string, unknown>;
  const width = node.width
    ?? node.measured?.width
    ?? readFiniteNumber(nodeData.width)
    ?? 0;
  const height = node.height
    ?? node.measured?.height
    ?? readFiniteNumber(nodeData.height)
    ?? 0;
  return { width, height };
}

function resolveSelectionBounds(input: {
  selectedNodes: SelectionAnchorNode[];
}) {
  if (input.selectedNodes.length === 0) {
    return null;
  }

  return input.selectedNodes.reduce((acc, node) => {
    const { width, height } = resolveSelectionNodeDimensions(node);
    const minX = Math.min(acc.minX, node.position.x);
    const minY = Math.min(acc.minY, node.position.y);
    const maxX = Math.max(acc.maxX, node.position.x + width);
    const maxY = Math.max(acc.maxY, node.position.y + height);
    return { minX, minY, maxX, maxY };
  }, {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  });
}

function resolveNodeGroupSelection(nodeIds: string[], nodes: CanvasDismissNode[]): string[] | null {
  if (nodeIds.length === 0) {
    return null;
  }

  const selectedNodes = nodes.filter((node) => nodeIds.includes(node.id));
  if (selectedNodes.length !== nodeIds.length) {
    return null;
  }

  const groupIds = selectedNodes.map((node) => {
    const data = (node.data || {}) as Record<string, unknown>;
    return typeof data.groupId === 'string' && data.groupId.length > 0
      ? data.groupId
      : null;
  });

  const primaryGroupId = groupIds[0];
  if (!primaryGroupId || groupIds.some((groupId) => groupId !== primaryGroupId)) {
    return null;
  }

  const groupedNodeIds = nodes
    .filter((node) => {
      const data = (node.data || {}) as Record<string, unknown>;
      return data.groupId === primaryGroupId;
    })
    .map((node) => node.id);

  if (groupedNodeIds.length <= nodeIds.length) {
    return null;
  }

  return groupedNodeIds;
}

function resolveSelectionShellCapabilities(node: SelectionShellNode | undefined) {
  if (!node) {
    return {
      canResize: false,
      canRotate: false,
    };
  }

  const nodeData = (node.data || {}) as Record<string, unknown>;
  const editMeta = (
    nodeData.editMeta && typeof nodeData.editMeta === 'object'
      ? nodeData.editMeta as { styleEditableKeys?: unknown }
      : null
  );
  const styleEditableKeys = Array.isArray(editMeta?.styleEditableKeys)
    ? editMeta.styleEditableKeys.filter((value): value is string => typeof value === 'string')
    : [];
  const canResize = (
    styleEditableKeys.includes('width')
    && styleEditableKeys.includes('height')
  ) || node.type === 'image' || node.type === 'sticker';
  const canRotate = styleEditableKeys.includes('rotation')
    || node.type === 'sticker'
    || (typeof nodeData.rotation === 'number' && Number.isFinite(nodeData.rotation));

  return {
    canResize,
    canRotate,
  };
}

export function buildSelectionBoundsAnchor(input: {
  selectedNodes: SelectionAnchorNode[];
  viewport: { x: number; y: number; zoom: number };
}) {
  if (input.selectedNodes.length === 0) {
    return null;
  }

  const bounds = resolveSelectionBounds({
    selectedNodes: input.selectedNodes,
  });
  if (!bounds) {
    return null;
  }

  return createEntrypointAnchor({
    anchorId: 'selection-floating-menu:selection-bounds',
    kind: 'selection-bounds',
    nodeIds: input.selectedNodes.map((node) => node.id),
    flow: { x: bounds.minX, y: bounds.minY },
    screen: {
      x: bounds.minX,
      y: bounds.minY,
      width: Math.max(bounds.maxX - bounds.minX, 0),
      height: Math.max(bounds.maxY - bounds.minY, 0),
    },
    viewport: input.viewport,
  });
}

export function resolveCanvasDismissal(input: {
  reason: 'escape' | 'pane';
  activeTextEditNodeId: string | null;
  selectedNodeIds: string[];
  nodes: CanvasDismissNode[];
}): GraphCanvasDismissalDecision {
  if (input.activeTextEditNodeId) {
    return {
      kind: input.reason === 'pane' ? 'commit-text-edit' : 'cancel-text-edit',
      activeTextEditNodeId: input.activeTextEditNodeId,
    };
  }

  const groupedSelection = resolveNodeGroupSelection(input.selectedNodeIds, input.nodes);
  if (groupedSelection) {
    return {
      kind: 'expand-group-selection',
      nodeIds: groupedSelection,
    };
  }

  if (input.selectedNodeIds.length > 0) {
    return {
      kind: 'clear-selection',
    };
  }

  return {
    kind: 'noop',
  };
}

export function resolveSelectionShellState(input: {
  selectedNodes: SelectionShellNode[];
  viewport: { x: number; y: number; zoom: number };
  activeGesture?: 'move' | 'resize' | 'rotate' | null;
}): GraphCanvasSelectionShellState {
  const bounds = resolveSelectionBounds({
    selectedNodes: input.selectedNodes,
  });
  if (!bounds) {
    return {
      visible: false,
      canResize: false,
      canRotate: false,
      activeGesture: input.activeGesture ?? null,
      screenBounds: null,
    };
  }

  const primaryNode = input.selectedNodes.length === 1
    ? input.selectedNodes[0]
    : undefined;
  const capabilities = resolveSelectionShellCapabilities(primaryNode);
  const zoom = input.viewport.zoom || 1;

  return {
    visible: true,
    canResize: capabilities.canResize,
    canRotate: capabilities.canRotate,
    activeGesture: input.activeGesture ?? null,
    screenBounds: {
      left: bounds.minX * zoom + input.viewport.x,
      top: bounds.minY * zoom + input.viewport.y,
      width: Math.max((bounds.maxX - bounds.minX) * zoom, 0),
      height: Math.max((bounds.maxY - bounds.minY) * zoom, 0),
    },
  };
}

export function resolveSelectionResizePatch(input: {
  node: SelectionShellNode;
  deltaScreen: { x: number; y: number };
  zoom: number;
}): Record<string, unknown> | null {
  const capabilities = resolveSelectionShellCapabilities(input.node);
  if (!capabilities.canResize) {
    return null;
  }

  const { width, height } = resolveSelectionNodeDimensions(input.node);
  const zoom = input.zoom > 0 ? input.zoom : 1;
  return {
    width: Math.max(48, Math.round(width + (input.deltaScreen.x / zoom))),
    height: Math.max(48, Math.round(height + (input.deltaScreen.y / zoom))),
  };
}

export function resolveSelectionRotation(input: {
  node: SelectionShellNode;
  screenBounds: NonNullable<GraphCanvasSelectionShellState['screenBounds']>;
  pointerScreen: { x: number; y: number };
}): number | null {
  const capabilities = resolveSelectionShellCapabilities(input.node);
  if (!capabilities.canRotate) {
    return null;
  }

  const centerX = input.screenBounds.left + (input.screenBounds.width / 2);
  const centerY = input.screenBounds.top + (input.screenBounds.height / 2);
  const angle = (Math.atan2(
    input.pointerScreen.y - centerY,
    input.pointerScreen.x - centerX,
  ) * 180) / Math.PI;
  return Math.round((angle + 450) % 360);
}

function areSelectionIdsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const leftSet = new Set(left);
  return right.every((value) => leftSet.has(value));
}

export function shouldHandleRuntimePaneCreate(input: {
  interactionMode: EntrypointInteractionMode;
  createMode: GraphCanvasCreateMode;
  hasPendingUiActions: boolean;
}) {
  if (input.hasPendingUiActions) {
    return false;
  }

  return shouldHandlePaneCreate({
    interactionMode: input.interactionMode,
    createMode: input.createMode,
  });
}

function GraphCanvasContent({
  onNodeDragStop,
  onUndoEditStep,
  onRedoEditStep,
  mapEditErrorToToast,
  onRenameNode,
  onDuplicateNode,
  onDeleteNode,
  onToggleNodeLock,
  onSelectNodeGroup,
  onCreateNode,
  onApplySelectionStyle,
  onCommitSelectionContent,
}: GraphCanvasProps) {
  const nodeTypes = useMemo(
    () => ({
      sticky: StickyNode,
      shape: ShapeNode,
      text: TextNode,
      image: ImageNode,
      sticker: StickerNode,
      'washi-tape': WashiTapeNode,
      markdown: MarkdownNode,
      'sequence-diagram': SequenceDiagramNode,
      plugin: PluginNode,
      'plugin-fallback': PluginFallbackNode,
    }),
    [],
  );

  const edgeTypes = useMemo(
    () => ({
      floating: FloatingEdge,
      default: FloatingEdge, // Use floating edge as default
    }),
    [],
  );

  const {
    nodes,
    edges,
    selectedNodeIds,
    activeTextEditNodeId,
    onNodesChange,
    onEdgesChange,
    setSelectedNodes,
    selectNodesByType,
    focusNextNodeByType,
    currentFile,
    graphId,
    needsAutoLayout,
    layoutType,
    mindMapGroups,
    canvasBackground,
    globalFontFamily,
    canvasFontFamily,
    activeTabId,
    openTabs,
    updateTabSnapshot,
    requestTextEditCommit,
    requestTextEditCancel,
    entrypointRuntime,
    setEntrypointInteractionMode,
    setEntrypointCreateMode,
    openEntrypointSurface,
    closeEntrypointSurface,
    dismissEntrypointSurfaceOnViewportChange,
    registerEntrypointAnchor,
    clearEntrypointAnchor,
    clearEntrypointAnchorsForNode,
    beginPendingUiAction,
    commitPendingUiAction,
    failPendingUiAction,
    clearPendingUiAction,
    pendingActionRoutingByKey,
  } = useGraphStore();
  const interactionMode = entrypointRuntime.activeTool.interactionMode;
  const createMode = entrypointRuntime.activeTool.createMode;
  const hasPendingUiActions = Object.keys(entrypointRuntime.pendingByRequestId).length > 0;

  const { isZoomBold } = useZoom();

  const canvasResolvedFontFamily = useMemo(
    () => resolveFontFamilyCssValue({ canvasFontFamily, globalFontFamily }),
    [canvasFontFamily, globalFontFamily],
  );

  const { calculateLayout, isLayouting } = useLayout();
  const nodesInitialized = useNodesInitialized();
  const { zoomIn, zoomOut, fitView, getZoom, setNodes, getNodes, getViewport, setViewport, screenToFlowPosition } = useReactFlow();
  const {
    open: openOverlayHost,
    replace: replaceOverlayHost,
    close: closeOverlayHost,
    getActive: getActiveOverlays,
  } = useOverlayHost();
  const { openMenu, handleSelectionChange } = useContextMenu();
  const { copyImageToClipboard } = useExportImage();
  const [exportDialog, setExportDialog] = useState<{
    isOpen: boolean;
    defaultArea: 'selection' | 'full';
    selectedNodeIds?: string[];
  }>({
    isOpen: false,
    defaultArea: 'full',
  });
  const [isGraphVisible, setIsGraphVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dragFeedback, setDragFeedback] = useState<DragFeedbackState>(null);
  const [selectionShellGesture, setSelectionShellGesture] = useState<SelectionShellGestureState>(null);
  const hasLayouted = useRef(false);
  const lastLayoutedGraphId = useRef<string | null>(null);
  const lastSizeSignaturesRef = useRef<Map<string, string>>(new Map());
  const relayoutCountRef = useRef<Map<string, number>>(new Map());
  const relayoutTimerRef = useRef<number | null>(null);
  const relayoutInFlightRef = useRef(false);
  const lastRelayoutAtRef = useRef<Map<string, number>>(new Map());
  const previousFileRef = useRef<string | null>(currentFile);
  const pendingViewportRestoreRef = useRef<{ x: number; y: number; zoom: number } | null>(null);
  const clipboardHistory = useRef<{ past: GraphSnapshot[]; future: GraphSnapshot[] }>({
    past: [],
    future: [],
  });
  const graphClipboardRef = useRef<{ payload: GraphClipboardPayload; text: string } | null>(null);
  const dragOriginPositions = useRef<Map<string, DragOriginState>>(new Map());
  const dragGenerationRef = useRef<Map<string, number>>(new Map());
  const previousNodeIdsRef = useRef<Set<string>>(new Set());
  const toolbarOverlayIdRef = useRef<string | null>(null);
  const selectionFloatingMenuOverlayIdRef = useRef<string | null>(null);
  const selectionShellGestureRef = useRef<SelectionShellGestureSession | null>(null);
  const washiPresets = useMemo(() => getWashiPresetPatternCatalog(), []);

  const activeTab = useMemo(
    () => openTabs.find((tab) => tab.tabId === activeTabId) ?? null,
    [activeTabId, openTabs],
  );

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2000);
  }, []);

  const selectionNodes = useMemo(
    () => nodes.filter((node) => selectedNodeIds.includes(node.id)) as SelectionShellNode[],
    [nodes, selectedNodeIds],
  );
  const selectionShell = resolveSelectionShellState({
    selectedNodes: selectionNodes,
    viewport: getViewport(),
    activeGesture: selectionShellGesture,
  });

  const syncControlledSelection = useCallback((nodeIds: string[]) => {
    setNodes((prev) => prev.map((node) => {
      const shouldSelect = nodeIds.includes(node.id);
      return node.selected === shouldSelect
        ? node
        : { ...node, selected: shouldSelect };
    }));
    setSelectedNodes(nodeIds);
    if (!activeTabId) {
      return;
    }
    updateTabSnapshot(activeTabId, {
      lastSelection: nodeIds.length > 0
        ? {
            nodeIds,
            edgeIds: [],
            updatedAt: Date.now(),
          }
        : null,
    });
  }, [activeTabId, setNodes, setSelectedNodes, updateTabSnapshot]);

  const restoreSelectionNodePreview = useCallback((nodeId: string, originalData: Record<string, unknown>) => {
    useGraphStore.setState((state) => ({
      nodes: state.nodes.map((node) => (
        node.id === nodeId
          ? { ...node, data: originalData }
          : node
      )),
    }));
  }, []);

  const clearSelectionShellGesture = useCallback(() => {
    selectionShellGestureRef.current = null;
    setSelectionShellGesture(null);
  }, []);

  const handleSelectionStylePatch = useCallback(async (input: {
    nodeIds: string[];
    patch: Record<string, unknown>;
    patchKey: SelectionFloatingMenuStylePatchKey;
  }) => {
    if (!onApplySelectionStyle) {
      return;
    }

    try {
      await Promise.resolve(onApplySelectionStyle(input));
    } catch (error) {
      const mapped = mapEditErrorToToast?.(error);
      showToast(mapped ?? '스타일 저장에 실패했습니다.');
      throw error;
    }
  }, [mapEditErrorToToast, onApplySelectionStyle, showToast]);

  const handleSelectionContentCommit = useCallback(async (input: {
    nodeId: string;
    content: string;
  }) => {
    if (!onCommitSelectionContent) {
      return;
    }

    try {
      await Promise.resolve(onCommitSelectionContent(input));
      showToast('텍스트를 업데이트했습니다.');
    } catch (error) {
      const mapped = mapEditErrorToToast?.(error);
      showToast(mapped ?? '텍스트 저장에 실패했습니다.');
      throw error;
    }
  }, [mapEditErrorToToast, onCommitSelectionContent, showToast]);

  const runPendingUiAction = useCallback(async <T,>(input: {
    actionType: Parameters<typeof createPendingRequestIdForCommand>[0];
    targetIds: string[];
    execute: () => Promise<T>;
  }): Promise<T> => {
    const requestId = createPendingRequestIdForCommand(input.actionType, input.targetIds[0]);
    beginPendingUiAction({
      requestId,
      actionType: input.actionType,
      targetIds: input.targetIds,
    });

    try {
      const result = await input.execute();
      commitPendingUiAction(requestId);
      clearPendingUiAction(requestId);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      failPendingUiAction(requestId, errorMessage);
      clearPendingUiAction(requestId);
      throw error;
    }
  }, [
    beginPendingUiAction,
    clearPendingUiAction,
    commitPendingUiAction,
    failPendingUiAction,
  ]);

  const clearPendingRelayout = useCallback(() => {
    if (relayoutTimerRef.current !== null) {
      window.clearTimeout(relayoutTimerRef.current);
      relayoutTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    clearPendingRelayout();
  }, [clearPendingRelayout]);

  const persistActiveTabViewport = useCallback((viewport: { x: number; y: number; zoom: number }) => {
    if (!activeTabId) {
      return;
    }

    updateTabSnapshot(activeTabId, {
      lastViewport: toTabViewportState(viewport),
    });
  }, [activeTabId, updateTabSnapshot]);

  const restorePendingViewport = useCallback(async () => {
    const pending = pendingViewportRestoreRef.current;
    if (!pending) {
      return false;
    }

    pendingViewportRestoreRef.current = null;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        void setViewport(pending, { duration: 0 });
        persistActiveTabViewport(pending);
        resolve();
      });
    });
    return true;
  }, [persistActiveTabViewport, setViewport]);

  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 300 });
    setTimeout(() => {
      persistActiveTabViewport(getViewport());
      showToast(`Zoom: ${Math.round(getZoom() * 100)}%`);
    }, 350);
  }, [getViewport, getZoom, persistActiveTabViewport, showToast, zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 300 });
    setTimeout(() => {
      persistActiveTabViewport(getViewport());
      showToast(`Zoom: ${Math.round(getZoom() * 100)}%`);
    }, 350);
  }, [getViewport, getZoom, persistActiveTabViewport, showToast, zoomOut]);

  const handleFitView = useCallback(() => {
    fitView({ duration: 300 });
    setTimeout(() => {
      persistActiveTabViewport(getViewport());
      showToast('Fit to view');
    }, 350);
  }, [fitView, getViewport, persistActiveTabViewport, showToast]);

  const contextMenuActions = useMemo(() => createGraphCanvasContextMenuActions({
    copyImageToClipboard,
    handleFitView,
    openExportDialog: (scope: 'selection' | 'full', selectedNodeIds?: string[]) => {
      setExportDialog({
        isOpen: true,
        defaultArea: scope === 'selection' ? 'selection' : 'full',
        selectedNodeIds: scope === 'selection' ? selectedNodeIds : undefined,
      });
    },
    screenToFlowPosition,
    resolveNode: (nodeId: string) => useGraphStore.getState().nodes.find((item) => item.id === nodeId),
    resolveParentNodeId: (nodeId: string) => {
      const runtime = useGraphStore.getState();
      return runtime.edges.find((edge) => edge.target === nodeId)?.source ?? null;
    },
    onRenameNode,
    onDuplicateNode,
    onDeleteNode,
    onToggleNodeLock,
    onSelectNodeGroup,
    onCreateNode,
    buildRenameIntent: buildGraphCanvasRenameIntent,
    buildNodeMenuIntent: buildGraphCanvasNodeMenuIntent,
    buildCreateIntent: buildGraphCanvasCreateIntent,
  }), [
    copyImageToClipboard,
    handleFitView,
    onCreateNode,
    onDeleteNode,
    onDuplicateNode,
    onRenameNode,
    onSelectNodeGroup,
    onToggleNodeLock,
    screenToFlowPosition,
  ]);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: FlowNode) => {
      event.preventDefault();
      const runtime = useGraphStore.getState();
      openMenu(createGraphCanvasNodeContextMenu({
        eventPosition: { x: event.clientX, y: event.clientY },
        node,
        selectedNodeIds: runtime.selectedNodeIds,
        resolveNodeFamily: (resolvedNode) => (
          resolveNodeEditContext(resolvedNode, useGraphStore.getState().currentFile).editMeta?.family
        ),
        actions: contextMenuActions,
      }), {
        triggerElement: event.currentTarget as HTMLElement,
      });
    },
    [openMenu, contextMenuActions],
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      const runtime = useGraphStore.getState();
      openMenu(createGraphCanvasPaneContextMenu({
        eventPosition: { x: event.clientX, y: event.clientY },
        selectedNodeIds: runtime.selectedNodeIds,
        canCreateNode: typeof runtime.currentFile === 'string' && runtime.currentFile.length > 0,
        actions: contextMenuActions,
      }), {
        triggerElement: event.currentTarget as HTMLElement,
      });
    },
    [contextMenuActions, openMenu],
  );

  const onPaneClick = useCallback(
    async (event: React.MouseEvent) => {
      if (!shouldHandleRuntimePaneCreate({ interactionMode, createMode, hasPendingUiActions }) || !onCreateNode) {
        const dismissal = resolveCanvasDismissal({
          reason: 'pane',
          activeTextEditNodeId,
          selectedNodeIds,
          nodes: useGraphStore.getState().nodes,
        });

        if (dismissal.kind === 'commit-text-edit' && dismissal.activeTextEditNodeId) {
          requestTextEditCommit(dismissal.activeTextEditNodeId);
          return;
        }
        if (dismissal.kind === 'cancel-text-edit' && dismissal.activeTextEditNodeId) {
          requestTextEditCancel(dismissal.activeTextEditNodeId);
          return;
        }
        if (dismissal.kind === 'expand-group-selection' && dismissal.nodeIds) {
          syncControlledSelection(dismissal.nodeIds);
          return;
        }
        if (dismissal.kind === 'clear-selection') {
          syncControlledSelection([]);
        }
        return;
      }

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      try {
        await runPendingUiAction({
          actionType: 'node.create',
          targetIds: [createMode],
          execute: () => Promise.resolve(onCreateNode(buildGraphCanvasCreateIntent({
            surfaceId: 'toolbar',
            surface: 'canvas-toolbar',
            trigger: { source: 'click' },
            nodeType: createMode,
            placement: { mode: 'canvas-absolute', x: position.x, y: position.y },
          }))),
        });
        setEntrypointCreateMode(null);
        showToast('새 오브젝트를 생성했습니다.');
      } catch (error) {
        const mapped = mapEditErrorToToast?.(error);
        showToast(mapped ?? '오브젝트 생성에 실패했습니다.');
      }
    },
    [
      createMode,
      activeTextEditNodeId,
      hasPendingUiActions,
      interactionMode,
      mapEditErrorToToast,
      onCreateNode,
      requestTextEditCancel,
      requestTextEditCommit,
      runPendingUiAction,
      screenToFlowPosition,
      selectedNodeIds,
      setEntrypointCreateMode,
      syncControlledSelection,
    ],
  );


  // Reset layout state when new graph is loaded
  useEffect(() => {
    if (graphId !== lastLayoutedGraphId.current) {
      console.log('[Layout] New graph detected, resetting layout state.');
      pendingViewportRestoreRef.current = resolveViewportToRestore({
        hasRenderedGraph: lastLayoutedGraphId.current !== null,
        previousFile: previousFileRef.current,
        currentFile,
        currentViewport: getViewport(),
        savedViewport: activeTab?.lastViewport,
      });
      hasLayouted.current = false;
      setIsGraphVisible(false); // Hide graph=
      lastLayoutedGraphId.current = graphId;
      previousFileRef.current = currentFile;
      lastSizeSignaturesRef.current = new Map();
      relayoutCountRef.current = new Map();
      relayoutInFlightRef.current = false;
      lastRelayoutAtRef.current = new Map();
      clearPendingRelayout();
    }
  }, [activeTab?.lastViewport, clearPendingRelayout, currentFile, getViewport, graphId]);

  // Trigger Layout when all nodes are initialized (measured)
  useEffect(() => {
    const measured = areNodesMeasured(nodes);

    if (nodes.length > 0 && nodesInitialized && measured && !hasLayouted.current) {
      const runLayout = async () => {
        const shouldRestoreViewport = pendingViewportRestoreRef.current !== null;

        // Double-check: wait one more frame to ensure DOM is fully settled
        await new Promise(resolve => requestAnimationFrame(resolve));

        // Re-verify measurements after the frame (in case of rapid updates)
        const currentNodes = useGraphStore.getState().nodes;
        const stillMeasured = areNodesMeasured(currentNodes);

        if (!stillMeasured || hasLayouted.current) {
          console.log('[Layout] Aborted: nodes changed or already layouted.');
          return;
        }

        if (needsAutoLayout) {
          // ELK layout now handles everything:
          // - Internal group layouts
          // - Global group positioning (with anchor resolution)
          console.log(`[Layout] Triggering ELK layout (${layoutType} mode, ${mindMapGroups.length} group(s))...`);
          const layoutSucceeded = await calculateLayout({
            direction: 'RIGHT',
            mindMapGroups,
            fitViewOnComplete: !shouldRestoreViewport,
          });
          if (layoutSucceeded) {
            lastSizeSignaturesRef.current = getMindMapSizeSignaturesByGroup(currentNodes, {
              quantizationPx: AUTO_RELAYOUT_QUANTIZATION_PX,
            });
          }
        } else {
          // Canvas mode: check if any nodes use anchor-based positioning
          const hasAnchors = currentNodes.some((n) => {
            const atType = (n.data as { at?: { type?: unknown } } | undefined)?.at?.type;
            return Boolean(
              n.data?.anchor
              || atType === 'attach'
              || (n.type === 'sticky' && atType === 'anchor'),
            );
          });
          if (hasAnchors) {
            console.log('[Layout] Canvas mode with anchors, resolving anchor positions...');
            const resolved = resolveAnchors(currentNodes);
            setNodes(resolved);
            if (!shouldRestoreViewport) {
              setTimeout(() => fitView({ duration: 300 }), 50);
            }
          } else {
            console.log('[Layout] Canvas mode, no anchors, skipping layout.');
          }
        }

        if (shouldRestoreViewport) {
          await restorePendingViewport();
        }

        console.log('[Layout] Layout pipeline finished.');
        hasLayouted.current = true;
        setIsGraphVisible(true);
      };

      runLayout();
    }
  }, [nodes, nodesInitialized, calculateLayout, graphId, needsAutoLayout, layoutType, mindMapGroups, setNodes, fitView, restorePendingViewport]);

  useEffect(() => {
    const signaturesByGroup = getMindMapSizeSignaturesByGroup(nodes, {
      quantizationPx: AUTO_RELAYOUT_QUANTIZATION_PX,
    });
    const changedGroupIds = getChangedMindMapGroupIds(
      signaturesByGroup,
      lastSizeSignaturesRef.current,
    );
    const shouldSchedule = shouldScheduleAutoRelayout({
      needsAutoLayout,
      hasLayouted: hasLayouted.current,
      nodesInitialized,
      nodesMeasured: areNodesMeasured(nodes),
      changedGroupIds,
      inFlight: relayoutInFlightRef.current,
      attemptCounts: relayoutCountRef.current,
      maxAttempts: AUTO_RELAYOUT_MAX_ATTEMPTS,
      now: Date.now(),
      lastRelayoutAts: lastRelayoutAtRef.current,
      cooldownMs: AUTO_RELAYOUT_COOLDOWN_MS,
    });

    if (!shouldSchedule) {
      return;
    }

    const scheduledGraphId = graphId;
    clearPendingRelayout();
    relayoutTimerRef.current = window.setTimeout(async () => {
      relayoutTimerRef.current = null;
      if (useGraphStore.getState().graphId !== scheduledGraphId) {
        return;
      }
      if (relayoutInFlightRef.current) {
        return;
      }

      const latestNodes = useGraphStore.getState().nodes;
      if (!areNodesMeasured(latestNodes)) {
        return;
      }

      const latestSignaturesByGroup = getMindMapSizeSignaturesByGroup(latestNodes, {
        quantizationPx: AUTO_RELAYOUT_QUANTIZATION_PX,
      });
      const changedLatestGroupIds = getChangedMindMapGroupIds(
        latestSignaturesByGroup,
        lastSizeSignaturesRef.current,
      );
      const eligibleGroupIds = getEligibleAutoRelayoutGroupIds({
        changedGroupIds: changedLatestGroupIds,
        attemptCounts: relayoutCountRef.current,
        maxAttempts: AUTO_RELAYOUT_MAX_ATTEMPTS,
        now: Date.now(),
        lastRelayoutAts: lastRelayoutAtRef.current,
        cooldownMs: AUTO_RELAYOUT_COOLDOWN_MS,
      });
      if (eligibleGroupIds.length === 0) {
        return;
      }

      relayoutInFlightRef.current = true;
      try {
        const success = await calculateLayout({
          direction: 'RIGHT',
          mindMapGroups,
          fitViewOnComplete: false,
        });
        if (!success) {
          return;
        }
        lastSizeSignaturesRef.current = latestSignaturesByGroup;
        const completedAt = Date.now();
        eligibleGroupIds.forEach((groupId) => {
          const currentAttempt = relayoutCountRef.current.get(groupId) ?? 0;
          relayoutCountRef.current.set(groupId, currentAttempt + 1);
          lastRelayoutAtRef.current.set(groupId, completedAt);
        });
      } finally {
        relayoutInFlightRef.current = false;
      }
    }, AUTO_RELAYOUT_DEBOUNCE_MS);
  }, [
    nodes,
    nodesInitialized,
    graphId,
    needsAutoLayout,
    mindMapGroups,
    calculateLayout,
    clearPendingRelayout,
  ]);

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
      const selectedIds = selectedNodes.map((node) => node.id);
      const currentSelectedIds = useGraphStore.getState().selectedNodeIds;
      if (areSelectionIdsEqual(currentSelectedIds, selectedIds)) {
        return;
      }

      setSelectedNodes(selectedIds);
      handleSelectionChange(selectedIds);
      if (activeTabId) {
        updateTabSnapshot(activeTabId, {
          lastSelection: selectedIds.length > 0
            ? {
                nodeIds: selectedIds,
                edgeIds: [],
                updatedAt: Date.now(),
              }
            : null,
        });
      }
      if (selectedIds.length === 0) {
        clearEntrypointAnchor('selection-floating-menu:selection-bounds');
        return;
      }

      const selectionAnchor = buildSelectionBoundsAnchor({
        selectedNodes: selectedNodes as SelectionAnchorNode[],
        viewport: getViewport(),
      });
      if (selectionAnchor) {
        registerEntrypointAnchor(selectionAnchor);
      }
    },
    [activeTabId, clearEntrypointAnchor, getViewport, handleSelectionChange, registerEntrypointAnchor, setSelectedNodes, updateTabSnapshot],
  );

  useEffect(() => {
    if (selectedNodeIds.length === 0) {
      clearEntrypointAnchor('selection-floating-menu:selection-bounds');
      return;
    }

    const anchoredNodes = nodes.filter((node) => selectedNodeIds.includes(node.id));
    if (anchoredNodes.length === 0) {
      clearEntrypointAnchor('selection-floating-menu:selection-bounds');
      return;
    }

    const selectionAnchor = buildSelectionBoundsAnchor({
      selectedNodes: anchoredNodes as SelectionAnchorNode[],
      viewport: getViewport(),
    });
    if (selectionAnchor) {
      registerEntrypointAnchor(selectionAnchor);
    }
  }, [clearEntrypointAnchor, getViewport, nodes, registerEntrypointAnchor, selectedNodeIds]);

  useEffect(() => {
    const previousNodeIds = previousNodeIdsRef.current;
    const nextNodeIds = new Set(nodes.map((node) => node.id));

    previousNodeIds.forEach((nodeId) => {
      if (!nextNodeIds.has(nodeId)) {
        clearEntrypointAnchorsForNode(nodeId);
      }
    });

    previousNodeIdsRef.current = nextNodeIds;
  }, [clearEntrypointAnchorsForNode, nodes]);

  const onHandleNodeDragStart = useCallback(
    (event: React.MouseEvent, node: FlowNode) => {
      const nextGeneration = (dragGenerationRef.current.get(node.id) ?? 0) + 1;
      dragGenerationRef.current.set(node.id, nextGeneration);
      dragOriginPositions.current.set(node.id, {
        x: node.position.x,
        y: node.position.y,
        generation: nextGeneration,
        pointerType: resolvePointerTypeFromEvent(event),
      });
      if (selectedNodeIds.includes(node.id)) {
        setSelectionShellGesture('move');
      }
    },
    [selectedNodeIds],
  );

  const updateDragFeedback = useCallback((node: FlowNode) => {
    const allNodes = getNodes();
    const feedback = resolveMindMapDragFeedback({
      draggedNode: node as never,
      allNodes: allNodes as never,
      dropPosition: node.position,
    });

    if (!feedback) {
      setDragFeedback(null);
      return;
    }

    if (feedback.kind === 'reparent-hint') {
      setDragFeedback({ kind: 'reparent-hint' });
      return;
    }

    const parentNode = allNodes.find((item) => item.id === feedback.newParentNodeId);
    setDragFeedback({
      kind: 'reparent-ready',
      parentLabel: getCanvasNodeLabel(parentNode),
    });
  }, [getNodes]);

  const onHandleNodeDrag = useCallback(
    (_event: React.MouseEvent, node: FlowNode) => {
      updateDragFeedback(node);
    },
    [updateDragFeedback],
  );

  const onHandleNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: FlowNode) => {
      if (!onNodeDragStop || hasPendingUiActions) return;

      const original = dragOriginPositions.current.get(node.id);
      const generation = original?.generation ?? dragGenerationRef.current.get(node.id) ?? 0;
      const isLatestDragAttempt = () => (dragGenerationRef.current.get(node.id) ?? 0) === generation;

      if (!shouldCommitDragStop({
        origin: original ? { x: original.x, y: original.y } : undefined,
        current: { x: node.position.x, y: node.position.y },
        pointerType: original?.pointerType,
      })) {
        if (isLatestDragAttempt()) {
          dragOriginPositions.current.delete(node.id);
          setDragFeedback(null);
          setSelectionShellGesture(null);
        }
        return;
      }

      if (isLatestDragAttempt()) {
        setDragFeedback(null);
      }

      try {
        await runPendingUiAction({
          actionType: 'node.move.absolute',
          targetIds: [node.id],
          execute: () => Promise.resolve(onNodeDragStop({
            nodeId: node.id,
            x: node.position.x,
            y: node.position.y,
            originX: original?.x ?? node.position.x,
            originY: original?.y ?? node.position.y,
          })),
        });

        if (!isLatestDragAttempt()) {
          return;
        }

        const currentNodes = getNodes();
        const hasAnchors = currentNodes.some((n) => {
          const atType = (n.data as { at?: { type?: unknown } } | undefined)?.at?.type;
          return Boolean(
            n.data?.anchor
            || atType === 'attach'
            || (n.type === 'sticky' && atType === 'anchor'),
          );
        });

        if (hasAnchors) {
          const resolved = resolveAnchors(currentNodes);
          setNodes(resolved);
        }
      } catch (error) {
        if (!isLatestDragAttempt()) {
          return;
        }

        editDebugLog('node-drag-stop', error, {
          nodeId: node.id,
          attemptedPosition: { x: node.position.x, y: node.position.y },
          originalPosition: original ? { x: original.x, y: original.y } : null,
        });

        if (original) {
          setNodes((prev) => prev.map((n) => (
            n.id === node.id
              ? { ...n, position: { x: original.x, y: original.y } }
              : n
          )));
        }

        if (shouldSuppressDragStopErrorToast(error)) {
          return;
        }

        const mapped = mapEditErrorToToast?.(error);
        if (mapped) {
          showToast(mapped);
          return;
        }

        const code = (error as { code?: number })?.code;
        if (code === 40901) {
          showToast('외부 수정 감지: 최신 상태로 다시 동기화합니다.');
        } else if (code === 40903) {
          showToast('ID 중복 감지: 중복 식별자를 먼저 정리해주세요.');
        } else {
          showToast('편집 실패: 이전 상태로 롤백되었습니다.');
        }
      } finally {
        if (isLatestDragAttempt()) {
          dragOriginPositions.current.delete(node.id);
          setSelectionShellGesture(null);
        }
      }
    },
    [getNodes, hasPendingUiActions, mapEditErrorToToast, onNodeDragStop, runPendingUiAction, setNodes],
  );

  const beginSelectionResizeGesture = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!onApplySelectionStyle || selectionNodes.length !== 1) {
      return;
    }

    const [targetNode] = selectionNodes;
    selectionShellGestureRef.current = {
      kind: 'resize',
      nodeId: targetNode.id,
      originScreen: { x: event.clientX, y: event.clientY },
      originalData: { ...((targetNode.data || {}) as Record<string, unknown>) },
      zoom: Math.max(getViewport().zoom, 0.1),
      lastPatch: null,
    };
    setSelectionShellGesture('resize');
    event.preventDefault();
    event.stopPropagation();
  }, [getViewport, onApplySelectionStyle, selectionNodes]);

  const beginSelectionRotateGesture = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!onApplySelectionStyle || selectionNodes.length !== 1 || !selectionShell.screenBounds) {
      return;
    }

    const [targetNode] = selectionNodes;
    selectionShellGestureRef.current = {
      kind: 'rotate',
      nodeId: targetNode.id,
      originalData: { ...((targetNode.data || {}) as Record<string, unknown>) },
      screenBounds: selectionShell.screenBounds,
      lastPatch: null,
    };
    setSelectionShellGesture('rotate');
    event.preventDefault();
    event.stopPropagation();
  }, [onApplySelectionStyle, selectionNodes, selectionShell.screenBounds]);

  useEffect(() => {
    if (!selectionShellGesture) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const gesture = selectionShellGestureRef.current;
      if (!gesture) {
        return;
      }

      const runtimeNode = useGraphStore.getState().nodes.find((node) => node.id === gesture.nodeId);
      if (!runtimeNode) {
        clearSelectionShellGesture();
        return;
      }

      if (gesture.kind === 'resize') {
        const patch = resolveSelectionResizePatch({
          node: runtimeNode as SelectionShellNode,
          deltaScreen: {
            x: event.clientX - gesture.originScreen.x,
            y: event.clientY - gesture.originScreen.y,
          },
          zoom: gesture.zoom,
        });
        if (!patch) {
          return;
        }
        gesture.lastPatch = patch;
        useGraphStore.getState().updateNodeData(gesture.nodeId, patch);
        event.preventDefault();
        return;
      }

      const rotation = resolveSelectionRotation({
        node: runtimeNode as SelectionShellNode,
        screenBounds: gesture.screenBounds,
        pointerScreen: { x: event.clientX, y: event.clientY },
      });
      if (rotation === null) {
        return;
      }
      gesture.lastPatch = { rotation };
      useGraphStore.getState().updateNodeData(gesture.nodeId, { rotation });
      event.preventDefault();
    };

    const finishGesture = async () => {
      const gesture = selectionShellGestureRef.current;
      clearSelectionShellGesture();
      if (!gesture) {
        return;
      }

      if (!gesture.lastPatch || !onApplySelectionStyle) {
        restoreSelectionNodePreview(gesture.nodeId, gesture.originalData);
        return;
      }

      try {
        await Promise.resolve(onApplySelectionStyle({
          nodeIds: [gesture.nodeId],
          patch: gesture.lastPatch,
          patchKey: gesture.kind === 'rotate' ? 'rotation' : 'width',
        }));
      } catch (error) {
        restoreSelectionNodePreview(gesture.nodeId, gesture.originalData);
        const mapped = mapEditErrorToToast?.(error);
        showToast(mapped ?? '직접 조작 변경을 저장하지 못했습니다.');
      }
    };

    const cancelGesture = () => {
      const gesture = selectionShellGestureRef.current;
      clearSelectionShellGesture();
      if (!gesture) {
        return;
      }
      restoreSelectionNodePreview(gesture.nodeId, gesture.originalData);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishGesture);
    window.addEventListener('pointercancel', cancelGesture);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishGesture);
      window.removeEventListener('pointercancel', cancelGesture);
    };
  }, [
    clearSelectionShellGesture,
    mapEditErrorToToast,
    onApplySelectionStyle,
    restoreSelectionNodePreview,
    selectionShellGesture,
    showToast,
  ]);

  const selectionFloatingMenuContribution = useMemo(() => createGraphCanvasSelectionFloatingMenuContribution({
    runtime: canvasRuntime,
    toolbarSlot: canvasRuntime.slots.canvasToolbar,
    selectionFloatingMenuSlot: canvasRuntime.slots.selectionFloatingMenu,
    nodes,
    selectedNodeIds,
    currentFile,
    runtimeState: entrypointRuntime,
    pendingActionRoutingByKey,
    washiPresets,
    onApplyStylePatch: handleSelectionStylePatch,
    onCommitContent: handleSelectionContentCommit,
  }), [
    currentFile,
    entrypointRuntime,
    handleSelectionContentCommit,
    handleSelectionStylePatch,
    nodes,
    pendingActionRoutingByKey,
    selectedNodeIds,
    washiPresets,
  ]);

  const toolbarContribution = useMemo(() => createGraphCanvasToolbarContribution({
    runtime: canvasRuntime,
    toolbarSlot: canvasRuntime.slots.canvasToolbar,
    selectionFloatingMenuSlot: canvasRuntime.slots.selectionFloatingMenu,
    interactionMode,
    setEntrypointInteractionMode,
    createMode,
    setEntrypointCreateMode,
    handleZoomIn,
    handleZoomOut,
    handleFitView,
    washiPresets: [],
    activeWashiPresetId: null,
    selectedWashiNodeIds: [],
    onSelectWashiPreset: () => {},
  }), [
    createMode,
    handleFitView,
    handleZoomIn,
    handleZoomOut,
    interactionMode,
    setEntrypointCreateMode,
    setEntrypointInteractionMode,
  ]);

  useEffect(() => {
    const activeId = toolbarOverlayIdRef.current;
    const nextId = activeId
      && getActiveOverlays().some((item) => item.instanceId === activeId)
      ? replaceOverlayHost(activeId, toolbarContribution)
      : openOverlayHost(toolbarContribution);
    toolbarOverlayIdRef.current = nextId;
  }, [getActiveOverlays, openOverlayHost, replaceOverlayHost, toolbarContribution]);

  useEffect(() => () => {
    const activeId = toolbarOverlayIdRef.current;
    if (!activeId) {
      return;
    }

    if (getActiveOverlays().some((item) => item.instanceId === activeId)) {
      closeOverlayHost(activeId, 'viewport-teardown');
    }
  }, [closeOverlayHost, getActiveOverlays]);

  useEffect(() => {
    selectionFloatingMenuOverlayIdRef.current = syncGraphCanvasSelectionFloatingMenuOverlay({
      activeOverlayId: selectionFloatingMenuOverlayIdRef.current,
      contribution: selectionFloatingMenuContribution,
      currentOpenSurfaceKind: entrypointRuntime.openSurface?.kind ?? null,
      getActiveOverlays,
      openOverlayHost,
      replaceOverlayHost,
      closeOverlayHost,
      openEntrypointSurface,
      closeEntrypointSurface,
    });
  }, [
    closeEntrypointSurface,
    closeOverlayHost,
    entrypointRuntime.openSurface?.kind,
    getActiveOverlays,
    openEntrypointSurface,
    openOverlayHost,
    replaceOverlayHost,
    selectionFloatingMenuContribution,
  ]);

  useEffect(() => () => {
    const activeId = selectionFloatingMenuOverlayIdRef.current;
    if (!activeId) {
      return;
    }

    if (getActiveOverlays().some((item) => item.instanceId === activeId)) {
      closeOverlayHost(activeId, 'viewport-teardown');
    }
  }, [closeOverlayHost, getActiveOverlays]);

  useEffect(() => {
    const keyboardHost = createGraphCanvasKeyboardHost({
      clipboardHistoryRef: clipboardHistory,
      graphClipboardRef,
      focusNextNodeByType,
      selectNodesByType,
      showToast,
      getGraphState: () => {
        const state = useGraphStore.getState();
        return {
          nodes: state.nodes,
          edges: state.edges,
          selectedNodeIds: state.selectedNodeIds,
        };
      },
      setGraphState: (next) => {
        useGraphStore.setState({
          nodes: next.nodes,
          edges: next.edges,
          selectedNodeIds: next.selectedNodeIds,
        });
      },
      mapEditErrorToToast,
      onUndoEditStep,
      onRedoEditStep,
      getClipboard: () => (
        typeof navigator !== 'undefined' ? navigator.clipboard : null
      ),
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      void keyboardHost.handleKeyDown(event);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusNextNodeByType, mapEditErrorToToast, onRedoEditStep, onUndoEditStep, selectNodesByType, showToast]);

  return (
    <>
      {isLayouting && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm font-medium text-slate-600">Optimizing layout...</p>
          </div>
        </div>
      )}

      {/* 
         Use opacity to prevent FOUC (Flash of Unstyled Content) / Jumpy layout.
         We wait until isGraphVisible is true.
      */}
      <div
        className="w-full h-full min-h-[500px] flex-1 bg-white transition-opacity duration-300"
        style={{
          opacity: isGraphVisible ? 1 : 0,
          fontFamily: canvasResolvedFontFamily,
          fontWeight: isZoomBold ? 700 : undefined,
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStart={onHandleNodeDragStart}
          onNodeDrag={onHandleNodeDrag}
          onNodeDragStop={onHandleNodeDragStop}
          onNodeContextMenu={onNodeContextMenu}
          onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          onSelectionChange={onSelectionChange}
          onMoveEnd={(_event, viewport) => {
            persistActiveTabViewport(viewport);
            if (selectedNodeIds.length > 0) {
              const anchoredNodes = getNodes().filter((node) => selectedNodeIds.includes(node.id));
              const selectionAnchor = buildSelectionBoundsAnchor({
                selectedNodes: anchoredNodes as SelectionAnchorNode[],
                viewport,
              });
              if (selectionAnchor) {
                registerEntrypointAnchor(selectionAnchor);
              }
            }
            dismissEntrypointSurfaceOnViewportChange();
          }}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={true}
          nodesConnectable={false}
          zoomOnScroll={true}
          panOnScroll={true}
          panOnDrag={interactionMode === 'hand'}
          selectionOnDrag={interactionMode === 'pointer'}
          panOnScrollMode={undefined} // Allow pan on scroll
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{
            type: 'floating',
            animated: false,
            style: { stroke: '#94a3b8', strokeWidth: 2 },
          }}
          proOptions={{ hideAttribution: true }}
        >
          {typeof canvasBackground === 'string' && canvasBackground !== 'solid' && (
            <Background
              variant={canvasBackground === 'lines' ? BackgroundVariant.Lines : BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="#cbd5e1"
            />
          )}
          {typeof canvasBackground === 'object' && canvasBackground.type === 'custom' && (
            <CustomBackground svg={canvasBackground.svg} gap={canvasBackground.gap} />
          )}
        </ReactFlow>

        {selectionShell.visible && selectionShell.screenBounds ? (
          <div className="pointer-events-none absolute inset-0 z-[95]">
            <div
              data-testid="graph-canvas-selection-shell"
              className={[
                'absolute rounded-2xl border border-sky-500/80 bg-sky-500/5 shadow-[0_0_0_1px_rgba(255,255,255,0.7)] transition-colors',
                selectionShell.activeGesture ? 'border-sky-600 bg-sky-500/10' : '',
              ].join(' ')}
              style={{
                left: selectionShell.screenBounds.left,
                top: selectionShell.screenBounds.top,
                width: selectionShell.screenBounds.width,
                height: selectionShell.screenBounds.height,
              }}
            >
              {selectionShell.canRotate && selectionNodes.length === 1 ? (
                <button
                  type="button"
                  data-testid="graph-canvas-rotate-handle"
                  aria-label="Rotate selection"
                  className="pointer-events-auto absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 -translate-y-6 rounded-full border border-sky-500 bg-white shadow-sm"
                  onPointerDown={beginSelectionRotateGesture}
                >
                  <span className="sr-only">Rotate selection</span>
                </button>
              ) : null}
              {selectionShell.canResize && selectionNodes.length === 1 ? (
                <button
                  type="button"
                  data-testid="graph-canvas-resize-handle"
                  aria-label="Resize selection"
                  className="pointer-events-auto absolute bottom-0 right-0 h-4 w-4 translate-x-1/2 translate-y-1/2 rounded-full border border-sky-500 bg-white shadow-sm cursor-se-resize"
                  onPointerDown={beginSelectionResizeGesture}
                >
                  <span className="sr-only">Resize selection</span>
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <ExportDialog
          isOpen={exportDialog.isOpen}
          defaultArea={exportDialog.defaultArea}
          selectedNodeIds={exportDialog.selectedNodeIds}
          onClose={() => setExportDialog({ isOpen: false, defaultArea: 'full' })}
        />

        {/* Bubble overlay - renders all bubbles above nodes */}
        <BubbleOverlay />

        {dragFeedback && (
          <div className="absolute top-24 left-1/2 z-[100] -translate-x-1/2 animate-in fade-in slide-in-from-top-2">
            <div className={[
              'rounded-full border px-4 py-2 text-sm font-medium shadow-lg backdrop-blur',
              dragFeedback.kind === 'reparent-ready'
                ? 'border-emerald-200 bg-emerald-50/95 text-emerald-700'
                : 'border-amber-200 bg-amber-50/95 text-amber-700',
            ].join(' ')}>
              {dragFeedback.kind === 'reparent-ready'
                ? `${dragFeedback.parentLabel} 아래로 놓으면 부모가 바뀝니다.`
                : '다른 MindMap 노드 위에 놓으면 부모를 바꿀 수 있습니다.'}
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-slate-800 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium">
              <Check className="w-4 h-4 text-green-400" />
              {toastMessage}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function GraphCanvas({
  onNodeDragStop,
  onUndoEditStep,
  onRedoEditStep,
  mapEditErrorToToast,
  onRenameNode,
  onDuplicateNode,
  onDeleteNode,
  onToggleNodeLock,
  onSelectNodeGroup,
  onCreateNode,
  onApplySelectionStyle,
  onCommitSelectionContent,
}: GraphCanvasProps) {
  return (
    <div className="w-full h-full min-h-[500px] flex-1 relative">
      <ReactFlowProvider>
        <NavigationProvider>
          <ZoomProvider>
            <BubbleProvider>
              <OverlayHostProvider>
                <PluginRuntimeProvider>
                  <GraphCanvasContent
                    onNodeDragStop={onNodeDragStop}
                    onUndoEditStep={onUndoEditStep}
                    onRedoEditStep={onRedoEditStep}
                    mapEditErrorToToast={mapEditErrorToToast}
                    onRenameNode={onRenameNode}
                    onDuplicateNode={onDuplicateNode}
                    onDeleteNode={onDeleteNode}
                    onToggleNodeLock={onToggleNodeLock}
                    onSelectNodeGroup={onSelectNodeGroup}
                    onCreateNode={onCreateNode}
                    onApplySelectionStyle={onApplySelectionStyle}
                    onCommitSelectionContent={onCommitSelectionContent}
                  />
                </PluginRuntimeProvider>
              </OverlayHostProvider>
            </BubbleProvider>
          </ZoomProvider>
        </NavigationProvider>
      </ReactFlowProvider>
    </div>
  );
}
