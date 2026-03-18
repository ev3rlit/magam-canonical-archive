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
import type {
  CanonicalObject,
  ValidationResult,
} from '@/features/render/canonicalObject';
import type { ActionRoutingPendingRecord } from '@/features/editing/actionRoutingBridge/types';
import {
  applySessionUpdate,
  createStaleUpdateDiagnostic,
  createWorkspaceStyleSessionState,
  interpretWorkspaceStyle,
  resolveEligibleObjectProfileForNode,
  type InterpretedStyleResult,
  type StylingDiagnostic,
  type WorkspaceStyleInput,
  type WorkspaceStyleRuntimeContext,
  type WorkspaceStyleSessionState,
} from '@/features/workspace-styling';
import {
  DEFAULT_ENTRYPOINT_RUNTIME_STATE,
  beginPendingUiAction as beginPendingUiActionReducer,
  clearEntrypointAnchor as clearEntrypointAnchorReducer,
  clearEntrypointAnchorsForNode as clearEntrypointAnchorsForNodeReducer,
  clearEntrypointAnchorsForSelection as clearEntrypointAnchorsForSelectionReducer,
  clearPendingUiAction as clearPendingUiActionReducer,
  closeEntrypointSurface as closeEntrypointSurfaceReducer,
  commitPendingUiAction as commitPendingUiActionReducer,
  createPendingUiAction,
  dismissEntrypointSurfaceOnSelectionChange as dismissEntrypointSurfaceOnSelectionChangeReducer,
  dismissEntrypointSurfaceOnViewportChange as dismissEntrypointSurfaceOnViewportChangeReducer,
  failPendingUiAction as failPendingUiActionReducer,
  mergeActiveTool,
  openEntrypointSurface as openEntrypointSurfaceReducer,
  registerEntrypointAnchor as registerEntrypointAnchorReducer,
  rollbackPendingUiAction as rollbackPendingUiActionReducer,
  setHoverTargetNodeId as setHoverTargetNodeIdReducer,
  syncGroupHoverRegistry,
  type EntrypointAnchorSnapshot,
  type EntrypointInteractionMode,
  type EntrypointRuntimeState,
  type OpenSurfaceDescriptor,
} from '@/features/canvas-ui-entrypoints/ui-runtime-state';
import type { ActionOptimisticLifecycleEvent } from '@/features/editing/actionRoutingBridge.types';

type SearchActionResult = {
  clearQuery?: boolean;
  clearHighlights?: boolean;
};

export type EditCompletionEventType =
  | 'ABSOLUTE_MOVE_COMMITTED'
  | 'TEXT_EDIT_COMMITTED'
  | 'ATTACH_RELATIVE_COMMITTED'
  | 'RELATIVE_MOVE_COMMITTED'
  | 'CONTENT_UPDATED'
  | 'STYLE_UPDATED'
  | 'NODE_RENAMED'
  | 'NODE_CREATED'
  | 'NODE_REPARENTED';

export interface EditCompletionEvent {
  eventId: string;
  type: EditCompletionEventType;
  nodeId: string;
  filePath: string;
  commandId: string;
  baseVersion: string;
  nextVersion: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  committedAt: number;
}

export type TextEditMode = 'text' | 'markdown-wysiwyg';

export interface TextEditAction {
  type: 'commit' | 'cancel';
  nodeId: string;
  requestId: number;
}

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

export interface CanonicalNodeData {
  canonicalObject?: CanonicalObject;
  canonicalValidation?: ValidationResult;
}

