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
  GLOBAL_FONT_PREFERENCE_KEY,
  isFontFamilyPreset,
  parseGlobalFontPreferenceValue,
  persistGlobalFontFamily,
} from '@/utils/fontHierarchy';
import type {
  CanonicalObject,
  ValidationResult,
} from '@/features/render/canonicalObject';
import type {
  PluginNodeRuntimeState,
  PluginRuntimeDiagnostic,
} from '@/features/plugin-runtime';
import type { ActionRoutingPendingRecord } from '@/features/editing/actionRoutingBridge/types';
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
import {
  buildRegisteredWorkspace,
  hydrateWorkspaceRegistryFromAppState,
  lastActiveCanvasMapToPreferenceInput,
  normalizeWorkspaceCanvasPath,
  type LastActiveCanvasMap,
  removeWorkspace as removeWorkspaceEntry,
  registeredWorkspaceToAppStateWorkspaceInput,
  type RegisteredWorkspace,
  sortWorkspaces,
  updateWorkspaceFromProbe,
  upsertWorkspace,
  type WorkspaceHealthState,
  type WorkspaceProbeResponse,
  type WorkspaceSidebarCanvas,
} from '@/components/editor/workspaceRegistry';
import { getHostRuntime } from '@/features/host/renderer/createHostRuntime';

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
  | 'NODE_GROUP_MEMBERSHIP_UPDATED'
  | 'NODE_RENAMED'
  | 'NODE_CREATED'
  | 'NODE_DELETED'
  | 'NODE_LOCK_TOGGLED'
  | 'NODE_REPARENTED'
  | 'NODE_Z_ORDER_UPDATED';

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
  pluginRuntime?: PluginNodeRuntimeState;
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

export interface WorkspacePathHealthRecord {
  workspaceId: string;
  rootPath: string;
  status: WorkspaceHealthState;
  lastCheckedAt: number;
  lastKnownRootPath: string;
  failureReason?: string | null;
}

export interface WorkspaceRegistryStateSnapshot {
  registeredWorkspaces: RegisteredWorkspace[];
  activeWorkspaceId: string | null;
  lastActiveCanvasesByWorkspaceId: LastActiveCanvasMap;
  workspaceCanvasesByWorkspaceId: Record<string, WorkspaceSidebarCanvas[]>;
  workspacePathHealthByWorkspaceId: Record<string, WorkspacePathHealthRecord>;
}

