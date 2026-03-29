'use client';


import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { RpcClientError } from '@/hooks/useFileSync';
import type { RpcMutationResult } from '@/hooks/useFileSync.shared';
import { useCanvasRuntime } from '@/hooks/useCanvasRuntime';
import { GraphCanvas, resolveCreateCompleteBodyEditSession } from '@/components/GraphCanvas';
import type { GraphCanvasSelectionActionIntentInput } from '@/components/GraphCanvas';
import { resolveBodySlashCommandSession } from '@/components/nodes/renderableContent';
import { Header } from '@/components/ui/Header';
import { Sidebar } from '@/components/ui/Sidebar';

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
  LAST_ACTIVE_CANVAS_ID_SESSION_PREFERENCE_KEY,
  type RegisteredWorkspace,
  type WorkspaceProbeResponse,
  type WorkspaceSidebarCanvas,
  updateWorkspaceFromProbe,
} from '@/components/editor/workspaceRegistry';
import { getHostRuntime } from '@/features/host/renderer/createHostRuntime';
import {
  navigateToDashboard,
  navigateToWorkspaceCanvas,
} from '@/features/host/renderer/navigation';
import { resolveCreatedCanvasBootstrapGraph } from './createdCanvasBootstrap';
import {
  copyTextWithDesktopBridge,
  pickWorkspaceRootPath,
  pickWorkspaceSaveLocation,
} from '@/components/editor/desktopBridge';



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

function readCanvasIdMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      ([, canvasId]) => typeof canvasId === 'string' && canvasId.length > 0,
    ),
  );
}