export interface MindMapGroup {
  id: string;
  layoutType: 'tree' | 'bidirectional' | 'radial' | 'compact' | 'compact-bidir' | 'depth-hybrid' | 'treemap-pack' | 'quadrant-pack' | 'voronoi-pack';
  basePosition: { x: number; y: number };
  spacing?: number;
  density?: number;
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
  sourceVersions: Record<string, string>;
  clientId: string;
  lastAppliedCommandId?: string;
  status: 'idle' | 'loading' | 'error' | 'success' | 'connected';
  error: AppError | null;
  selectedNodeIds: string[];
  needsAutoLayout: boolean; // true for MindMap, false for Canvas with explicit positions
  layoutType: 'tree' | 'bidirectional' | 'radial' | 'compact' | 'compact-bidir' | 'depth-hybrid' | 'treemap-pack' | 'quadrant-pack' | 'voronoi-pack'; // Layout algorithm type (legacy, for single MindMap)
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
  activeTextEditNodeId: string | null;
  textEditMode: TextEditMode | null;
  textEditDraft: string;
  textEditDirty: boolean;
  pendingTextEditAction: TextEditAction | null;
  editHistoryPast: EditCompletionEvent[];
  editHistoryFuture: EditCompletionEvent[];
  editHistoryMaxSize: number;
  entrypointRuntime: EntrypointRuntimeState;
  hoveredNodeIdsByGroupId: Record<string, string[]>;
  workspaceStyleSession: WorkspaceStyleSessionState;
  workspaceStyleByNodeId: Record<string, InterpretedStyleResult>;
  workspaceStyleDiagnosticsByNodeId: Record<string, StylingDiagnostic[]>;
  pendingActionRoutingByKey: Record<string, ActionRoutingPendingRecord>;
  actionRoutingPendingByToken: Record<string, ActionOptimisticLifecycleEvent>;
  setGraph: (graph: { nodes: Node[]; edges: Edge[]; needsAutoLayout?: boolean; layoutType?: 'tree' | 'bidirectional' | 'radial' | 'compact' | 'compact-bidir' | 'depth-hybrid' | 'treemap-pack' | 'quadrant-pack' | 'voronoi-pack'; mindMapGroups?: MindMapGroup[]; canvasBackground?: CanvasBackgroundStyle; canvasFontFamily?: FontFamilyPreset; sourceVersion?: string | null; sourceVersions?: Record<string, string> }) => void;
  setSourceVersion: (version: string | null) => void;
  setSourceVersionForFile: (filePath: string, version: string | null) => void;
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
  startTextEditSession: (input: { nodeId: string; initialDraft: string; mode: TextEditMode }) => void;
  updateTextEditDraft: (draft: string) => void;
  requestTextEditCommit: (nodeId: string) => void;
  requestTextEditCancel: (nodeId: string) => void;
  clearPendingTextEditAction: () => void;
  clearTextEditSession: () => void;
  setEntrypointInteractionMode: (mode: EntrypointInteractionMode) => void;
  setEntrypointCreateMode: (mode: EntrypointRuntimeState['activeTool']['createMode']) => void;
  openEntrypointSurface: (surface: OpenSurfaceDescriptor) => void;
  closeEntrypointSurface: () => void;
  dismissEntrypointSurfaceOnViewportChange: () => void;
  registerEntrypointAnchor: (anchor: EntrypointAnchorSnapshot) => void;
  clearEntrypointAnchor: (anchorId: string) => void;
  clearEntrypointAnchorsForNode: (nodeId: string) => void;
  setEntrypointHoverTarget: (nodeId: string | null) => void;
  beginPendingUiAction: (input: { requestId: string; actionType: string; targetIds: string[]; startedAt?: number }) => void;
  commitPendingUiAction: (requestId: string) => void;
  failPendingUiAction: (requestId: string, errorMessage?: string) => void;
  clearPendingUiAction: (requestId: string) => void;
  registerGroupHover: (groupId: string, nodeId: string) => void;
  unregisterGroupHover: (groupId: string, nodeId: string) => void;
  applyActionRoutingLifecycleEvent: (event: ActionOptimisticLifecycleEvent) => void;
  pushEditCompletionEvent: (event: EditCompletionEvent) => void;
  peekUndoEditEvent: () => EditCompletionEvent | null;
  peekRedoEditEvent: () => EditCompletionEvent | null;
  commitUndoEventSuccess: (eventId: string) => void;
  commitRedoEventSuccess: (eventId: string) => void;
  refreshWorkspaceStyles: () => void;
  registerPendingActionRouting: (record: ActionRoutingPendingRecord) => void;
  clearPendingActionRouting: (pendingKey: string) => void;
}

export const getDefaultTabTitle = (pageId: string): string => {
  const parts = pageId.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : pageId;
};

export function getNodeCanonicalObject(
  node: Pick<Node, 'data'> | null | undefined,
): CanonicalObject | undefined {
  const data = node?.data as CanonicalNodeData | undefined;
  return data?.canonicalObject;
}

