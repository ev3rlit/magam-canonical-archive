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
import { Sidebar } from '@/components/ui/Sidebar';
import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import { TabBar } from '@/components/ui/TabBar';
import { type QuickOpenCommand } from '@/components/ui/QuickOpenDialog';
import { ErrorOverlay } from '@/components/ui/ErrorOverlay';
import {
  LazyChatPanel,
  LazyQuickOpenDialog,
  LazySearchOverlay,
  LazyStickerInspector,
} from './LazyPanels';
import { useChatUiStore } from '@/store/chatUi';
import { TabState, useGraphStore } from '@/store/graph';
import {
  buildAbsoluteMoveCommand,
  buildContentUpdateCommand,
  buildCreateCommand,
  buildRenameCommand,
  buildReparentCommand,
  buildRelativeMoveCommand,
  buildStyleUpdateCommand,
  toCreateNodeInput,
  toUpdateNodeProps,
} from '@/features/editing/commands';
import { createUniqueNodeId, getCreateDefaults } from '@/features/editing/createDefaults';
import {
  getWashiPresetPatternCatalog,
} from '@/utils/washiTapeDefaults';
import { parseRenderGraph } from '@/features/render/parseRenderGraph';
import { editDebugLog } from '@/utils/editDebug';
import { mapDragToRelativeAttachmentUpdate } from '@/utils/relativeAttachmentMapping';
import { resolveMindMapReparentIntent } from '@/components/GraphCanvas.drag';
import {
  buildTextDraftPatch,
  canCommitTextEdit,
  canRunNodeCommand,
  getAllowedNodeStylePatch,
  mapEditRpcErrorToToast,
  resolveNodeEditContext,
  resolveNodeEditTarget,
} from './workspaceEditUtils';

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

function getNodeLabel(node: { data?: unknown }): string {
  const data = (node.data || {}) as Record<string, unknown>;
  return typeof data.label === 'string' ? data.label : '';
}

function pickNodeDataSnapshot(
  data: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  return keys.reduce<Record<string, unknown>>((acc, key) => {
    if (key in data) {
      acc[key] = data[key];
    }
    return acc;
  }, {});
}

