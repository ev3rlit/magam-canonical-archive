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
import { useElkLayout } from '../hooks/useElkLayout';
import { resolveAnchors } from '@/utils/anchorResolver';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { ZoomProvider } from '@/contexts/ZoomContext';
import { BubbleProvider } from '@/contexts/BubbleContext';
import { BubbleOverlay } from './BubbleOverlay';
import { Loader2, Check } from 'lucide-react';
import { FloatingToolbar, InteractionMode } from './FloatingToolbar';
import { useExportImage } from '@/hooks/useExportImage';
import { ContextMenu } from './ContextMenu';
import { useContextMenu } from '@/hooks/useContextMenu';
import { ExportDialog } from './ExportDialog';
import { CustomBackground } from './CustomBackground';
import { resolveFontFamilyCssValue } from '@/utils/fontHierarchy';
import {
  applyGraphSnapshot,
  createPastedGraphState,
  isGraphClipboardPayload,
  snapshotGraphState,
  type GraphSnapshot,
} from '@/utils/clipboardGraph';
import { getPresetPatternCatalog, resolvePresetPatternId } from '@/utils/washiTapeDefaults';
import type { PresetPatternId } from '@/types/washiTape';

type GraphCanvasProps = {
  onNodeDragStop?: (nodeId: string, x: number, y: number) => Promise<void> | void;
  onWashiPresetChange?: (nodeIds: string[], presetId: PresetPatternId) => Promise<void> | void;
};

