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
import { FloatingToolbar, InteractionMode } from './FloatingToolbar';
import { useExportImage } from '@/hooks/useExportImage';
import { ContextMenu } from './ContextMenu';
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
  applyGraphSnapshot,
  createGraphClipboardPayload,
  createPastedGraphState,
  isGraphClipboardPayload,
  serializeNodeIdsForClipboard,
  type GraphClipboardPayload,
  snapshotGraphState,
  type GraphSnapshot,
} from '@/utils/clipboardGraph';
import { editDebugLog } from '@/utils/editDebug';
import { getWashiPresetPatternCatalog, resolvePresetPatternId } from '@/utils/washiTapeDefaults';
import type { MaterialPresetId } from '@/types/washiTape';
import {
  resolveEditHistoryShortcut,
  resolveMindMapDragFeedback,
  shouldCommitDragStop,
  shouldHandlePaneCreate,
  shouldSuppressDragStopErrorToast,
  type GraphCanvasCreateMode,
} from './GraphCanvas.drag';
import type { CreatePayload } from '@/features/editing/commands';
import { resolveNodeEditContext } from '@/components/editor/workspaceEditUtils';
import type { CreatableNodeType } from '@/types/contextMenu';

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
  onRenameNode?: (nodeId: string) => Promise<void> | void;
  onCreateNode?: (input: {
    nodeType: CreatableNodeType;
    placement: CreatePayload['placement'];
    filePath?: string;
    scopeId?: string;
    frameScope?: string;
  }) => Promise<void> | void;
};

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