function buildRenderedNodeId(input: {
  sourceId: string;
  scopeId?: string;
  frameScope?: string;
}): string {
  const segments = [
    input.scopeId,
    input.frameScope,
    input.sourceId,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  return segments.length > 0 ? segments.join('.') : input.sourceId;
}

declare global {
  interface Window {
    __magamTest?: MagamTestHooks;
  }
}

export function WorkspaceClient() {
  const {
    setFiles,
    setGraph,
    currentFile,
    sourceVersions,
    files,
    nodes,
    selectedNodeIds,
    setSelectedNodes,
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
    activeTextEditNodeId,
    textEditDraft,
    pendingTextEditAction,
    clearPendingTextEditAction,
    clearTextEditSession,
    pushEditCompletionEvent,
  } = useGraphStore();
  const isChatOpen = useChatUiStore((state) => state.isOpen);
  const toggleChat = useChatUiStore((state) => state.toggleOpen);
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
  const pendingSelectionNodeIdRef = useRef<string | null>(null);

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

  const dependencyFiles = useMemo(
    () => Object.keys(sourceVersions).filter((filePath) => filePath !== currentFile),
    [currentFile, sourceVersions],
  );

  // File sync with reload callback for file list changes
  const {
    updateNode,
    moveNode,
    createNode,
    reparentNode,
    undoLastEdit,
    redoLastEdit,
  } = useFileSync(currentFile, handleFileChange, loadFiles, dependencyFiles);

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

  const restoreNodeData = useCallback((nodeId: string, previousData: Record<string, unknown> | undefined) => {
    useGraphStore.setState((state) => ({
      nodes: state.nodes.map((node) => (
        node.id === nodeId
          ? { ...node, data: previousData || {} }
          : node
      )),
    }));
  }, []);

  const handleNodeStyleCommit = useCallback(async (payload: {
    nodeId: string;
    patch: Record<string, unknown>;
  }) => {
    const runtime = useGraphStore.getState();
    const targetNode = runtime.nodes.find((node) => node.id === payload.nodeId);
    if (!targetNode) {
      throw new RpcClientError(40401, 'NODE_NOT_FOUND', { nodeId: payload.nodeId });
    }

    const editContext = resolveNodeEditContext(targetNode, runtime.currentFile);
    if (!editContext.target.filePath) {
      throw new Error('SOURCE_VERSION_NOT_READY');
    }
    if (!canRunNodeCommand(targetNode, 'node.style.update')) {
      throw new RpcClientError(42201, 'EDIT_NOT_ALLOWED', {
        nodeId: payload.nodeId,
        reason: editContext.readOnlyReason ?? 'STYLE_NOT_ALLOWED',
      });
    }

    const { patch, rejectedKeys } = getAllowedNodeStylePatch(targetNode, payload.patch);
    if (Object.keys(patch).length === 0 || rejectedKeys.length > 0) {
      throw new RpcClientError(42201, 'EDIT_NOT_ALLOWED', {
        nodeId: payload.nodeId,
        rejectedKeys,
      });
    }

    const baseVersion = runtime.sourceVersions[editContext.target.filePath] ?? null;
    if (!baseVersion) {
      throw new Error('SOURCE_VERSION_NOT_READY');
    }

    const previousData = (targetNode.data || {}) as Record<string, unknown>;
    const previous = pickNodeDataSnapshot(previousData, Object.keys(patch));
    const command = buildStyleUpdateCommand({
      target: {
        sourceId: editContext.target.nodeId,
        filePath: editContext.target.filePath,
        renderedId: targetNode.id,
        editMeta: editContext.editMeta,
      },
      previous,
      patch,
    });

    useGraphStore.getState().updateNodeData(payload.nodeId, patch);

    try {
      const result = await updateNode(
        command.target.sourceId,
        toUpdateNodeProps(command),
        command.target.filePath,
        { commandType: command.type },
      );
      const nextVersion = result.newVersion
        ?? useGraphStore.getState().sourceVersions[command.target.filePath]
        ?? baseVersion;
      const commandId = result.commandId ?? crypto.randomUUID();

      pushEditCompletionEvent({
        eventId: crypto.randomUUID(),
        type: 'STYLE_UPDATED',
        nodeId: command.target.sourceId,
        filePath: command.target.filePath,
        commandId,
        baseVersion,
        nextVersion,
        before: command.payload.previous,
        after: command.payload.patch,
        committedAt: Date.now(),
      });
    } catch (error) {
      restoreNodeData(payload.nodeId, previousData);
      const message = mapEditRpcErrorToToast(error) ?? '스타일 저장에 실패했습니다.';
      setGraphError({
        message,
        type: 'EDIT_REJECTED',
        details: error,
      });
      throw error;
    }
  }, [pushEditCompletionEvent, restoreNodeData, setGraphError, updateNode]);

  const handleWashiPresetChange = useCallback(
    async (nodeIds: string[], presetId: string) => {
      await Promise.all(nodeIds.map((nodeId) => handleNodeStyleCommit({
        nodeId,
        patch: { pattern: { type: 'preset', id: presetId } },
      })));
    },
    [handleNodeStyleCommit],
  );

  const handleNodeRenameCommit = useCallback(async (nodeId: string) => {
    const runtime = useGraphStore.getState();
    const targetNode = runtime.nodes.find((node) => node.id === nodeId);
    if (!targetNode) {
      throw new RpcClientError(40401, 'NODE_NOT_FOUND', { nodeId });
    }

    const editContext = resolveNodeEditContext(targetNode, runtime.currentFile);
    if (!editContext.target.filePath) {
      throw new Error('SOURCE_VERSION_NOT_READY');
    }
    if (!canRunNodeCommand(targetNode, 'node.rename')) {
      throw new RpcClientError(42201, 'EDIT_NOT_ALLOWED', {
        nodeId,
        reason: editContext.readOnlyReason ?? 'RENAME_NOT_ALLOWED',
      });
    }

    const currentId = editContext.target.nodeId;
    const nextId = window.prompt('새 노드 ID', currentId)?.trim();
    if (!nextId || nextId === currentId) {
      return;
    }

    const baseVersion = runtime.sourceVersions[editContext.target.filePath] ?? null;
    if (!baseVersion) {
      throw new Error('SOURCE_VERSION_NOT_READY');
    }

    const command = buildRenameCommand({
      target: {
        sourceId: currentId,
        filePath: editContext.target.filePath,
        renderedId: targetNode.id,
        editMeta: editContext.editMeta,
      },
      previousId: currentId,
      nextId,
    });

    try {
      const result = await updateNode(
        command.target.sourceId,
        toUpdateNodeProps(command),
        command.target.filePath,
        { commandType: command.type },
      );
      const nextVersion = result.newVersion
        ?? useGraphStore.getState().sourceVersions[command.target.filePath]
        ?? baseVersion;
      const commandId = result.commandId ?? crypto.randomUUID();

      pushEditCompletionEvent({
        eventId: crypto.randomUUID(),
        type: 'NODE_RENAMED',
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
      const message = mapEditRpcErrorToToast(error) ?? 'ID 변경에 실패했습니다.';
      setGraphError({
        message,
        type: 'EDIT_REJECTED',
        details: error,
      });
      throw error;
    }
  }, [handleFileChange, pushEditCompletionEvent, setGraphError, updateNode]);

  const handleCreateNodeCommit = useCallback(async (input: {
    nodeType: 'shape' | 'text' | 'markdown' | 'sticky' | 'sticker' | 'washi-tape';
    placement:
      | { mode: 'canvas-absolute'; x: number; y: number }
      | { mode: 'mindmap-child'; parentId: string }
      | { mode: 'mindmap-sibling'; siblingOf: string; parentId: string | null };
    filePath?: string;
    scopeId?: string;
    frameScope?: string;
  }) => {
    const runtime = useGraphStore.getState();
    const targetFile = input.filePath ?? runtime.currentFile;
    if (!targetFile) {
      throw new Error('SOURCE_VERSION_NOT_READY');
    }

    const baseVersion = runtime.sourceVersions[targetFile] ?? null;
    if (!baseVersion) {
      throw new Error('SOURCE_VERSION_NOT_READY');
    }

    const existingSourceIds = runtime.nodes
      .map((node) => {
        const sourceMeta = (node.data as { sourceMeta?: { sourceId?: unknown } } | undefined)?.sourceMeta;
        return typeof sourceMeta?.sourceId === 'string' ? sourceMeta.sourceId : node.id;
      });
    const nextId = createUniqueNodeId(input.nodeType, existingSourceIds);
    const defaults = getCreateDefaults(input.nodeType);
    const command = buildCreateCommand({
      type: input.placement.mode === 'canvas-absolute'
        ? 'node.create'
        : input.placement.mode === 'mindmap-child'
          ? 'mindmap.child.create'
          : 'mindmap.sibling.create',
      target: {
        sourceId: nextId,
        filePath: targetFile,
        scopeId: input.scopeId,
        frameScope: input.frameScope,
      },
      payload: {
        nodeType: input.nodeType,
        id: nextId,
        initialProps: defaults.initialProps,
        initialContent: defaults.initialContent,
        placement: input.placement,
      },
    });

    const createInput = toCreateNodeInput(command);

    try {
      const result = await createNode(createInput, targetFile);
      const nextVersion = result.newVersion
        ?? useGraphStore.getState().sourceVersions[targetFile]
        ?? baseVersion;
      const commandId = result.commandId ?? crypto.randomUUID();
      const renderedId = buildRenderedNodeId({
        sourceId: nextId,
        scopeId: input.scopeId,
        frameScope: input.frameScope,
      });

      pendingSelectionNodeIdRef.current = renderedId;
      pushEditCompletionEvent({
        eventId: crypto.randomUUID(),
        type: 'NODE_CREATED',
        nodeId: nextId,
        filePath: targetFile,
        commandId,
        baseVersion,
        nextVersion,
        before: { created: false },
        after: { create: createInput, renderedId },
        committedAt: Date.now(),
      });
      handleFileChange();
    } catch (error) {
      const message = mapEditRpcErrorToToast(error) ?? '오브젝트 생성에 실패했습니다.';
      setGraphError({
        message,
        type: 'EDIT_REJECTED',
        details: error,
      });
      throw error;
    }
  }, [createNode, handleFileChange, pushEditCompletionEvent, setGraphError]);

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
      draggedNode: targetNode as any,
      allNodes: runtime.nodes as any,
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
          carrier: typeof relativeUpdate.props.gap === 'number' ? 'gap' : 'at.offset',
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
      const editContext = resolveNodeEditContext(node, runtime.currentFile);
      const baseVersion = editTarget.filePath
        ? runtime.sourceVersions[editTarget.filePath] ?? null
        : null;
      if (!editTarget.filePath || !baseVersion) {
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

      const previousData = (node.data || {}) as Record<string, unknown>;
      useGraphStore.getState().updateNodeData(
        node.id,
        buildTextDraftPatch(node.type, nextContent),
      );

      try {
        const contentCarrier = editContext.editMeta?.contentCarrier
          ?? (node.type === 'markdown' ? 'markdown-child' : 'text-child');
        const contentCommand = buildContentUpdateCommand({
          target: {
            sourceId: editTarget.nodeId,
            filePath: editTarget.filePath,
            renderedId: node.id,
            editMeta: editContext.editMeta,
          },
          carrier: contentCarrier,
          previousContent: beforeContent,
          nextContent,
        });
        const result = await updateNode(
          contentCommand.target.sourceId,
          toUpdateNodeProps(contentCommand),
          contentCommand.target.filePath,
          { commandType: contentCommand.type },
        );
        const nextVersion = result.newVersion
          ?? useGraphStore.getState().sourceVersions[editTarget.filePath]
          ?? baseVersion;
        const commandId = result.commandId ?? crypto.randomUUID();

        pushEditCompletionEvent({
          eventId: crypto.randomUUID(),
          type: 'CONTENT_UPDATED',
          nodeId: editTarget.nodeId,
          filePath: editTarget.filePath,
          commandId,
          baseVersion,
          nextVersion,
          before: contentCommand.payload.previous,
          after: contentCommand.payload.next,
          committedAt: Date.now(),
        });
        clearTextEditSession();
      } catch (error) {
        editDebugLog('text-edit-commit', error, {
          nodeId: editTarget.nodeId,
          filePath: editTarget.filePath,
          beforeContent,
          nextContent,
        });
        restoreNodeData(node.id, previousData);
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
    pendingTextEditAction,
    pushEditCompletionEvent,
    restoreNodeData,
    selectedNodeIds,
    setGraphError,
    textEditDraft,
    updateNode,
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

        const parsed = parseRenderGraph(data);
        if (parsed) {
          setGraph(parsed);
          if (pendingSelectionNodeIdRef.current) {
            const createdNodeId = pendingSelectionNodeIdRef.current;
            const createdNodeExists = parsed.nodes.some((node) => node.id === createdNodeId);
            if (createdNodeExists) {
              setSelectedNodes([createdNodeId]);
              pendingSelectionNodeIdRef.current = null;
            }
          }
        }
      } catch (error) {
        console.error('Failed to render file:', error);
      }
    }

    renderFile();
  }, [currentFile, refreshKey, setGraph, setSelectedNodes]); // refreshKey triggers re-render on file changes

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-900">
      <Sidebar onOpenFile={openTabByPath} />

      <div className="flex flex-1 flex-col h-full overflow-hidden relative">
        <Header />
        {isChatOpen && <LazyChatPanel />}
        <TabBar
          tabs={openTabs}
          activeTabId={activeTabId}
          onActivate={activateTab}
          onClose={requestCloseTab}
          onContextMenu={openTabContextMenu}
        />

        <main className="flex-1 relative w-full h-full overflow-hidden">
          <ErrorOverlay />
          {isSearchOpen && <LazySearchOverlay />}
          <GraphCanvas
            onNodeDragStop={handleNodeDragCommit}
            onWashiPresetChange={handleWashiPresetChange}
            onUndoEditStep={undoLastEdit}
            onRedoEditStep={redoLastEdit}
            mapEditErrorToToast={mapEditRpcErrorToToast}
            onRenameNode={handleNodeRenameCommit}
            onCreateNode={handleCreateNodeCommit}
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