function GraphCanvasContent({ onNodeDragStop, onWashiPresetChange }: GraphCanvasProps) {
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
    graphId,
    needsAutoLayout,
    layoutType,
    mindMapGroups,
    canvasBackground,
    globalFontFamily,
    canvasFontFamily,
  } = useGraphStore();

  const canvasResolvedFontFamily = useMemo(
    () => resolveFontFamilyCssValue({ canvasFontFamily, globalFontFamily }),
    [canvasFontFamily, globalFontFamily],
  );

  const { calculateLayout, isLayouting } = useElkLayout();
  const nodesInitialized = useNodesInitialized();
  const { zoomIn, zoomOut, fitView, getZoom, setNodes, getNodes } = useReactFlow();
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
  const hasLayouted = useRef(false);
  const lastLayoutedGraphId = useRef<string | null>(null);
  const clipboardHistory = useRef<{ past: GraphSnapshot[]; future: GraphSnapshot[] }>({
    past: [],
    future: [],
  });
  const dragOriginPositions = useRef<Map<string, { x: number; y: number }>>(new Map());
  const washiPresets = useMemo(() => getPresetPatternCatalog(), []);
  const selectedWashiNodeIds = useMemo(
    () => nodes
      .filter((node) => selectedNodeIds.includes(node.id) && node.type === 'washi-tape')
      .map((node) => node.id),
    [nodes, selectedNodeIds],
  );

  const activeWashiPresetId = useMemo<PresetPatternId | null>(() => {
    if (selectedWashiNodeIds.length === 0) return null;

    const selectedNodes = nodes.filter((node) => selectedWashiNodeIds.includes(node.id));
    const presetIds = selectedNodes
      .map((node) => resolvePresetPatternId((node.data as Record<string, unknown>)?.preset
        ?? (node.data as Record<string, unknown>)?.presetId
        ?? (node.data as Record<string, unknown>)?.pattern))
      .filter(Boolean);

    if (presetIds.length === 0) return null;
    const first = presetIds[0];
    const allSame = presetIds.every((presetId) => presetId === first);
    return allSame ? first : null;
  }, [nodes, selectedWashiNodeIds]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const handleZoomIn = () => {
    zoomIn({ duration: 300 });
    setTimeout(() => {
      showToast(`Zoom: ${Math.round(getZoom() * 100)}%`);
    }, 350);
  };

  const handleZoomOut = () => {
    zoomOut({ duration: 300 });
    setTimeout(() => {
      showToast(`Zoom: ${Math.round(getZoom() * 100)}%`);
    }, 350);
  };

  const handleFitView = () => {
    fitView({ duration: 300 });
    setTimeout(() => {
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
  }), [copyImageToClipboard, handleFitView, selectMindMapGroupByNodeId]);

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


  // Reset layout state when new graph is loaded
  useEffect(() => {
    if (graphId !== lastLayoutedGraphId.current) {
      console.log('[Layout] New graph detected, resetting layout state.');
      hasLayouted.current = false;
      setIsGraphVisible(false); // Hide graph=
      lastLayoutedGraphId.current = graphId;
    }
  }, [graphId]);

  // Trigger Layout when all nodes are initialized (measured)
  useEffect(() => {
    // Additional check: verify ALL nodes have actual measured dimensions
    // This prevents race condition where nodesInitialized is briefly true
    // before new nodes are fully rendered after file watch updates
    const areAllNodesMeasured = nodes.length > 0 && nodes.every(
      (node) => typeof node.width === 'number' && typeof node.height === 'number' && node.width > 0 && node.height > 0
    );

    // Check if we have nodes, they are fully initialized (width/height measured), and we haven't run layout yet.
    if (nodes.length > 0 && nodesInitialized && areAllNodesMeasured && !hasLayouted.current) {
      const runLayout = async () => {
        // Double-check: wait one more frame to ensure DOM is fully settled
        await new Promise(resolve => requestAnimationFrame(resolve));

        // Re-verify measurements after the frame (in case of rapid updates)
        const currentNodes = useGraphStore.getState().nodes;
        const stillMeasured = currentNodes.every(
          (node) => typeof node.width === 'number' && typeof node.height === 'number' && node.width > 0 && node.height > 0
        );

        if (!stillMeasured || hasLayouted.current) {
          console.log('[Layout] Aborted: nodes changed or already layouted.');
          return;
        }

        if (needsAutoLayout) {
          // ELK layout now handles everything:
          // - Internal group layouts
          // - Global group positioning (with anchor resolution)
          console.log(`[Layout] Triggering ELK layout (${layoutType} mode, ${mindMapGroups.length} group(s))...`);
          await calculateLayout({
            direction: 'RIGHT',
            bidirectional: layoutType === 'bidirectional',
            mindMapGroups,
          });
        } else {
          // Canvas mode: check if any nodes use anchor-based positioning
          const hasAnchors = currentNodes.some((n) =>
            n.data?.anchor
            || (n.type === 'washi-tape'
              && (n.data as { at?: { type?: unknown } } | undefined)?.at?.type === 'attach'),
          );
          if (hasAnchors) {
            console.log('[Layout] Canvas mode with anchors, resolving anchor positions...');
            const resolved = resolveAnchors(currentNodes);
            setNodes(resolved);
            setTimeout(() => fitView({ duration: 300 }), 50);
          } else {
            console.log('[Layout] Canvas mode, no anchors, skipping layout.');
          }
        }

        console.log('[Layout] Layout pipeline finished.');
        hasLayouted.current = true;
        setIsGraphVisible(true);
      };

      runLayout();
    }
  }, [nodes.length, nodesInitialized, calculateLayout, graphId, needsAutoLayout, layoutType, mindMapGroups, nodes]);

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
      const selectedIds = selectedNodes.map((node) => node.id);
      setSelectedNodes(selectedIds);
    },
    [setSelectedNodes],
  );

  const onHandleNodeDragStart = useCallback(
    (_event: React.MouseEvent, node: FlowNode) => {
      dragOriginPositions.current.set(node.id, { x: node.position.x, y: node.position.y });
    },
    [],
  );

  const onHandleNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: FlowNode) => {
      if (!onNodeDragStop) return;

      try {
        await onNodeDragStop(node.id, node.position.x, node.position.y);

        const currentNodes = getNodes();
        const hasAnchors = currentNodes.some((n) =>
          n.data?.anchor
          || (n.type === 'washi-tape'
            && (n.data as { at?: { type?: unknown } } | undefined)?.at?.type === 'attach'),
        );

        if (hasAnchors) {
          const resolved = resolveAnchors(currentNodes);
          setNodes(resolved);
        }
      } catch (error) {
        const original = dragOriginPositions.current.get(node.id);
        if (original) {
          setNodes((prev) => prev.map((n) => (n.id === node.id ? { ...n, position: original } : n)));
        }

        const code = (error as { code?: number })?.code;
        if (code === 40901) {
          showToast('외부 수정 감지: 최신 상태로 다시 동기화합니다.');
        } else {
          showToast('편집 실패: 이전 상태로 롤백되었습니다.');
        }
      } finally {
        dragOriginPositions.current.delete(node.id);
      }
    },
    [getNodes, onNodeDragStop, setNodes],
  );

  const handleWashiPresetSelect = useCallback(
    async (presetIdInput: string) => {
      if (selectedWashiNodeIds.length === 0) return;
      const presetId = resolvePresetPatternId(presetIdInput);

      const selectedIdSet = new Set(selectedWashiNodeIds);
      const previousData = new Map(
        nodes
          .filter((node) => selectedIdSet.has(node.id))
          .map((node) => [node.id, node.data]),
      );

      useGraphStore.setState((state) => ({
        nodes: state.nodes.map((node) => {
          if (!selectedIdSet.has(node.id)) {
            return node;
          }
          return {
            ...node,
            data: {
              ...(node.data || {}),
              preset: presetId,
              presetId,
              pattern: { type: 'preset', id: presetId },
            },
          };
        }),
      }));

      try {
        await onWashiPresetChange?.(selectedWashiNodeIds, presetId);
      } catch (error) {
        useGraphStore.setState((state) => ({
          nodes: state.nodes.map((node) => {
            const previous = previousData.get(node.id);
            if (!previous) {
              return node;
            }
            return { ...node, data: previous };
          }),
        }));

        const code = (error as { code?: number })?.code;
        if (code === 40901) {
          showToast('외부 수정 감지: 최신 상태로 다시 동기화합니다.');
        } else {
          showToast('와시 프리셋 변경 실패: 이전 상태로 롤백되었습니다.');
        }
      }
    },
    [nodes, onWashiPresetChange, selectedWashiNodeIds, showToast],
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
      const isUndo = (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z';
      const isRedo = (e.metaKey || e.ctrlKey)
        && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'));
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
        let dataToCopy;

        if (selectedNodeIds.length > 0) {
          const selectedNodeIdSet = new Set(selectedNodeIds);
          const selectedNodes = nodes.filter((node) => selectedNodeIdSet.has(node.id));
          const relatedEdges = edges.filter(
            (edge) => selectedNodeIdSet.has(edge.source) && selectedNodeIdSet.has(edge.target),
          );

          dataToCopy = {
            nodes: selectedNodes,
            edges: relatedEdges,
          };
        } else {
          dataToCopy = { nodes, edges };
        }

        const jsonString = JSON.stringify(dataToCopy, null, 2);
        navigator.clipboard
          .writeText(jsonString)
          .then(() => {
            console.log('Copied to clipboard:', dataToCopy);
          })
          .catch((err) => {
            console.error('Failed to copy:', err);
          });
        return;
      }

      if (isPaste) {
        if (typeof navigator.clipboard?.readText !== 'function') return;
        e.preventDefault();

        try {
          const text = await navigator.clipboard.readText();
          const parsed = JSON.parse(text);
          if (!isGraphClipboardPayload(parsed)) return;

          const { nodes, edges } = useGraphStore.getState();
          pushHistory(snapshotGraphState(nodes, edges));

          const next = createPastedGraphState(parsed, nodes, edges);
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
  }, [focusNextNodeByType, selectNodesByType]);

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
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStart={onHandleNodeDragStart}
          onNodeDragStop={onHandleNodeDragStop}
          onNodeContextMenu={onNodeContextMenu}
          onPaneContextMenu={onPaneContextMenu}
          onSelectionChange={onSelectionChange}
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

export function GraphCanvas({ onNodeDragStop, onWashiPresetChange }: GraphCanvasProps) {
  return (
    <div className="w-full h-full min-h-[500px] flex-1 relative">
      <ReactFlowProvider>
        <NavigationProvider>
          <ZoomProvider>
            <BubbleProvider>
              <GraphCanvasContent
                onNodeDragStop={onNodeDragStop}
                onWashiPresetChange={onWashiPresetChange}
              />
            </BubbleProvider>
          </ZoomProvider>
        </NavigationProvider>
      </ReactFlowProvider>
    </div>
  );
}