export interface GraphState {
  nodes: Node[];
  edges: Edge[];
  files: string[];
  fileTree: FileTreeNode | null;
  expandedFolders: Set<string>;
  currentFile: string | null;
  currentCanvasId: string | null;
  // Workspace-canvas-shell migration anchor:
  // registry/session/path-health state is owned here so runtime scope follows the active workspace.
  registeredWorkspaces: RegisteredWorkspace[];
  activeWorkspaceId: string | null;
  lastActiveCanvasesByWorkspaceId: LastActiveCanvasMap;
  workspaceCanvasesByWorkspaceId: Record<string, WorkspaceSidebarCanvas[]>;
  workspacePathHealthByWorkspaceId: Record<string, WorkspacePathHealthRecord>;
  workspaceSessionKey: string | null;
  workspaceRootPath: string | null;
  workspaceSessionScopeVersion: number;
  lastActiveCanvasPath: string | null;
  draftCanvases: string[];
  graphId: string; // Unique ID for the current graph data version
  sourceVersion: string | null;
  sourceVersions: Record<string, string>;
  clientId: string;
  lastAppliedCommandId?: string;
  status: 'idle' | 'loading' | 'error' | 'success' | 'connected';
  error: AppError | null;
  selectedNodeIds: string[];
  activeGroupFocusGroupId: string | null;
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
  pendingActionRoutingByKey: Record<string, ActionRoutingPendingRecord>;
  actionRoutingPendingByToken: Record<string, ActionOptimisticLifecycleEvent>;
  setGraph: (graph: { nodes: Node[]; edges: Edge[]; needsAutoLayout?: boolean; layoutType?: 'tree' | 'bidirectional' | 'radial' | 'compact' | 'compact-bidir' | 'depth-hybrid' | 'treemap-pack' | 'quadrant-pack' | 'voronoi-pack'; mindMapGroups?: MindMapGroup[]; canvasBackground?: CanvasBackgroundStyle; canvasFontFamily?: FontFamilyPreset; sourceVersion?: string | null; sourceVersions?: Record<string, string> }) => void;
  setSourceVersion: (version: string | null) => void;
  setSourceVersionForFile: (filePath: string, version: string | null) => void;
  setLastAppliedCommandId: (commandId?: string) => void;
  hydrateWorkspaceRegistry: () => Promise<{
    workspaces: RegisteredWorkspace[];
    activeWorkspaceId: string | null;
  }>;
  replaceRegisteredWorkspaces: (workspaces: RegisteredWorkspace[]) => Promise<RegisteredWorkspace[]>;
  upsertWorkspaceFromProbe: (
    probe: WorkspaceProbeResponse,
    options?: { existingId?: string; activate?: boolean },
  ) => Promise<RegisteredWorkspace>;
  reconnectWorkspaceFromProbe: (workspaceId: string, probe: WorkspaceProbeResponse) => Promise<RegisteredWorkspace | null>;
  setActiveWorkspaceId: (workspaceId: string | null) => Promise<boolean>;
  removeRegisteredWorkspace: (workspaceId: string) => Promise<string | null>;
  setWorkspaceCanvases: (workspaceId: string, canvases: WorkspaceSidebarCanvas[]) => void;
  registerWorkspaceCanvas: (workspaceId: string, canvas: WorkspaceSidebarCanvas) => void;
  setWorkspacePathStatus: (input: {
    workspaceId: string;
    rootPath?: string;
    status: WorkspaceHealthState;
    failureReason?: string | null;
    checkedAt?: number;
  }) => void;
  hydrateCanvasSession: (workspaceKey: string | null, workspaceRootPath?: string | null) => void;
  setWorkspaceSession: (input: {
    workspaceId: string | null;
    rootPath?: string | null;
  }) => void;
  rememberLastActiveCanvasForWorkspace: (workspaceId: string, canvasPath: string | null) => Promise<void>;
  rememberLastActiveCanvas: (canvasPath: string | null) => Promise<void>;
  registerDraftCanvas: (filePath: string) => void;
  setFiles: (files: string[]) => void;
  setFileTree: (tree: FileTreeNode | null) => void;
  toggleFolder: (path: string) => void;
  setCurrentFile: (file: string) => void;
  setCurrentCanvasId: (canvasId: string | null) => void;
  setStatus: (status: GraphState['status']) => void;
  setError: (error: AppError | null) => void;
  setSelectedNodes: (selectedNodeIds: string[]) => void;
  setActiveGroupFocusGroupId: (groupId: string | null) => void;
  selectNodesByType: (nodeType: string) => string[];
  focusNextNodeByType: (nodeType: string) => string | null;
  updateNodeData: (nodeId: string, partialData: Record<string, unknown>) => void;
  canvasBackground: CanvasBackgroundStyle;
  setCanvasBackground: (style: CanvasBackgroundStyle) => void;
  globalFontFamily: FontFamilyPreset;
  canvasFontFamily?: FontFamilyPreset;
  hydrateGlobalFontFamilyPreference: () => Promise<void>;
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

export function getNodeGroupId(
  node: Pick<Node, 'data'> | null | undefined,
): string | null {
  const groupId = (node?.data as { groupId?: unknown } | undefined)?.groupId;
  return typeof groupId === 'string' && groupId.length > 0 ? groupId : null;
}

export function resolveGroupedNodeIds(
  nodes: Array<Pick<Node, 'id' | 'data'>>,
  groupId: string | null | undefined,
): string[] {
  if (!groupId) {
    return [];
  }

  return nodes
    .filter((node) => getNodeGroupId(node) === groupId)
    .map((node) => node.id);
}

function resolveRetainedGroupFocusGroupId(input: {
  nodes: Array<Pick<Node, 'id' | 'data'>>;
  selectedNodeIds: string[];
  activeGroupFocusGroupId: string | null;
}): string | null {
  const { activeGroupFocusGroupId } = input;
  if (!activeGroupFocusGroupId) {
    return null;
  }

  if (input.selectedNodeIds.length === 0) {
    return activeGroupFocusGroupId;
  }

  const groupedNodeIds = resolveGroupedNodeIds(input.nodes, activeGroupFocusGroupId);
  if (groupedNodeIds.length <= 1) {
    return null;
  }

  const isSubset = input.selectedNodeIds.every((nodeId) => groupedNodeIds.includes(nodeId));
  if (!isSubset) {
    return null;
  }

  return groupedNodeIds.length === input.selectedNodeIds.length
    ? null
    : activeGroupFocusGroupId;
}

export function getNodeCanonicalValidation(
  node: Pick<Node, 'data'> | null | undefined,
): ValidationResult | undefined {
  const data = node?.data as CanonicalNodeData | undefined;
  return data?.canonicalValidation;
}

export function getNodePluginRuntimeState(
  node: Pick<Node, 'data'> | null | undefined,
): PluginNodeRuntimeState | undefined {
  const data = node?.data as CanonicalNodeData | undefined;
  return data?.pluginRuntime;
}

export function getNodePluginRuntimeDiagnostic(
  node: Pick<Node, 'data'> | null | undefined,
): PluginRuntimeDiagnostic | undefined {
  const runtimeState = getNodePluginRuntimeState(node);
  return runtimeState?.diagnostic;
}

const DEFAULT_MINDMAP_SPACING = 50;

function buildWorkspacePathHealthRecord(
  workspace: RegisteredWorkspace,
  checkedAt: number = Date.now(),
): WorkspacePathHealthRecord {
  return {
    workspaceId: workspace.id,
    rootPath: workspace.rootPath,
    status: workspace.status,
    lastCheckedAt: checkedAt,
    lastKnownRootPath: workspace.rootPath,
    failureReason: workspace.status === 'ok' ? null : null,
  };
}

function buildWorkspacePathHealthMap(
  workspaces: RegisteredWorkspace[],
  existing: Record<string, WorkspacePathHealthRecord> = {},
): Record<string, WorkspacePathHealthRecord> {
  const next: Record<string, WorkspacePathHealthRecord> = {};
  workspaces.forEach((workspace) => {
    const current = existing[workspace.id];
    next[workspace.id] = current
      ? {
          ...current,
          rootPath: workspace.rootPath,
          status: workspace.status,
          lastKnownRootPath: workspace.rootPath,
          lastCheckedAt: Date.now(),
          failureReason: workspace.status === 'ok' ? null : current.failureReason ?? null,
        }
      : buildWorkspacePathHealthRecord(workspace);
  });
  return next;
}

function sanitizeLastActiveCanvasMap(
  map: LastActiveCanvasMap,
  keepWorkspaceIds: string[],
): LastActiveCanvasMap {
  const keep = new Set(keepWorkspaceIds);
  return Object.fromEntries(
    Object.entries(map).filter(([workspaceId]) => keep.has(workspaceId)),
  );
}

function getWorkspaceRegistryRpc() {
  return getHostRuntime().rpc;
}

async function persistRegisteredWorkspacesToAppState(
  workspaces: RegisteredWorkspace[],
  previousWorkspaces: RegisteredWorkspace[],
): Promise<void> {
  const rpc = getWorkspaceRegistryRpc();
  const nextWorkspaceIds = new Set(workspaces.map((workspace) => workspace.id));
  const removedWorkspaceIds = previousWorkspaces
    .map((workspace) => workspace.id)
    .filter((workspaceId) => !nextWorkspaceIds.has(workspaceId));

  await Promise.all([
    ...workspaces.map((workspace) => (
      rpc.upsertAppStateWorkspace(registeredWorkspaceToAppStateWorkspaceInput(workspace))
    )),
    ...removedWorkspaceIds.map((workspaceId) => rpc.removeAppStateWorkspace(workspaceId)),
  ]);
}

async function persistActiveWorkspaceSessionToAppState(
  activeWorkspaceId: string | null,
): Promise<void> {
  await getWorkspaceRegistryRpc().setAppStateWorkspaceSession({ activeWorkspaceId });
}

async function persistLastActiveCanvasesToAppState(
  lastActiveCanvasesByWorkspaceId: LastActiveCanvasMap,
): Promise<void> {
  await getWorkspaceRegistryRpc().setAppStatePreference(
    lastActiveCanvasMapToPreferenceInput(lastActiveCanvasesByWorkspaceId),
  );
}

function normalizeWorkspaceAwareFilePath(
  workspaceRootPath: string | null | undefined,
  filePath: string,
): string {
  return normalizeWorkspaceCanvasPath(workspaceRootPath, filePath);
}

function normalizeWorkspaceAwareFileList(
  workspaceRootPath: string | null | undefined,
  files: string[],
): string[] {
  return [...new Set(
    files
      .map((filePath) => normalizeWorkspaceAwareFilePath(workspaceRootPath, filePath))
      .filter((filePath) => filePath.length > 0),
  )].sort((left, right) => left.localeCompare(right));
}

function normalizeWorkspaceAwareSourceVersions(
  workspaceRootPath: string | null | undefined,
  sourceVersions: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(sourceVersions)
      .map(([filePath, version]) => [
        normalizeWorkspaceAwareFilePath(workspaceRootPath, filePath),
        version,
      ] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function attachAbsoluteFilePathToNode(
  node: Node,
  workspaceRootPath: string | null | undefined,
): Node {
  const data = (node.data ?? {}) as Record<string, unknown>;
  const sourceMeta = (
    data.sourceMeta && typeof data.sourceMeta === 'object'
      ? data.sourceMeta as Record<string, unknown>
      : null
  );
  const sourceFilePath = typeof sourceMeta?.filePath === 'string'
    ? sourceMeta.filePath
    : null;
  if (!workspaceRootPath || !sourceMeta || !sourceFilePath) {
    return node;
  }

  const absoluteFilePath = normalizeWorkspaceAwareFilePath(workspaceRootPath, sourceFilePath);
  if (sourceMeta.absoluteFilePath === absoluteFilePath) {
    return node;
  }

  return {
    ...node,
    data: {
      ...data,
      sourceMeta: {
        ...sourceMeta,
        absoluteFilePath,
      },
    },
  };
}

function attachAbsoluteFilePathsToNodes(
  nodes: Node[],
  workspaceRootPath: string | null | undefined,
): Node[] {
  if (!workspaceRootPath) {
    return nodes;
  }
  return nodes.map((node) => attachAbsoluteFilePathToNode(node, workspaceRootPath));
}

function insertFileIntoTree(root: FileTreeNode | null, filePath: string): FileTreeNode | null {
  const segments = filePath.split('/').filter(Boolean);
  if (segments.length === 0) {
    return root;
  }

  if (!root) {
    root = {
      name: 'root',
      path: '',
      type: 'directory',
      children: [],
    };
  }

  const cloneNode = (node: FileTreeNode): FileTreeNode => ({
    ...node,
    children: node.children ? node.children.map(cloneNode) : undefined,
  });

  const nextRoot = cloneNode(root);
  let current = nextRoot;
  let currentPath = '';

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const nextPath = currentPath ? `${currentPath}/${segment}` : segment;
    const isLeaf = index === segments.length - 1;
    const children = current.children ? [...current.children] : [];
    const existingIndex = children.findIndex((child) => child.path === nextPath);

    if (isLeaf) {
      if (existingIndex === -1) {
        children.push({
          name: segment,
          path: nextPath,
          type: 'file',
        });
        children.sort((left, right) => left.path.localeCompare(right.path));
      }
      current.children = children;
      break;
    }

    let nextNode: FileTreeNode;
    if (existingIndex === -1) {
      nextNode = {
        name: segment,
        path: nextPath,
        type: 'directory',
        children: [],
      };
      children.push(nextNode);
      children.sort((left, right) => left.path.localeCompare(right.path));
      current.children = children;
    } else {
      const existing = children[existingIndex];
      nextNode = existing.type === 'directory'
        ? existing
        : {
            name: segment,
            path: nextPath,
            type: 'directory',
            children: [],
          };
      children[existingIndex] = nextNode;
      current.children = children;
    }

    current = nextNode;
    currentPath = nextPath;
  }

  return nextRoot;
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

function areTabViewportStatesEqual(
  left: TabViewportState | null | undefined,
  right: TabViewportState | null | undefined,
): boolean {
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }

  return left.x === right.x && left.y === right.y && left.zoom === right.zoom;
}

function areTabSelectionStatesEqual(
  left: TabSelectionState | null | undefined,
  right: TabSelectionState | null | undefined,
): boolean {
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  if (left.updatedAt !== right.updatedAt) {
    return false;
  }
  if (left.nodeIds.length !== right.nodeIds.length || left.edgeIds.length !== right.edgeIds.length) {
    return false;
  }

  return left.nodeIds.every((nodeId, index) => nodeId === right.nodeIds[index])
    && left.edgeIds.every((edgeId, index) => edgeId === right.edgeIds[index]);
}



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
    case 'NODE_DELETED':
      return ['node.delete'];
    case 'NODE_LOCK_TOGGLED':
      return ['node.lock.toggle'];
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
  currentCanvasId: null,
  registeredWorkspaces: [],
  activeWorkspaceId: null,
  lastActiveCanvasesByWorkspaceId: {},
  workspaceCanvasesByWorkspaceId: {},
  workspacePathHealthByWorkspaceId: {},
  workspaceSessionKey: null,
  workspaceRootPath: null,
  workspaceSessionScopeVersion: 0,
  lastActiveCanvasPath: null,
  draftCanvases: [],
  graphId: uuidv4(),
  sourceVersion: null,
  sourceVersions: {},
  clientId: uuidv4(),
  lastAppliedCommandId: undefined,
  status: 'idle',
  error: null,
  selectedNodeIds: [],
  activeGroupFocusGroupId: null,
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
    const nextSourceVersions = sourceVersions
      ? normalizeWorkspaceAwareSourceVersions(state.workspaceRootPath, sourceVersions)
      : state.sourceVersions;
    const normalizedMindMapGroups = mindMapGroups.map(normalizeMindMapGroup);
    const resolvedLayoutType = layoutType ?? normalizedMindMapGroups[0]?.layoutType ?? 'compact';
    return {
      nodes: attachAbsoluteFilePathsToNodes(nodes, state.workspaceRootPath),
      edges,
      needsAutoLayout,
      layoutType: resolvedLayoutType,
      mindMapGroups: normalizedMindMapGroups,
      graphId: uuidv4(),
      ...(canvasBackground ? { canvasBackground } : {}),
      ...(isFontFamilyPreset(canvasFontFamily) ? { canvasFontFamily } : { canvasFontFamily: undefined }),
      ...(sourceVersion !== undefined ? { sourceVersion } : {}),
      sourceVersions: nextSourceVersions,
      activeGroupFocusGroupId: null,
      entrypointRuntime: resetEntrypointRuntimeState({
        current: state.entrypointRuntime,
        preserveActiveTool: true,
      }),
      hoveredNodeIdsByGroupId: {},
    };
  }),
  setSourceVersion: (sourceVersion) => set({ sourceVersion }),
  setSourceVersionForFile: (filePath, version) => set((state) => {
    const normalizedFilePath = filePath
      ? normalizeWorkspaceAwareFilePath(state.workspaceRootPath, filePath)
      : '';
    if (!normalizedFilePath) {
      return state;
    }

    const nextSourceVersions = { ...state.sourceVersions };
    if (version) {
      nextSourceVersions[normalizedFilePath] = version;
    } else {
      delete nextSourceVersions[normalizedFilePath];
    }

    return {
      sourceVersions: nextSourceVersions,
      ...(state.currentFile === normalizedFilePath ? { sourceVersion: version } : {}),
      entrypointRuntime: {
        ...state.entrypointRuntime,
        hover: {
          ...state.entrypointRuntime.hover,
          nodeIdsByGroupId: {},
          targetNodeId: null,
        },
      },
      hoveredNodeIdsByGroupId: {},
    };
  }),
  setLastAppliedCommandId: (lastAppliedCommandId) => set({ lastAppliedCommandId }),
  hydrateWorkspaceRegistry: async () => {
    const { workspaces, activeWorkspaceId, lastActiveCanvases } =
      await hydrateWorkspaceRegistryFromAppState(getWorkspaceRegistryRpc());
    const workspacePathHealthByWorkspaceId = buildWorkspacePathHealthMap(workspaces);

    set({
      registeredWorkspaces: workspaces,
      activeWorkspaceId,
      lastActiveCanvasesByWorkspaceId: lastActiveCanvases,
      workspacePathHealthByWorkspaceId,
    });

    return {
      workspaces,
      activeWorkspaceId,
    };
  },
  replaceRegisteredWorkspaces: async (workspaces) => {
    const state = get();
    const nextWorkspaces = sortWorkspaces(workspaces);
    const nextActiveWorkspaceId = nextWorkspaces.some((workspace) => workspace.id === state.activeWorkspaceId)
      ? state.activeWorkspaceId
      : nextWorkspaces[0]?.id ?? null;
    const nextLastActiveCanvasesByWorkspaceId = sanitizeLastActiveCanvasMap(
      state.lastActiveCanvasesByWorkspaceId,
      nextWorkspaces.map((workspace) => workspace.id),
    );

    set((current) => ({
      registeredWorkspaces: nextWorkspaces,
      activeWorkspaceId: nextActiveWorkspaceId,
      lastActiveCanvasesByWorkspaceId: nextLastActiveCanvasesByWorkspaceId,
      workspacePathHealthByWorkspaceId: buildWorkspacePathHealthMap(
        nextWorkspaces,
        current.workspacePathHealthByWorkspaceId,
      ),
      workspaceCanvasesByWorkspaceId: Object.fromEntries(
        Object.entries(current.workspaceCanvasesByWorkspaceId)
          .filter(([workspaceId]) => nextWorkspaces.some((workspace) => workspace.id === workspaceId)),
      ),
    }));

    await Promise.all([
      persistRegisteredWorkspacesToAppState(nextWorkspaces, state.registeredWorkspaces),
      persistActiveWorkspaceSessionToAppState(nextActiveWorkspaceId),
      persistLastActiveCanvasesToAppState(nextLastActiveCanvasesByWorkspaceId),
    ]);

    return nextWorkspaces;
  },
  upsertWorkspaceFromProbe: async (probe, options) => {
    const state = get();
    const existing = options?.existingId
      ? state.registeredWorkspaces.find((workspace) => workspace.id === options.existingId) ?? null
      : state.registeredWorkspaces.find((workspace) => workspace.rootPath === probe.rootPath) ?? null;
    const baseWorkspace = existing
      ? updateWorkspaceFromProbe(existing, probe)
      : buildRegisteredWorkspace(probe, options?.existingId);
    const nextWorkspace: RegisteredWorkspace = {
      ...baseWorkspace,
      lastOpenedAt: (options?.activate || !existing)
        ? Date.now()
        : baseWorkspace.lastOpenedAt,
    };
    const nextWorkspaces = await get().replaceRegisteredWorkspaces(
      upsertWorkspace(get().registeredWorkspaces, nextWorkspace),
    );

    if (options?.activate || !get().activeWorkspaceId) {
      await get().setActiveWorkspaceId(nextWorkspace.id);
    }

    return nextWorkspaces.find((workspace) => workspace.id === nextWorkspace.id) ?? nextWorkspace;
  },
  reconnectWorkspaceFromProbe: async (workspaceId, probe) => {
    const current = get().registeredWorkspaces.find((workspace) => workspace.id === workspaceId);
    if (!current) {
      return null;
    }

    const nextWorkspace = await get().upsertWorkspaceFromProbe(probe, {
      existingId: workspaceId,
      activate: true,
    });
    get().setWorkspacePathStatus({
      workspaceId,
      rootPath: probe.rootPath,
      status: probe.health.state,
      failureReason: probe.health.message ?? null,
    });
    return nextWorkspace;
  },
  setActiveWorkspaceId: async (workspaceId) => {
    const state = get();
    if (!workspaceId) {
      set({ activeWorkspaceId: null });
      await persistActiveWorkspaceSessionToAppState(null);
      return true;
    }

    const targetWorkspace = state.registeredWorkspaces.find((workspace) => workspace.id === workspaceId);
    if (!targetWorkspace) {
      return false;
    }

    const nextWorkspaces = sortWorkspaces(
      state.registeredWorkspaces.map((workspace) => (
        workspace.id === workspaceId
          ? { ...workspace, lastOpenedAt: Date.now() }
          : workspace
      )),
    );
    set((current) => ({
      registeredWorkspaces: nextWorkspaces,
      activeWorkspaceId: workspaceId,
      workspacePathHealthByWorkspaceId: buildWorkspacePathHealthMap(
        nextWorkspaces,
        current.workspacePathHealthByWorkspaceId,
      ),
    }));
    await Promise.all([
      persistRegisteredWorkspacesToAppState(nextWorkspaces, state.registeredWorkspaces),
      persistActiveWorkspaceSessionToAppState(workspaceId),
    ]);
    return true;
  },
  removeRegisteredWorkspace: async (workspaceId) => {
    const state = get();
    const nextWorkspaces = removeWorkspaceEntry(state.registeredWorkspaces, workspaceId);
    const nextActiveWorkspaceId = state.activeWorkspaceId === workspaceId
      ? nextWorkspaces[0]?.id ?? null
      : state.activeWorkspaceId;
    const nextLastActiveCanvasesByWorkspaceId = sanitizeLastActiveCanvasMap(
      Object.fromEntries(
        Object.entries(state.lastActiveCanvasesByWorkspaceId).filter(([id]) => id !== workspaceId),
      ),
      nextWorkspaces.map((workspace) => workspace.id),
    );

    set((current) => ({
      registeredWorkspaces: nextWorkspaces,
      activeWorkspaceId: nextActiveWorkspaceId,
      lastActiveCanvasesByWorkspaceId: nextLastActiveCanvasesByWorkspaceId,
      workspaceCanvasesByWorkspaceId: Object.fromEntries(
        Object.entries(current.workspaceCanvasesByWorkspaceId).filter(([id]) => id !== workspaceId),
      ),
      workspacePathHealthByWorkspaceId: Object.fromEntries(
        Object.entries(current.workspacePathHealthByWorkspaceId).filter(([id]) => id !== workspaceId),
      ),
    }));

    await Promise.all([
      getWorkspaceRegistryRpc().removeAppStateWorkspace(workspaceId),
      persistActiveWorkspaceSessionToAppState(nextActiveWorkspaceId),
      persistLastActiveCanvasesToAppState(nextLastActiveCanvasesByWorkspaceId),
    ]);

    return nextActiveWorkspaceId;
  },
  setWorkspaceCanvases: (workspaceId, canvases) => set((state) => {
    const nextWorkspaces = state.registeredWorkspaces.map((workspace) => (
      workspace.id === workspaceId
        ? { ...workspace, canvasCount: canvases.length }
        : workspace
    ));

    return {
      workspaceCanvasesByWorkspaceId: {
        ...state.workspaceCanvasesByWorkspaceId,
        [workspaceId]: [...canvases],
      },
      registeredWorkspaces: nextWorkspaces,
    };
  }),
  registerWorkspaceCanvas: (workspaceId, canvas) => set((state) => {
    const currentCanvases = state.workspaceCanvasesByWorkspaceId[workspaceId] ?? [];
    if (currentCanvases.some((entry) => (
      entry.canvasId === canvas.canvasId
    ))) {
      return state;
    }

    const nextCanvases = [canvas, ...currentCanvases];
    const nextWorkspaces = state.registeredWorkspaces.map((workspace) => (
      workspace.id === workspaceId
        ? { ...workspace, canvasCount: nextCanvases.length }
        : workspace
    ));
    const isActiveWorkspace = state.workspaceSessionKey === workspaceId;

    return {
      workspaceCanvasesByWorkspaceId: {
        ...state.workspaceCanvasesByWorkspaceId,
        [workspaceId]: nextCanvases,
      },
      registeredWorkspaces: nextWorkspaces,
      ...(isActiveWorkspace
        ? {
            ...(typeof canvas.compatibilityFilePath === 'string' && canvas.compatibilityFilePath.length > 0
              ? {
                  files: normalizeWorkspaceAwareFileList(
                    state.workspaceRootPath,
                    [...state.files, canvas.compatibilityFilePath],
                  ),
                  fileTree: insertFileIntoTree(state.fileTree, canvas.compatibilityFilePath),
                }
              : {}),
          }
        : {}),
    };
  }),
  setWorkspacePathStatus: ({ workspaceId, rootPath, status, failureReason, checkedAt }) => set((state) => {
    const targetWorkspace = state.registeredWorkspaces.find((workspace) => workspace.id === workspaceId);
    if (!targetWorkspace) {
      return state;
    }

    const nextRootPath = rootPath ?? targetWorkspace.rootPath;
    const nextWorkspaces = state.registeredWorkspaces.map((workspace) => (
      workspace.id === workspaceId
        ? {
            ...workspace,
            rootPath: nextRootPath,
            status,
          }
        : workspace
    ));

    return {
      registeredWorkspaces: nextWorkspaces,
      workspacePathHealthByWorkspaceId: {
        ...state.workspacePathHealthByWorkspaceId,
        [workspaceId]: {
          workspaceId,
          rootPath: nextRootPath,
          status,
          lastCheckedAt: checkedAt ?? Date.now(),
          lastKnownRootPath: nextRootPath,
          failureReason: failureReason ?? (status === 'ok' ? null : state.workspacePathHealthByWorkspaceId[workspaceId]?.failureReason ?? null),
        },
      },
    };
  }),
  hydrateCanvasSession: (workspaceSessionKey, workspaceRootPath) => set((state) => {
    const normalizedWorkspaceKey = workspaceSessionKey && workspaceSessionKey.length > 0
      ? workspaceSessionKey
      : null;
    const normalizedWorkspaceRootPath = workspaceRootPath && workspaceRootPath.length > 0
      ? workspaceRootPath
      : null;
    const knownFiles = new Set([...state.files, ...state.draftCanvases]);
    const lastActiveCanvasPath = (
      normalizedWorkspaceKey
      && typeof state.lastActiveCanvasesByWorkspaceId[normalizedWorkspaceKey] === 'string'
      && knownFiles.has(state.lastActiveCanvasesByWorkspaceId[normalizedWorkspaceKey] as string)
    )
      ? state.lastActiveCanvasesByWorkspaceId[normalizedWorkspaceKey] as string
      : null;
    const scopeChanged = (
      state.workspaceSessionKey !== normalizedWorkspaceKey
      || state.workspaceRootPath !== normalizedWorkspaceRootPath
    );

    return {
      workspaceSessionKey: normalizedWorkspaceKey,
      workspaceRootPath: normalizedWorkspaceRootPath,
      ...(scopeChanged
        ? { workspaceSessionScopeVersion: state.workspaceSessionScopeVersion + 1 }
        : {}),
      lastActiveCanvasPath,
    };
  }),
  setWorkspaceSession: ({ workspaceId, rootPath }) => set((state) => {
    const normalizedWorkspaceId = workspaceId && workspaceId.length > 0
      ? workspaceId
      : null;
    const normalizedWorkspaceRootPath = rootPath && rootPath.length > 0
      ? rootPath
      : null;
    const scopeChanged = (
      state.workspaceSessionKey !== normalizedWorkspaceId
      || state.workspaceRootPath !== normalizedWorkspaceRootPath
    );
    if (!scopeChanged) {
      return state;
    }

    return {
      workspaceSessionKey: normalizedWorkspaceId,
      workspaceRootPath: normalizedWorkspaceRootPath,
      workspaceSessionScopeVersion: state.workspaceSessionScopeVersion + 1,
      sourceVersion: state.currentFile
        ? (state.sourceVersions[state.currentFile] ?? null)
        : null,
    };
  }),
  rememberLastActiveCanvasForWorkspace: async (workspaceId, canvasPath) => {
    const state = get();
    const nextLastActiveCanvasesByWorkspaceId = { ...state.lastActiveCanvasesByWorkspaceId };
    if (!canvasPath) {
      delete nextLastActiveCanvasesByWorkspaceId[workspaceId];
    } else {
      nextLastActiveCanvasesByWorkspaceId[workspaceId] = canvasPath;
    }

    set({
      lastActiveCanvasesByWorkspaceId: nextLastActiveCanvasesByWorkspaceId,
      ...(state.activeWorkspaceId === workspaceId ? { lastActiveCanvasPath: canvasPath } : {}),
    });

    await Promise.all([
      persistLastActiveCanvasesToAppState(nextLastActiveCanvasesByWorkspaceId),
      ...(canvasPath
        ? [getWorkspaceRegistryRpc().upsertAppStateRecentCanvas({
            workspaceId,
            canvasPath,
            lastOpenedAt: new Date(),
          })]
        : []),
    ]);
  },
  rememberLastActiveCanvas: async (canvasPath) => {
    const state = get();
    const nextCanvasPath = canvasPath && canvasPath.length > 0
      ? normalizeWorkspaceAwareFilePath(state.workspaceRootPath, canvasPath)
      : state.lastActiveCanvasPath;
    set({
      lastActiveCanvasPath: nextCanvasPath ?? null,
    });
  },
  registerDraftCanvas: (filePath) => set((state) => {
    const normalizedFilePath = filePath
      ? normalizeWorkspaceAwareFilePath(state.workspaceRootPath, filePath)
      : '';
    if (!normalizedFilePath || state.files.includes(normalizedFilePath)) {
      return state;
    }

    return {
      draftCanvases: [...state.draftCanvases, normalizedFilePath],
      files: [...state.files, normalizedFilePath].sort((left, right) => left.localeCompare(right)),
      fileTree: insertFileIntoTree(state.fileTree, normalizedFilePath),
    };
  }),
  setFiles: (files) => set((state) => ({
    files: normalizeWorkspaceAwareFileList(
      state.workspaceRootPath,
      [...files, ...state.draftCanvases],
    ),
  })),
  setFileTree: (fileTree) => set((state) => ({
    fileTree: state.draftCanvases.reduce<FileTreeNode | null>(
      (tree, draftPath) => insertFileIntoTree(tree, draftPath),
      fileTree,
    ),
  })),
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
    const normalizedCurrentFile = currentFile
      ? normalizeWorkspaceAwareFilePath(state.workspaceRootPath, currentFile)
      : null;
    return {
      currentFile: normalizedCurrentFile,
      currentCanvasId: normalizedCurrentFile === state.currentFile ? state.currentCanvasId : null,
      sourceVersion: normalizedCurrentFile ? (state.sourceVersions[normalizedCurrentFile] ?? null) : null,
      activeGroupFocusGroupId: null,
      entrypointRuntime: resetEntrypointRuntimeState({
        current: state.entrypointRuntime,
        preserveActiveTool: true,
      }),
      hoveredNodeIdsByGroupId: {},
    };
  }),
  setCurrentCanvasId: (currentCanvasId) => set({
    currentCanvasId: currentCanvasId && currentCanvasId.length > 0 ? currentCanvasId : null,
  }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setCanvasBackground: (canvasBackground) => set({ canvasBackground }),
  hydrateGlobalFontFamilyPreference: async () => {
    if (typeof window === 'undefined') {
      return;
    }

    const preference = await getWorkspaceRegistryRpc().getAppStatePreference(GLOBAL_FONT_PREFERENCE_KEY);
    const nextFontFamily = parseGlobalFontPreferenceValue(preference?.valueJson);
    if (!nextFontFamily) {
      return;
    }

    persistGlobalFontFamily(nextFontFamily);
    set({ globalFontFamily: nextFontFamily });
  },
  setGlobalFontFamily: (globalFontFamily) => {
    persistGlobalFontFamily(globalFontFamily);
    if (typeof window !== 'undefined') {
      void getWorkspaceRegistryRpc().setAppStatePreference({
        key: GLOBAL_FONT_PREFERENCE_KEY,
        valueJson: globalFontFamily,
      }).catch((error) => {
        console.error('[graph] failed to persist global font preference', error);
      });
    }
    set({ globalFontFamily });
  },
  setCanvasFontFamily: (canvasFontFamily) => set({
    canvasFontFamily: isFontFamilyPreset(canvasFontFamily) ? canvasFontFamily : undefined,
  }),
  setSelectedNodes: (selectedNodeIds) => set((state) => {
    const shouldClearTextEdit =
      Boolean(state.activeTextEditNodeId)
      && !selectedNodeIds.includes(state.activeTextEditNodeId as string);
    const hasSameSelection = (
      state.selectedNodeIds.length === selectedNodeIds.length
      && state.selectedNodeIds.every((nodeId) => selectedNodeIds.includes(nodeId))
    );
    if (hasSameSelection && !shouldClearTextEdit) {
      return state;
    }

    const nextActiveGroupFocusGroupId = resolveRetainedGroupFocusGroupId({
      nodes: state.nodes,
      selectedNodeIds,
      activeGroupFocusGroupId: state.activeGroupFocusGroupId,
    });
    const nextRuntime = clearEntrypointAnchorsForSelectionReducer(
      dismissEntrypointSurfaceOnSelectionChangeReducer(state.entrypointRuntime),
      selectedNodeIds,
    );
    return {
      selectedNodeIds,
      activeGroupFocusGroupId: nextActiveGroupFocusGroupId,
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
  setActiveGroupFocusGroupId: (groupId) => set({
    activeGroupFocusGroupId: groupId && groupId.length > 0 ? groupId : null,
  }),
  selectNodesByType: (nodeType) => {
    const ids = get().nodes
      .filter((node) => node.type === nodeType)
      .map((node) => node.id);
    set({
      selectedNodeIds: ids,
      activeGroupFocusGroupId: null,
    });
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
    set({
      selectedNodeIds: [nextId],
      activeGroupFocusGroupId: null,
    });
    return nextId;
  },
  updateNodeData: (nodeId, partialData) => set((state) => {
    const nodes = state.nodes.map((node) => {
      if (node.id !== nodeId) {
        return node;
      }
      const nextZIndex = Object.prototype.hasOwnProperty.call(partialData, 'zIndex')
        ? (typeof partialData.zIndex === 'number' ? partialData.zIndex : undefined)
        : node.zIndex;
      return {
        ...node,
        zIndex: nextZIndex,
        data: {
          ...(node.data || {}),
          ...partialData,
        },
      };
    });
    return {
      nodes,
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
    const { openTabs, maxTabs, activeTabId, currentFile, workspaceRootPath } = get();
    const normalizedPageId = normalizeWorkspaceAwareFilePath(workspaceRootPath, pageId);
    const existingTab = openTabs.find((tab) => tab.pageId === normalizedPageId);
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
        currentFile: normalizedPageId,
        currentCanvasId: null,
      });
      if (activeTabId !== existingTab.tabId || currentFile !== normalizedPageId) {
        console.debug('[Telemetry] tabs_switched', { tabId: existingTab.tabId, pageId: normalizedPageId, source: 'openTab' });
      }
      return { status: 'activated', tabId: existingTab.tabId };
    }

    if (openTabs.length >= maxTabs) {
      const replaceTab = selectLeastRecentlyUsedTab(openTabs);
      if (replaceTab) {
        console.debug('[Telemetry] tabs_limit_prompted', {
          pageId: normalizedPageId,
          replaceTabId: replaceTab.tabId,
          tabCount: openTabs.length,
        });
        return { status: 'blocked', replaceTabId: replaceTab.tabId };
      }
      return { status: 'blocked', replaceTabId: activeTabId || openTabs[0]?.tabId || '' };
    }

    const nextTab: TabState = {
      tabId: uuidv4(),
      pageId: normalizedPageId,
      title: getDefaultTabTitle(normalizedPageId),
      dirty: false,
      lastViewport: null,
      lastSelection: null,
      lastAccessedAt: now,
      createdAt: now,
    };

    set({
      openTabs: [...openTabs, nextTab],
      activeTabId: nextTab.tabId,
      currentFile: normalizedPageId,
      currentCanvasId: null,
    });
    console.debug('[Telemetry] tabs_opened', { tabId: nextTab.tabId, pageId: normalizedPageId, source: 'openTab' });
    return { status: 'opened', tabId: nextTab.tabId };
  },
  replaceLeastRecentlyUsedTab: (pageId, replaceTabId) => {
    const { openTabs, workspaceRootPath } = get();
    const normalizedPageId = normalizeWorkspaceAwareFilePath(workspaceRootPath, pageId);
    const now = getNow();
    const exists = openTabs.some((tab) => tab.tabId === replaceTabId);
    if (!exists) {
      return;
    }

    const nextTabs = openTabs.map((tab) => (
      tab.tabId === replaceTabId
        ? {
            ...tab,
            pageId: normalizedPageId,
            title: getDefaultTabTitle(normalizedPageId),
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
      currentFile: normalizedPageId,
      currentCanvasId: null,
    });
    console.debug('[Telemetry] tabs_limit_replaced', { tabId: replaceTabId, pageId: normalizedPageId });
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
      currentCanvasId: null,
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
          currentCanvasId: null,
        });
        console.debug('[Telemetry] tabs_fallback_opened', { tabId: fallbackTab.tabId, pageId: fallbackPageId });
        return;
      }

      set({
        openTabs: [],
        activeTabId: null,
        currentFile: null,
        currentCanvasId: null,
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
      currentCanvasId: null,
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
    set((state) => {
      let changed = false;
      const openTabs = state.openTabs.map((tab) => {
        if (tab.tabId !== tabId) {
          return tab;
        }

        const nextViewport = Object.prototype.hasOwnProperty.call(snapshot, 'lastViewport')
          ? (snapshot.lastViewport ?? null)
          : tab.lastViewport;
        const nextSelection = Object.prototype.hasOwnProperty.call(snapshot, 'lastSelection')
          ? (snapshot.lastSelection ?? null)
          : tab.lastSelection;
        if (
          areTabViewportStatesEqual(nextViewport, tab.lastViewport)
          && areTabSelectionStatesEqual(nextSelection, tab.lastSelection)
        ) {
          return tab;
        }

        changed = true;
        return {
          ...tab,
          lastAccessedAt: getNow(),
          lastViewport: nextViewport,
          lastSelection: nextSelection,
        };
      });

      return changed ? { openTabs } : state;
    });
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
}));
