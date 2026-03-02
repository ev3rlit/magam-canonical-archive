'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFileSync } from '@/hooks/useFileSync';
import { GraphCanvas } from '@/components/GraphCanvas';
import { Sidebar } from '@/components/ui/Sidebar';
import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import { TabBar } from '@/components/ui/TabBar';
import {
  QuickOpenDialog,
  type QuickOpenCommand,
} from '@/components/ui/QuickOpenDialog';
import { ErrorOverlay } from '@/components/ui/ErrorOverlay';
import { SearchOverlay } from '@/components/ui/SearchOverlay';
import { StickerInspector } from '@/components/ui/StickerInspector';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { useChatStore } from '@/store/chat';
import { TabState, useGraphStore } from '@/store/graph';
import { normalizeStickerData } from '@/utils/stickerDefaults';
import {
  getWashiPresetPatternCatalog,
  normalizeStickyDefaults,
  normalizeWashiDefaults,
} from '@/utils/washiTapeDefaults';
import {
  getWashiNodePosition,
  resolveWashiGeometry,
} from '@/utils/washiTapeGeometry';
import { extractNodeContent, extractStickerContent } from '@/utils/nodeContent';
import { stickerDebugLog } from '@/utils/stickerDebug';
import type { FontFamilyPreset } from '@magam/core';
import { isFontFamilyPreset } from '@/utils/fontHierarchy';

interface RenderNode {
  type: string;
  props: {
    id?: string;
    from?: string;
    to?: string;
    label?: string;
    text?: string;
    title?: string;
    x?: number;
    y?: number;
    type?: string;
    color?: string;
    bg?: string;
    className?: string;
    fontSize?: number;
    labelColor?: string;
    labelFontSize?: number;
    labelBold?: boolean;
    bold?: boolean;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    labelTextColor?: string;
    labelBgColor?: string;
    // MindMap Node specific
    edgeLabel?: string;
    edgeClassName?: string;
    // Markdown specific
    content?: string;
    variant?: string;
    src?: string;
    imageSrc?: string;
    alt?: string;
    fit?: string;
    imageFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
    // Washi tape specific
    pattern?: Record<string, unknown>;
    edge?: Record<string, unknown>;
    texture?: Record<string, unknown>;
    at?: Record<string, unknown>;
    shape?: 'rectangle' | 'heart' | 'cloud' | 'speech';
    seed?: string | number;
    opacity?: number;
    // Anchor positioning
    anchor?: string;
    position?: string;
    gap?: number;
    align?: 'start' | 'center' | 'end';
    // Size
    width?: number;
    height?: number;
    // MindMap container specific
    layout?: 'tree' | 'bidirectional' | 'radial' | 'compact' | 'compact-bidir' | 'depth-hybrid';
    spacing?: number;
    outlineWidth?: number;
    outlineColor?: string;
    shadow?: 'none' | 'sm' | 'md' | 'lg';
    padding?: number;
    rotation?: number;
    fontFamily?: FontFamilyPreset;
    // Semantic zoom
    bubble?: boolean;
    // Sequence diagram specific
    participantSpacing?: number;
    messageSpacing?: number;
    sourceMeta?: {
      sourceId: string;
      kind: 'canvas' | 'mindmap';
      scopeId?: string;
    };
    children?: any; // Keep children loosely typed for now as it can be strings/numbers/arrays
  };
  children?: RenderNode[];
}

type PendingTabCloseRequest = {
  tabIds: string[];
};

type TabContextMenuState = {
  tabId: string;
  x: number;
  y: number;
};

type MagamTestHooks = {
  getState: () => {
    openTabs: TabState[];
    activeTabId: string | null;
  };
  getActiveTabId: () => string | null;
  getOpenTabs: () => TabState[];
  markTabDirty: (tabId: string, dirty: boolean) => void;
};

declare global {
  interface Window {
    __magamTest?: MagamTestHooks;
  }
}

