'use client';


import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { RpcClientError, useFileSync } from '@/hooks/useFileSync';
import { GraphCanvas } from '@/components/GraphCanvas';
import type { GraphCanvasSelectionActionIntentInput } from '@/components/GraphCanvas';
import {
  Sidebar,
  type SidebarDocumentEntry,
  type SidebarWorkspaceEntry,
} from '@/components/ui/Sidebar';
import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';

import { type QuickOpenCommand } from '@/components/ui/QuickOpenDialog';
import { ErrorOverlay } from '@/components/ui/ErrorOverlay';
import {
  LazyChatPanel,
  LazyQuickOpenDialog,
  LazySearchOverlay,
  LazyStickerInspector,
} from '@/components/editor/LazyPanels';
import { useChatUiStore } from '@/store/chatUi';
import { useGraphStore } from '@/store/graph';
import {
  buildAbsoluteMoveCommand,
  buildReparentCommand,
  buildRelativeMoveCommand,
  toUpdateNodeProps,
  type CreatePayload,
} from '@/features/editing/commands';
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
  buildSidebarDocuments,
  resolveWorkspaceDocumentAbsolutePath,
  type RegisteredWorkspace,
  type WorkspaceProbeResponse,
  updateWorkspaceFromProbe,
} from '@/components/editor/workspaceRegistry';
import {
  copyTextWithDesktopBridge,
  pickWorkspaceRootPath,
} from '@/components/editor/desktopBridge';
import { getHostRuntime } from '@/features/host/renderer/createHostRuntime';



type PendingCreateEdit = {
  renderedId: string;
  mode: 'text' | 'markdown-wysiwyg';
};




function getNodeLabel(node: { data?: unknown }): string {
  const data = (node.data || {}) as Record<string, unknown>;
  return typeof data.label === 'string' ? data.label : '';
}