function GraphCanvasContent({
  onNodeDragStop,
  onWashiPresetChange,
  onUndoEditStep,
  onRedoEditStep,
  mapEditErrorToToast,
  onRenameNode,
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
  } = useGraphStore();

  const { isZoomBold } = useZoom();

  const canvasResolvedFontFamily = useMemo(
    () => resolveFontFamilyCssValue({ canvasFontFamily, globalFontFamily }),
    [canvasFontFamily, globalFontFamily],
  );

  const { calculateLayout, isLayouting } = useLayout();
  const nodesInitialized = useNodesInitialized();
  const { zoomIn, zoomOut, fitView, getZoom, setNodes, getNodes, getViewport, setViewport, screenToFlowPosition } = useReactFlow();
  const { isOpen: isContextMenuOpen, context: contextMenuContext, items: contextMenuItems, openMenu, closeMenu } = useContextMenu();
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
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('pointer');
  const [createMode, setCreateMode] = useState<GraphCanvasCreateMode>(null);
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

  const selectMindMapGroupByNodeId = useCallback((nodeId: string) => {
    const node = useGraphStore.getState().nodes.find((item) => item.id === nodeId);
    const groupId = node?.data?.groupId as string | undefined;

    if (!groupId) {
      showToast('그룹 정보가 없는 노드입니다.');
      return;
    }

    const groupNodeIds = useGraphStore.getState().nodes
      .filter((item) => item.data?.groupId === groupId)
      .map((item) => item.id);
    setSelectedNodes(groupNodeIds);
    showToast('그룹 노드가 선택되었습니다.');
  }, [setSelectedNodes, showToast]);

  const contextMenuActions = useMemo(() => ({
    fitView: () => {
      handleFitView();
    },
    copyImageToClipboard: (ids?: string[]) => {
      return copyImageToClipboard(ids);
    },
    openExportDialog: (scope: 'selection' | 'full', selectedNodeIds?: string[]) => {
      setExportDialog({
        isOpen: true,
        defaultArea: scope === 'selection' ? 'selection' : 'full',
        selectedNodeIds: scope === 'selection' ? selectedNodeIds : undefined,
      });
    },
    selectMindMapGroupByNodeId,
    renameNode: (nodeId: string) => onRenameNode?.(nodeId),
    createCanvasNode: (nodeType: CreatableNodeType, screenPosition: { x: number; y: number }) => {
      if (!onCreateNode) {
        return;
      }
      const position = screenToFlowPosition(screenPosition);
      return onCreateNode({
        nodeType,
        placement: { mode: 'canvas-absolute', x: position.x, y: position.y },
      });
    },
    createMindMapChild: (renderedNodeId: string) => {
      if (!onCreateNode) {
        return;
      }
      const targetNode = useGraphStore.getState().nodes.find((item) => item.id === renderedNodeId);
      const sourceMeta = (targetNode?.data as { sourceMeta?: Record<string, unknown> } | undefined)?.sourceMeta;
      const parentId = typeof sourceMeta?.sourceId === 'string' ? sourceMeta.sourceId : renderedNodeId;
      return onCreateNode({
        nodeType: 'shape',
        placement: { mode: 'mindmap-child', parentId },
        filePath: typeof sourceMeta?.filePath === 'string' ? sourceMeta.filePath : undefined,
        scopeId: typeof sourceMeta?.scopeId === 'string' ? sourceMeta.scopeId : undefined,
        frameScope: typeof sourceMeta?.frameScope === 'string' ? sourceMeta.frameScope : undefined,
      });
    },
    createMindMapSibling: (renderedNodeId: string) => {
      if (!onCreateNode) {
        return;
      }
      const runtime = useGraphStore.getState();
      const targetNode = runtime.nodes.find((item) => item.id === renderedNodeId);
      const sourceMeta = (targetNode?.data as { sourceMeta?: Record<string, unknown> } | undefined)?.sourceMeta;
      const parentEdge = runtime.edges.find((edge) => edge.target === renderedNodeId);
      const parentNode = parentEdge
        ? runtime.nodes.find((item) => item.id === parentEdge.source)
        : null;
      const parentSourceMeta = (parentNode?.data as { sourceMeta?: Record<string, unknown> } | undefined)?.sourceMeta;
      const parentId = parentSourceMeta && typeof parentSourceMeta.sourceId === 'string'
        ? parentSourceMeta.sourceId
        : null;
      const siblingOf = typeof sourceMeta?.sourceId === 'string' ? sourceMeta.sourceId : renderedNodeId;
      return onCreateNode({
        nodeType: 'shape',
        placement: { mode: 'mindmap-sibling', siblingOf, parentId },
        filePath: typeof sourceMeta?.filePath === 'string' ? sourceMeta.filePath : undefined,
        scopeId: typeof sourceMeta?.scopeId === 'string' ? sourceMeta.scopeId : undefined,
        frameScope: typeof sourceMeta?.frameScope === 'string' ? sourceMeta.frameScope : undefined,
      });
    },
  }), [copyImageToClipboard, handleFitView, onCreateNode, onRenameNode, screenToFlowPosition, selectMindMapGroupByNodeId]);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: FlowNode) => {
      event.preventDefault();
      const currentSelectedIds = useGraphStore.getState().selectedNodeIds;
      const nextSelectedIds = currentSelectedIds.includes(node.id)
        ? currentSelectedIds
        : [node.id];
      openMenu({
        type: 'node',
        position: { x: event.clientX, y: event.clientY },
        nodeId: node.id,
        nodeFamily: resolveNodeEditContext(node, useGraphStore.getState().currentFile).editMeta?.family,
        selectedNodeIds: nextSelectedIds,
        actions: contextMenuActions,
      });
    },
    [openMenu, contextMenuActions],
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      openMenu({
        type: 'pane',
        position: { x: event.clientX, y: event.clientY },
        selectedNodeIds: [],
        actions: contextMenuActions,
      });
    },
    [contextMenuActions, openMenu],
  );

  const onCloseContextMenu = useCallback(() => {
    closeMenu();
  }, [closeMenu]);

  const onPaneClick = useCallback(
    async (event: React.MouseEvent) => {
      if (!shouldHandlePaneCreate({ interactionMode, createMode }) || !onCreateNode) {
        return;
      }
      if (createMode === null) {
        return;
      }

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      try {
        await onCreateNode({
          nodeType: createMode,
          placement: { mode: 'canvas-absolute', x: position.x, y: position.y },
        });
        setCreateMode(null);
        showToast('새 오브젝트를 생성했습니다.');
      } catch (error) {
        const mapped = mapEditErrorToToast?.(error);
        showToast(mapped ?? '오브젝트 생성에 실패했습니다.');
      }
    },
    [createMode, interactionMode, mapEditErrorToToast, onCreateNode, screenToFlowPosition],
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
    },
    [setSelectedNodes],
  );

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
      if (!onNodeDragStop) return;

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
        await onNodeDragStop({
          nodeId: node.id,
          x: node.position.x,
          y: node.position.y,
          originX: original?.x ?? node.position.x,
          originY: original?.y ?? node.position.y,
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
    [getNodes, mapEditErrorToToast, onNodeDragStop, setNodes],
  );

  const handleWashiPresetSelect = useCallback(
    async (presetIdInput: string) => {
      if (selectedWashiNodeIds.length === 0) return;
      const presetId = resolvePresetPatternId(presetIdInput);

      try {
        await onWashiPresetChange?.(selectedWashiNodeIds, presetId);
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
    [onWashiPresetChange, selectedWashiNodeIds, showToast],
  );

  useEffect(() => {
    const isTextInputFocused = () => (
      document.activeElement instanceof HTMLInputElement
      || document.activeElement instanceof HTMLTextAreaElement
      || (document.activeElement as HTMLElement)?.isContentEditable
    );

    const pushHistory = (snapshot: GraphSnapshot) => {
      const history = clipboardHistory.current;
      history.past.push(snapshot);
      if (history.past.length > 50) {
        history.past.shift();
      }
      history.future = [];
    };

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (isTextInputFocused()) return;

      const isCopy = (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'c';
      const isPaste = (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'v';
      const historyShortcut = resolveEditHistoryShortcut({
        key: e.key,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
      });
      const isUndo = historyShortcut === 'undo';
      const isRedo = historyShortcut === 'redo';
      const isFocusNextWashi = (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f';
      const isSelectAllWashi = (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'g';

      if (isFocusNextWashi) {
        e.preventDefault();
        const nextId = focusNextNodeByType('washi-tape');
        showToast(nextId ? 'Washi 포커스를 이동했습니다.' : 'Washi 노드가 없습니다.');
        return;
      }

      if (isSelectAllWashi) {
        e.preventDefault();
        const ids = selectNodesByType('washi-tape');
        showToast(ids.length > 0 ? `Washi ${ids.length}개 선택됨` : 'Washi 노드가 없습니다.');
        return;
      }

      if (isCopy) {
        e.preventDefault();

        const { nodes, edges, selectedNodeIds } = useGraphStore.getState();
        const dataToCopy = createGraphClipboardPayload(nodes, edges, selectedNodeIds);
        const clipboardText = serializeNodeIdsForClipboard(dataToCopy);
        graphClipboardRef.current = {
          payload: dataToCopy,
          text: clipboardText,
        };

        navigator.clipboard
          .writeText(clipboardText)
          .then(() => {
            console.log('Copied node ids to clipboard:', clipboardText);
          })
          .catch((err) => {
            console.error('Failed to copy:', err);
          });
        return;
      }

      if (isPaste) {
        e.preventDefault();

        try {
          const clipboardText = typeof navigator.clipboard?.readText === 'function'
            ? await navigator.clipboard.readText()
            : null;
          const copiedGraph = graphClipboardRef.current;
          let parsedPayload: GraphClipboardPayload | null = null;

          if (copiedGraph && (clipboardText === null || clipboardText === copiedGraph.text)) {
            parsedPayload = copiedGraph.payload;
          } else if (clipboardText) {
            const parsed = JSON.parse(clipboardText);
            if (!isGraphClipboardPayload(parsed)) return;
            parsedPayload = parsed;
          }

          if (!parsedPayload) return;

          const { nodes, edges } = useGraphStore.getState();
          pushHistory(snapshotGraphState(nodes, edges));

          const next = createPastedGraphState(parsedPayload, nodes, edges);
          useGraphStore.setState({
            nodes: next.nodes,
            edges: next.edges,
            selectedNodeIds: next.selectedNodeIds,
          });
        } catch (error) {
          console.debug('Paste skipped: invalid clipboard graph payload', error);
        }
        return;
      }

      if (isUndo) {
        if (onUndoEditStep) {
          e.preventDefault();
          try {
            const handled = await onUndoEditStep();
            if (handled) {
              showToast('편집 1단계 실행 취소');
              return;
            }
          } catch (error) {
            editDebugLog('edit-undo-step', error);
            const mapped = mapEditErrorToToast?.(error);
            if (mapped) {
              showToast(mapped);
            } else {
              showToast('실행 취소에 실패했습니다.');
            }
            return;
          }
        }

        const history = clipboardHistory.current;
        const previous = history.past.pop();
        if (!previous) return;

        e.preventDefault();
        const { nodes, edges } = useGraphStore.getState();
        history.future.push(snapshotGraphState(nodes, edges));
        const restored = applyGraphSnapshot(previous);
        useGraphStore.setState(restored);
        return;
      }

      if (isRedo) {
        if (onRedoEditStep) {
          e.preventDefault();
          try {
            const handled = await onRedoEditStep();
            if (handled) {
              showToast('편집 1단계 다시 실행');
              return;
            }
          } catch (error) {
            editDebugLog('edit-redo-step', error);
            const mapped = mapEditErrorToToast?.(error);
            if (mapped) {
              showToast(mapped);
            } else {
              showToast('다시 실행에 실패했습니다.');
            }
            return;
          }
        }

        const history = clipboardHistory.current;
        const nextSnapshot = history.future.pop();
        if (!nextSnapshot) return;

        e.preventDefault();
        const { nodes, edges } = useGraphStore.getState();
        history.past.push(snapshotGraphState(nodes, edges));
        const restored = applyGraphSnapshot(nextSnapshot);
        useGraphStore.setState(restored);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusNextNodeByType, mapEditErrorToToast, onRedoEditStep, onUndoEditStep, selectNodesByType]);

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

          <FloatingToolbar
            interactionMode={interactionMode}
            onInteractionModeChange={setInteractionMode}
            createMode={createMode}
            onCreateModeChange={setCreateMode}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitView={handleFitView}
            washiPresets={washiPresets}
            washiPresetEnabled={selectedWashiNodeIds.length > 0}
            activeWashiPresetId={activeWashiPresetId}
            onSelectWashiPreset={handleWashiPresetSelect}
          />
        </ReactFlow>

        {isContextMenuOpen && contextMenuContext && contextMenuItems.length > 0 && (
          <ContextMenu
            isOpen={isContextMenuOpen}
            position={contextMenuContext.position}
            items={contextMenuItems}
            context={contextMenuContext}
            onClose={onCloseContextMenu}
          />
        )}

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
  onCreateNode,
}: GraphCanvasProps) {
  return (
    <div className="w-full h-full min-h-[500px] flex-1 relative">
      <ReactFlowProvider>
        <NavigationProvider>
          <ZoomProvider>
            <BubbleProvider>
              <GraphCanvasContent
                onNodeDragStop={onNodeDragStop}
                onWashiPresetChange={onWashiPresetChange}
                onUndoEditStep={onUndoEditStep}
                onRedoEditStep={onRedoEditStep}
                mapEditErrorToToast={mapEditErrorToToast}
                onRenameNode={onRenameNode}
                onCreateNode={onCreateNode}
              />
            </BubbleProvider>
          </ZoomProvider>
        </NavigationProvider>
      </ReactFlowProvider>
    </div>
  );
}