export function getNodeCanonicalValidation(
  node: Pick<Node, 'data'> | null | undefined,
): ValidationResult | undefined {
  const data = node?.data as CanonicalNodeData | undefined;
  return data?.canonicalValidation;
}

const DEFAULT_MINDMAP_SPACING = 50;

type WorkspaceStyleStateSnapshot = {
  workspaceStyleSession: WorkspaceStyleSessionState;
  workspaceStyleByNodeId: Record<string, InterpretedStyleResult>;
  workspaceStyleDiagnosticsByNodeId: Record<string, StylingDiagnostic[]>;
};

type NodeSourceMeta = {
  filePath?: unknown;
};

function resolveStyleInputForNode(input: {
  node: Node;
  sourceVersions: Record<string, string>;
  currentFile: string | null;
  previousResult?: InterpretedStyleResult;
}): WorkspaceStyleInput | null {
  const data = ((input.node.data || {}) as Record<string, unknown>);
  const hasClassNameSurface = typeof data.className === 'string';
  if (!hasClassNameSurface && !input.previousResult) {
    return null;
  }

  const sourceMeta = (data.sourceMeta || {}) as NodeSourceMeta;
  const filePath = typeof sourceMeta.filePath === 'string' && sourceMeta.filePath.length > 0
    ? sourceMeta.filePath
    : input.currentFile;
  const sourceRevision = filePath
    ? (input.sourceVersions[filePath] ?? 'workspace-style:pending')
    : 'workspace-style:pending';

  return {
    objectId: input.node.id,
    className: hasClassNameSurface ? String(data.className || '') : '',
    sourceRevision,
    timestamp: Date.now(),
    groupId: typeof data.groupId === 'string' && data.groupId.length > 0 ? data.groupId : undefined,
  };
}

function buildWorkspaceStyleSnapshot(input: {
  nodes: Node[];
  sourceVersions: Record<string, string>;
  currentFile: string | null;
  previousSession: WorkspaceStyleSessionState;
  previousResults: Record<string, InterpretedStyleResult>;
  runtimeContext: WorkspaceStyleRuntimeContext;
}): WorkspaceStyleStateSnapshot {
  let workspaceStyleSession = input.previousSession;
  const workspaceStyleByNodeId: Record<string, InterpretedStyleResult> = {};
  const workspaceStyleDiagnosticsByNodeId: Record<string, StylingDiagnostic[]> = {};

  input.nodes.forEach((node) => {
    const previousResult = input.previousResults[node.id];
    const styleInput = resolveStyleInputForNode({
      node,
      sourceVersions: input.sourceVersions,
      currentFile: input.currentFile,
      previousResult,
    });
    if (!styleInput) {
      return;
    }

    const sessionUpdate = applySessionUpdate(workspaceStyleSession, {
      objectId: styleInput.objectId,
      sourceRevision: styleInput.sourceRevision,
      timestamp: styleInput.timestamp,
    });

    if (sessionUpdate.stale) {
      if (previousResult) {
        workspaceStyleByNodeId[node.id] = previousResult;
      }
      workspaceStyleDiagnosticsByNodeId[node.id] = [
        createStaleUpdateDiagnostic({
          objectId: styleInput.objectId,
          revision: styleInput.sourceRevision,
          latestAcceptedRevision: workspaceStyleSession.byObjectId[styleInput.objectId]?.latestAcceptedRevision ?? styleInput.sourceRevision,
        }),
      ];
      return;
    }

    workspaceStyleSession = sessionUpdate.state;
    const interpreted = interpretWorkspaceStyle({
      styleInput,
      eligibleProfile: resolveEligibleObjectProfileForNode(node),
      runtimeContext: input.runtimeContext,
    });

    if (styleInput.className.trim().length > 0 || previousResult) {
      workspaceStyleByNodeId[node.id] = interpreted.result;
    }
    if (interpreted.diagnostics.length > 0) {
      workspaceStyleDiagnosticsByNodeId[node.id] = interpreted.diagnostics;
    }
  });

  return {
    workspaceStyleSession,
    workspaceStyleByNodeId,
    workspaceStyleDiagnosticsByNodeId,
  };
}