export function CanvasEditorPage({ canvasId }: { canvasId: string }) {
  const hostRuntime = useMemo(() => getHostRuntime(), []);
  const hostRpc = hostRuntime.rpc;
  const transientCanvasId = hostRuntime.runtimeConfig?.transientCanvasId ?? null;

  useEffect(() => {
    useGraphStore.getState().setCurrentCanvasId(canvasId);
  }, [canvasId]);

  // Workspace-canvas-shell migration anchor:
  // workspace registry/session state now lives in the graph store instead of local component state.
  const {
    setGraph,
    setAssetBasePath,
    currentCanvasId,
    setCurrentCanvasId,
    workspaceRootPath,
    registeredWorkspaces,
    activeWorkspaceId,
    workspaceCanvasesByWorkspaceId,
    canvasVersions,
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
    setWorkspaceSession,
    hydrateWorkspaceRegistry,
    replaceRegisteredWorkspaces,
    upsertWorkspaceFromProbe,
    setWorkspaceCanvases,
    registerWorkspaceCanvas,
    setWorkspacePathStatus,
    rememberLastActiveCanvasForWorkspace,
    hydrateGlobalFontFamilyPreference,
    removeRegisteredWorkspace,
  } = useGraphStore();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false);
  const [isSavingTransientWorkspace, setIsSavingTransientWorkspace] = useState(false);

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
  const activeWorkspaceCanvas = useMemo(
    () => workspaceCanvases.find((canvas) => canvas.canvasId === currentCanvasId) ?? null,
    [currentCanvasId, workspaceCanvases],
  );
  const isTransientSession = !activeWorkspace && canvasId === transientCanvasId;
  const sidebarWorkspaces = useMemo(
    () => registeredWorkspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      rootPath: workspace.rootPath,
      status: workspace.status,
      canvasCount: workspace.canvasCount,
    })),
    [registeredWorkspaces],
  );
  const sidebarActiveWorkspace = useMemo(
    () => (activeWorkspace ? {
      id: activeWorkspace.id,
      name: activeWorkspace.name,
      rootPath: activeWorkspace.rootPath,
      status: activeWorkspace.status,
      canvasCount: workspaceCanvases.length,
    } : null),
    [activeWorkspace, workspaceCanvases.length],
  );
  const sidebarCanvases = useMemo(
    () => (isTransientSession
      ? [{
          canvasId,
          title: 'Untitled Canvas',
          latestRevision: 0,
        }]
      : workspaceCanvases),
    [canvasId, isTransientSession, workspaceCanvases],
  );

  const openWorkspaceInEditor = useCallback(async (workspace: RegisteredWorkspace) => {
    if (workspace.status !== 'ok') {
      setGraphError({
        message: 'Workspace is unavailable.',
        type: 'WORKSPACE_UNAVAILABLE',
      });
      return false;
    }

    const canvases = await hostRpc.listWorkspaceCanvases(workspace.rootPath);
    const firstCanvasId = canvases.canvases.find(
      (canvas): canvas is { canvasId: string } =>
        typeof canvas.canvasId === 'string' && canvas.canvasId.length > 0,
    )?.canvasId;

    if (firstCanvasId) {
      navigateToWorkspaceCanvas(firstCanvasId);
      return true;
    }

    const created = await hostRpc.createWorkspaceCanvas({ rootPath: workspace.rootPath });
    navigateToWorkspaceCanvas(created.canvasId);
    return true;
  }, [hostRpc, setGraphError]);



  const resetWorkspaceShellState = useCallback((workspaceId: string | null, rootPath: string | null) => {
    setGraph({
      nodes: [],
      edges: [],
      sourceVersion: null,
      canvasVersions: {},
      canvasRevisionsById: {},
      assetBasePath: null,
    });
    setSelectedNodes([]);
    clearTextEditSession();
    clearPendingTextEditAction();
    closeSearch({ clearQuery: true, clearHighlights: true });
    setGraphError(null);
    setWorkspaceSession({
      workspaceId,
      rootPath,
    });
    useGraphStore.setState({
      sourceVersion: null,
      canvasVersions: {},
      canvasRevisionsById: {},
      lastActiveCanvasId: null,
      assetBasePath: null,
    });
  }, [
    clearPendingTextEditAction,
    clearTextEditSession,
    closeSearch,
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

  const handleCanvasInvalidated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const loadActiveWorkspaceCanvases = useCallback(async (
    workspace: RegisteredWorkspace,
    options?: {
      restoreInitialCanvas?: boolean;
    },
  ) => {
    try {
      const data = await hostRpc.listWorkspaceCanvases(workspace.rootPath);
      const resolvedHealth = resolveWorkspaceCanvasesHealth(data);
      if (!data.health || typeof data.health.state !== 'string') {
        console.warn('[WorkspaceCanvasesLoad] Compatibility payload without health; falling back to inferred ok state', {
          workspaceId: workspace.id,
          rootPath: workspace.rootPath,
          payload: data,
        });
      }
      const sidebarCanvases = buildSidebarCanvases(workspace.rootPath, data.canvases);
      const resumeTarget = useGraphStore.getState().lastActiveCanvasesByWorkspaceId[workspace.id];
      const initialCanvas = (
        typeof resumeTarget === 'string'
        && sidebarCanvases.some((canvas) => canvas.canvasId === resumeTarget)
      )
        ? resumeTarget
        : sidebarCanvases[0]?.canvasId ?? null;

      setWorkspaceCanvases(workspace.id, sidebarCanvases);
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
        lastActiveCanvasId: initialCanvas,
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
      const message = error instanceof Error
        ? error.message
        : '캔버스 목록을 불러오는 데 실패했습니다.';
      setGraphError({
        message,
        type: 'WORKSPACE_CANVASES_LOAD_FAILED',
        details: error,
      });
    }
  }, [hostRpc, setGraphError, setWorkspaceCanvases, setWorkspacePathStatus, setWorkspaceSession, syncWorkspaceEntry]);

  const handleWorkspaceFilesChange = useCallback(() => {
    if (!activeWorkspace) {
      return;
    }

    void loadActiveWorkspaceCanvases(activeWorkspace);
  }, [activeWorkspace, loadActiveWorkspaceCanvases]);

  const {
    dispatchRuntimeMutation,
    updateNode,
    moveNode,
    createNode,
    createCanvasNode,
    insertObjectBodyBlock,
    deleteNode,
    reparentNode,
    getRuntimeProjections,
    undoLastEdit,
    redoLastEdit,
  } = useCanvasRuntime(
    isTransientSession ? null : currentCanvasId,
    activeWorkspace?.id ?? null,
    activeWorkspace?.rootPath ?? workspaceRootPath,
    handleCanvasInvalidated,
    handleWorkspaceFilesChange,
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
    if (!activeWorkspace || !currentCanvasId) {
      return;
    }

    void rememberLastActiveCanvasForWorkspace(activeWorkspace.id, currentCanvasId);
  }, [activeWorkspace, currentCanvasId, rememberLastActiveCanvasForWorkspace]);

  useEffect(() => {
    setCurrentCanvasId(activeWorkspaceCanvas?.canvasId ?? canvasId ?? null);
  }, [activeWorkspaceCanvas?.canvasId, canvasId, setCurrentCanvasId]);

  useEffect(() => {
    if (!activeWorkspace || !currentCanvasId || isTransientSession) {
      return;
    }

    let cancelled = false;

    const persistCanvasId = async () => {
      try {
        const preference = await hostRpc.getAppStatePreference(
          LAST_ACTIVE_CANVAS_ID_SESSION_PREFERENCE_KEY,
        );
        if (cancelled) {
          return;
        }
        await hostRpc.setAppStatePreference({
          key: LAST_ACTIVE_CANVAS_ID_SESSION_PREFERENCE_KEY,
          valueJson: {
            ...readCanvasIdMap(preference?.valueJson),
            [activeWorkspace.id]: currentCanvasId,
          },
        });
      } catch {
        // Best-effort only.
      }
    };

    void persistCanvasId();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspace, currentCanvasId, hostRpc, isTransientSession]);

  const openTabByPath = useCallback(
    (_canvasId: string) => {
      setIsQuickOpenOpen(false);
      return true;
    },
    [],
  );

  const handleCreateCanvas = useCallback(async () => {
    if (isTransientSession) {
      return false;
    }
    if (!activeWorkspace) {
      return false;
    }

    try {
      const createdCanvas = await hostRpc.createWorkspaceCanvas({
        rootPath: activeWorkspace.rootPath,
      });
      registerWorkspaceCanvas(activeWorkspace.id, {
        canvasId: createdCanvas.canvasId,
        workspaceId: createdCanvas.workspaceId,
        latestRevision: createdCanvas.latestRevision,
        title: '',
      });

      const opened = openTabByPath(createdCanvas.canvasId);
      if (opened) {
        setGraph(resolveCreatedCanvasBootstrapGraph({
          canvasId: createdCanvas.canvasId,
          sourceVersion: createdCanvas.sourceVersion,
          latestRevision: createdCanvas.latestRevision,
        }));
        setGraphError(null);
      }

      setCurrentCanvasId(createdCanvas.canvasId);
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
  }, [activeWorkspace, hostRpc, isTransientSession, loadActiveWorkspaceCanvases, openTabByPath, registerWorkspaceCanvas, setCurrentCanvasId, setGraph, setGraphError]);

  const handleAddWorkspace = useCallback(async () => {
    const rootPath = await pickWorkspaceRootPath({
      title: 'Select workspace folder',
    });
    if (!rootPath) {
      return;
    }

    try {
      const probe = await hostRpc.ensureWorkspace(rootPath);
      const workspace = await upsertWorkspaceFromProbe(probe, { activate: true });
      await openWorkspaceInEditor(workspace);
    } catch (error) {
      setGraphError({
        message: error instanceof Error ? error.message : 'Failed to add workspace.',
        type: 'WORKSPACE_ADD_FAILED',
        details: error,
      });
    }
  }, [hostRpc, openWorkspaceInEditor, setGraphError, upsertWorkspaceFromProbe]);

  const handleSaveWorkspace = useCallback(async () => {
    if (!isTransientSession) {
      return false;
    }

    const rootPath = await pickWorkspaceSaveLocation({
      title: 'Choose workspace folder',
    });
    if (!rootPath) {
      return false;
    }

    setIsSavingTransientWorkspace(true);
    try {
      const existing = await hostRpc.listWorkspaceCanvases(rootPath).catch(() => null);
      if (existing && existing.canvasCount > 0) {
        setGraphError({
          message: 'Save Workspace target must be empty.',
          type: 'TRANSIENT_WORKSPACE_SAVE_REJECTED',
        });
        return false;
      }

      const probe = await hostRpc.ensureWorkspace(rootPath);
      const workspace = await upsertWorkspaceFromProbe(probe, { activate: true });
      const createdCanvas = await hostRpc.createWorkspaceCanvas({
        rootPath: probe.rootPath,
        canvasId,
      });

      await loadActiveWorkspaceCanvases(workspace);
      setCurrentCanvasId(createdCanvas.canvasId);
      navigateToWorkspaceCanvas(createdCanvas.canvasId);
      return true;
    } catch (error) {
      setGraphError({
        message: error instanceof Error ? error.message : 'Failed to save workspace.',
        type: 'TRANSIENT_WORKSPACE_SAVE_FAILED',
        details: error,
      });
      return false;
    } finally {
      setIsSavingTransientWorkspace(false);
    }
  }, [canvasId, hostRpc, isTransientSession, loadActiveWorkspaceCanvases, setCurrentCanvasId, setGraphError, upsertWorkspaceFromProbe]);

  const handleSelectWorkspace = useCallback(async (workspaceId: string) => {
    const workspace = registeredWorkspaces.find((entry) => entry.id === workspaceId);
    if (!workspace) {
      setGraphError({
        message: 'Workspace not found.',
        type: 'WORKSPACE_NOT_FOUND',
      });
      return;
    }

    try {
      await openWorkspaceInEditor(workspace);
    } catch (error) {
      setGraphError({
        message: error instanceof Error ? error.message : 'Failed to open workspace.',
        type: 'WORKSPACE_OPEN_FAILED',
        details: error,
      });
    }
  }, [openWorkspaceInEditor, registeredWorkspaces, setGraphError]);

  const handleOpenCanvas = useCallback((nextCanvasId: string) => {
    navigateToWorkspaceCanvas(nextCanvasId);
    return true;
  }, []);

  const handleCopyWorkspacePath = useCallback(async () => {
    if (!activeWorkspace) {
      return;
    }

    try {
      await copyTextWithDesktopBridge(activeWorkspace.rootPath);
    } catch (error) {
      setGraphError({
        message: error instanceof Error ? error.message : 'Failed to copy workspace path.',
        type: 'WORKSPACE_COPY_PATH_FAILED',
        details: error,
      });
    }
  }, [activeWorkspace, setGraphError]);

  const handleRevealWorkspace = useCallback(async () => {
    if (!activeWorkspace) {
      return;
    }

    try {
      await hostRuntime.capabilities.workspace.revealInOs(activeWorkspace.rootPath);
    } catch (error) {
      setGraphError({
        message: error instanceof Error ? error.message : 'Failed to reveal workspace.',
        type: 'WORKSPACE_REVEAL_FAILED',
        details: error,
      });
    }
  }, [activeWorkspace, hostRuntime.capabilities.workspace, setGraphError]);

  const handleReconnectWorkspace = useCallback(async () => {
    if (!activeWorkspace) {
      return;
    }

    try {
      const probe = await hostRpc.probeWorkspace(activeWorkspace.rootPath);
      const workspace = await syncWorkspaceEntry(probe, { existingId: activeWorkspace.id, activate: true });
      await loadActiveWorkspaceCanvases(workspace);
    } catch (error) {
      setGraphError({
        message: error instanceof Error ? error.message : 'Failed to reconnect workspace.',
        type: 'WORKSPACE_RECONNECT_FAILED',
        details: error,
      });
    }
  }, [activeWorkspace, hostRpc, loadActiveWorkspaceCanvases, setGraphError, syncWorkspaceEntry]);

  const handleRemoveWorkspace = useCallback(async () => {
    if (!activeWorkspace) {
      return;
    }

    await removeRegisteredWorkspace(activeWorkspace.id);
    navigateToDashboard();
  }, [activeWorkspace, removeRegisteredWorkspace]);

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

  const commitHistoryEffect = useCallback((effect: ActionRoutingHistoryEffect, result: RpcMutationResult) => {
    if (result.runtimeResult?.ok && (!result.runtimeResult.meta?.undoable || result.runtimeResult.data.dryRun)) {
      return;
    }

    const usesRuntimeHistory = Boolean(
      result.runtimeResult?.ok
      && result.runtimeResult.meta?.undoable
      && !result.runtimeResult.data.dryRun,
    );

    if (usesRuntimeHistory) {
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
        handleCanvasInvalidated();
      }
      return;
    }

    const nextVersion = result.newVersion
      ?? (effect.canvasId ? useGraphStore.getState().canvasVersions[effect.canvasId] : null)
      ?? effect.baseVersion;
    const commandId = result.commandId ?? crypto.randomUUID();

    pushEditCompletionEvent({
      eventId: crypto.randomUUID(),
      type: effect.eventType,
      nodeId: effect.nodeId,
      canvasId: effect.canvasId ?? currentCanvasId ?? '',
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
      handleCanvasInvalidated();
    }
  }, [currentCanvasId, handleCanvasInvalidated, pushEditCompletionEvent]);

  const executeMutationDescriptor = useCallback(async (descriptor: MutationDispatchDescriptor) => {
    if (descriptor.kind === 'runtime-mutation') {
      return dispatchRuntimeMutation({
        canvasId: descriptor.payload.canvasId ?? currentCanvasId,
        ...(descriptor.payload.dryRun !== undefined ? { dryRun: descriptor.payload.dryRun } : {}),
        commands: descriptor.payload.commands,
      });
    }

    const targetCanvasId = descriptor.payload.canvasId ?? currentCanvasId;
    if (descriptor.actionId === 'node.update') {
      return updateNode(
        descriptor.payload.nodeId,
        descriptor.payload.props,
        descriptor.payload.commandType
          ? { commandType: descriptor.payload.commandType }
          : undefined,
        targetCanvasId,
      );
    }
    if (descriptor.actionId === 'canvas.node.create') {
      return createCanvasNode(descriptor.payload.node, targetCanvasId);
    }
    if (descriptor.actionId === 'node.create') {
      return createNode(descriptor.payload.node, targetCanvasId);
    }
    if (descriptor.actionId === 'node.delete') {
      return deleteNode(descriptor.payload.nodeId, targetCanvasId);
    }
    if (descriptor.actionId === 'node.reparent') {
      return reparentNode(
        descriptor.payload.nodeId,
        descriptor.payload.newParentId,
        targetCanvasId,
      );
    }
    if (descriptor.actionId === 'node.group-membership.update') {
      return updateNode(
        descriptor.payload.nodeId,
        { groupId: descriptor.payload.groupId },
        { commandType: 'node.group.update' },
        targetCanvasId,
      );
    }
    if (descriptor.actionId === 'node.z-order.update') {
      return updateNode(
        descriptor.payload.nodeId,
        { zIndex: descriptor.payload.zIndex },
        { commandType: 'node.z-order.update' },
        targetCanvasId,
      );
    }
    throw new RpcClientError(RPC_ERRORS.INVALID_PARAMS.code, RPC_ERRORS.INVALID_PARAMS.message, {
      stage: 'WorkspaceClient.executeMutationDescriptor',
    });
  }, [createCanvasNode, createNode, currentCanvasId, deleteNode, dispatchRuntimeMutation, reparentNode, updateNode]);

  const { dispatchActionRoutingIntentOrThrow } = useMemo(() => createCanvasActionDispatchBinding({
    getRuntime: () => {
      const runtime = useGraphStore.getState();
      return {
        nodes: runtime.nodes,
        edges: runtime.edges,
        currentCanvasId: runtime.currentCanvasId,
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

    const editContext = resolveNodeEditContext(targetNode);
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
          currentCanvasId,
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
    scopeId?: string;
    frameScope?: string;
    targetNodeId?: string;
  }) => {
    if (isTransientSession) {
      setGraphError({
        message: 'Save Workspace to start editing.',
        type: 'TRANSIENT_EDIT_BLOCKED',
      });
      return;
    }
    const runtime = useGraphStore.getState();
    const intent = input.placement.mode === 'mindmap-child'
      ? 'create-mindmap-child'
      : input.placement.mode === 'mindmap-sibling'
        ? 'create-mindmap-sibling'
        : 'create-node';
    const resolvedContext = input.placement.mode === 'canvas-absolute' || input.placement.mode === 'mindmap-root'
      ? createPaneActionRoutingContext({
        currentCanvasId,
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
  }, [currentCanvasId, dispatchActionRoutingIntentOrThrow, isTransientSession, setGraphError]);

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

    const targetContext = resolveNodeEditContext(targetNode);
    const parentContext = resolveNodeEditContext(parentNode);
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
      ? resolveNodeEditContext(currentParentNode)
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
        currentCanvasId,
      );
      const usesRuntimeHistory = Boolean(
        result.runtimeResult?.ok
        && result.runtimeResult.meta?.undoable
        && !result.runtimeResult.data.dryRun,
      );
      if (!usesRuntimeHistory) {
        const nextVersion = result.newVersion
          ?? (currentCanvasId ? useGraphStore.getState().canvasVersions[currentCanvasId] : null)
          ?? baseVersion;
        const commandId = result.commandId ?? crypto.randomUUID();

        pushEditCompletionEvent({
          eventId: crypto.randomUUID(),
          type: 'NODE_REPARENTED',
          nodeId: command.target.sourceId,
          canvasId: currentCanvasId ?? '',
          commandId,
          baseVersion,
          nextVersion,
          before: command.payload.previous,
          after: command.payload.next,
          committedAt: Date.now(),
        });
      }
      handleCanvasInvalidated();
    } catch (error) {
      const message = mapEditRpcErrorToToast(error) ?? 'MindMap 구조 변경에 실패했습니다.';
      setGraphError({
        message,
        type: 'EDIT_REJECTED',
        details: error,
      });
      throw error;
    }
  }, [handleCanvasInvalidated, pushEditCompletionEvent, reparentNode, setGraphError]);

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
    const editContext = resolveNodeEditContext(targetNode);
    const editTarget = editContext.target;
    const baseVersion = currentCanvasId
      ? runtime.canvasVersions[currentCanvasId] ?? null
      : null;
    if (!baseVersion) {
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
          { commandType: relativeCommand.type },
          currentCanvasId,
        );
        const usesRuntimeHistory = Boolean(
          result.runtimeResult?.ok
          && result.runtimeResult.meta?.undoable
          && !result.runtimeResult.data.dryRun,
        );
        if (!usesRuntimeHistory) {
          const nextVersion = result.newVersion
            ?? (currentCanvasId ? useGraphStore.getState().canvasVersions[currentCanvasId] : null)
            ?? baseVersion;
          const commandId = result.commandId ?? crypto.randomUUID();
          pushEditCompletionEvent({
            eventId: crypto.randomUUID(),
            type: 'RELATIVE_MOVE_COMMITTED',
            nodeId: editTarget.nodeId,
            canvasId: currentCanvasId ?? '',
            commandId,
            baseVersion,
            nextVersion,
            before: relativeCommand.payload.previous,
            after: relativeCommand.payload.next,
            committedAt: Date.now(),
          });
        }
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
        renderedId: targetNode.id,
        editMeta: editContext.editMeta,
      },
      previous: { x: payload.originX, y: payload.originY },
      next: { x: payload.x, y: payload.y },
    });
    const result = await moveNode(editTarget.nodeId, payload.x, payload.y, currentCanvasId);
    const usesRuntimeHistory = Boolean(
      result.runtimeResult?.ok
      && result.runtimeResult.meta?.undoable
      && !result.runtimeResult.data.dryRun,
    );
    if (!usesRuntimeHistory) {
      const nextVersion = result.newVersion
        ?? (currentCanvasId ? useGraphStore.getState().canvasVersions[currentCanvasId] : null)
        ?? baseVersion;
      const commandId = result.commandId ?? crypto.randomUUID();
      pushEditCompletionEvent({
        eventId: crypto.randomUUID(),
        type: 'ABSOLUTE_MOVE_COMMITTED',
        nodeId: editTarget.nodeId,
        canvasId: currentCanvasId ?? '',
        commandId,
        baseVersion,
        nextVersion,
        before: absoluteCommand.payload.previous,
        after: absoluteCommand.payload.next,
        committedAt: Date.now(),
      });
    }
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
    navigateToDashboard();
  }, []);

  const handleMenu = useCallback(() => {
    navigateToDashboard();
  }, []);

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
      const editTarget = resolveNodeEditTarget(node);
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
          }, currentCanvasId);
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
    insertObjectBodyBlock,
    pendingTextEditAction,
    selectedNodeIds,
    setGraphError,
    textEditDraft,
  ]);

  useEffect(() => {
    async function renderCanvas() {
      if (!currentCanvasId) return;

      if (isTransientSession) {
        setGraph({
          nodes: [],
          edges: [],
          sourceVersion: null,
          canvasVersions: {
            [currentCanvasId]: 'draft:transient-canvas',
          },
          canvasRevisionsById: {
            [currentCanvasId]: 0,
          },
          assetBasePath: null,
        });
        setGraphError(null);
        return;
      }

      try {
        setGraphError(null); // Clear previous errors

        const rootPath = activeWorkspace?.rootPath ?? workspaceRootPath;
        const [response, runtimeProjectionResult] = await Promise.all([
          fetch('/api/render', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              canvasId: currentCanvasId,
              ...(rootPath ? { rootPath } : {}),
            }),
          }),
          getRuntimeProjections().catch(() => null),
        ]);

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

        const parsed = parseRenderGraph(
          runtimeProjectionResult
            ? {
                ...data,
                hierarchyProjection: runtimeProjectionResult.hierarchyProjection,
                renderProjection: runtimeProjectionResult.renderProjection,
                editingProjection: runtimeProjectionResult.editingProjection,
              }
            : data,
        );
        if (parsed) {
          setCurrentCanvasId(typeof data.canvasId === 'string'
            ? data.canvasId
            : currentCanvasId);
          const resolvedCanvasId = typeof data.canvasId === 'string'
            ? data.canvasId
            : currentCanvasId;
          const resolvedCanvasRevision = runtimeProjectionResult?.renderProjection.canvasRevision
            ?? (typeof data.canvasRevision === 'number' ? data.canvasRevision : undefined);
          setGraph({
            ...parsed,
            canvasVersions: (
              resolvedCanvasId && typeof data.sourceVersion === 'string'
                ? {
                    ...useGraphStore.getState().canvasVersions,
                    [resolvedCanvasId]: data.sourceVersion,
                  }
                : undefined
            ),
            canvasRevisionsById: (
              resolvedCanvasId && typeof resolvedCanvasRevision === 'number'
                ? {
                    ...useGraphStore.getState().canvasRevisionsById,
                    [resolvedCanvasId]: resolvedCanvasRevision,
                  }
                : undefined
            ),
            assetBasePath: typeof data.assetBasePath === 'string' ? data.assetBasePath : null,
          });
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
  }, [activeWorkspace?.rootPath, currentCanvasId, getRuntimeProjections, isTransientSession, refreshKey, setCurrentCanvasId, setGraph, setSelectedNodes, workspaceRootPath]); // refreshKey triggers re-render on canvas changes

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        activeWorkspace={sidebarActiveWorkspace}
        workspaces={sidebarWorkspaces}
        canvases={sidebarCanvases}
        isTransientWorkspace={isTransientSession}
        isLoading={isSavingTransientWorkspace}
        onSelectWorkspace={handleSelectWorkspace}
        onSaveWorkspace={handleSaveWorkspace}
        onCreateWorkspace={handleAddWorkspace}
        onAddWorkspace={handleAddWorkspace}
        onCreateCanvas={handleCreateCanvas}
        onOpenCanvas={handleOpenCanvas}
        onCopyWorkspacePath={handleCopyWorkspacePath}
        onRevealWorkspace={handleRevealWorkspace}
        onReconnectWorkspace={handleReconnectWorkspace}
        onRemoveWorkspace={handleRemoveWorkspace}
      />
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
            canvases={sidebarCanvases.map((canvas) => ({
              canvasId: canvas.canvasId,
              title: canvas.title,
            }))}
            commands={quickOpenCommands}
            onOpenCanvas={handleOpenCanvas}
            onRunCommand={runQuickOpenCommand}
            onClose={() => setIsQuickOpenOpen(false)}
          />
        )}

        {/* Workspace-level overlays stay outside the canvas overlay host boundary. */}

      </div>
    </div>
  );
}
