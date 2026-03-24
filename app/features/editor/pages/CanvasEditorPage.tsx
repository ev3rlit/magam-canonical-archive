'use client';


import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { RpcClientError, useFileSync } from '@/hooks/useFileSync';
import { GraphCanvas, resolveCreateCompleteBodyEditSession } from '@/components/GraphCanvas';
import type { GraphCanvasSelectionActionIntentInput } from '@/components/GraphCanvas';
import { resolveBodySlashCommandSession } from '@/components/nodes/renderableContent';
import { Header } from '@/components/ui/Header';

import { type QuickOpenCommand } from '@/components/ui/QuickOpenDialog';
import { ErrorOverlay } from '@/components/ui/ErrorOverlay';
import {
  LazyQuickOpenDialog,
  LazySearchOverlay,
  LazyStickerInspector,
} from '@/components/editor/LazyPanels';
import { useGraphStore } from '@/store/graph';
import {
  buildAbsoluteMoveCommand,
  buildReparentCommand,
  buildRelativeMoveCommand,
  toObjectBodyBlockInsertInput,
  toUpdateNodeProps,
  type CreatePayload,
} from '@/features/editing/commands';
import { resolveBodySlashCommand } from '@/features/editing/bodySlashCommands';
import {
  type ActionRoutingHistoryEffect,
  type ActionRoutingSurfaceId,
  type MutationDispatchDescriptor,
  type RuntimeActionDescriptor,
} from '@/features/editing/actionRoutingBridge/types';
import {
  getWashiPresetPatternCatalog,
} from '@/utils/washiTapeDefaults';
import type { CanvasEntrypointSurface } from '@/features/canvas-ui-entrypoints/contracts';
import { parseRenderGraph } from '@/features/render/parseRenderGraph';
import { editDebugLog } from '@/utils/editDebug';
import { mapDragToRelativeAttachmentUpdate } from '@/utils/relativeAttachmentMapping';
import { resolveMindMapReparentIntent } from '@/components/GraphCanvas.drag';
import { RPC_ERRORS } from '@/ws/rpc';
import {
  createCanvasActionDispatchBinding,
  resolveLegacyEntrypointSurface,
} from '@/processes/canvas-runtime/bindings/actionDispatch';
import { canvasRuntime } from '@/processes/canvas-runtime/createCanvasRuntime';
import {
  createPaneActionRoutingContext,
  canCommitTextEdit,
  canRunNodeCommand,
  mapEditRpcErrorToToast,
  resolveImmediateCreateEditMode,
  resolveNodeEditContext,
  resolveNodeEditTarget,
  resolveNodeActionRoutingContext,
} from '@/components/editor/workspaceEditUtils';
import {
  buildSidebarCanvases,
  resolveWorkspaceCanvasAbsolutePath,
  type RegisteredWorkspace,
  type WorkspaceProbeResponse,
  type WorkspaceSidebarCanvas,
  updateWorkspaceFromProbe,
} from '@/components/editor/workspaceRegistry';
import { getHostRuntime } from '@/features/host/renderer/createHostRuntime';
import {
  navigateToDashboard,
  navigateToWorkspaceCanvas,
  navigateToWorkspaceDetail,
} from '@/features/host/renderer/navigation';



type PendingCreateEdit = {
  renderedId: string;
  mode: 'text' | 'markdown-wysiwyg';
};




function getNodeLabel(node: { data?: unknown }): string {
  const data = (node.data || {}) as Record<string, unknown>;
  return typeof data.label === 'string' ? data.label : '';
}

function resolveWorkspaceCanvasesHealth(
  payload: WorkspaceProbeResponse,
): { state: WorkspaceProbeResponse['health']['state']; message?: string; canvasCount?: number } {
  if (payload.health && typeof payload.health.state === 'string') {
    return payload.health;
  }

  return {
    state: 'ok',
    canvasCount: payload.canvasCount,
  };
}