function resolveWorkspaceStyleRuntimeContext(): WorkspaceStyleRuntimeContext {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      colorScheme: 'light',
      viewportWidth: 0,
    };
  }

  return {
    colorScheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    viewportWidth: window.innerWidth,
  };
}

const normalizeMindMapGroup = (group: MindMapGroup): MindMapGroup => ({
  ...group,
  spacing: group.spacing ?? DEFAULT_MINDMAP_SPACING,
});

const selectLeastRecentlyUsedTab = (tabs: TabState[]): TabState | null => {
  return tabs.reduce<TabState | null>((acc, tab) => {
    if (!acc) return tab;
    return tab.lastAccessedAt < acc.lastAccessedAt ? tab : acc;
  }, null);
};

const getNow = () => Date.now();

function resetEntrypointRuntimeState(input: {
  current: EntrypointRuntimeState;
  preserveActiveTool?: boolean;
}): EntrypointRuntimeState {
  return {
    ...DEFAULT_ENTRYPOINT_RUNTIME_STATE,
    activeTool: input.preserveActiveTool
      ? { ...input.current.activeTool }
      : { ...DEFAULT_ENTRYPOINT_RUNTIME_STATE.activeTool },
  };
}

function getPendingActionTypesForEvent(event: EditCompletionEvent): string[] {
  switch (event.type) {
    case 'ABSOLUTE_MOVE_COMMITTED':
      return ['node.move.absolute'];
    case 'ATTACH_RELATIVE_COMMITTED':
    case 'RELATIVE_MOVE_COMMITTED':
      return ['node.move.relative'];
    case 'CONTENT_UPDATED':
    case 'TEXT_EDIT_COMMITTED':
      return ['node.content.update'];
    case 'STYLE_UPDATED':
      return ['node.style.update'];
    case 'NODE_RENAMED':
      return ['node.rename'];
    case 'NODE_CREATED':
      return ['node.create', 'mindmap.child.create', 'mindmap.sibling.create'];
    case 'NODE_REPARENTED':
      return ['node.reparent'];
    default:
      return [];
  }
}