export function CanvasEditorPage({ documentPath }: { documentPath: string }) {
  const hostRpc = useMemo(() => getHostRuntime().rpc, []);

  useEffect(() => {
    useGraphStore.getState().setCurrentFile(documentPath);
  }, [documentPath]);

  // Workspace-document-shell migration anchor:
  // workspace registry/session state now lives in the graph store instead of local component state.
  const {
    setFiles,
    setGraph,
    currentFile,
    workspaceRootPath,
    registeredWorkspaces,
    activeWorkspaceId,
    lastActiveDocumentsByWorkspaceId,
    workspaceDocumentsByWorkspaceId,
    sourceVersions,
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
    draftDocuments,
    setFileTree,
    setWorkspaceSession,
    hydrateWorkspaceRegistry,
    replaceRegisteredWorkspaces,
    upsertWorkspaceFromProbe,
    reconnectWorkspaceFromProbe,
    setActiveWorkspaceId: setGraphActiveWorkspaceId,
    removeRegisteredWorkspace,
    setWorkspaceDocuments,
    registerWorkspaceDocument,
    setWorkspacePathStatus,
    rememberLastActiveDocumentForWorkspace,
    hydrateGlobalFontFamilyPreference,
  } = useGraphStore();
  const isChatOpen = useChatUiStore((state) => state.isOpen);
  const toggleChat = useChatUiStore((state) => state.toggleOpen);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false);

  const pendingSelectionNodeIdRef = useRef<string | null>(null);
  const pendingCreateEditRef = useRef<PendingCreateEdit | null>(null);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);

  const activeWorkspace = useMemo(
    () => registeredWorkspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, registeredWorkspaces],
  );
  const workspaceDocuments = useMemo<SidebarDocumentEntry[]>(
    () => (activeWorkspaceId ? workspaceDocumentsByWorkspaceId[activeWorkspaceId] ?? [] : []),
    [activeWorkspaceId, workspaceDocumentsByWorkspaceId],
  );



  const resetWorkspaceShellState = useCallback((workspaceId: string | null, rootPath: string | null) => {
    setGraph({
      nodes: [],
      edges: [],
      sourceVersion: null,
      sourceVersions: {},
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
      sourceVersion: null,
      sourceVersions: {},
      lastActiveDocumentPath: null,
      draftDocuments: [],
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
    setIsWorkspaceLoading(true);
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
    } finally {
      setIsWorkspaceLoading(false);
    }
  }, [hostRpc, hydrateWorkspaceRegistry, replaceRegisteredWorkspaces, setGraphError, upsertWorkspaceFromProbe]);

  // File sync - triggers re-render when file changes externally
  const handleFileChange = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const loadActiveWorkspaceDocuments = useCallback(async (
    workspace: RegisteredWorkspace,
    options?: {
      restoreInitialDocument?: boolean;
    },
  ) => {
    try {
      const [data, legacyTree] = await Promise.all([
        hostRpc.listWorkspaceDocuments(workspace.rootPath),
        hostRpc.getFileTree(workspace.rootPath).catch(() => ({ tree: null })),
      ]);
      const sidebarDocuments = buildSidebarDocuments(workspace.rootPath, data.documents);
      const absoluteFiles = sidebarDocuments.map((document) => document.absolutePath);
      const resumeTarget = lastActiveDocumentsByWorkspaceId[workspace.id];
      const initialDocument = (
        typeof resumeTarget === 'string'
        && absoluteFiles.includes(resumeTarget)
      )
        ? resumeTarget
        : absoluteFiles[0] ?? null;

      setWorkspaceDocuments(workspace.id, sidebarDocuments);
      setFiles(absoluteFiles);
      setFileTree(legacyTree.tree);
      await syncWorkspaceEntry(data, { existingId: workspace.id });
      setWorkspacePathStatus({
        workspaceId: workspace.id,
        rootPath: data.rootPath,
        status: data.health.state,
        failureReason: data.health.message ?? null,
      });
      setWorkspaceSession({
        workspaceId: workspace.id,
        rootPath: data.rootPath,
      });
      useGraphStore.setState({
        lastActiveDocumentPath: initialDocument,
      });

      if (options?.restoreInitialDocument && initialDocument) {
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
      setWorkspaceDocuments(workspace.id, []);
      setFiles([]);
      setFileTree(null);
      const message = error instanceof Error
        ? error.message
        : '문서 목록을 불러오는 데 실패했습니다.';
      setGraphError({
        message,
        type: 'WORKSPACE_DOCUMENTS_LOAD_FAILED',
        details: error,
      });
    }
  }, [hostRpc, lastActiveDocumentsByWorkspaceId, setFileTree, setFiles, setGraphError, setWorkspaceDocuments, setWorkspacePathStatus, setWorkspaceSession, syncWorkspaceEntry]);

  const dependencyFiles = useMemo(
    () => Object.keys(sourceVersions).filter((filePath) => filePath !== currentFile),
    [currentFile, sourceVersions],
  );

  // File sync with reload callback for file list changes
  const {
    updateNode,
    moveNode,
    createNode,
    deleteNode,
    reparentNode,
    undoLastEdit,
    redoLastEdit,
  } = useFileSync(
    currentFile,
    activeWorkspace?.rootPath ?? workspaceRootPath,
    handleFileChange,
    activeWorkspace ? () => {
      void loadActiveWorkspaceDocuments(activeWorkspace);
    } : undefined,
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
    void loadActiveWorkspaceDocuments(activeWorkspace, { restoreInitialDocument: true });
  }, [activeWorkspace?.id, activeWorkspace?.rootPath, activeWorkspace?.status, loadActiveWorkspaceDocuments, resetWorkspaceShellState]);

  useEffect(() => {
    if (!activeWorkspace || !currentFile) {
      return;
    }

    void rememberLastActiveDocumentForWorkspace(activeWorkspace.id, currentFile);
  }, [activeWorkspace, currentFile, rememberLastActiveDocumentForWorkspace]);



  const openTabByPath = useCallback(
    (_pageId: string) => {
      setIsQuickOpenOpen(false);
      return true;
    },
    [],
  );

  const handleSelectWorkspace = useCallback((workspaceId: string) => {
    void setGraphActiveWorkspaceId(workspaceId);
  }, [setGraphActiveWorkspaceId]);

  const handleCreateWorkspace = useCallback(async () => {
    const rootPath = await pickWorkspaceRootPath({
      title: '새 workspace 절대 경로',
      defaultPath: activeWorkspace?.rootPath ?? '',
    });
    if (!rootPath) {
      return false;
    }

    try {
      const probe = await hostRpc.ensureWorkspace(rootPath);
      await syncWorkspaceEntry(probe, { activate: true });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '새 workspace를 만드는 데 실패했습니다.';
      setGraphError({
        message,
        type: 'WORKSPACE_CREATE_FAILED',
        details: error,
      });
      return false;
    }
  }, [activeWorkspace?.rootPath, hostRpc, setGraphError, syncWorkspaceEntry]);

  const handleAddExistingWorkspace = useCallback(async () => {
    const rootPath = await pickWorkspaceRootPath({
      title: '기존 workspace 절대 경로',
      defaultPath: activeWorkspace?.rootPath ?? '',
    });
    if (!rootPath) {
      return false;
    }

    try {
      const probe = await hostRpc.probeWorkspace(rootPath);
      await syncWorkspaceEntry(probe, { activate: true });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '기존 workspace를 등록하는 데 실패했습니다.';
      setGraphError({
        message,
        type: 'WORKSPACE_ADD_FAILED',
        details: error,
      });
      return false;
    }
  }, [activeWorkspace?.rootPath, hostRpc, setGraphError, syncWorkspaceEntry]);

  const handleReconnectWorkspace = useCallback(async () => {
    if (!activeWorkspace) {
      return false;
    }

    const nextRootPath = await pickWorkspaceRootPath({
      title: '새 workspace 절대 경로',
      defaultPath: activeWorkspace.rootPath,
    });
    if (!nextRootPath) {
      return false;
    }

    try {
      const probe = await hostRpc.probeWorkspace(nextRootPath);
      await reconnectWorkspaceFromProbe(activeWorkspace.id, probe);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'workspace를 다시 연결하는 데 실패했습니다.';
      setGraphError({
        message,
        type: 'WORKSPACE_RECONNECT_FAILED',
        details: error,
      });
      return false;
    }
  }, [activeWorkspace, hostRpc, reconnectWorkspaceFromProbe, setGraphError]);

  const handleRemoveWorkspace = useCallback(async () => {
    if (!activeWorkspace) {
      return false;
    }

    const shouldRemove = window.confirm(`"${activeWorkspace.name}" workspace를 제거할까요?`);
    if (!shouldRemove) {
      return false;
    }

    await removeRegisteredWorkspace(activeWorkspace.id);
    return true;
  }, [activeWorkspace, removeRegisteredWorkspace]);

  const handleRevealWorkspace = useCallback(async () => {
    if (!activeWorkspace) {
      return false;
    }

    try {
      await hostRpc.launchWorkspaceFileBrowser({
        rootPath: activeWorkspace.rootPath,
        action: 'open',
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'workspace 경로를 여는 데 실패했습니다.';
      setGraphError({
        message,
        type: 'WORKSPACE_REVEAL_FAILED',
        details: error,
      });
      return false;
    }
  }, [activeWorkspace, hostRpc, setGraphError]);

  const handleCopyWorkspacePath = useCallback(async () => {
    if (!activeWorkspace) {
      return false;
    }

    try {
      await copyTextWithDesktopBridge(activeWorkspace.rootPath);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'workspace 경로를 복사하는 데 실패했습니다.';
      setGraphError({
        message,
        type: 'WORKSPACE_COPY_PATH_FAILED',
        details: error,
      });
      return false;
    }
  }, [activeWorkspace, setGraphError]);

  const refreshActiveWorkspace = useCallback(async () => {
    if (!activeWorkspace) {
      return;
    }

    if (activeWorkspace.status !== 'ok') {
      const probe = await hostRpc.probeWorkspace(activeWorkspace.rootPath);
      await reconnectWorkspaceFromProbe(activeWorkspace.id, probe);
      return;
    }

    await loadActiveWorkspaceDocuments(activeWorkspace);
  }, [activeWorkspace, hostRpc, loadActiveWorkspaceDocuments, reconnectWorkspaceFromProbe]);

  const handleCreateDocument = useCallback(async () => {
    if (!activeWorkspace) {
      return false;
    }

    try {
      const createdDocument = await hostRpc.createWorkspaceDocument({
        rootPath: activeWorkspace.rootPath,
      });
      const absoluteFilePath = resolveWorkspaceDocumentAbsolutePath(
        activeWorkspace.rootPath,
        createdDocument.filePath,
      );
      useGraphStore.getState().setSourceVersionForFile(
        absoluteFilePath,
        createdDocument.sourceVersion,
      );
      registerWorkspaceDocument(activeWorkspace.id, {
        absolutePath: absoluteFilePath,
        relativePath: createdDocument.filePath,
        title: createdDocument.filePath.split('/').filter(Boolean).at(-1) ?? createdDocument.filePath,
      });

      const opened = openTabByPath(absoluteFilePath);
      if (opened) {
        const nextSourceVersions = {
          ...useGraphStore.getState().sourceVersions,
          [absoluteFilePath]: createdDocument.sourceVersion,
        };
        setGraph({
          nodes: [],
          edges: [],
          sourceVersion: createdDocument.sourceVersion,
          sourceVersions: nextSourceVersions,
        });
        setGraphError(null);
      }

      await loadActiveWorkspaceDocuments(activeWorkspace);
      return opened;
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : '새 문서를 만드는 데 실패했습니다.';
      setGraphError({
        message,
        type: 'DOCUMENT_CREATE_FAILED',
        details: error,
      });
      return false;
    }
  }, [activeWorkspace, hostRpc, loadActiveWorkspaceDocuments, openTabByPath, registerWorkspaceDocument, setGraph, setGraphError]);

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
      ?? useGraphStore.getState().sourceVersions[effect.filePath]
      ?? effect.baseVersion;
    const commandId = result.commandId ?? crypto.randomUUID();

    pushEditCompletionEvent({
      eventId: crypto.randomUUID(),
      type: effect.eventType,
      nodeId: effect.nodeId,
      filePath: effect.filePath,
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
  }, [handleFileChange, pushEditCompletionEvent]);

  const executeMutationDescriptor = useCallback(async (descriptor: MutationDispatchDescriptor) => {
    if (descriptor.actionId === 'node.update') {
      return updateNode(
        descriptor.payload.nodeId,
        descriptor.payload.props,
        descriptor.payload.filePath,
        descriptor.payload.commandType
          ? { commandType: descriptor.payload.commandType }
          : undefined,
      );
    }
    if (descriptor.actionId === 'node.create') {
      return createNode(descriptor.payload.node, descriptor.payload.filePath);
    }
    if (descriptor.actionId === 'node.delete') {
      return deleteNode(descriptor.payload.nodeId, descriptor.payload.filePath);
    }
    if (descriptor.actionId === 'node.reparent') {
      return reparentNode(
        descriptor.payload.nodeId,
        descriptor.payload.newParentId,
        descriptor.payload.filePath,
      );
    }
    if (descriptor.actionId === 'node.group-membership.update') {
      return updateNode(
        descriptor.payload.nodeId,
        { groupId: descriptor.payload.groupId },
        descriptor.payload.filePath,
        { commandType: 'node.group.update' },
      );
    }
    if (descriptor.actionId === 'node.z-order.update') {
      return updateNode(
        descriptor.payload.nodeId,
        { zIndex: descriptor.payload.zIndex },
        descriptor.payload.filePath,
        { commandType: 'node.z-order.update' },
      );
    }
    throw new RpcClientError(RPC_ERRORS.INVALID_PARAMS.code, RPC_ERRORS.INVALID_PARAMS.message, {
      stage: 'WorkspaceClient.executeMutationDescriptor',
    });
  }, [createNode, deleteNode, reparentNode, updateNode]);

  const { dispatchActionRoutingIntentOrThrow } = useMemo(() => createCanvasActionDispatchBinding({
    getRuntime: () => {
      const runtime = useGraphStore.getState();
      return {
        nodes: runtime.nodes,
        edges: runtime.edges,
        currentFile: runtime.currentFile,
        sourceVersions: runtime.sourceVersions,
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
          runtime.currentFile,
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
          runtime.currentFile,
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

    const editContext = resolveNodeEditContext(targetNode, runtime.currentFile);
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
          runtime.currentFile,
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
          runtime.currentFile,
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
          runtime.currentFile,
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
          runtime.currentFile,
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
          runtime.currentFile,
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
          runtime.currentFile,
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
    const resolvedContext = input.placement.mode === 'canvas-absolute'
      ? createPaneActionRoutingContext({
        currentFile: runtime.currentFile,
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
          runtime.currentFile,
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

    const targetContext = resolveNodeEditContext(targetNode, runtime.currentFile);
    const parentContext = resolveNodeEditContext(parentNode, runtime.currentFile);
    if (!targetContext.target.filePath) {
      throw new Error('SOURCE_VERSION_NOT_READY');
    }
    if (!canRunNodeCommand(targetNode, 'node.reparent')) {
      throw new RpcClientError(42201, 'EDIT_NOT_ALLOWED', {
        nodeId: input.draggedNodeId,
        reason: targetContext.readOnlyReason ?? 'REPARENT_NOT_ALLOWED',
      });
    }

    const baseVersion = runtime.sourceVersions[targetContext.target.filePath] ?? null;
    if (!baseVersion) {
      throw new Error('SOURCE_VERSION_NOT_READY');
    }

    const currentParentEdge = runtime.edges.find((edge) => edge.target === input.draggedNodeId);
    const currentParentRenderedId = currentParentEdge?.source ?? null;
    const currentParentNode = currentParentRenderedId
      ? runtime.nodes.find((node) => node.id === currentParentRenderedId)
      : null;
    const currentParentContext = currentParentNode
      ? resolveNodeEditContext(currentParentNode, runtime.currentFile)
      : null;
    const nextParentId = parentContext.target.nodeId;
    const previousParentId = currentParentContext?.target.nodeId ?? null;
    if (previousParentId === nextParentId) {
      return;
    }

    const command = buildReparentCommand({
      target: {
        sourceId: targetContext.target.nodeId,
        filePath: targetContext.target.filePath,
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
        command.target.filePath,
      );
      const nextVersion = result.newVersion
        ?? useGraphStore.getState().sourceVersions[command.target.filePath]
        ?? baseVersion;
      const commandId = result.commandId ?? crypto.randomUUID();

      pushEditCompletionEvent({
        eventId: crypto.randomUUID(),
        type: 'NODE_REPARENTED',
        nodeId: command.target.sourceId,
        filePath: command.target.filePath,
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
    const editContext = resolveNodeEditContext(targetNode, runtime.currentFile);
    const editTarget = editContext.target;
    const baseVersion = editTarget.filePath
      ? runtime.sourceVersions[editTarget.filePath] ?? null
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
            filePath: targetFile,
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
        );
        const nextVersion = result.newVersion
          ?? useGraphStore.getState().sourceVersions[targetFile]
          ?? baseVersion;
        const commandId = result.commandId ?? crypto.randomUUID();
        pushEditCompletionEvent({
          eventId: crypto.randomUUID(),
          type: 'RELATIVE_MOVE_COMMITTED',
          nodeId: editTarget.nodeId,
          filePath: targetFile,
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
        filePath: targetFile,
        renderedId: targetNode.id,
        editMeta: editContext.editMeta,
      },
      previous: { x: payload.originX, y: payload.originY },
      next: { x: payload.x, y: payload.y },
    });
    const result = await moveNode(editTarget.nodeId, payload.x, payload.y, targetFile);
    const nextVersion = result.newVersion
      ?? useGraphStore.getState().sourceVersions[targetFile]
      ?? baseVersion;
    const commandId = result.commandId ?? crypto.randomUUID();
    pushEditCompletionEvent({
      eventId: crypto.randomUUID(),
      type: 'ABSOLUTE_MOVE_COMMITTED',
      nodeId: editTarget.nodeId,
      filePath: targetFile,
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
      if (commandId === 'new-document') {
        return handleCreateDocument();
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
      handleCreateDocument,
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
        id: 'new-document',
        label: 'New document',
        hint: 'Empty canvas',
        keywords: ['new', 'document', 'canvas', 'empty', '새 문서'],
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


    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [
    isSearchOpen,
    openSearch,
    closeSearch,
    toggleChat,
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
      const editTarget = resolveNodeEditTarget(node, runtime.currentFile);
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
    pendingTextEditAction,
    selectedNodeIds,
    setGraphError,
    textEditDraft,
  ]);

  useEffect(() => {
    async function renderFile() {
      if (!currentFile) return;

      if (draftDocuments.includes(currentFile)) {
        setGraph({
          nodes: [],
          edges: [],
          sourceVersion: null,
          sourceVersions: {
            ...useGraphStore.getState().sourceVersions,
            [currentFile]: 'draft:empty-canvas',
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
            filePath: currentFile,
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
          setGraph(parsed);
          if (pendingSelectionNodeIdRef.current) {
            const createdNodeId = pendingSelectionNodeIdRef.current;
            const createdNode = parsed.nodes.find((node) => node.id === createdNodeId);
            if (createdNode) {
              setSelectedNodes([createdNodeId]);
              pendingSelectionNodeIdRef.current = null;
              if (pendingCreateEditRef.current?.renderedId === createdNodeId) {
                const data = (createdNode.data || {}) as Record<string, unknown>;
                useGraphStore.getState().startTextEditSession({
                  nodeId: createdNodeId,
                  initialDraft: typeof data.label === 'string' ? data.label : '',
                  mode: pendingCreateEditRef.current.mode,
                });
                pendingCreateEditRef.current = null;
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to render file:', error);
      }
    }

    renderFile();
  }, [activeWorkspace?.rootPath, currentFile, draftDocuments, refreshKey, setGraph, setSelectedNodes, workspaceRootPath]); // refreshKey triggers re-render on file changes

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        activeWorkspace={activeWorkspace as SidebarWorkspaceEntry | null}
        workspaces={registeredWorkspaces as SidebarWorkspaceEntry[]}
        documents={workspaceDocuments}
        isLoading={isWorkspaceLoading}
        onRefresh={() => { void refreshActiveWorkspace(); }}
        onSelectWorkspace={handleSelectWorkspace}
        onCreateWorkspace={() => { void handleCreateWorkspace(); }}
        onAddWorkspace={() => { void handleAddExistingWorkspace(); }}
        onCreateDocument={() => { void handleCreateDocument(); }}
        onOpenDocument={(path) => {
            if (typeof window !== 'undefined' && 'electron' in window) {
              window.location.hash = `/document/${encodeURIComponent(path)}`;
            } else {
              window.location.href = `/app/document/${encodeURIComponent(path)}`;
            }
        }}
        onCopyWorkspacePath={() => { void handleCopyWorkspacePath(); }}
        onRevealWorkspace={() => { void handleRevealWorkspace(); }}
        onReconnectWorkspace={() => { void handleReconnectWorkspace(); }}
        onRemoveWorkspace={handleRemoveWorkspace}
        onOpenLegacyFile={(path) => {
            if (typeof window !== 'undefined' && 'electron' in window) {
              window.location.hash = `/document/${encodeURIComponent(path)}`;
            } else {
              window.location.href = `/app/document/${encodeURIComponent(path)}`;
            }
        }}
      />

      <div className="flex flex-1 flex-col h-full overflow-hidden relative">
        <Header
          onCreateDocument={() => { void handleCreateDocument(); }}
          workspaceLabel={activeWorkspace?.name ?? null}
        />
        {isChatOpen && <LazyChatPanel />}
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

        <Footer />

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