export default function Home() {
  const {
    setFiles,
    setGraph,
    currentFile,
    files,
    nodes,
    selectedNodeIds,
    selectNodesByType,
    focusNextNodeByType,
    openTabs,
    activeTabId,
    openTab,
    activateTab,
    closeTab,
    markTabDirty,
    replaceLeastRecentlyUsedTab,
    isSearchOpen,
    openSearch,
    closeSearch,
    setError: setGraphError,
  } = useGraphStore();
  const toggleChat = useChatStore((state) => state.toggleOpen);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false);
  const [pendingReplaceRequest, setPendingReplaceRequest] = useState<{
    replaceTabId: string;
    pageId: string;
  } | null>(null);
  const [pendingCloseRequest, setPendingCloseRequest] =
    useState<PendingTabCloseRequest | null>(null);
  const [tabContextMenu, setTabContextMenu] =
    useState<TabContextMenuState | null>(null);
  const tabContextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    window.__magamTest = {
      getState: () => ({
        openTabs,
        activeTabId,
      }),
      getActiveTabId: () => activeTabId,
      getOpenTabs: () => openTabs,
      markTabDirty: (tabId, dirty) => {
        markTabDirty(tabId, dirty);
      },
    };
  }, [activeTabId, markTabDirty, openTabs]);

  // File sync - triggers re-render when file changes externally
  const handleFileChange = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Load file list from API
  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/files');
      const data = await res.json();
      if (data.files) {
        setFiles(data.files);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  }, [setFiles]);

  // File sync with reload callback for file list changes
  const { updateNode, moveNode } = useFileSync(currentFile, handleFileChange, loadFiles);

  // Initial file load
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const executeCloseTabs = useCallback(
    (tabIds: string[]) => {
      const targetTabIds = openTabs
        .filter((tab) => tabIds.includes(tab.tabId))
        .map((tab) => tab.tabId);
      targetTabIds.forEach((targetTabId) => {
        closeTab(targetTabId);
      });
    },
    [closeTab, openTabs],
  );

  const requestCloseTabs = useCallback(
    (tabIds: string[]) => {
      const uniqueTabIds = Array.from(new Set(tabIds));
      if (uniqueTabIds.length === 0) {
        return;
      }
      const targetTabs = openTabs.filter((tab) =>
        uniqueTabIds.includes(tab.tabId),
      );
      if (targetTabs.length === 0) {
        return;
      }

      const dirtyTabIds = targetTabs
        .filter((tab) => tab.dirty)
        .map((tab) => tab.tabId);

      if (dirtyTabIds.length > 0) {
        console.debug('[Telemetry] tabs_close_dirty_prompted', {
          source: 'request',
          tabCount: targetTabs.length,
          dirtyTabCount: dirtyTabIds.length,
        });
        setPendingCloseRequest({ tabIds: targetTabs.map((tab) => tab.tabId) });
        return;
      }

      executeCloseTabs(targetTabs.map((tab) => tab.tabId));
    },
    [executeCloseTabs, openTabs],
  );

  const requestCloseTab = useCallback(
    (tabId: string) => {
      requestCloseTabs([tabId]);
    },
    [requestCloseTabs],
  );

  const openTabByPath = useCallback(
    (pageId: string) => {
      const result = openTab(pageId);
      if (result.status === 'blocked') {
        setPendingReplaceRequest({
          replaceTabId: result.replaceTabId,
          pageId,
        });
        return false;
      }
      setPendingReplaceRequest(null);
      setIsQuickOpenOpen(false);
      return true;
    },
    [openTab],
  );

  const handleWashiPresetChange = useCallback(
    async (nodeIds: string[], presetId: string) => {
      await Promise.all(
        nodeIds.map((nodeId) => updateNode(nodeId, { pattern: { type: 'preset', id: presetId } })),
      );
    },
    [updateNode],
  );

  const washiPresetCatalog = useMemo(() => getWashiPresetPatternCatalog(), []);
  const allWashiNodeIds = useMemo(
    () => nodes.filter((node) => node.type === 'washi-tape').map((node) => node.id),
    [nodes],
  );
  const selectedWashiNodeIds = useMemo(
    () => selectedNodeIds.filter((nodeId) => {
      const node = nodes.find((item) => item.id === nodeId);
      return node?.type === 'washi-tape';
    }),
    [nodes, selectedNodeIds],
  );

  const runQuickOpenCommand = useCallback(
    async (commandId: string) => {
      if (commandId === 'washi:select-all') {
        return selectNodesByType('washi-tape').length > 0;
      }

      if (commandId === 'washi:focus-next') {
        return focusNextNodeByType('washi-tape') !== null;
      }

      if (commandId.startsWith('washi:preset:')) {
        const presetId = commandId.replace('washi:preset:', '');
        if (selectedWashiNodeIds.length === 0) {
          return false;
        }

        selectedWashiNodeIds.forEach((nodeId) => {
          useGraphStore.getState().updateNodeData(nodeId, {
            pattern: { type: 'preset', id: presetId },
          });
        });

        try {
          await handleWashiPresetChange(selectedWashiNodeIds, presetId);
          return true;
        } catch (error) {
          console.error('Failed to apply washi preset from quick command:', error);
          return false;
        }
      }

      return false;
    },
    [
      focusNextNodeByType,
      handleWashiPresetChange,
      selectNodesByType,
      selectedWashiNodeIds,
    ],
  );

  const quickOpenCommands = useMemo<QuickOpenCommand[]>(() => {
    const hasWashiNode = allWashiNodeIds.length > 0;
    const hasWashiSelection = selectedWashiNodeIds.length > 0;

    const baseCommands: QuickOpenCommand[] = [
      {
        id: 'washi:select-all',
        label: 'Washi: 전체 선택',
        hint: hasWashiNode ? `${allWashiNodeIds.length}개` : '없음',
        keywords: ['washi', 'select', 'all', '전체', '선택'],
        disabled: !hasWashiNode,
      },
      {
        id: 'washi:focus-next',
        label: 'Washi: 다음 노드 포커스',
        hint: hasWashiNode ? '순환' : '없음',
        keywords: ['washi', 'focus', 'next', '포커스'],
        disabled: !hasWashiNode,
      },
    ];

    const presetCommands = washiPresetCatalog.map((preset) => ({
      id: `washi:preset:${preset.id}`,
      label: `Washi preset: ${preset.label}`,
      hint: hasWashiSelection ? `${selectedWashiNodeIds.length}개 선택됨` : '와시 선택 필요',
      keywords: ['washi', 'preset', preset.id, preset.label.toLowerCase()],
      disabled: !hasWashiSelection,
    }));

    return [...baseCommands, ...presetCommands];
  }, [allWashiNodeIds.length, selectedWashiNodeIds.length, washiPresetCatalog]);

  const confirmLimitReplace = useCallback(() => {
    if (!pendingReplaceRequest) return;
    replaceLeastRecentlyUsedTab(
      pendingReplaceRequest.pageId,
      pendingReplaceRequest.replaceTabId,
    );
    setPendingReplaceRequest(null);
    setIsQuickOpenOpen(false);
  }, [pendingReplaceRequest, replaceLeastRecentlyUsedTab]);

  const cancelLimitReplace = useCallback(() => {
    setPendingReplaceRequest(null);
  }, []);

  const requestCloseCurrentTabFromMenu = useCallback(() => {
    if (!tabContextMenu) return;
    requestCloseTab(tabContextMenu.tabId);
    setTabContextMenu(null);
  }, [requestCloseTab, tabContextMenu]);

  const requestCloseOtherTabsFromMenu = useCallback(() => {
    if (!tabContextMenu) return;
    requestCloseTabs(
      openTabs
        .filter((tab) => tab.tabId !== tabContextMenu.tabId)
        .map((tab) => tab.tabId),
    );
    setTabContextMenu(null);
  }, [openTabs, requestCloseTabs, tabContextMenu]);

  const requestCloseAllTabsFromMenu = useCallback(() => {
    requestCloseTabs(openTabs.map((tab) => tab.tabId));
    setTabContextMenu(null);
  }, [openTabs, requestCloseTabs]);

  const confirmTabClose = useCallback(
    (shouldSave: boolean) => {
      if (!pendingCloseRequest) return;

      if (shouldSave) {
        pendingCloseRequest.tabIds.forEach((tabId) => {
          markTabDirty(tabId, false);
        });
      }
      executeCloseTabs(pendingCloseRequest.tabIds);
      setPendingCloseRequest(null);
    },
    [executeCloseTabs, markTabDirty, pendingCloseRequest],
  );

  const cancelTabClose = useCallback(() => {
    setPendingCloseRequest(null);
  }, []);

  const activeTab = useMemo(
    () => openTabs.find((tab) => tab.tabId === activeTabId) || null,
    [activeTabId, openTabs],
  );

  const pendingCloseTabInfos = useMemo(() => {
    if (!pendingCloseRequest) return null;
    const tabsToClose = openTabs.filter((tab) =>
      pendingCloseRequest.tabIds.includes(tab.tabId),
    );
    const dirtyTabs = tabsToClose.filter((tab) => tab.dirty);
    return {
      total: tabsToClose.length,
      dirtyTotal: dirtyTabs.length,
      tabNames: tabsToClose.map((tab) => tab.title || tab.pageId),
    };
  }, [openTabs, pendingCloseRequest]);

  const openTabContextMenu = useCallback(
    (tabId: string, event: React.MouseEvent) => {
      setTabContextMenu({
        tabId,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [],
  );

  const closeTabContextMenu = useCallback(() => {
    setTabContextMenu(null);
  }, []);

  useEffect(() => {
    if (!tabContextMenu) {
      return;
    }

    const handlePointer = (event: MouseEvent | TouchEvent) => {
      if (!tabContextMenuRef.current || !event.target) {
        return;
      }
      if (!tabContextMenuRef.current.contains(event.target as Node)) {
        setTabContextMenu(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTabContextMenu(null);
      }
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [tabContextMenu]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean =>
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target as HTMLElement)?.isContentEditable;

    const handleShortcut = (event: KeyboardEvent) => {
      if (pendingReplaceRequest || pendingCloseRequest || tabContextMenu) {
        return;
      }

      const isModifierPressed = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (!isModifierPressed) return;
      if (isEditableTarget(event.target)) return;

      if (key === 't') {
        event.preventDefault();
        setIsQuickOpenOpen(true);
        return;
      }

      if (key === 'j') {
        event.preventDefault();
        toggleChat();
        return;
      }

      if (key === 'k') {
        event.preventDefault();
        if (isSearchOpen) {
          closeSearch({ clearQuery: true, clearHighlights: true });
        } else {
          openSearch();
        }
        return;
      }

      if (key === 'w') {
        event.preventDefault();
        if (activeTab) {
          requestCloseTab(activeTab.tabId);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [
    activeTab,
    pendingCloseRequest,
    pendingReplaceRequest,
    requestCloseTab,
    tabContextMenu,
    isSearchOpen,
    openSearch,
    closeSearch,
    toggleChat,
  ]);

  useEffect(() => {
    async function renderFile() {
      if (!currentFile) return;

      try {
        setGraphError(null); // Clear previous errors

        const response = await fetch('/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: currentFile }),
        });

        const data = await response.json();

        if (!response.ok) {
          // Handle structured error from backend
          const errorMessage = data.error || 'Unknown rendering error';

          // Try to extract location info from the error message or details
          let location = undefined;

          // Regex to find "at filename:line:col" pattern common in stack traces
          // or custom format "file.tsx:10:5"
          if (data.details && typeof data.details === 'string') {
            // Look for specific file match if available
            const match = data.details.match(
              /([a-zA-Z0-9_-]+\.tsx?):(\d+):(\d+)/,
            );
            if (match) {
              location = {
                file: match[1],
                line: parseInt(match[2]),
                column: parseInt(match[3]),
              };
            }
          }

          setGraphError({
            message: errorMessage,
            type: data.type || 'RENDER_ERROR',
            details: data.details,
            location,
          });
          return;
        }

        if (data && data.graph && data.graph.children) {
          const { children } = data.graph;

          const nodes: any[] = [];
          const edges: any[] = [];

          // Helper to map user edge types to React Flow types
          const getEdgeType = (type?: string) => {
            // default -> smoothstep (rounded polyline, default in React Flow logic below)
            // straight -> straight
            // curved -> default (bezier)
            // step -> step
            switch (type) {
              case 'straight':
                return 'straight';
              case 'curved':
                return 'default';
              case 'step':
                return 'step';
              case 'default':
                return 'smoothstep';
              default:
                return 'smoothstep';
            }
          };

          // Helper to map Tailwind classes to SVG stroke styles
          const getStrokeStyle = (className?: string) => {
            if (!className) return {};
            if (
              className.includes('dashed') ||
              className.includes('border-dashed')
            ) {
              return { strokeDasharray: '5 5' };
            }
            if (
              className.includes('dotted') ||
              className.includes('border-dotted')
            ) {
              return { strokeDasharray: '2 2' };
            }
            return {};
          };

          const normalizeFontFamily = (value?: unknown): FontFamilyPreset | undefined => (
            isFontFamilyPreset(value) ? value : undefined
          );

          let nodeIdCounter = 0;
          let edgeIdCounter = 0;
          let mindmapIdCounter = 0;
          let sequenceIdCounter = 0;
          let imageIdCounter = 0;

          // Track MindMap groups for layout
          const mindMapGroups: {
            id: string;
            layoutType: 'tree' | 'bidirectional' | 'radial' | 'compact' | 'compact-bidir' | 'depth-hybrid';
            basePosition: { x: number; y: number };
            spacing?: number;
            anchor?: string;
            anchorPosition?: string;
            anchorGap?: number;
          }[] = [];

          // Helper to resolve node ID with mindmap scope
          // - If ID contains '.', it's already fully qualified (e.g., "map1.node1")
          // - Otherwise, prefix with current mindmapId if inside a mindmap
          const resolveNodeId = (
            id: string,
            currentMindmapId?: string,
          ): string => {
            if (!id) return id;
            if (id.includes('.')) return id; // Already fully qualified
            if (currentMindmapId) return `${currentMindmapId}.${id}`; // Add prefix
            return id; // No prefix for Canvas nodes
          };
          // Helper to process children recursively or flatly
          // mindmapId: current MindMap context (undefined for Canvas)
          const processChildren = (
            childElements: RenderNode[],
            mindmapId?: string,
          ) => {
            childElements.forEach((child: RenderNode) => {
              if (child.type === 'graph-edge') {
                // Top-level edge
                // Parse source and target for ports (nodeId:portId) or cross-mindmap (map.node:port)
                const parseEdgeEndpoint = (val?: string) => {
                  if (!val) return { id: undefined, handle: undefined };

                  // Check for port notation (id:handle)
                  // But also support dot notation for cross-mindmap (map.node)
                  // Format: "nodeId", "nodeId:handle", "map.nodeId", "map.nodeId:handle"
                  const colonIndex = val.lastIndexOf(':');
                  if (colonIndex > 0) {
                    const id = val.substring(0, colonIndex);
                    const handle = val.substring(colonIndex + 1);
                    return { id: resolveNodeId(id, mindmapId), handle };
                  }
                  return {
                    id: resolveNodeId(val, mindmapId),
                    handle: undefined,
                  };
                };

                const sourceMeta = parseEdgeEndpoint(child.props.from);
                const targetMeta = parseEdgeEndpoint(child.props.to);
                const edgeFontFamily = normalizeFontFamily(child.props.fontFamily);

                // Determine edge type: if handles are specified, use traditional edge; otherwise use floating
                const hasHandles = sourceMeta.handle || targetMeta.handle;
                const edgeType = hasHandles
                  ? getEdgeType(child.props.type)
                  : 'floating';

                edges.push({
                  id: child.props.id || `edge-${edgeIdCounter++}`,
                  source: sourceMeta.id,
                  sourceHandle: sourceMeta.handle,
                  target: targetMeta.id,
                  targetHandle: targetMeta.handle,
                  label: child.props.label,
                  style: {
                    stroke: child.props.stroke || '#94a3b8',
                    strokeWidth: child.props.strokeWidth || 2,
                    ...getStrokeStyle(child.props.className),
                  },
                  labelStyle: {
                    fill: child.props.labelTextColor,
                    fontSize: child.props.labelFontSize,
                    fontWeight: 700,
                    fontFamily: edgeFontFamily,
                  },
                  labelBgStyle: child.props.labelBgColor
                    ? {
                        fill: child.props.labelBgColor,
                      }
                    : undefined,
                  animated: false,
                  type: edgeType,
                });
              } else if (child.type === 'graph-mindmap') {
                // MindMap container: extract ID and process children with scope
                const mmId = child.props.id || `mindmap-${mindmapIdCounter++}`;
                const layoutType =
                  (child.props.layout as 'tree' | 'bidirectional' | 'radial' | 'compact' | 'compact-bidir' | 'depth-hybrid') ||
                  'tree';
                const baseX = child.props.x ?? 0;
                const baseY = child.props.y ?? 0;

                // Register MindMap group
                mindMapGroups.push({
                  id: mmId,
                  layoutType,
                  basePosition: { x: baseX, y: baseY },
                  spacing: child.props.spacing,
                  anchor: child.props.anchor,
                  anchorPosition: child.props.position,
                  anchorGap: child.props.gap,
                });

                // Process children with this MindMap's ID as scope
                if (child.children && child.children.length > 0) {
                  processChildren(child.children, mmId);
                }
              } else if (child.type === 'graph-sequence') {
                // Sequence diagram: single ReactFlow node containing the entire diagram
                const seqId =
                  child.props.id || `sequence-${sequenceIdCounter++}`;
                const sequenceFontFamily = normalizeFontFamily(child.props.fontFamily);
                const participants: {
                  id: string;
                  label: string;
                  className?: string;
                }[] = [];
                const messages: {
                  from: string;
                  to: string;
                  label?: string;
                  type: string;
                }[] = [];

                (child.children || []).forEach((seqChild: RenderNode) => {
                  if (seqChild.type === 'graph-participant') {
                    participants.push({
                      id: seqChild.props.id || '',
                      label: seqChild.props.label || seqChild.props.id || '',
                      className: seqChild.props.className,
                    });
                  } else if (seqChild.type === 'graph-message') {
                    const msgFrom = seqChild.props.from || '';
                    const msgTo = seqChild.props.to || '';
                    messages.push({
                      from: msgFrom,
                      to: msgTo,
                      label: seqChild.props.label,
                      type:
                        msgFrom === msgTo
                          ? 'self'
                          : seqChild.props.type || 'sync',
                    });
                  }
                });

                nodes.push({
                  id: seqId,
                  type: 'sequence-diagram',
                  position: { x: child.props.x || 0, y: child.props.y || 0 },
                  data: {
                    participants,
                    messages,
                    participantSpacing: child.props.participantSpacing ?? 200,
                    messageSpacing: child.props.messageSpacing ?? 60,
                    className: child.props.className,
                    fontFamily: sequenceFontFamily,
                    anchor: child.props.anchor,
                    position: child.props.position,
                    gap: child.props.gap,
                    sourceMeta: child.props.sourceMeta || {
                      sourceId: seqId,
                      kind: 'canvas',
                    },
                  },
                });
              } else if (child.type === 'graph-node') {
                // MindMap Node: process as a regular node and create edge from 'from' prop
                const rawNodeId = child.props.id || `node-${nodeIdCounter++}`;
                const nodeId = resolveNodeId(rawNodeId, mindmapId);

                // Create edge from 'from' prop if it exists
                if (child.props.from) {
                  // Resolve the source node ID (supports dot notation for cross-MindMap refs)
                  const sourceId = resolveNodeId(child.props.from, mindmapId);
                  edges.push({
                    id: `edge-${sourceId}-${nodeId}`,
                    source: sourceId,
                    target: nodeId,
                    label: child.props.edgeLabel,
                    style: {
                      stroke: '#94a3b8',
                      strokeWidth: 2,
                      ...getStrokeStyle(child.props.edgeClassName),
                    },
                    animated: false,
                    type: 'floating', // Use floating edge for MindMap
                  });
                }

                const rendererChildren = child.children || [];
                const { label: baseLabel, parsedChildren } = extractNodeContent(
                  rendererChildren,
                  child.props.children,
                  { textJoiner: '\n' },
                );

                const textChildren = baseLabel
                  ? [{ type: 'text' as const, text: baseLabel }]
                  : [];

                // Track bubble from children (Markdown may have bubble prop)
                let childBubble = false;

                rendererChildren.forEach((grandChild: RenderNode) => {
                  if (grandChild.type === 'graph-markdown') {
                    // Extract bubble from Markdown child
                    if (grandChild.props.bubble) {
                      childBubble = true;
                    }
                  } else if (grandChild.type === 'graph-image') {
                    const imageSrc = grandChild.props.src;
                    const imageAlt = grandChild.props.alt || '';
                    if (imageSrc) {
                      const markdownToken = `![${imageAlt}](${imageSrc})`;
                      textChildren.push({ type: 'text', text: markdownToken });
                    }
                  }
                });

                const safeLabel =
                  textChildren.map((content) => content.text).join('\n') ||
                  child.props.label ||
                  '';

                // Check if any child is markdown or image to switch node type
                const hasMarkdown = rendererChildren.some(
                  (c: RenderNode) =>
                    c.type === 'graph-markdown' || c.type === 'graph-image',
                );

                // Bubble comes from: 1) Node's bubble prop OR 2) child Markdown's bubble prop
                const nodeBubble = child.props.bubble || childBubble;
                const nodeFontFamily = normalizeFontFamily(child.props.fontFamily);

                nodes.push({
                  id: nodeId,
                  // Use 'markdown' type if markdown/image content is present, otherwise 'shape'
                  type: hasMarkdown ? 'markdown' : 'shape',
                  position: { x: child.props.x || 0, y: child.props.y || 0 },
                  data: {
                    label: safeLabel,
                    type: child.props.type || 'rectangle', // for shapes
                    color: child.props.color || child.props.bg,
                    className: child.props.className, // Tailwind support
                    groupId: mindmapId, // For multi-MindMap layout grouping
                    sourceMeta: child.props.sourceMeta || {
                      sourceId: nodeId,
                      kind: mindmapId ? 'mindmap' : 'canvas',
                      scopeId: mindmapId,
                    },

                    // Rich text props
                    fontSize: child.props.fontSize,
                    // ... pass through other style props manually or spread carefully
                    labelColor: child.props.labelColor || child.props.color, // Text nodes might use color prop
                    labelFontSize:
                      child.props.labelFontSize || child.props.fontSize,
                    labelBold: child.props.labelBold || child.props.bold,
                    fill: child.props.fill,
                    stroke: child.props.stroke,
                    fontFamily: nodeFontFamily,
                    children: parsedChildren,
                    // Semantic zoom bubble (from Node or child Markdown)
                    bubble: nodeBubble,
                  },
                });
              } else if (child.type === 'graph-image') {
                const imageId = child.props.id || `image-${imageIdCounter++}`;
                nodes.push({
                  id: imageId,
                  type: 'image',
                  position: { x: child.props.x || 0, y: child.props.y || 0 },
                  data: {
                    src: child.props.src || '',
                    alt: child.props.alt,
                    width: child.props.width,
                    height: child.props.height,
                    fit: child.props.fit,
                    sourceMeta: child.props.sourceMeta || {
                      sourceId: imageId,
                      kind: 'canvas',
                    },
                  },
                });
              } else if (child.type === 'graph-sticker') {
                const rawStickerId = child.props.id || `sticker-${nodeIdCounter++}`;
                const stickerId = resolveNodeId(rawStickerId, mindmapId);
                const stickerFontFamily = normalizeFontFamily(child.props.fontFamily);
                const stickerRendererChildren = child.children || [];
                const { label: stickerLabel, parsedChildren: stickerChildren } = extractStickerContent(
                  stickerRendererChildren,
                  child.props.children,
                  { textJoiner: ' ' },
                );
                const normalized = normalizeStickerData(child.props);

                stickerDebugLog('parser', {
                  stickerId,
                  label: stickerLabel || child.props.label || '',
                  rawTypes: stickerRendererChildren.map((item) => item.type),
                  parsedTypes: stickerChildren.map((item) => item.type),
                  outlineWidth: normalized.outlineWidth,
                  outlineColor: normalized.outlineColor,
                  shadow: normalized.shadow,
                  padding: normalized.padding,
                  anchor: child.props.anchor,
                  position: child.props.position,
                });

                nodes.push({
                  id: stickerId,
                  type: 'sticker',
                  position: { x: child.props.x || 0, y: child.props.y || 0 },
                  data: {
                    label: stickerLabel || child.props.label || '',
                    width: child.props.width,
                    height: child.props.height,
                    rotation: child.props.rotation,
                    fontFamily: stickerFontFamily,
                    children: stickerChildren,
                    outlineWidth: normalized.outlineWidth,
                    outlineColor: normalized.outlineColor,
                    shadow: normalized.shadow,
                    padding: normalized.padding,

                    // Anchor positioning props
                    anchor: child.props.anchor,
                    position: child.props.position,
                    gap: child.props.gap,
                    align: child.props.align,
                  },
                });
              } else if (child.type === 'graph-washi-tape') {
                const rawWashiId = child.props.id || `washi-${nodeIdCounter++}`;
                const washiId = resolveNodeId(rawWashiId, mindmapId);
                const washiRendererChildren = child.children || [];
                const { label: washiLabel, parsedChildren: washiChildren } = extractStickerContent(
                  washiRendererChildren,
                  child.props.children,
                  { textJoiner: ' ' },
                );
                const normalizedWashi = normalizeWashiDefaults({
                  ...child.props,
                  id: washiId,
                });
                const resolvedGeometry = resolveWashiGeometry({
                  at: normalizedWashi.at,
                  nodes,
                  seed: normalizedWashi.seed,
                  fallbackPosition: {
                    x: child.props.x || 0,
                    y: child.props.y || 0,
                  },
                });
                const defaultPosition = getWashiNodePosition(resolvedGeometry);

                nodes.push({
                  id: washiId,
                  type: 'washi-tape',
                  position: {
                    x:
                      typeof child.props.x === 'number'
                        ? child.props.x
                        : defaultPosition.x,
                    y:
                      typeof child.props.y === 'number'
                        ? child.props.y
                        : defaultPosition.y,
                  },
                  data: {
                    label: washiLabel || child.props.label || '',
                    pattern: child.props.pattern ?? normalizedWashi.pattern,
                    edge: child.props.edge,
                    texture: child.props.texture,
                    text: child.props.text,
                    at: normalizedWashi.at,
                    resolvedGeometry,
                    seed: normalizedWashi.seed,
                    opacity: normalizedWashi.opacity,
                    children: washiChildren,
                    sourceMeta: child.props.sourceMeta || {
                      sourceId: washiId,
                      kind: mindmapId ? 'mindmap' : 'canvas',
                      scopeId: mindmapId,
                    },
                  },
                });
              } else {
                // It's a Node (Sticky, Shape, Text)
                const nodeId = child.props.id || `node-${nodeIdCounter++}`;
                const nodeFontFamily = normalizeFontFamily(child.props.fontFamily);

                // Separate node content from nested edges
                const nestedEdges: RenderNode[] = [];
                const ports: any[] = [];

                // Check render output children first (from renderer.ts)
                const rendererChildren = child.children || [];
                const {
                  label: parsedLabel,
                  parsedChildren,
                } = extractNodeContent(rendererChildren, child.props.children);

                rendererChildren.forEach((grandChild: RenderNode) => {
                  if (grandChild.type === 'graph-edge') {
                    nestedEdges.push(grandChild);
                  } else if (grandChild.type === 'graph-port') {
                    ports.push(grandChild.props);
                  }
                });

                // Process nested edges: source is implicitly the parent node
                nestedEdges.forEach(
                  (edgeChild: RenderNode, edgeIndex: number) => {
                    // If 'from' is missing, inject parent id
                    const sourceId = edgeChild.props.from || nodeId;
                    const edgeFontFamily = normalizeFontFamily(edgeChild.props.fontFamily);

                    edges.push({
                      id:
                        edgeChild.props.id ||
                        `nested-edge-${nodeId}-${edgeIndex}`,
                      source: sourceId,
                      target: edgeChild.props.to,
                      label: edgeChild.props.label,
                      style: {
                        stroke: edgeChild.props.stroke || '#94a3b8',
                        strokeWidth: edgeChild.props.strokeWidth || 2,
                        ...getStrokeStyle(edgeChild.props.className),
                      },
                      labelStyle: {
                        fill: edgeChild.props.labelTextColor,
                        fontSize: edgeChild.props.labelFontSize,
                        fontWeight: 700,
                        fontFamily: edgeFontFamily,
                      },
                      labelBgStyle: edgeChild.props.labelBgColor
                        ? {
                            fill: edgeChild.props.labelBgColor,
                          }
                        : undefined,
                      animated: false,
                      type: getEdgeType(edgeChild.props.type),
                    });
                  },
                );

                // Extract primitive content (strings/numbers) key for label
                const safeLabel =
                  parsedLabel ||
                  child.props.label ||
                  child.props.title ||
                  child.props.text ||
                  '';

                // Create Node Object
                const nodeType =
                  child.type === 'graph-sticky'
                    ? 'sticky'
                    : child.type === 'graph-text'
                      ? 'text'
                      : 'shape';

                const normalizedSticky = nodeType === 'sticky'
                  ? normalizeStickyDefaults({
                    ...child.props,
                    id: nodeId,
                  })
                  : null;
                const stickyAtInput = normalizedSticky?.at;

                nodes.push({
                  id: nodeId,
                  type: nodeType,
                  position: {
                    x: typeof child.props.x === 'number' ? child.props.x : 0,
                    y: typeof child.props.y === 'number' ? child.props.y : 0,
                  },
                  data: {
                    label: safeLabel,
                    type: child.props.type || 'rectangle', // for shapes
                    shape: nodeType === 'sticky' ? normalizedSticky?.shape : undefined,
                    color: child.props.color || child.props.bg,
                    className: child.props.className, // Tailwind support
                    pattern:
                      nodeType === 'sticky'
                        ? child.props.pattern ?? normalizedSticky?.pattern
                        : child.props.pattern,
                    at:
                      nodeType === 'sticky'
                        ? child.props.at ?? stickyAtInput
                        : child.props.at,

                    // Rich text props
                    fontSize: child.props.fontSize,
                    // ... pass through other style props manually or spread carefully
                    labelColor: child.props.labelColor || child.props.color, // Text nodes might use color prop
                    labelFontSize:
                      child.props.labelFontSize || child.props.fontSize,
                    labelBold: child.props.labelBold || child.props.bold,
                    fill: child.props.fill,
                    stroke: child.props.stroke,
                    fontFamily: nodeFontFamily,
                    children: parsedChildren,
                    imageSrc: child.props.imageSrc,
                    imageFit: child.props.imageFit,
                    ports: ports, // Inject ports

                    // Anchor positioning props
                    anchor: child.props.anchor,
                    position: child.props.position,
                    gap: child.props.gap,
                    align: child.props.align,

                    // Size hints for anchor calculations
                    width: nodeType === 'sticky' ? (normalizedSticky?.width ?? child.props.width) : child.props.width,
                    height: nodeType === 'sticky' ? (normalizedSticky?.height ?? child.props.height) : child.props.height,
                    // Semantic zoom bubble
                    bubble: child.props.bubble,
                    sourceMeta: child.props.sourceMeta || {
                      sourceId: nodeId,
                      kind: mindmapId ? 'mindmap' : 'canvas',
                      scopeId: mindmapId,
                    },
                  },
                });
              }
            });
          };

          // Process all children (populates mindMapGroups)
          processChildren(children);

          const finalizedNodes = nodes.map((node) => {
            if (node.type !== 'washi-tape') {
              return node;
            }

            const data = (node.data || {}) as Record<string, unknown>;
            const normalizedWashi = normalizeWashiDefaults({
              ...data,
              id: node.id,
              x: node.position.x,
              y: node.position.y,
            });
            const atInput = (data.at as Record<string, unknown> | undefined) ?? normalizedWashi.at;
            const resolvedGeometry = resolveWashiGeometry({
              at: atInput as any,
              nodes,
              seed: (data.seed as string | number | undefined) ?? normalizedWashi.seed,
              fallbackPosition: node.position,
            });
            const isAttach = (atInput as { type?: unknown }).type === 'attach';
            const attachedPosition = getWashiNodePosition(resolvedGeometry);

            return {
              ...node,
              position: isAttach ? attachedPosition : node.position,
              data: {
                ...(node.data || {}),
                at: atInput,
                resolvedGeometry,
              },
            };
          });

          // Detect if any mindmap nodes exist (they need auto layout)
          const hasMindMap = mindMapGroups.length > 0;
          // For backward compatibility, use first MindMap's layoutType as default
          const layoutType = mindMapGroups[0]?.layoutType || 'tree';

          // Extract canvas-level metadata (e.g. background style from code)
          const canvasBackground = data.graph.meta?.background;
          const canvasFontFamily = normalizeFontFamily(data.graph.meta?.fontFamily);

          setGraph({
            nodes: finalizedNodes,
            edges,
            needsAutoLayout: hasMindMap,
            layoutType,
            mindMapGroups,
            canvasBackground,
            canvasFontFamily,
            sourceVersion: data.sourceVersion ?? null,
          });
        }
      } catch (error) {
        console.error('Failed to render file:', error);
      }
    }

    renderFile();
  }, [currentFile, setGraph, refreshKey]); // refreshKey triggers re-render on file changes

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-900">
      <Sidebar onOpenFile={openTabByPath} />

      <div className="flex flex-1 flex-col h-full overflow-hidden relative">
        <Header />
        <ChatPanel />
        <TabBar
          tabs={openTabs}
          activeTabId={activeTabId}
          onActivate={activateTab}
          onClose={requestCloseTab}
          onContextMenu={openTabContextMenu}
        />

        <main className="flex-1 relative w-full h-full overflow-hidden">
          <ErrorOverlay />
          <SearchOverlay />
          <GraphCanvas
            onNodeDragStop={moveNode}
            onWashiPresetChange={handleWashiPresetChange}
          />
          <StickerInspector />
        </main>

        <Footer />

        <QuickOpenDialog
          isOpen={isQuickOpenOpen}
          files={files}
          commands={quickOpenCommands}
          onOpenFile={openTabByPath}
          onRunCommand={runQuickOpenCommand}
          onClose={() => setIsQuickOpenOpen(false)}
        />

        {tabContextMenu && (
          <div
            ref={tabContextMenuRef}
            role="menu"
            className="fixed z-50 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1"
            style={{
              left: `${Math.max(8, Math.min(tabContextMenu.x, window.innerWidth - 200))}px`,
              top: `${Math.max(8, Math.min(tabContextMenu.y, window.innerHeight - 130))}px`,
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                closeTabContextMenu();
              }
            }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={requestCloseCurrentTabFromMenu}
              className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              탭 닫기
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={requestCloseOtherTabsFromMenu}
              className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              다른 탭 닫기
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={requestCloseAllTabsFromMenu}
              className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              모든 탭 닫기
            </button>
          </div>
        )}

        {pendingCloseRequest && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center px-4"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelTabClose();
                return;
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                cancelTabClose();
              }
            }}
          >
            <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-4 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {pendingCloseTabInfos?.total === 1
                  ? '변경사항이 저장되지 않았습니다'
                  : `${pendingCloseTabInfos?.total ?? 0}개 탭에 저장되지 않은 변경사항이 있습니다`}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {pendingCloseTabInfos?.total === 1
                  ? '현재 탭을 닫으면 편집한 내용이 손실될 수 있습니다.'
                  : `${pendingCloseTabInfos?.dirtyTotal ?? 0}개 탭의 저장되지 않은 내용이 있습니다. 선택한 탭들을 닫으면 변경사항이 손실될 수 있습니다.`}
              </p>
              {!!pendingCloseTabInfos?.tabNames.length && (
                <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                  {pendingCloseTabInfos.tabNames.slice(0, 5).map((tabName) => (
                    <li key={tabName} className="truncate">
                      {tabName}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => confirmTabClose(false)}
                  className="rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  저장 안 함
                </button>
                <button
                  type="button"
                  onClick={() => confirmTabClose(true)}
                  className="rounded border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/40 px-3 py-1.5 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-800"
                >
                  저장 후 닫기
                </button>
                <button
                  type="button"
                  onClick={cancelTabClose}
                  className="rounded bg-slate-900 text-white px-3 py-1.5 text-xs font-medium hover:bg-slate-700"
                  autoFocus
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {pendingReplaceRequest && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center px-4"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelLimitReplace();
              }
            }}
          >
            <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-4 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                탭 개수 제한
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                최대 10개 탭이 열려 있습니다. 가장 오래 사용하지 않은 탭을
                교체하고 새 탭을 열까요?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelLimitReplace}
                  className="rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={confirmLimitReplace}
                  className="rounded bg-slate-900 text-white px-3 py-1.5 text-xs font-medium hover:bg-slate-700"
                  autoFocus
                >
                  교체 후 열기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
