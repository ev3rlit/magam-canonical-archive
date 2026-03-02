import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from 'reactflow';
import type { SearchMode, SearchResult } from '@/utils/search';
import type { FontFamilyPreset } from '@magam/core';
import {
  getStoredGlobalFontFamily,
  isFontFamilyPreset,
  persistGlobalFontFamily,
} from '@/utils/fontHierarchy';

type SearchActionResult = {
  clearQuery?: boolean;
  clearHighlights?: boolean;
};

export type CustomBackgroundData = { type: 'custom'; svg: string; gap: number };
export type CanvasBackgroundStyle = 'dots' | 'lines' | 'solid' | CustomBackgroundData;

export interface AppError {
  message: string;
  type?: string;
  location?: {
    file?: string;
    line?: number;
    column?: number;
    lineText?: string;
  };
  details?: any;
}

export interface MindMapGroup {
  id: string;
  layoutType: 'tree' | 'bidirectional' | 'radial' | 'compact' | 'compact-bidir' | 'depth-hybrid';
  basePosition: { x: number; y: number };
  spacing?: number;
  anchor?: string;
  anchorPosition?: string;
  anchorGap?: number;
}

export interface TabViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface TabSelectionState {
  nodeIds: string[];
  edgeIds: string[];
  updatedAt: number;
}

export interface TabState {
  tabId: string;
  pageId: string;
  title: string;
  dirty: boolean;
  lastViewport: TabViewportState | null;
  lastSelection: TabSelectionState | null;
  lastAccessedAt: number;
  createdAt: number;
}

export interface OpenTabResultActivated {
  status: 'activated' | 'opened';
  tabId: string;
}

export interface OpenTabResultBlocked {
  status: 'blocked';
  replaceTabId: string;
}

export type OpenTabResult = OpenTabResultActivated | OpenTabResultBlocked;

/**
 * File tree node structure for folder tree view
 */
export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

export interface GraphState {
  nodes: Node[];
  edges: Edge[];
  files: string[];
  fileTree: FileTreeNode | null;
  expandedFolders: Set<string>;
  currentFile: string | null;
  graphId: string; // Unique ID for the current graph data version
  sourceVersion: string | null;
  clientId: string;
  lastAppliedCommandId?: string;
  status: 'idle' | 'loading' | 'error' | 'success' | 'connected';
  error: AppError | null;
  selectedNodeIds: string[];
  needsAutoLayout: boolean; // true for MindMap, false for Canvas with explicit positions
  layoutType: 'tree' | 'bidirectional' | 'radial' | 'compact' | 'compact-bidir' | 'depth-hybrid'; // Layout algorithm type (legacy, for single MindMap)
  mindMapGroups: MindMapGroup[]; // Multiple MindMap support
  openTabs: TabState[];
  activeTabId: string | null;
  maxTabs: number;
  isSearchOpen: boolean;
  searchMode: SearchMode;
  searchQuery: string;
  searchResults: SearchResult[];
  activeResultIndex: number;
  highlightElementIds: string[];
  lastExecutedSearch?: SearchResult;
  setGraph: (graph: { nodes: Node[]; edges: Edge[]; needsAutoLayout?: boolean; layoutType?: 'tree' | 'bidirectional' | 'radial' | 'compact' | 'compact-bidir' | 'depth-hybrid'; mindMapGroups?: MindMapGroup[]; canvasBackground?: CanvasBackgroundStyle; canvasFontFamily?: FontFamilyPreset; sourceVersion?: string | null }) => void;
  setSourceVersion: (version: string | null) => void;
  setLastAppliedCommandId: (commandId?: string) => void;
  setFiles: (files: string[]) => void;
  setFileTree: (tree: FileTreeNode | null) => void;
  toggleFolder: (path: string) => void;
  setCurrentFile: (file: string) => void;
  setStatus: (status: GraphState['status']) => void;
  setError: (error: AppError | null) => void;
  setSelectedNodes: (selectedNodeIds: string[]) => void;
  selectNodesByType: (nodeType: string) => string[];
  focusNextNodeByType: (nodeType: string) => string | null;
  updateNodeData: (nodeId: string, partialData: Record<string, unknown>) => void;
  canvasBackground: CanvasBackgroundStyle;
  setCanvasBackground: (style: CanvasBackgroundStyle) => void;
  globalFontFamily: FontFamilyPreset;
  canvasFontFamily?: FontFamilyPreset;
  setGlobalFontFamily: (fontFamily: FontFamilyPreset) => void;
  setCanvasFontFamily: (fontFamily?: FontFamilyPreset) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  openTab: (pageId: string) => OpenTabResult;
  replaceLeastRecentlyUsedTab: (pageId: string, replaceTabId: string) => void;
  activateTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  markTabDirty: (tabId: string, dirty: boolean) => void;
  updateTabSnapshot: (tabId: string, snapshot: {
    lastViewport?: TabViewportState | null;
    lastSelection?: TabSelectionState | null;
  }) => void;
  openSearch: () => void;
  closeSearch: (options?: SearchActionResult) => void;
  setSearchMode: (mode: SearchMode) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: SearchResult[]) => void;
  moveSearchActiveIndex: (direction: 'up' | 'down') => void;
  setSearchActiveIndex: (index: number) => void;
  setSearchHighlightElementIds: (elementIds: string[]) => void;
  resetSearchState: () => void;
}