function reconcilePendingUiActionsAfterEdit(
  state: EntrypointRuntimeState,
  event: EditCompletionEvent,
): EntrypointRuntimeState {
  if (state.pendingByRequestId[event.commandId]) {
    return clearPendingUiActionReducer(
      commitPendingUiActionReducer(state, event.commandId),
      event.commandId,
    );
  }

  const eligibleActionTypes = getPendingActionTypesForEvent(event);
  let nextState = state;
  Object.entries(state.pendingByRequestId).forEach(([requestId, pending]) => {
    if (
      eligibleActionTypes.includes(pending.actionType)
      && pending.targetIds.includes(event.nodeId)
    ) {
      nextState = clearPendingUiActionReducer(
        commitPendingUiActionReducer(nextState, requestId),
        requestId,
      );
    }
  });
  return nextState;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],
  files: [],
  fileTree: null,
  expandedFolders: new Set<string>(),
  currentFile: null,
  graphId: uuidv4(),
  sourceVersion: null,
  sourceVersions: {},
  clientId: uuidv4(),
  lastAppliedCommandId: undefined,
  status: 'idle',
  error: null,
  selectedNodeIds: [],
  needsAutoLayout: false,
  layoutType: 'compact',
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
  activeTextEditNodeId: null,
  textEditMode: null,
  textEditDraft: '',
  textEditDirty: false,
  pendingTextEditAction: null,
  editHistoryPast: [],
  editHistoryFuture: [],
  editHistoryMaxSize: 200,
  entrypointRuntime: DEFAULT_ENTRYPOINT_RUNTIME_STATE,
  hoveredNodeIdsByGroupId: {},
  workspaceStyleSession: createWorkspaceStyleSessionState(),
  workspaceStyleByNodeId: {},
  workspaceStyleDiagnosticsByNodeId: {},
  pendingActionRoutingByKey: {},
  actionRoutingPendingByToken: {},
  setGraph: ({
    nodes,
    edges,
    needsAutoLayout = false,
    layoutType,
    mindMapGroups = [],
    canvasBackground,
    canvasFontFamily,
    sourceVersion,
    sourceVersions,
  }) => set((state) => {
    const nextSourceVersions = sourceVersions ?? state.sourceVersions;
    const normalizedMindMapGroups = mindMapGroups.map(normalizeMindMapGroup);
    const resolvedLayoutType = layoutType ?? normalizedMindMapGroups[0]?.layoutType ?? 'compact';
    const workspaceStyleState = buildWorkspaceStyleSnapshot({
      nodes,
      sourceVersions: nextSourceVersions,
      currentFile: state.currentFile,
      previousSession: state.workspaceStyleSession,
      previousResults: state.workspaceStyleByNodeId,
      runtimeContext: resolveWorkspaceStyleRuntimeContext(),
    });
    return {
      nodes,
      edges,
      needsAutoLayout,
      layoutType: resolvedLayoutType,
      mindMapGroups: normalizedMindMapGroups,
      graphId: uuidv4(),
      ...(canvasBackground ? { canvasBackground } : {}),
      ...(isFontFamilyPreset(canvasFontFamily) ? { canvasFontFamily } : { canvasFontFamily: undefined }),
      ...(sourceVersion !== undefined ? { sourceVersion } : {}),
      sourceVersions: nextSourceVersions,
      entrypointRuntime: resetEntrypointRuntimeState({
        current: state.entrypointRuntime,
        preserveActiveTool: true,
      }),
      hoveredNodeIdsByGroupId: {},
      ...workspaceStyleState,
    };
  }),
  setSourceVersion: (sourceVersion) => set({ sourceVersion }),
  setSourceVersionForFile: (filePath, version) => set((state) => {
    if (!filePath) {
      return state;
    }

    const nextSourceVersions = { ...state.sourceVersions };
    if (version) {
      nextSourceVersions[filePath] = version;
    } else {
      delete nextSourceVersions[filePath];
    }

    const workspaceStyleState = buildWorkspaceStyleSnapshot({
      nodes: state.nodes,
      sourceVersions: nextSourceVersions,
      currentFile: state.currentFile,
      previousSession: state.workspaceStyleSession,
      previousResults: state.workspaceStyleByNodeId,
      runtimeContext: resolveWorkspaceStyleRuntimeContext(),
    });

    return {
      sourceVersions: nextSourceVersions,
      ...(state.currentFile === filePath ? { sourceVersion: version } : {}),
      entrypointRuntime: {
        ...state.entrypointRuntime,
        hover: {
          ...state.entrypointRuntime.hover,
          nodeIdsByGroupId: {},
          targetNodeId: null,
        },
      },
      hoveredNodeIdsByGroupId: {},
      ...workspaceStyleState,
    };
  }),
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
  setCurrentFile: (currentFile) => set((state) => {
    const workspaceStyleState = buildWorkspaceStyleSnapshot({
      nodes: state.nodes,
      sourceVersions: state.sourceVersions,
      currentFile,
      previousSession: state.workspaceStyleSession,
      previousResults: state.workspaceStyleByNodeId,
      runtimeContext: resolveWorkspaceStyleRuntimeContext(),
    });
    return {
      currentFile,
      sourceVersion: currentFile ? (state.sourceVersions[currentFile] ?? null) : null,
      entrypointRuntime: resetEntrypointRuntimeState({
        current: state.entrypointRuntime,
        preserveActiveTool: true,
      }),
      hoveredNodeIdsByGroupId: {},
      ...workspaceStyleState,
    };
  }),
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
  setSelectedNodes: (selectedNodeIds) => set((state) => {
    const shouldClearTextEdit =
      Boolean(state.activeTextEditNodeId)
      && !selectedNodeIds.includes(state.activeTextEditNodeId as string);
    const nextRuntime = clearEntrypointAnchorsForSelectionReducer(
      dismissEntrypointSurfaceOnSelectionChangeReducer(state.entrypointRuntime),
      selectedNodeIds,
    );
    return {
      selectedNodeIds,
      entrypointRuntime: nextRuntime,
      ...(shouldClearTextEdit
        ? {
            activeTextEditNodeId: null,
            textEditMode: null,
            textEditDraft: '',
            textEditDirty: false,
            pendingTextEditAction: null,
          }
        : {}),
    };
  }),
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
  updateNodeData: (nodeId, partialData) => set((state) => {
    const nodes = state.nodes.map((node) => {
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
    });
    return {
      nodes,
      ...buildWorkspaceStyleSnapshot({
        nodes,
        sourceVersions: state.sourceVersions,
        currentFile: state.currentFile,
        previousSession: state.workspaceStyleSession,
        previousResults: state.workspaceStyleByNodeId,
        runtimeContext: resolveWorkspaceStyleRuntimeContext(),
      }),
    };
  }),
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
  startTextEditSession: ({ nodeId, initialDraft, mode }) => set({
    activeTextEditNodeId: nodeId,
    textEditMode: mode,
    textEditDraft: initialDraft,
    textEditDirty: false,
    pendingTextEditAction: null,
  }),
  updateTextEditDraft: (textEditDraft) => set((state) => ({
    textEditDraft,
    textEditDirty: state.activeTextEditNodeId
      ? textEditDraft !== state.textEditDraft || state.textEditDirty
      : false,
  })),
  requestTextEditCommit: (nodeId) => set((state) => {
    if (state.activeTextEditNodeId !== nodeId) {
      return state;
    }
    return {
      pendingTextEditAction: {
        type: 'commit',
        nodeId,
        requestId: Date.now(),
      },
    };
  }),
  requestTextEditCancel: (nodeId) => set((state) => {
    if (state.activeTextEditNodeId !== nodeId) {
      return state;
    }
    return {
      pendingTextEditAction: {
        type: 'cancel',
        nodeId,
        requestId: Date.now(),
      },
    };
  }),
  clearPendingTextEditAction: () => set({ pendingTextEditAction: null }),
  clearTextEditSession: () => set({
    activeTextEditNodeId: null,
    textEditMode: null,
    textEditDraft: '',
    textEditDirty: false,
    pendingTextEditAction: null,
  }),
  setEntrypointInteractionMode: (mode) => set((state) => ({
    entrypointRuntime: mergeActiveTool(state.entrypointRuntime, {
      interactionMode: mode,
    }),
  })),
  setEntrypointCreateMode: (mode) => set((state) => ({
    entrypointRuntime: mergeActiveTool(state.entrypointRuntime, {
      createMode: mode,
    }),
  })),
  openEntrypointSurface: (surface) => set((state) => ({
    entrypointRuntime: openEntrypointSurfaceReducer(state.entrypointRuntime, surface),
  })),
  closeEntrypointSurface: () => set((state) => ({
    entrypointRuntime: closeEntrypointSurfaceReducer(state.entrypointRuntime),
  })),
  dismissEntrypointSurfaceOnViewportChange: () => set((state) => ({
    entrypointRuntime: dismissEntrypointSurfaceOnViewportChangeReducer(state.entrypointRuntime),
  })),
  registerEntrypointAnchor: (anchor) => set((state) => ({
    entrypointRuntime: registerEntrypointAnchorReducer(state.entrypointRuntime, anchor),
  })),
  clearEntrypointAnchor: (anchorId) => set((state) => ({
    entrypointRuntime: clearEntrypointAnchorReducer(state.entrypointRuntime, anchorId),
  })),
  clearEntrypointAnchorsForNode: (nodeId) => set((state) => ({
    entrypointRuntime: clearEntrypointAnchorsForNodeReducer(state.entrypointRuntime, nodeId),
  })),
  setEntrypointHoverTarget: (nodeId) => set((state) => ({
    entrypointRuntime: setHoverTargetNodeIdReducer(state.entrypointRuntime, nodeId),
  })),
  beginPendingUiAction: (input) => set((state) => ({
    entrypointRuntime: beginPendingUiActionReducer(
      state.entrypointRuntime,
      createPendingUiAction(input),
    ),
  })),
  commitPendingUiAction: (requestId) => set((state) => ({
    entrypointRuntime: commitPendingUiActionReducer(state.entrypointRuntime, requestId),
  })),
  failPendingUiAction: (requestId, errorMessage) => set((state) => ({
    entrypointRuntime: failPendingUiActionReducer(state.entrypointRuntime, requestId, errorMessage),
  })),
  clearPendingUiAction: (requestId) => set((state) => ({
    entrypointRuntime: clearPendingUiActionReducer(state.entrypointRuntime, requestId),
  })),
  registerGroupHover: (groupId, nodeId) => set((state) => {
    if (!groupId || !nodeId) return state;
    const current = state.hoveredNodeIdsByGroupId[groupId] ?? [];
    if (current.includes(nodeId)) {
      return state;
    }
    const nextMap = {
      ...state.hoveredNodeIdsByGroupId,
      [groupId]: [...current, nodeId],
    };
    return {
      hoveredNodeIdsByGroupId: nextMap,
      entrypointRuntime: syncGroupHoverRegistry(state.entrypointRuntime, nextMap),
    };
  }),
  unregisterGroupHover: (groupId, nodeId) => set((state) => {
    if (!groupId || !nodeId) return state;
    const current = state.hoveredNodeIdsByGroupId[groupId] ?? [];
    if (current.length === 0) {
      return state;
    }
    const next = current.filter((candidate) => candidate !== nodeId);
    if (next.length === current.length) {
      return state;
    }
    const nextMap = { ...state.hoveredNodeIdsByGroupId };
    if (next.length === 0) {
      delete nextMap[groupId];
    } else {
      nextMap[groupId] = next;
    }
    return {
      hoveredNodeIdsByGroupId: nextMap,
      entrypointRuntime: syncGroupHoverRegistry(state.entrypointRuntime, nextMap),
    };
  }),
  applyActionRoutingLifecycleEvent: (event) => set((state) => {
    if (event.phase === 'apply') {
      return {
        actionRoutingPendingByToken: {
          ...state.actionRoutingPendingByToken,
          [event.optimisticToken]: event,
        },
      };
    }

    if (!(event.optimisticToken in state.actionRoutingPendingByToken)) {
      return state;
    }

    const nextPending = { ...state.actionRoutingPendingByToken };
    delete nextPending[event.optimisticToken];
    return {
      actionRoutingPendingByToken: nextPending,
    };
  }),
  pushEditCompletionEvent: (event) => set((state) => {
    const nextPast = [...state.editHistoryPast, event];
    if (nextPast.length > state.editHistoryMaxSize) {
      nextPast.shift();
    }
    return {
      editHistoryPast: nextPast,
      editHistoryFuture: [],
      entrypointRuntime: reconcilePendingUiActionsAfterEdit(state.entrypointRuntime, event),
    };
  }),
  peekUndoEditEvent: () => {
    const { editHistoryPast } = get();
    if (editHistoryPast.length === 0) return null;
    return editHistoryPast[editHistoryPast.length - 1];
  },
  peekRedoEditEvent: () => {
    const { editHistoryFuture } = get();
    if (editHistoryFuture.length === 0) return null;
    return editHistoryFuture[editHistoryFuture.length - 1];
  },
  commitUndoEventSuccess: (eventId) => set((state) => {
    const last = state.editHistoryPast[state.editHistoryPast.length - 1];
    if (!last || last.eventId !== eventId) {
      return state;
    }
    return {
      editHistoryPast: state.editHistoryPast.slice(0, -1),
      editHistoryFuture: [...state.editHistoryFuture, last],
    };
  }),
  commitRedoEventSuccess: (eventId) => set((state) => {
    const last = state.editHistoryFuture[state.editHistoryFuture.length - 1];
    if (!last || last.eventId !== eventId) {
      return state;
    }
    return {
      editHistoryFuture: state.editHistoryFuture.slice(0, -1),
      editHistoryPast: [...state.editHistoryPast, last],
    };
  }),
  registerPendingActionRouting: (record) => set((state) => ({
    pendingActionRoutingByKey: {
      ...state.pendingActionRoutingByKey,
      [record.pendingKey]: record,
    },
  })),
  clearPendingActionRouting: (pendingKey) => set((state) => {
    if (!(pendingKey in state.pendingActionRoutingByKey)) {
      return state;
    }
    const next = { ...state.pendingActionRoutingByKey };
    delete next[pendingKey];
    return {
      pendingActionRoutingByKey: next,
    };
  }),
  refreshWorkspaceStyles: () => set((state) => buildWorkspaceStyleSnapshot({
    nodes: state.nodes,
    sourceVersions: state.sourceVersions,
    currentFile: state.currentFile,
    previousSession: state.workspaceStyleSession,
    previousResults: state.workspaceStyleByNodeId,
    runtimeContext: resolveWorkspaceStyleRuntimeContext(),
  })),
}));