export function CanvasEditorPage({ canvasId }: { canvasId: string }) {
  const hostRpc = useMemo(() => getHostRuntime().rpc, []);

  useEffect(() => {
    useGraphStore.getState().setCurrentCanvasId(canvasId);
  }, [canvasId]);

  // Workspace-canvas-shell migration anchor:
  // workspace registry/session state now lives in the graph store instead of local component state.
  const {
    setFiles,
    setGraph,
    currentFile,
    currentCompatibilityFilePath: currentCompatibilityFilePathState,
    currentCanvasId,
    setCurrentCompatibilityFilePath,
    setCurrentCanvasId,
    workspaceRootPath,
    registeredWorkspaces,
    activeWorkspaceId,
    lastActiveCanvasesByWorkspaceId,
    workspaceCanvasesByWorkspaceId,
    sourceVersions,
    canvasVersions,
    files,
    nodes,
    selectedNodeIds,
    setSelectedNodes,
    selectNodesByType,
    focusNextNodeByType,

    isSearchOpen,
    openSearch,
    closeSearch,
    setError: setGraphError,
    activeTextEditNodeId,
    textEditDraft,
    pendingTextEditAction,
    clearPendingTextEditAction,
    clearTextEditSession,
    pushEditCompletionEvent,
    registerPendingActionRouting,
    clearPendingActionRouting,
    draftCanvases,
    setFileTree,
    setWorkspaceSession,
    hydrateWorkspaceRegistry,
    replaceRegisteredWorkspaces,
    upsertWorkspaceFromProbe,
    setWorkspaceCanvases,
    registerWorkspaceCanvas,
    setWorkspacePathStatus,
    rememberLastActiveCanvasForWorkspace,
    hydrateGlobalFontFamilyPreference,
  } = useGraphStore();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false);

  const pendingSelectionNodeIdRef = useRef<string | null>(null);
  const pendingCreateEditRef = useRef<PendingCreateEdit | null>(null);

  const activeWorkspace = useMemo(
    () => registeredWorkspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, registeredWorkspaces],
  );
  const workspaceCanvases = useMemo<WorkspaceSidebarCanvas[]>(
    () => (activeWorkspaceId ? workspaceCanvasesByWorkspaceId[activeWorkspaceId] ?? [] : []),
    [activeWorkspaceId, workspaceCanvasesByWorkspaceId],
  );
  const compatibilityFilePathByCanvasId = useMemo(
    () => new Map(
      workspaceCanvases
        .filter((canvas) => typeof canvas.compatibilityFilePath === 'string' && canvas.compatibilityFilePath.length > 0)
        .map((canvas) => [canvas.canvasId, canvas.compatibilityFilePath as string]),
    ),
    [workspaceCanvases],
  );
  const activeWorkspaceCanvas = useMemo(
    () => (
      workspaceCanvases.find((canvas) => (
        canvas.canvasId === currentCanvasId
        || (
          typeof currentFile === 'string'
          && typeof canvas.compatibilityFilePath === 'string'
          && canvas.compatibilityFilePath === currentFile
        )
      )) ?? null
    ),
    [currentCanvasId, currentFile, workspaceCanvases],
  );
  const currentCompatibilityFilePath = useMemo(() => {
    if (typeof activeWorkspaceCanvas?.compatibilityFilePath === 'string' && activeWorkspaceCanvas.compatibilityFilePath.length > 0) {
      return activeWorkspaceCanvas.compatibilityFilePath;
    }

    if (currentCanvasId) {
      return compatibilityFilePathByCanvasId.get(currentCanvasId) ?? currentCompatibilityFilePathState ?? currentFile;
    }

    return currentCompatibilityFilePathState ?? currentFile;
  }, [activeWorkspaceCanvas?.compatibilityFilePath, compatibilityFilePathByCanvasId, currentCanvasId, currentCompatibilityFilePathState, currentFile]);



  const resetWorkspaceShellState = useCallback((workspaceId: string | null, rootPath: string | null) => {
    setGraph({
      nodes: [],
      edges: [],
      sourceVersion: null,
      sourceVersions: {},
      canvasVersions: {},
    });
    setSelectedNodes([]);
    clearTextEditSession();
    clearPendingTextEditAction();
    closeSearch({ clearQuery: true, clearHighlights: true });
    setGraphError(null);
    setFileTree(null);
    setWorkspaceSession({
      workspaceId,
      rootPath,
    });
    useGraphStore.setState({
      files: [],
      currentFile: null,
      currentCompatibilityFilePath: null,
      sourceVersion: null,
      sourceVersions: {},
      canvasVersions: {},
      lastActiveCanvasPath: null,
      draftCanvases: [],
    });
  }, [
    clearPendingTextEditAction,
    clearTextEditSession,
    closeSearch,
    setFileTree,
    setGraph,
    setGraphError,
    setSelectedNodes,
    setWorkspaceSession,
  ]);

  const syncWorkspaceEntry = useCallback(async (probe: WorkspaceProbeResponse, options?: {
    existingId?: string;
    activate?: boolean;
  }) => upsertWorkspaceFromProbe(probe, options), [upsertWorkspaceFromProbe]);

  const bootstrapWorkspaceRegistry = useCallback(async () => {
    try {
      const { workspaces: storedWorkspaces } = await hydrateWorkspaceRegistry();

      if (storedWorkspaces.length === 0) {
        return;
      }

      const refreshed = await Promise.all(
        storedWorkspaces.map(async (workspace) => {
          try {
            const probe = await hostRpc.probeWorkspace(workspace.rootPath);
            return updateWorkspaceFromProbe(workspace, probe);
          } catch {
            return workspace;
          }
        }),
      );

      await replaceRegisteredWorkspaces(refreshed);
    } catch (error) {
      const message = error instanceof Error ? error.message : '워크스페이스를 초기화하는 데 실패했습니다.';
      setGraphError({
        message,
        type: 'WORKSPACE_BOOTSTRAP_FAILED',
        details: error,
      });
    }
  }, [hostRpc, hydrateWorkspaceRegistry, replaceRegisteredWorkspaces, setGraphError, upsertWorkspaceFromProbe]);

  // File sync - triggers re-render when file changes externally
  const handleFileChange = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const loadActiveWorkspaceCanvases = useCallback(async (
    workspace: RegisteredWorkspace,
    options?: {
      restoreInitialCanvas?: boolean;
    },
  ) => {
    try {
      const [data, legacyTree] = await Promise.all([
        hostRpc.listWorkspaceCanvases(workspace.rootPath),
        hostRpc.getFileTree(workspace.rootPath).catch(() => ({ tree: null })),
      ]);
      const resolvedHealth = resolveWorkspaceCanvasesHealth(data);
      if (!data.health || typeof data.health.state !== 'string') {
        console.warn('[WorkspaceCanvasesLoad] Compatibility payload without health; falling back to inferred ok state', {
          workspaceId: workspace.id,
          rootPath: workspace.rootPath,
          payload: data,
        });
      }
      const sidebarCanvases = buildSidebarCanvases(workspace.rootPath, data.canvases);
      const compatibilityFiles = sidebarCanvases
        .map((canvas) => canvas.compatibilityFilePath)
        .filter((value): value is string => typeof value === 'string' && value.length > 0);
      const resumeTarget = useGraphStore.getState().lastActiveCanvasesByWorkspaceId[workspace.id];
      const initialCanvas = (
        typeof resumeTarget === 'string'
        && compatibilityFiles.includes(resumeTarget)
      )
        ? resumeTarget
        : compatibilityFiles[0] ?? null;

      setWorkspaceCanvases(workspace.id, sidebarCanvases);
      setFiles(compatibilityFiles);
      setFileTree(legacyTree.tree);
      await syncWorkspaceEntry(data, { existingId: workspace.id });
      setWorkspacePathStatus({
        workspaceId: workspace.id,
        rootPath: data.rootPath,
        status: resolvedHealth.state,
        failureReason: resolvedHealth.message ?? null,
      });
      setWorkspaceSession({
        workspaceId: workspace.id,
        rootPath: data.rootPath,
      });
      useGraphStore.setState({
        lastActiveCanvasPath: initialCanvas,
      });

      if (options?.restoreInitialCanvas && initialCanvas) {
        window.setTimeout(() => {

        }, 0);
      }
    } catch (error) {
      try {
        const probe = await hostRpc.probeWorkspace(workspace.rootPath);
        await syncWorkspaceEntry(probe, { existingId: workspace.id });
        setWorkspacePathStatus({
          workspaceId: workspace.id,
          rootPath: probe.rootPath,
          status: probe.health.state,
          failureReason: probe.health.message ?? null,
        });
      } catch {
        // Ignore probe failures and surface the original error below.
      }
      console.error('[WorkspaceCanvasesLoad] Failed to load workspace canvases', {
        workspaceId: workspace.id,
        rootPath: workspace.rootPath,
        error,
      });
      setWorkspaceCanvases(workspace.id, []);
      setFiles([]);
      setFileTree(null);
      const message = error instanceof Error
        ? error.message
        : '캔버스 목록을 불러오는 데 실패했습니다.';
      setGraphError({
        message,
        type: 'WORKSPACE_CANVASES_LOAD_FAILED',
        details: error,
      });
    }
  }, [hostRpc, setFileTree, setFiles, setGraphError, setWorkspaceCanvases, setWorkspacePathStatus, setWorkspaceSession, syncWorkspaceEntry]);

  const dependencyFiles = useMemo(
    () => Object.keys(sourceVersions).filter((filePath) => filePath !== currentCompatibilityFilePath),
    [currentCompatibilityFilePath, sourceVersions],
  );

  const handleWorkspaceFilesChange = useCallback(() => {
    if (!activeWorkspace) {
      return;
    }

    void loadActiveWorkspaceCanvases(activeWorkspace);
  }, [activeWorkspace, loadActiveWorkspaceCanvases]);

  // File sync with reload callback for file list changes
  const {
    updateNode,
    moveNode,
    createNode,
    createCanvasNode,
    insertObjectBodyBlock,
    deleteNode,
    reparentNode,
    undoLastEdit,
    redoLastEdit,
  } = useFileSync(
    currentCanvasId,
    currentCompatibilityFilePath,
    activeWorkspace?.rootPath ?? workspaceRootPath,
    handleFileChange,
    handleWorkspaceFilesChange,
    dependencyFiles,
  );

  useEffect(() => {
    void bootstrapWorkspaceRegistry();
  }, [bootstrapWorkspaceRegistry]);

  useEffect(() => {
    void hydrateGlobalFontFamilyPreference();
  }, [hydrateGlobalFontFamilyPreference]);

  useEffect(() => {
    if (!activeWorkspace) {
      resetWorkspaceShellState(null, null);
      return;
    }

    resetWorkspaceShellState(activeWorkspace.id, activeWorkspace.rootPath);
    if (activeWorkspace.status !== 'ok') {
      return;
    }
    void loadActiveWorkspaceCanvases(activeWorkspace, { restoreInitialCanvas: true });
  }, [activeWorkspace?.id, activeWorkspace?.rootPath, activeWorkspace?.status, loadActiveWorkspaceCanvases, resetWorkspaceShellState]);

  useEffect(() => {
    if (!activeWorkspace || !currentCompatibilityFilePath) {
      return;
    }

    void rememberLastActiveCanvasForWorkspace(activeWorkspace.id, currentCompatibilityFilePath);
  }, [activeWorkspace, currentCompatibilityFilePath, rememberLastActiveCanvasForWorkspace]);

  useEffect(() => {
    setCurrentCanvasId(activeWorkspaceCanvas?.canvasId ?? null);
  }, [activeWorkspaceCanvas?.canvasId, setCurrentCanvasId]);

  useEffect(() => {
    if (
      typeof currentCompatibilityFilePath === 'string'
      && currentCompatibilityFilePath.length > 0
      && currentCompatibilityFilePath !== currentCompatibilityFilePathState
    ) {
      setCurrentCompatibilityFilePath(currentCompatibilityFilePath);
    }
  }, [currentCompatibilityFilePath, currentCompatibilityFilePathState, setCurrentCompatibilityFilePath]);



  const openTabByPath = useCallback(
    (_pageId: string) => {
      setIsQuickOpenOpen(false);
      return true;
    },
    [],
  );

  const handleCreateCanvas = useCallback(async () => {
    if (!activeWorkspace) {
      return false;
    }

    try {
      const createdCanvas = await hostRpc.createWorkspaceCanvas({
        rootPath: activeWorkspace.rootPath,
      });
      setCurrentCanvasId(createdCanvas.canvasId);
      registerWorkspaceCanvas(activeWorkspace.id, {
        canvasId: createdCanvas.canvasId,
        workspaceId: createdCanvas.workspaceId,
        latestRevision: createdCanvas.latestRevision,
        title: '',
        compatibilityFilePath: null,
      });

      const opened = openTabByPath(createdCanvas.canvasId);
      if (opened) {
        setGraph({
          nodes: [],
          edges: [],
          sourceVersion: null,
          sourceVersions: {},
          canvasVersions: {},
        });
        setGraphError(null);
      }

      await loadActiveWorkspaceCanvases(activeWorkspace);
      navigateToWorkspaceCanvas(createdCanvas.canvasId);
      return opened;
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : '새 캔버스를 만드는 데 실패했습니다.';
      setGraphError({
        message,
        type: 'CANVAS_CREATE_FAILED',
        details: error,
      });
      return false;
    }
  }, [activeWorkspace, hostRpc, loadActiveWorkspaceCanvases, openTabByPath, registerWorkspaceCanvas, setCurrentCanvasId, setGraph, setGraphError]);

  const restoreNodeData = useCallback((nodeId: string, previousData: Record<string, unknown> | undefined) => {
    useGraphStore.setState((state) => ({
      nodes: state.nodes.map((node) => (
        node.id === nodeId
          ? {
              ...node,
              zIndex: typeof previousData?.zIndex === 'number' ? previousData.zIndex : undefined,
              data: previousData || {},
            }
          : node
      )),
    }));
  }, []);
  const applyRuntimeAction = useCallback((descriptor: RuntimeActionDescriptor) => {
    if (descriptor.actionId === 'apply-node-data-patch') {
      useGraphStore.getState().updateNodeData(descriptor.payload.nodeId, descriptor.payload.patch);
      return;
    }
    if (descriptor.actionId === 'restore-node-data') {
      restoreNodeData(descriptor.payload.nodeId, descriptor.payload.previousData);
      return;
    }
    if (descriptor.actionId === 'select-node-group') {
      const runtime = useGraphStore.getState();
      const groupNodeIds = runtime.nodes
        .filter((node) => node.data?.groupId === descriptor.payload.groupId)
        .map((node) => node.id);
      const nextSelectedNodeIds = groupNodeIds.length > 0
        ? groupNodeIds
        : (descriptor.payload.anchorNodeId ? [descriptor.payload.anchorNodeId] : []);
      useGraphStore.setState((state) => ({
        nodes: state.nodes.map((node) => {
          const selected = nextSelectedNodeIds.includes(node.id);
          return node.selected === selected
            ? node
            : { ...node, selected };
        }),
        selectedNodeIds: nextSelectedNodeIds,
        activeGroupFocusGroupId: null,
      }));
    }
  }, [restoreNodeData]);

  const commitHistoryEffect = useCallback((effect: ActionRoutingHistoryEffect, result: {
    commandId?: string;
    newVersion?: string;
  }) => {
    const nextVersion = result.newVersion
      ?? (effect.canvasId ? useGraphStore.getState().canvasVersions[effect.canvasId] : null)
      ?? useGraphStore.getState().sourceVersions[effect.filePath]
      ?? effect.baseVersion;
    const commandId = result.commandId ?? crypto.randomUUID();

    pushEditCompletionEvent({
      eventId: crypto.randomUUID(),
      type: effect.eventType,
      nodeId: effect.nodeId,
      canvasId: effect.canvasId ?? currentCanvasId ?? '',
      filePath: effect.filePath,
      compatibilityFilePath: effect.compatibilityFilePath ?? effect.filePath,
      commandId,
      baseVersion: effect.baseVersion,
      nextVersion,
      before: effect.before,
      after: effect.after,
      committedAt: Date.now(),
    });

    if (effect.pendingSelectionRenderedId) {
      pendingSelectionNodeIdRef.current = effect.pendingSelectionRenderedId;
      const createdNode = (
        effect.after
        && typeof effect.after === 'object'
        && 'create' in (effect.after as Record<string, unknown>)
      )
        ? (effect.after as { create?: { type?: string } }).create
        : undefined;
      if (
        createdNode?.type
        && resolveImmediateCreateEditMode(createdNode.type as CreatePayload['nodeType'])
      ) {
        pendingCreateEditRef.current = {
          renderedId: effect.pendingSelectionRenderedId,
          mode: resolveImmediateCreateEditMode(createdNode.type as CreatePayload['nodeType']) as PendingCreateEdit['mode'],
        };
      }
    }
    if (effect.reloadGraphOnSuccess) {
      handleFileChange();
    }
  }, [currentCanvasId, handleFileChange, pushEditCompletionEvent]);

  const executeMutationDescriptor = useCallback(async (descriptor: MutationDispatchDescriptor) => {
    const targetCanvasId = descriptor.payload.canvasId ?? currentCanvasId;
    const targetCompatibilityFilePath = descriptor.payload.compatibilityFilePath ?? descriptor.payload.filePath;
    if (descriptor.actionId === 'node.update') {
      return updateNode(
        descriptor.payload.nodeId,
        descriptor.payload.props,
        targetCompatibilityFilePath,
        descriptor.payload.commandType
          ? { commandType: descriptor.payload.commandType }
          : undefined,
        targetCanvasId,
      );
    }
    if (descriptor.actionId === 'canvas.node.create') {
      return createCanvasNode(descriptor.payload.node, targetCompatibilityFilePath, targetCanvasId);
    }
    if (descriptor.actionId === 'node.create') {
      return createNode(descriptor.payload.node, targetCompatibilityFilePath, targetCanvasId);
    }
    if (descriptor.actionId === 'node.delete') {
      return deleteNode(descriptor.payload.nodeId, targetCompatibilityFilePath, targetCanvasId);
    }
    if (descriptor.actionId === 'node.reparent') {
      return reparentNode(
        descriptor.payload.nodeId,
        descriptor.payload.newParentId,
        targetCompatibilityFilePath,
        targetCanvasId,
      );
    }
    if (descriptor.actionId === 'node.group-membership.update') {
      return updateNode(
        descriptor.payload.nodeId,
        { groupId: descriptor.payload.groupId },
        targetCompatibilityFilePath,
        { commandType: 'node.group.update' },
        targetCanvasId,
      );
    }
    if (descriptor.actionId === 'node.z-order.update') {
      return updateNode(
        descriptor.payload.nodeId,
        { zIndex: descriptor.payload.zIndex },
        targetCompatibilityFilePath,
        { commandType: 'node.z-order.update' },
        targetCanvasId,
      );
    }
    throw new RpcClientError(RPC_ERRORS.INVALID_PARAMS.code, RPC_ERRORS.INVALID_PARAMS.message, {
      stage: 'WorkspaceClient.executeMutationDescriptor',
    });
  }, [createCanvasNode, createNode, currentCanvasId, deleteNode, reparentNode, updateNode]);

  const { dispatchActionRoutingIntentOrThrow } = useMemo(() => createCanvasActionDispatchBinding({
    getRuntime: () => {
      const runtime = useGraphStore.getState();
      return {
        nodes: runtime.nodes,
        edges: runtime.edges,
        currentCanvasId: runtime.currentCanvasId,
        currentCompatibilityFilePath,
        canvasVersions: runtime.canvasVersions,
        selectedNodeIds: runtime.selectedNodeIds,
      };
    },
    applyRuntimeAction,
    executeMutationDescriptor,
    commitHistoryEffect,
    registerPendingActionRouting,
    clearPendingActionRouting,
    registryEntries: canvasRuntime.intents,
  }), [
    applyRuntimeAction,
    clearPendingActionRouting,
    commitHistoryEffect,
    currentCanvasId,
    currentCompatibilityFilePath,
    executeMutationDescriptor,
    registerPendingActionRouting,
  ]);

  const handleNodeStyleCommit = useCallback(async (payload: {
    nodeId: string;
    patch: Record<string, unknown>;
    surfaceId?: ActionRoutingSurfaceId;
    surface?: Extract<CanvasEntrypointSurface, 'selection-floating-menu'>;
    trigger?: { source: 'click' | 'hotkey' | 'menu' | 'inspector' };
  }) => {
    const runtime = useGraphStore.getState();
    const targetNode = runtime.nodes.find((node) => node.id === payload.nodeId);
    if (!targetNode) {
      throw new RpcClientError(40401, 'NODE_NOT_FOUND', { nodeId: payload.nodeId });
    }

    try {
      await dispatchActionRoutingIntentOrThrow({
        surface: resolveLegacyEntrypointSurface({
          surfaceId: payload.surfaceId,
          surface: payload.surface,
        }),
        intent: 'style-update',
        resolvedContext: resolveNodeActionRoutingContext(
          targetNode,
          currentCanvasId,
          currentCompatibilityFilePath,
          runtime.selectedNodeIds,
        ),
        uiPayload: {
          patch: payload.patch,
        },
        trigger: payload.trigger ?? { source: 'inspector' },
      });
    } catch (error) {
      const message = mapEditRpcErrorToToast(error) ?? '스타일 저장에 실패했습니다.';
      setGraphError({
        message,
        type: 'EDIT_REJECTED',
        details: error,
      });
      throw error;
    }
  }, [dispatchActionRoutingIntentOrThrow, setGraphError]);

  const handleWashiPresetChange = useCallback(
    async (nodeIds: string[], presetId: string) => {
      await Promise.all(nodeIds.map((nodeId) => handleNodeStyleCommit({
        nodeId,
        patch: { pattern: { type: 'preset', id: presetId } },
        surface: 'selection-floating-menu',
        trigger: { source: 'hotkey' },
      })));
    },
    [handleNodeStyleCommit],
  );

  const handleSelectionStyleCommit = useCallback(async (input: {
    nodeIds: string[];
    patch: Record<string, unknown>;
  }) => {
    await Promise.all(input.nodeIds.map((nodeId) => handleNodeStyleCommit({
      nodeId,
      patch: input.patch,
      surface: 'selection-floating-menu',
      trigger: { source: 'click' },
    })));
  }, [handleNodeStyleCommit]);

  const handleSelectionContentCommit = useCallback(async (input: {
    nodeId: string;
    content: string;
    trigger?: { source: 'click' | 'inspector' };
  }) => {
    const runtime = useGraphStore.getState();
    const node = runtime.nodes.find((item) => item.id === input.nodeId);
    if (!node) {
      throw new RpcClientError(40401, 'NODE_NOT_FOUND', { nodeId: input.nodeId });
    }

    try {
      await dispatchActionRoutingIntentOrThrow({
        surface: 'selection-floating-menu',
        intent: 'content-update',
        resolvedContext: resolveNodeActionRoutingContext(
          node,
          currentCanvasId,
          currentCompatibilityFilePath,
          runtime.selectedNodeIds,
        ),
        uiPayload: {
          content: input.content,
        },
        trigger: input.trigger ?? { source: 'click' },
      });
    } catch (error) {
      const message = mapEditRpcErrorToToast(error) ?? '텍스트 저장에 실패했습니다.';
      setGraphError({
        message,
        type: 'EDIT_REJECTED',
        details: error,
      });
      throw error;
    }
  }, [dispatchActionRoutingIntentOrThrow, setGraphError]);

  const handleNodeRenameCommit = useCallback(async (input: {
    nodeId: string;
    surfaceId?: ActionRoutingSurfaceId;
    surface?: Extract<CanvasEntrypointSurface, 'node-context-menu'>;
    trigger?: { source: 'menu' | 'hotkey' };
  }) => {
    const runtime = useGraphStore.getState();
    const targetNode = runtime.nodes.find((node) => node.id === input.nodeId);
    if (!targetNode) {
      throw new RpcClientError(40401, 'NODE_NOT_FOUND', { nodeId: input.nodeId });
    }

    const editContext = resolveNodeEditContext(targetNode, currentCompatibilityFilePath);
    if (!editContext.target.filePath) {
      throw new Error('SOURCE_VERSION_NOT_READY');
    }
    if (!canRunNodeCommand(targetNode, 'node.rename')) {
      throw new RpcClientError(42201, 'EDIT_NOT_ALLOWED', {
        nodeId: input.nodeId,
        reason: editContext.readOnlyReason ?? 'RENAME_NOT_ALLOWED',
      });
    }

    const currentId = editContext.target.nodeId;
    const nextId = window.prompt('새 노드 ID', currentId)?.trim();
    if (!nextId || nextId === currentId) {
      return;
    }

    try {
      await dispatchActionRoutingIntentOrThrow({
        surface: resolveLegacyEntrypointSurface({
          surfaceId: input.surfaceId,
          surface: input.surface,
        }),
        intent: 'rename-node',
        resolvedContext: resolveNodeActionRoutingContext(
          targetNode,
          currentCanvasId,
          currentCompatibilityFilePath,
          runtime.selectedNodeIds,
        ),
        uiPayload: {
          nextId,
        },
        trigger: input.trigger ?? { source: 'menu' },
      });
    } catch (error) {
      const message = mapEditRpcErrorToToast(error) ?? 'ID 변경에 실패했습니다.';
      setGraphError({
        message,
        type: 'EDIT_REJECTED',
        details: error,
      });
      throw error;
    }
  }, [dispatchActionRoutingIntentOrThrow, setGraphError]);

  const handleNodeDuplicateCommit = useCallback(async (input: {
    nodeId: string;
    surfaceId?: ActionRoutingSurfaceId;
    surface?: Extract<CanvasEntrypointSurface, 'node-context-menu'>;
    trigger?: { source: 'menu' | 'hotkey' };
  }) => {
    const runtime = useGraphStore.getState();
    const targetNode = runtime.nodes.find((node) => node.id === input.nodeId);
    if (!targetNode) {
      throw new RpcClientError(40401, 'NODE_NOT_FOUND', { nodeId: input.nodeId });
    }

    try {
      await dispatchActionRoutingIntentOrThrow({
        surface: resolveLegacyEntrypointSurface({
          surfaceId: input.surfaceId,
          surface: input.surface,
        }),
        intent: 'duplicate-node',
        resolvedContext: resolveNodeActionRoutingContext(
          targetNode,
          currentCanvasId,
          currentCompatibilityFilePath,
          runtime.selectedNodeIds,
        ),
        uiPayload: {},
        trigger: input.trigger ?? { source: 'menu' },
      });
    } catch (error) {
      const message = mapEditRpcErrorToToast(error) ?? '노드 복제에 실패했습니다.';
      setGraphError({
        message,
        type: 'EDIT_REJECTED',
        details: error,
      });
      throw error;
    }
  }, [dispatchActionRoutingIntentOrThrow, setGraphError]);

  const handleNodeDeleteCommit = useCallback(async (input: {
    nodeId: string;
    surfaceId?: ActionRoutingSurfaceId;
    surface?: Extract<CanvasEntrypointSurface, 'node-context-menu'>;
    trigger?: { source: 'menu' | 'hotkey' };
  }) => {
    const runtime = useGraphStore.getState();
    const targetNode = runtime.nodes.find((node) => node.id === input.nodeId);
    if (!targetNode) {
      throw new RpcClientError(40401, 'NODE_NOT_FOUND', { nodeId: input.nodeId });
    }

    try {
      await dispatchActionRoutingIntentOrThrow({
        surface: resolveLegacyEntrypointSurface({
          surfaceId: input.surfaceId,
          surface: input.surface,
        }),
        intent: 'delete-node',
        resolvedContext: resolveNodeActionRoutingContext(
          targetNode,
          currentCanvasId,
          currentCompatibilityFilePath,
          runtime.selectedNodeIds,
        ),
        uiPayload: {},
        trigger: input.trigger ?? { source: 'menu' },
      });
    } catch (error) {
      const message = mapEditRpcErrorToToast(error) ?? '노드 삭제에 실패했습니다.';
      setGraphError({
        message,
        type: 'EDIT_REJECTED',
        details: error,
      });
      throw error;
    }
  }, [dispatchActionRoutingIntentOrThrow, setGraphError]);

  const handleNodeLockToggleCommit = useCallback(async (input: {
    nodeId: string;
    surfaceId?: ActionRoutingSurfaceId;
    surface?: Extract<CanvasEntrypointSurface, 'node-context-menu'>;
    trigger?: { source: 'menu' | 'hotkey' };
  }) => {
    const runtime = useGraphStore.getState();
    const targetNode = runtime.nodes.find((node) => node.id === input.nodeId);
    if (!targetNode) {
      throw new RpcClientError(40401, 'NODE_NOT_FOUND', { nodeId: input.nodeId });
    }

    try {
      await dispatchActionRoutingIntentOrThrow({
        surface: resolveLegacyEntrypointSurface({
          surfaceId: input.surfaceId,
          surface: input.surface,
        }),
        intent: 'toggle-node-lock',
        resolvedContext: resolveNodeActionRoutingContext(
          targetNode,
          currentCanvasId,
          currentCompatibilityFilePath,
          runtime.selectedNodeIds,
        ),
        uiPayload: {},
        trigger: input.trigger ?? { source: 'menu' },
      });
    } catch (error) {
      const message = mapEditRpcErrorToToast(error) ?? '노드 잠금 전환에 실패했습니다.';
      setGraphError({
        message,
        type: 'EDIT_REJECTED',
        details: error,
      });
      throw error;
    }
  }, [dispatchActionRoutingIntentOrThrow, setGraphError]);

  const handleNodeGroupSelectCommit = useCallback(async (input: {
    nodeId: string;
    surfaceId?: ActionRoutingSurfaceId;
    surface?: Extract<CanvasEntrypointSurface, 'node-context-menu'>;
    trigger?: { source: 'menu' | 'hotkey' };
  }) => {
    const runtime = useGraphStore.getState();
    const targetNode = runtime.nodes.find((node) => node.id === input.nodeId);
    if (!targetNode) {
      throw new RpcClientError(40401, 'NODE_NOT_FOUND', { nodeId: input.nodeId });
    }

    try {
      await dispatchActionRoutingIntentOrThrow({
        surface: resolveLegacyEntrypointSurface({
          surfaceId: input.surfaceId,
          surface: input.surface,
        }),
        intent: 'select-node-group',
        resolvedContext: resolveNodeActionRoutingContext(
          targetNode,
          currentCompatibilityFilePath,
          runtime.selectedNodeIds,
        ),
        uiPayload: {},
        trigger: input.trigger ?? { source: 'menu' },
      });
    } catch (error) {
      const message = mapEditRpcErrorToToast(error) ?? '그룹 선택에 실패했습니다.';
      setGraphError({
        message,
        type: 'EDIT_REJECTED',
        details: error,
      });
      throw error;
    }
  }, [dispatchActionRoutingIntentOrThrow, setGraphError]);

  const handleSelectionStructuralCommit = useCallback(async (input: GraphCanvasSelectionActionIntentInput & {
    intent: 'group-selection' | 'ungroup-selection' | 'bring-selection-to-front' | 'send-selection-to-back';
    fallbackMessage: string;
  }) => {
    const runtime = useGraphStore.getState();
    const anchorNodeId = input.anchorNodeId ?? runtime.selectedNodeIds[0];
    if (!anchorNodeId) {
      return;
    }

    const anchorNode = runtime.nodes.find((node) => node.id === anchorNodeId);
    if (!anchorNode) {
      throw new RpcClientError(40401, 'NODE_NOT_FOUND', { nodeId: anchorNodeId });
    }

    try {
      await dispatchActionRoutingIntentOrThrow({
        surface: resolveLegacyEntrypointSurface({
          surfaceId: input.surfaceId,
          surface: input.surface,
        }),
        intent: input.intent,
        resolvedContext: resolveNodeActionRoutingContext(
          anchorNode,
          currentCanvasId,
          currentCompatibilityFilePath,
          runtime.selectedNodeIds,
        ),
        uiPayload: {},
        trigger: input.trigger ?? { source: 'menu' },
      });
    } catch (error) {
      const message = mapEditRpcErrorToToast(error) ?? input.fallbackMessage;
      setGraphError({
        message,
        type: 'EDIT_REJECTED',
        details: error,
      });
      throw error;
    }
  }, [dispatchActionRoutingIntentOrThrow, setGraphError]);

  const handleGroupSelectionCommit = useCallback((input: GraphCanvasSelectionActionIntentInput) => (
    handleSelectionStructuralCommit({
      ...input,
      intent: 'group-selection',
      fallbackMessage: '선택 항목 그룹화에 실패했습니다.',
    })
  ), [handleSelectionStructuralCommit]);

  const handleUngroupSelectionCommit = useCallback((input: GraphCanvasSelectionActionIntentInput) => (
    handleSelectionStructuralCommit({
      ...input,
      intent: 'ungroup-selection',
      fallbackMessage: '그룹 해제에 실패했습니다.',
    })
  ), [handleSelectionStructuralCommit]);

  const handleBringSelectionToFrontCommit = useCallback((input: GraphCanvasSelectionActionIntentInput) => (
    handleSelectionStructuralCommit({
      ...input,
      intent: 'bring-selection-to-front',
      fallbackMessage: '맨 앞으로 이동에 실패했습니다.',
    })
  ), [handleSelectionStructuralCommit]);

  const handleSendSelectionToBackCommit = useCallback((input: GraphCanvasSelectionActionIntentInput) => (
    handleSelectionStructuralCommit({
      ...input,
      intent: 'send-selection-to-back',
      fallbackMessage: '맨 뒤로 이동에 실패했습니다.',
    })
  ), [handleSelectionStructuralCommit]);

  const handleCreateNodeCommit = useCallback(async (input: {
    surfaceId?: ActionRoutingSurfaceId;
    surface?: Exclude<CanvasEntrypointSurface, 'selection-floating-menu'>;
    trigger?: { source: 'click' | 'menu' };
    nodeType: CreatePayload['nodeType'];
    placement:
      | { mode: 'canvas-absolute'; x: number; y: number }
      | { mode: 'mindmap-root'; x: number; y: number; mindmapId?: string }
      | { mode: 'mindmap-child'; parentId: string }
      | { mode: 'mindmap-sibling'; siblingOf: string; parentId: string | null };
    initialProps?: Record<string, unknown>;
    targetRenderedNodeId?: string;
    filePath?: string;
    scopeId?: string;
    frameScope?: string;
    targetNodeId?: string;
  }) => {
    const runtime = useGraphStore.getState();
    const intent = input.placement.mode === 'mindmap-child'
      ? 'create-mindmap-child'
      : input.placement.mode === 'mindmap-sibling'
        ? 'create-mindmap-sibling'
        : 'create-node';
    const resolvedContext = input.placement.mode === 'canvas-absolute' || input.placement.mode === 'mindmap-root'
      ? createPaneActionRoutingContext({
        currentCanvasId,
        currentFile: currentCompatibilityFilePath,
        selectedNodeIds: runtime.selectedNodeIds,
      })
      : (() => {
        const renderedNodeId = input.targetRenderedNodeId ?? input.targetNodeId;
        const targetNode = renderedNodeId
          ? runtime.nodes.find((node) => node.id === renderedNodeId)
          : null;
        if (!targetNode) {
          throw new RpcClientError(40401, 'NODE_NOT_FOUND', { nodeId: renderedNodeId });
        }
        return resolveNodeActionRoutingContext(
          targetNode,
          currentCanvasId,
          currentCompatibilityFilePath,
          runtime.selectedNodeIds,
        );
      })();

    try {
      await dispatchActionRoutingIntentOrThrow({
        surface: resolveLegacyEntrypointSurface({
          surfaceId: input.surfaceId,
          surface: input.surface,
        }),
        intent,
        resolvedContext,
        uiPayload: {
          nodeType: input.nodeType,
          placement: input.placement,
          ...(input.initialProps ? { initialProps: input.initialProps } : {}),
          filePath: input.filePath,
          scopeId: input.scopeId,
          frameScope: input.frameScope,
        },
        trigger: input.trigger ?? {
          source: input.placement.mode === 'canvas-absolute' ? 'click' : 'menu',
        },
      });
    } catch (error) {
      const message = mapEditRpcErrorToToast(error) ?? '오브젝트 생성에 실패했습니다.';
      setGraphError({
        message,
        type: 'EDIT_REJECTED',
        details: error,
      });
      throw error;
    }
  }, [dispatchActionRoutingIntentOrThrow, setGraphError]);

  const handleMindMapReparentCommit = useCallback(async (input: {
    draggedNodeId: string;
    newParentNodeId: string;
  }) => {
    const runtime = useGraphStore.getState();
    const targetNode = runtime.nodes.find((node) => node.id === input.draggedNodeId);
    const parentNode = runtime.nodes.find((node) => node.id === input.newParentNodeId);
    if (!targetNode || !parentNode) {
      throw new RpcClientError(40401, 'NODE_NOT_FOUND', input);
    }

    const targetContext = resolveNodeEditContext(targetNode, currentCompatibilityFilePath);
    const parentContext = resolveNodeEditContext(parentNode, currentCompatibilityFilePath);
    if (!targetContext.target.filePath) {
      throw new Error('SOURCE_VERSION_NOT_READY');
    }
    if (!canRunNodeCommand(targetNode, 'node.reparent')) {
      throw new RpcClientError(42201, 'EDIT_NOT_ALLOWED', {
        nodeId: input.draggedNodeId,
        reason: targetContext.readOnlyReason ?? 'REPARENT_NOT_ALLOWED',
      });
    }

    const baseVersion = currentCanvasId ? runtime.canvasVersions[currentCanvasId] ?? null : null;
    if (!baseVersion) {
      throw new Error('SOURCE_VERSION_NOT_READY');
    }

    const currentParentEdge = runtime.edges.find((edge) => edge.target === input.draggedNodeId);
    const currentParentRenderedId = currentParentEdge?.source ?? null;
    const currentParentNode = currentParentRenderedId
      ? runtime.nodes.find((node) => node.id === currentParentRenderedId)
      : null;
    const currentParentContext = currentParentNode
      ? resolveNodeEditContext(currentParentNode, currentCompatibilityFilePath)
      : null;
    const nextParentId = parentContext.target.nodeId;
    const previousParentId = currentParentContext?.target.nodeId ?? null;
    if (previousParentId === nextParentId) {
      return;
    }

    const command = buildReparentCommand({
      target: {
        sourceId: targetContext.target.nodeId,
        canvasId: currentCanvasId ?? undefined,
        filePath: targetContext.target.filePath,
        compatibilityFilePath: targetContext.target.filePath,
        renderedId: targetNode.id,
        editMeta: targetContext.editMeta,
      },
      previousParentId,
      nextParentId,
    });

    try {
      const result = await reparentNode(
        command.target.sourceId,
        command.payload.next.parentId,
        command.target.compatibilityFilePath ?? command.target.filePath,
        currentCanvasId,
      );
      const nextVersion = result.newVersion
        ?? (currentCanvasId ? useGraphStore.getState().canvasVersions[currentCanvasId] : null)
        ?? baseVersion;
      const commandId = result.commandId ?? crypto.randomUUID();

      pushEditCompletionEvent({
        eventId: crypto.randomUUID(),
        type: 'NODE_REPARENTED',
        nodeId: command.target.sourceId,
        canvasId: currentCanvasId ?? '',
        filePath: command.target.filePath,
        compatibilityFilePath: command.target.compatibilityFilePath ?? command.target.filePath,
        commandId,
        baseVersion,
        nextVersion,
        before: command.payload.previous,
        after: command.payload.next,
        committedAt: Date.now(),
      });
      handleFileChange();
    } catch (error) {
      const message = mapEditRpcErrorToToast(error) ?? 'MindMap 구조 변경에 실패했습니다.';
      setGraphError({
        message,
        type: 'EDIT_REJECTED',
        details: error,
      });
      throw error;
    }
  }, [handleFileChange, pushEditCompletionEvent, reparentNode, setGraphError]);

  const handleNodeDragCommit = useCallback(async (payload: {
    nodeId: string;
    x: number;
    y: number;
    originX: number;
    originY: number;
  }) => {
    const runtime = useGraphStore.getState();
    const targetNode = runtime.nodes.find((node) => node.id === payload.nodeId);
    if (!targetNode) {
      throw new RpcClientError(40401, 'NODE_NOT_FOUND', { nodeId: payload.nodeId });
    }
    const editContext = resolveNodeEditContext(targetNode, currentCompatibilityFilePath);
    const editTarget = editContext.target;
    const baseVersion = currentCanvasId
      ? runtime.canvasVersions[currentCanvasId] ?? null
      : null;
    const targetFile = editTarget.filePath;
    if (!baseVersion || !targetFile) {
      throw new Error('SOURCE_VERSION_NOT_READY');
    }

    const relativeUpdate = mapDragToRelativeAttachmentUpdate({
      draggedNode: targetNode,
      allNodes: runtime.nodes,
      dropPosition: { x: payload.x, y: payload.y },
    });

    if (relativeUpdate?.kind === 'invalid') {
      throw new RpcClientError(40401, 'NODE_NOT_FOUND', { reason: relativeUpdate.reason });
    }

    const mindMapReparentIntent = resolveMindMapReparentIntent({
      draggedNode: targetNode,
      allNodes: runtime.nodes,
      dropPosition: { x: payload.x, y: payload.y },
    });
    if (mindMapReparentIntent) {
      if (mindMapReparentIntent.kind === 'rejected') {
        throw new RpcClientError(42201, 'EDIT_NOT_ALLOWED', {
          nodeId: payload.nodeId,
          reason: mindMapReparentIntent.reason,
        });
      }

      await handleMindMapReparentCommit({
        draggedNodeId: payload.nodeId,
        newParentNodeId: mindMapReparentIntent.newParentNodeId,
      });
      return;
    }

    if (relativeUpdate) {
      if (!canRunNodeCommand(targetNode, 'node.move.relative')) {
        throw new RpcClientError(42201, 'EDIT_NOT_ALLOWED', { nodeId: payload.nodeId });
      }

      const previousData = (targetNode.data || {}) as Record<string, unknown>;
      useGraphStore.getState().updateNodeData(payload.nodeId, relativeUpdate.props);
      try {
        const relativeCommand = buildRelativeMoveCommand({
          target: {
            sourceId: editTarget.nodeId,
            canvasId: currentCanvasId ?? undefined,
            filePath: targetFile,
            compatibilityFilePath: targetFile,
            renderedId: targetNode.id,
            editMeta: editContext.editMeta,
          },
          carrier: relativeUpdate.kind === 'sticker-anchor' ? 'gap' : 'at.offset',
          previous: relativeUpdate.before,
          next: relativeUpdate.after,
        });
        const result = await updateNode(
          editTarget.nodeId,
          toUpdateNodeProps(relativeCommand),
          targetFile,
          { commandType: relativeCommand.type },
          currentCanvasId,
        );
        const nextVersion = result.newVersion
          ?? (currentCanvasId ? useGraphStore.getState().canvasVersions[currentCanvasId] : null)
          ?? baseVersion;
        const commandId = result.commandId ?? crypto.randomUUID();
        pushEditCompletionEvent({
          eventId: crypto.randomUUID(),
          type: 'RELATIVE_MOVE_COMMITTED',
          nodeId: editTarget.nodeId,
          canvasId: currentCanvasId ?? '',
          filePath: targetFile,
          compatibilityFilePath: targetFile,
          commandId,
          baseVersion,
          nextVersion,
          before: relativeCommand.payload.previous,
          after: relativeCommand.payload.next,
          committedAt: Date.now(),
        });
      } catch (error) {
        restoreNodeData(payload.nodeId, previousData);
        throw error;
      }
      return;
    }

    if (!canRunNodeCommand(targetNode, 'node.move.absolute')) {
      throw new RpcClientError(42201, 'EDIT_NOT_ALLOWED', { nodeId: payload.nodeId });
    }

    const absoluteCommand = buildAbsoluteMoveCommand({
      target: {
        sourceId: editTarget.nodeId,
        canvasId: currentCanvasId ?? undefined,
        filePath: targetFile,
        compatibilityFilePath: targetFile,
        renderedId: targetNode.id,
        editMeta: editContext.editMeta,
      },
      previous: { x: payload.originX, y: payload.originY },
      next: { x: payload.x, y: payload.y },
    });
    const result = await moveNode(editTarget.nodeId, payload.x, payload.y, targetFile, currentCanvasId);
    const nextVersion = result.newVersion
      ?? (currentCanvasId ? useGraphStore.getState().canvasVersions[currentCanvasId] : null)
      ?? baseVersion;
    const commandId = result.commandId ?? crypto.randomUUID();
    pushEditCompletionEvent({
      eventId: crypto.randomUUID(),
      type: 'ABSOLUTE_MOVE_COMMITTED',
      nodeId: editTarget.nodeId,
      canvasId: currentCanvasId ?? '',
      filePath: targetFile,
      compatibilityFilePath: targetFile,
      commandId,
      baseVersion,
      nextVersion,
      before: absoluteCommand.payload.previous,
      after: absoluteCommand.payload.next,
      committedAt: Date.now(),
    });
  }, [handleMindMapReparentCommit, moveNode, pushEditCompletionEvent, restoreNodeData, updateNode]);

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
      if (commandId === 'new-canvas') {
        return handleCreateCanvas();
      }

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
      handleCreateCanvas,
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
        id: 'new-canvas',
        label: 'New canvas',
        hint: 'Empty canvas',
        keywords: ['new', 'canvas', 'empty', '새 캔버스'],
      },
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

  const handleBack = useCallback(() => {
    if (activeWorkspace) {
      navigateToWorkspaceDetail(activeWorkspace.id);
      return;
    }

    navigateToDashboard();
  }, [activeWorkspace]);

  const handleMenu = useCallback(() => {
    if (activeWorkspace) {
      navigateToWorkspaceDetail(activeWorkspace.id);
      return;
    }

    navigateToDashboard();
  }, [activeWorkspace]);

  const currentCanvasTitle = useMemo(() => (
    activeWorkspaceCanvas?.title || null
  ), [activeWorkspaceCanvas?.title]);



  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean =>
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target as HTMLElement)?.isContentEditable;

    const handleShortcut = (event: KeyboardEvent) => {

      const isModifierPressed = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (!isModifierPressed) return;
      if (isEditableTarget(event.target)) return;

      if (key === 't') {
        event.preventDefault();
        setIsQuickOpenOpen(true);
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


    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [
    isSearchOpen,
    openSearch,
    closeSearch,
  ]);

  useEffect(() => {
    if (!pendingTextEditAction) {
      return;
    }
    clearPendingTextEditAction();

    const run = async () => {
      if (pendingTextEditAction.type === 'cancel') {
        clearTextEditSession();
        return;
      }

      if (!canCommitTextEdit({
        activeNodeId: activeTextEditNodeId,
        requestNodeId: pendingTextEditAction.nodeId,
        selectedNodeIds,
      })) {
        clearTextEditSession();
        return;
      }

      const runtime = useGraphStore.getState();
      const node = runtime.nodes.find((item) => item.id === pendingTextEditAction.nodeId);
      if (!node) {
        clearTextEditSession();
        return;
      }
      const editTarget = resolveNodeEditTarget(node, currentCompatibilityFilePath);
      if (!editTarget.filePath) {
        clearTextEditSession();
        return;
      }
      if (!canRunNodeCommand(node, 'node.content.update')) {
        clearTextEditSession();
        return;
      }

      const beforeContent = getNodeLabel(node);
      const nextContent = textEditDraft;
      const slashCommandSession = resolveBodySlashCommandSession(nextContent);
      if (slashCommandSession) {
        const sourceMeta = (((node.data || {}) as Record<string, unknown>).sourceMeta || {}) as Record<string, unknown>;
        const objectId = typeof sourceMeta.sourceId === 'string' && sourceMeta.sourceId.length > 0
          ? sourceMeta.sourceId
          : pendingTextEditAction.nodeId;
        const resolvedSlashCommand = resolveBodySlashCommand(nextContent);

        if (!resolvedSlashCommand) {
          clearTextEditSession();
          return;
        }

        try {
          await insertObjectBodyBlock(toObjectBodyBlockInsertInput({
            objectId,
            block: resolvedSlashCommand.createBlock(`body-${crypto.randomUUID()}`),
            afterBlockId: 'body-1',
          }) as unknown as {
            objectId: string;
            block: Record<string, unknown>;
            afterBlockId?: string;
          }, currentCompatibilityFilePath, currentCanvasId);
          clearTextEditSession();
        } catch (error) {
          editDebugLog('slash-block-insert', error, {
            nodeId: objectId,
            command: slashCommandSession.command,
          });
          const message = mapEditRpcErrorToToast(error) ?? '블록 추가에 실패했습니다.';
          setGraphError({
            message,
            type: 'EDIT_REJECTED',
            details: error,
          });
        }
        return;
      }
      if (beforeContent === nextContent) {
        clearTextEditSession();
        return;
      }

      try {
        await handleSelectionContentCommit({
          nodeId: pendingTextEditAction.nodeId,
          content: nextContent,
          trigger: { source: 'inspector' },
        });
        clearTextEditSession();
      } catch (error) {
        editDebugLog('text-edit-commit', error, {
          nodeId: editTarget.nodeId,
          filePath: editTarget.filePath,
          beforeContent,
          nextContent,
        });
        const message = mapEditRpcErrorToToast(error) ?? '텍스트 저장에 실패했습니다.';
        setGraphError({
          message,
          type: 'EDIT_REJECTED',
          details: error,
        });
      }
    };

    run();
  }, [
    activeTextEditNodeId,
    clearPendingTextEditAction,
    clearTextEditSession,
    handleSelectionContentCommit,
    currentCanvasId,
    currentCompatibilityFilePath,
    insertObjectBodyBlock,
    pendingTextEditAction,
    selectedNodeIds,
    setGraphError,
    textEditDraft,
  ]);

  useEffect(() => {
    async function renderCanvas() {
      if (!currentCanvasId) return;

      if (currentCompatibilityFilePath && draftCanvases.includes(currentCompatibilityFilePath)) {
        setGraph({
          nodes: [],
          edges: [],
          sourceVersion: null,
          canvasVersions: {
            ...(currentCanvasId ? { [currentCanvasId]: 'draft:empty-canvas' } : {}),
          },
          sourceVersions: {
            ...useGraphStore.getState().sourceVersions,
            [currentCompatibilityFilePath]: 'draft:empty-canvas',
          },
        });
        setGraphError(null);
        return;
      }

      try {
        setGraphError(null); // Clear previous errors

        const response = await fetch('/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            canvasId: currentCanvasId,
            ...(activeWorkspace?.rootPath ?? workspaceRootPath
              ? { rootPath: activeWorkspace?.rootPath ?? workspaceRootPath }
              : {}),
          }),
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

        const parsed = parseRenderGraph(data);
        if (parsed) {
          if (typeof data.compatibilityFilePath === 'string' && data.compatibilityFilePath.length > 0) {
            setCurrentCompatibilityFilePath(data.compatibilityFilePath);
          }
          setCurrentCanvasId(typeof data.canvasId === 'string'
            ? data.canvasId
            : currentCanvasId);
          setGraph(parsed);
          if (pendingSelectionNodeIdRef.current) {
            const createdNodeId = pendingSelectionNodeIdRef.current;
            const createdNode = parsed.nodes.find((node) => node.id === createdNodeId);
            if (createdNode) {
              setSelectedNodes([createdNodeId]);
              pendingSelectionNodeIdRef.current = null;
              const createCompleteSession = resolveCreateCompleteBodyEditSession({
                createdNode,
                pendingCreateEdit: pendingCreateEditRef.current,
              });
              if (createCompleteSession) {
                useGraphStore.getState().startTextEditSession({
                  nodeId: createCompleteSession.nodeId,
                  initialDraft: createCompleteSession.initialDraft,
                  mode: createCompleteSession.mode,
                });
                pendingCreateEditRef.current = null;
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to render canvas:', error);
      }
    }

    renderCanvas();
  }, [activeWorkspace?.rootPath, currentCanvasId, currentCompatibilityFilePath, draftCanvases, refreshKey, setCurrentCanvasId, setCurrentCompatibilityFilePath, setGraph, setSelectedNodes, workspaceRootPath]); // refreshKey triggers re-render on file changes

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <div className="flex flex-1 flex-col h-full overflow-hidden relative">
        <Header
          onBack={handleBack}
          onMenu={handleMenu}
          canvasTitle={currentCanvasTitle}
        />
        {/* TabBar removed by user request */}

        <main className="flex-1 relative w-full h-full overflow-hidden">
          <ErrorOverlay />
          {isSearchOpen && <LazySearchOverlay />}
          <GraphCanvas
            onNodeDragStop={handleNodeDragCommit}
            onUndoEditStep={undoLastEdit}
            onRedoEditStep={redoLastEdit}
            mapEditErrorToToast={mapEditRpcErrorToToast}
            onRenameNode={handleNodeRenameCommit}
            onDuplicateNode={handleNodeDuplicateCommit}
            onDeleteNode={handleNodeDeleteCommit}
            onToggleNodeLock={handleNodeLockToggleCommit}
            onSelectNodeGroup={handleNodeGroupSelectCommit}
            onGroupSelection={handleGroupSelectionCommit}
            onUngroupSelection={handleUngroupSelectionCommit}
            onBringSelectionToFront={handleBringSelectionToFrontCommit}
            onSendSelectionToBack={handleSendSelectionToBackCommit}
            onCreateNode={handleCreateNodeCommit}
            onApplySelectionStyle={handleSelectionStyleCommit}
            onCommitSelectionContent={handleSelectionContentCommit}
          />
          <LazyStickerInspector onApplyStylePatch={handleNodeStyleCommit} />
        </main>

        {isQuickOpenOpen && (
          <LazyQuickOpenDialog
            isOpen={isQuickOpenOpen}
            files={files}
            commands={quickOpenCommands}
            onOpenFile={openTabByPath}
            onRunCommand={runQuickOpenCommand}
            onClose={() => setIsQuickOpenOpen(false)}
          />
        )}

        {/* Workspace-level overlays stay outside the canvas overlay host boundary. */}

      </div>
    </div>
  );
}
