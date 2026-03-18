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
import { getWashiPresetPatternCatalog, resolvePresetPatternId } from '@/utils/washiTapeDefaults';
import type { MaterialPresetId } from '@/types/washiTape';
import {
  createEntrypointAnchor,
  type EntrypointInteractionMode,
} from '@/features/canvas-ui-entrypoints/ui-runtime-state';
import type { CanvasEntrypointSurface } from '@/features/canvas-ui-entrypoints/contracts';
import {
  resolveMindMapDragFeedback,
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
import { canvasRuntime } from '@/processes/canvas-runtime/createCanvasRuntime';
import {
  createGraphCanvasContextMenuActions,
  createGraphCanvasNodeContextMenu,
  createGraphCanvasPaneContextMenu,
  createGraphCanvasToolbarContribution,
} from '@/processes/canvas-runtime/bindings/graphCanvasHost';
import { createGraphCanvasKeyboardHost } from '@/processes/canvas-runtime/bindings/keyboardHost';

type GraphCanvasProps = {
  onNodeDragStop?: (payload: {
    nodeId: string;
    x: number;
    y: number;
    originX: number;
    originY: number;
  }) => Promise<void> | void;
  onWashiPresetChange?: (nodeIds: string[], presetId: MaterialPresetId) => Promise<void> | void;
  onUndoEditStep?: () => Promise<boolean> | boolean;
  onRedoEditStep?: () => Promise<boolean> | boolean;
  mapEditErrorToToast?: (error: unknown) => string | null;
  onRenameNode?: (input: GraphCanvasRenameIntentInput) => Promise<void> | void;
  onDuplicateNode?: (input: GraphCanvasNodeMenuIntentInput) => Promise<void> | void;
  onDeleteNode?: (input: GraphCanvasNodeMenuIntentInput) => Promise<void> | void;
  onToggleNodeLock?: (input: GraphCanvasNodeMenuIntentInput) => Promise<void> | void;
  onSelectNodeGroup?: (input: GraphCanvasNodeMenuIntentInput) => Promise<void> | void;
  onCreateNode?: (input: GraphCanvasCreateIntentInput) => Promise<void> | void;
};

export interface GraphCanvasNodeMenuIntentInput {
  nodeId: string;
  surfaceId: ActionRoutingSurfaceId;
  surface?: Extract<CanvasEntrypointSurface, 'node-context-menu'>;
  trigger?: { source: 'menu' };
}

export type GraphCanvasRenameIntentInput = GraphCanvasNodeMenuIntentInput;

export interface GraphCanvasCreateIntentInput {
  surfaceId: ActionRoutingSurfaceId;
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

type SelectionAnchorNode = Pick<FlowNode, 'id' | 'position' | 'width' | 'height'> & {
  measured?: {
    width?: number;
    height?: number;
  };
};

export function buildSelectionBoundsAnchor(input: {
  selectedNodes: SelectionAnchorNode[];
  viewport: { x: number; y: number; zoom: number };
}) {
  if (input.selectedNodes.length === 0) {
    return null;
  }

  const bounds = input.selectedNodes.reduce((acc, node) => {
    const width = node.width ?? node.measured?.width ?? 0;
    const height = node.height ?? node.measured?.height ?? 0;
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
  onWashiPresetChange,
  onUndoEditStep,
  onRedoEditStep,
  mapEditErrorToToast,
  onRenameNode,
  onDuplicateNode,
  onDeleteNode,
  onToggleNodeLock,
  onSelectNodeGroup,
  onCreateNode,
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
    entrypointRuntime,
    setEntrypointInteractionMode,
    setEntrypointCreateMode,
    dismissEntrypointSurfaceOnViewportChange,
    registerEntrypointAnchor,
    clearEntrypointAnchor,
    clearEntrypointAnchorsForNode,
    beginPendingUiAction,
    commitPendingUiAction,
    failPendingUiAction,
    clearPendingUiAction,
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
  const washiPresets = useMemo(() => getWashiPresetPatternCatalog(), []);
  const selectedWashiNodeIds = useMemo(
    () => nodes
      .filter((node) => selectedNodeIds.includes(node.id) && node.type === 'washi-tape')
      .map((node) => node.id),
    [nodes, selectedNodeIds],
  );

  const activeWashiPresetId = useMemo<MaterialPresetId | null>(() => {
    if (selectedWashiNodeIds.length === 0) return null;

    const selectedNodes = nodes.filter((node) => selectedWashiNodeIds.includes(node.id));
    const presetIds = selectedNodes
      .map((node) => {
        const pattern = (node.data as Record<string, unknown>)?.pattern;
        if (!pattern || typeof pattern !== 'object') return null;
        if ((pattern as { type?: unknown }).type !== 'preset') return null;
        return resolvePresetPatternId(pattern);
      })
      .filter((presetId): presetId is MaterialPresetId => Boolean(presetId));

    if (presetIds.length === 0) return null;
    const first = presetIds[0];
    const allSame = presetIds.every((presetId) => presetId === first);
    return allSame ? first : null;
  }, [nodes, selectedWashiNodeIds]);

  const activeTab = useMemo(
    () => openTabs.find((tab) => tab.tabId === activeTabId) ?? null,
    [activeTabId, openTabs],
  );

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2000);
  };

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

  const handleZoomIn = () => {
    zoomIn({ duration: 300 });
    setTimeout(() => {
      persistActiveTabViewport(getViewport());
      showToast(`Zoom: ${Math.round(getZoom() * 100)}%`);
    }, 350);
  };

  const handleZoomOut = () => {
    zoomOut({ duration: 300 });
    setTimeout(() => {
      persistActiveTabViewport(getViewport());
      showToast(`Zoom: ${Math.round(getZoom() * 100)}%`);
    }, 350);
  };

  const handleFitView = () => {
    fitView({ duration: 300 });
    setTimeout(() => {
      persistActiveTabViewport(getViewport());
      showToast('Fit to view');
    }, 350);
  };

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
      openMenu(createGraphCanvasPaneContextMenu({
        eventPosition: { x: event.clientX, y: event.clientY },
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
        return;
      }
      if (createMode === null) {
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
      hasPendingUiActions,
      interactionMode,
      mapEditErrorToToast,
      onCreateNode,
      runPendingUiAction,
      screenToFlowPosition,
      setEntrypointCreateMode,
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
      setSelectedNodes(selectedIds);
      handleSelectionChange(selectedIds);
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
    [clearEntrypointAnchor, getViewport, handleSelectionChange, registerEntrypointAnchor, setSelectedNodes],
  );

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
    (_event: React.MouseEvent, node: FlowNode) => {
      const nextGeneration = (dragGenerationRef.current.get(node.id) ?? 0) + 1;
      dragGenerationRef.current.set(node.id, nextGeneration);
      dragOriginPositions.current.set(node.id, {
        x: node.position.x,
        y: node.position.y,
        generation: nextGeneration,
      });
    },
    [],
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
      })) {
        if (isLatestDragAttempt()) {
          dragOriginPositions.current.delete(node.id);
          setDragFeedback(null);
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
        }
      }
    },
    [getNodes, hasPendingUiActions, mapEditErrorToToast, onNodeDragStop, runPendingUiAction, setNodes],
  );

  const handleWashiPresetSelect = useCallback(
    async (presetIdInput: string) => {
      if (selectedWashiNodeIds.length === 0 || hasPendingUiActions) return;
      const presetId = resolvePresetPatternId(presetIdInput);

      try {
        await runPendingUiAction({
          actionType: 'node.style.update',
          targetIds: selectedWashiNodeIds,
          execute: async () => {
            await Promise.resolve(onWashiPresetChange?.(selectedWashiNodeIds, presetId));
          },
        });
      } catch (error) {
        editDebugLog('washi-preset-change', error, {
          nodeIds: selectedWashiNodeIds,
          presetId,
        });

        const code = (error as { code?: number })?.code;
        if (code === 40901) {
          showToast('외부 수정 감지: 최신 상태로 다시 동기화합니다.');
        } else {
          showToast('와시 프리셋 변경 실패: 이전 상태로 롤백되었습니다.');
        }
      }
    },
    [hasPendingUiActions, onWashiPresetChange, runPendingUiAction, selectedWashiNodeIds, showToast],
  );

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
    washiPresets,
    activeWashiPresetId,
    selectedWashiNodeIds,
    onSelectWashiPreset: handleWashiPresetSelect,
  }), [
    activeWashiPresetId,
    createMode,
    handleFitView,
    handleWashiPresetSelect,
    interactionMode,
    selectedWashiNodeIds.length,
    setEntrypointCreateMode,
    setEntrypointInteractionMode,
    washiPresets,
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
          fitView
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
  onWashiPresetChange,
  onUndoEditStep,
  onRedoEditStep,
  mapEditErrorToToast,
  onRenameNode,
  onDuplicateNode,
  onDeleteNode,
  onToggleNodeLock,
  onSelectNodeGroup,
  onCreateNode,
}: GraphCanvasProps) {
  return (
    <div className="w-full h-full min-h-[500px] flex-1 relative">
      <ReactFlowProvider>
        <NavigationProvider>
          <ZoomProvider>
            <BubbleProvider>
              <OverlayHostProvider>
                <GraphCanvasContent
                  onNodeDragStop={onNodeDragStop}
                  onWashiPresetChange={onWashiPresetChange}
                  onUndoEditStep={onUndoEditStep}
                  onRedoEditStep={onRedoEditStep}
                  mapEditErrorToToast={mapEditErrorToToast}
                  onRenameNode={onRenameNode}
                  onDuplicateNode={onDuplicateNode}
                  onDeleteNode={onDeleteNode}
                  onToggleNodeLock={onToggleNodeLock}
                  onSelectNodeGroup={onSelectNodeGroup}
                  onCreateNode={onCreateNode}
                />
              </OverlayHostProvider>
            </BubbleProvider>
          </ZoomProvider>
        </NavigationProvider>
      </ReactFlowProvider>
    </div>
  );
}