export const getDefaultTabTitle = (pageId: string): string => {
  const parts = pageId.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : pageId;
};

const selectLeastRecentlyUsedTab = (tabs: TabState[]): TabState | null => {
  return tabs.reduce<TabState | null>((acc, tab) => {
    if (!acc) return tab;
    return tab.lastAccessedAt < acc.lastAccessedAt ? tab : acc;
  }, null);
};

const getNow = () => Date.now();

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],
  files: [],
  fileTree: null,
  expandedFolders: new Set<string>(),
  currentFile: null,
  graphId: uuidv4(),
  sourceVersion: null,
  clientId: uuidv4(),
  lastAppliedCommandId: undefined,
  status: 'idle',
  error: null,
  selectedNodeIds: [],
  needsAutoLayout: false,
  layoutType: 'tree',
  canvasBackground: 'dots',
  globalFontFamily: getStoredGlobalFontFamily(),
  canvasFontFamily: undefined,
  mindMapGroups: [],
  openTabs: [],
  activeTabId: null,
  maxTabs: 10,
  isSearchOpen: false,
  searchMode: 'global',
  searchQuery: '',
  searchResults: [],
  activeResultIndex: -1,
  highlightElementIds: [],
  setGraph: ({ nodes, edges, needsAutoLayout = false, layoutType = 'tree', mindMapGroups = [], canvasBackground, canvasFontFamily, sourceVersion }) => set({
    nodes,
    edges,
    needsAutoLayout,
    layoutType,
    mindMapGroups,
    graphId: uuidv4(),
    ...(canvasBackground ? { canvasBackground } : {}),
    ...(isFontFamilyPreset(canvasFontFamily) ? { canvasFontFamily } : { canvasFontFamily: undefined }),
    ...(sourceVersion !== undefined ? { sourceVersion } : {}),
  }),
  setSourceVersion: (sourceVersion) => set({ sourceVersion }),
  setLastAppliedCommandId: (lastAppliedCommandId) => set({ lastAppliedCommandId }),
  setFiles: (files) => set({ files }),
  setFileTree: (fileTree) => set({ fileTree }),
  toggleFolder: (path) => set((state) => {
    const newExpanded = new Set(state.expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    return { expandedFolders: newExpanded };
  }),
  setCurrentFile: (currentFile) => set({ currentFile }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setCanvasBackground: (canvasBackground) => set({ canvasBackground }),
  setGlobalFontFamily: (globalFontFamily) => {
    persistGlobalFontFamily(globalFontFamily);
    set({ globalFontFamily });
  },
  setCanvasFontFamily: (canvasFontFamily) => set({
    canvasFontFamily: isFontFamilyPreset(canvasFontFamily) ? canvasFontFamily : undefined,
  }),
  setSelectedNodes: (selectedNodeIds) => set({ selectedNodeIds }),
  selectNodesByType: (nodeType) => {
    const ids = get().nodes
      .filter((node) => node.type === nodeType)
      .map((node) => node.id);
    set({ selectedNodeIds: ids });
    return ids;
  },
  focusNextNodeByType: (nodeType) => {
    const { nodes, selectedNodeIds } = get();
    const ids = nodes
      .filter((node) => node.type === nodeType)
      .map((node) => node.id);

    if (ids.length === 0) {
      return null;
    }

    const currentSelectedId = selectedNodeIds.find((id) => ids.includes(id));
    const currentIndex = currentSelectedId ? ids.indexOf(currentSelectedId) : -1;
    const nextId = ids[(currentIndex + 1) % ids.length];
    set({ selectedNodeIds: [nextId] });
    return nextId;
  },
  updateNodeData: (nodeId, partialData) => set((state) => ({
    nodes: state.nodes.map((node) => {
      if (node.id !== nodeId) {
        return node;
      }
      return {
        ...node,
        data: {
          ...(node.data || {}),
          ...partialData,
        },
      };
    }),
  })),
  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  openTab: (pageId) => {
    const { openTabs, maxTabs, activeTabId, currentFile } = get();
    const existingTab = openTabs.find((tab) => tab.pageId === pageId);
    const now = getNow();

    if (existingTab) {
      const nextTabs = openTabs.map((tab) => (
        tab.tabId === existingTab.tabId
          ? { ...tab, lastAccessedAt: now }
          : tab
      ));
      set({
        openTabs: nextTabs,
        activeTabId: existingTab.tabId,
        currentFile: pageId,
      });
      if (activeTabId !== existingTab.tabId || currentFile !== pageId) {
        console.debug('[Telemetry] tabs_switched', { tabId: existingTab.tabId, pageId, source: 'openTab' });
      }
      return { status: 'activated', tabId: existingTab.tabId };
    }

    if (openTabs.length >= maxTabs) {
      const replaceTab = selectLeastRecentlyUsedTab(openTabs);
      if (replaceTab) {
        console.debug('[Telemetry] tabs_limit_prompted', {
          pageId,
          replaceTabId: replaceTab.tabId,
          tabCount: openTabs.length,
        });
        return { status: 'blocked', replaceTabId: replaceTab.tabId };
      }
      return { status: 'blocked', replaceTabId: activeTabId || openTabs[0]?.tabId || '' };
    }

    const nextTab: TabState = {
      tabId: uuidv4(),
      pageId,
      title: getDefaultTabTitle(pageId),
      dirty: false,
      lastViewport: null,
      lastSelection: null,
      lastAccessedAt: now,
      createdAt: now,
    };

    set({
      openTabs: [...openTabs, nextTab],
      activeTabId: nextTab.tabId,
      currentFile: pageId,
    });
    console.debug('[Telemetry] tabs_opened', { tabId: nextTab.tabId, pageId, source: 'openTab' });
    return { status: 'opened', tabId: nextTab.tabId };
  },
  replaceLeastRecentlyUsedTab: (pageId, replaceTabId) => {
    const { openTabs } = get();
    const now = getNow();
    const exists = openTabs.some((tab) => tab.tabId === replaceTabId);
    if (!exists) {
      return;
    }

    const nextTabs = openTabs.map((tab) => (
      tab.tabId === replaceTabId
        ? {
            ...tab,
            pageId,
            title: getDefaultTabTitle(pageId),
            dirty: false,
            lastViewport: null,
            lastSelection: null,
            lastAccessedAt: now,
            createdAt: now,
          }
        : tab
    ));

    set({
      openTabs: nextTabs,
      activeTabId: replaceTabId,
      currentFile: pageId,
    });
    console.debug('[Telemetry] tabs_limit_replaced', { tabId: replaceTabId, pageId });
  },
  activateTab: (tabId) => {
    const { openTabs } = get();
    const tab = openTabs.find((item) => item.tabId === tabId);
    if (!tab) {
      return;
    }
    const now = getNow();
    set({
      openTabs: openTabs.map((item) => (
        item.tabId === tabId
          ? { ...item, lastAccessedAt: now }
          : item
      )),
      activeTabId: tabId,
      currentFile: tab.pageId,
    });
    console.debug('[Telemetry] tabs_switched', { tabId, pageId: tab.pageId, source: 'activateTab' });
  },
  closeTab: (tabId) => {
    const { openTabs, activeTabId, files } = get();
    const targetTab = openTabs.find((tab) => tab.tabId === tabId);
    if (!targetTab) {
      return;
    }

    const remainingTabs = openTabs.filter((tab) => tab.tabId !== tabId);
    const shouldClearActive = activeTabId === tabId;
    if (remainingTabs.length === 0) {
      console.debug('[Telemetry] tabs_closed', { tabId, pageId: targetTab.pageId, dirty: targetTab.dirty });
      const fallbackPageId = files.find((file) => file !== targetTab.pageId) ?? files[0];
      if (fallbackPageId) {
        const now = getNow();
        const fallbackTab: TabState = {
          tabId: uuidv4(),
          pageId: fallbackPageId,
          title: getDefaultTabTitle(fallbackPageId),
          dirty: false,
          lastViewport: null,
          lastSelection: null,
          lastAccessedAt: now,
          createdAt: now,
        };
        set({
          openTabs: [fallbackTab],
          activeTabId: fallbackTab.tabId,
          currentFile: fallbackPageId,
        });
        console.debug('[Telemetry] tabs_fallback_opened', { tabId: fallbackTab.tabId, pageId: fallbackPageId });
        return;
      }

      set({
        openTabs: [],
        activeTabId: null,
        currentFile: null,
      });
      return;
    }

    let nextActiveId = activeTabId;
    if (shouldClearActive) {
      const sortedTabs = [...openTabs];
      const targetIndex = sortedTabs.findIndex((tab) => tab.tabId === tabId);
      const nextAdjacent = sortedTabs[targetIndex + 1] ?? sortedTabs[targetIndex - 1] ?? remainingTabs[remainingTabs.length - 1];
      nextActiveId = nextAdjacent.tabId;
    }

    const nextActiveTab = remainingTabs.find((tab) => tab.tabId === nextActiveId) ?? remainingTabs[0];
    set({
      openTabs: remainingTabs,
      activeTabId: nextActiveTab?.tabId ?? null,
      currentFile: nextActiveTab?.pageId ?? null,
    });
    console.debug('[Telemetry] tabs_closed', { tabId, pageId: targetTab.pageId, dirty: targetTab.dirty });
  },
  markTabDirty: (tabId, dirty) => {
    set((state) => ({
      openTabs: state.openTabs.map((tab) => (
        tab.tabId === tabId ? { ...tab, dirty } : tab
      )),
    }));
  },
  updateTabSnapshot: (tabId, snapshot) => {
    set((state) => ({
      openTabs: state.openTabs.map((tab) => {
        if (tab.tabId !== tabId) {
          return tab;
        }
        return {
          ...tab,
          lastAccessedAt: getNow(),
          lastViewport: snapshot.lastViewport ?? tab.lastViewport,
          lastSelection: snapshot.lastSelection ?? tab.lastSelection,
        };
      }),
    }));
  },
  openSearch: () => {
    set({ isSearchOpen: true });
    console.debug('[Search] search_opened', {
      mode: get().searchMode,
      queryLength: get().searchQuery.length,
      openAt: Date.now(),
    });
  },
  closeSearch: ({ clearQuery = true, clearHighlights = true } = {}) => set((state) => ({
    isSearchOpen: false,
    searchMode: state.searchMode,
    searchQuery: clearQuery ? '' : state.searchQuery,
    searchResults: clearQuery ? [] : state.searchResults,
    activeResultIndex: -1,
    highlightElementIds: clearHighlights ? [] : state.highlightElementIds,
  })),
  setSearchMode: (searchMode) => set((state) => {
    console.debug('[Search] search_mode_changed', {
      before: state.searchMode,
      after: searchMode,
    });
    return {
      searchMode,
      activeResultIndex: state.searchResults.length > 0 ? 0 : -1,
    };
  }),
  setSearchQuery: (searchQuery) => {
    console.debug('[Search] search_query_changed', { length: searchQuery.length });
    set({
      searchQuery,
      searchResults: [],
      activeResultIndex: -1,
      ...(searchQuery.length === 0 ? { highlightElementIds: [] } : {}),
    });
  },
  setSearchResults: (searchResults) => set((state) => ({
    searchResults,
    activeResultIndex: searchResults.length > 0
      ? Math.min(Math.max(state.activeResultIndex, 0), searchResults.length - 1)
      : -1,
  })),
  moveSearchActiveIndex: (direction) => set((state) => {
    if (state.searchResults.length === 0) {
      return { activeResultIndex: -1 };
    }

    if (state.activeResultIndex < 0) {
      return { activeResultIndex: 0 };
    }

    const maxIndex = state.searchResults.length - 1;
    const nextIndex = direction === 'down'
      ? (state.activeResultIndex + 1) % state.searchResults.length
      : (state.activeResultIndex - 1 + state.searchResults.length) % state.searchResults.length;

    return {
      activeResultIndex: Math.min(Math.max(nextIndex, 0), maxIndex),
    };
  }),
  setSearchActiveIndex: (index) => set((state) => ({
    activeResultIndex:
      state.searchResults.length === 0
        ? -1
        : Math.min(Math.max(index, 0), state.searchResults.length - 1),
  })),
  setSearchHighlightElementIds: (highlightElementIds) => set({
    highlightElementIds,
  }),
  resetSearchState: () => set({
    isSearchOpen: false,
    searchMode: 'global',
    searchQuery: '',
    searchResults: [],
    activeResultIndex: -1,
    highlightElementIds: [],
  }),
}));
