/**
 * useCanvasRuntime Hook - WebSocket client for canvas runtime synchronization
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useGraphStore } from '@/store/graph';
import { editDebugLog, isEditDebugEnabled } from '@/utils/editDebug';
import {
  applyEditCompletionSnapshot,
  createPerCanvasMutationExecutor,
  pruneExpiredOwnCommands,
  rememberOwnCommand,
  resolveFileSyncWsUrl,
  RpcClientError,
  shouldReloadAfterHistoryReplay,
  shouldReloadForCanvasChange,
  type RpcMutationResult,
  type UpdateNodeMutationOptions,
  type VersionConflictMetricsSnapshot,
} from './useFileSync.shared';

export { RpcClientError } from './useFileSync.shared';

const REQUEST_TIMEOUT = 5000;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: number;
  method?: string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
  params?: Record<string, unknown>;
}

type PendingRequestEntry = {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  meta: {
    method: string;
    startedAt: number;
    canvasId?: string;
    nodeId?: string;
    commandType?: string;
  };
};

declare global {
  interface Window {
    __MAGAM_EDIT_METRICS__?: Readonly<{
      getSnapshot: () => VersionConflictMetricsSnapshot;
      reset: () => void;
    }>;
  }
}

let requestIdCounter = 0;

function isClientOnlyDraftSourceVersion(version: string | null | undefined): boolean {
  return typeof version === 'string' && version.startsWith('draft:');
}

export function useCanvasRuntime(
  canvasId: string | null,
  workspaceRootPath: string | null,
  onCanvasInvalidated: () => void,
  onCanvasRegistryChanged?: () => void,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const pendingRequestsRef = useRef<Map<number, PendingRequestEntry>>(new Map());
  const currentCanvasIdRef = useRef<string | null>(null);
  const wsUrlRef = useRef<string>(resolveFileSyncWsUrl());
  const recentOwnCommandsRef = useRef<Map<string, number>>(new Map());

  const rejectPendingRequests = useCallback((reason: string) => {
    if (pendingRequestsRef.current.size === 0) {
      return;
    }

    const error = new Error(reason);
    pendingRequestsRef.current.forEach((pending) => {
      editDebugLog('rpc-request-aborted', error, {
        method: pending.meta.method,
        canvasId: pending.meta.canvasId ?? null,
        nodeId: pending.meta.nodeId ?? null,
        commandType: pending.meta.commandType ?? null,
        durationMs: Date.now() - pending.meta.startedAt,
        wsUrl: wsUrlRef.current,
        readyState: wsRef.current?.readyState ?? null,
      });
      pending.reject(error);
    });
    pendingRequestsRef.current.clear();
  }, []);

  const sendRequest = useCallback(async (method: string, params: Record<string, unknown>): Promise<unknown> => (
    new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = ++requestIdCounter;
      const request: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
      pendingRequestsRef.current.set(id, {
        resolve,
        reject,
        meta: {
          method,
          startedAt: Date.now(),
          canvasId: typeof params.canvasId === 'string' ? params.canvasId : undefined,
          nodeId: typeof params.nodeId === 'string' ? params.nodeId : undefined,
          commandType: typeof params.commandType === 'string' ? params.commandType : undefined,
        },
      });

      setTimeout(() => {
        const pending = pendingRequestsRef.current.get(id);
        if (!pending) {
          return;
        }

        pendingRequestsRef.current.delete(id);
        const timeoutError = new Error(`Request timeout: ${method}`);
        editDebugLog('rpc-request-timeout', timeoutError, {
          method: pending.meta.method,
          canvasId: pending.meta.canvasId ?? null,
          nodeId: pending.meta.nodeId ?? null,
          commandType: pending.meta.commandType ?? null,
          durationMs: Date.now() - pending.meta.startedAt,
          wsUrl: wsUrlRef.current,
          readyState: wsRef.current?.readyState ?? null,
        });
        pending.reject(timeoutError);
      }, REQUEST_TIMEOUT);

      wsRef.current.send(JSON.stringify(request));
    })
  ), []);

  const handleMessage = useCallback((event: MessageEvent) => {
    let data: JsonRpcResponse;
    try {
      data = JSON.parse(event.data);
    } catch {
      console.error('[CanvasRuntime] Failed to parse message:', event.data);
      return;
    }

    if (data.id !== undefined) {
      const pending = pendingRequestsRef.current.get(data.id);
      if (pending) {
        pendingRequestsRef.current.delete(data.id);
        if (data.error) {
          pending.reject(new RpcClientError(data.error.code, data.error.message, data.error.data));
        } else {
          pending.resolve(data.result);
        }
      }
      return;
    }

    if (data.method === 'canvas.changed') {
      const incomingCanvasId = typeof data.params?.canvasId === 'string' ? data.params.canvasId : undefined;
      const incomingVersion = typeof data.params?.newVersion === 'string' ? data.params.newVersion : undefined;
      const incomingOriginId = data.params?.originId;
      const incomingCommandId = data.params?.commandId;
      const { clientId, lastAppliedCommandId, setCanvasVersion } = useGraphStore.getState();
      pruneExpiredOwnCommands(recentOwnCommandsRef.current, Date.now());

      if (incomingCanvasId && incomingVersion) {
        setCanvasVersion(incomingCanvasId, incomingVersion);
      }

      const shouldReload = shouldReloadForCanvasChange({
        changedCanvasId: incomingCanvasId,
        currentCanvasId: currentCanvasIdRef.current,
        incomingOriginId,
        incomingCommandId,
        clientId,
        recentOwnCommandIds: new Set(recentOwnCommandsRef.current.keys()),
        lastAppliedCommandId,
      });

      if (!shouldReload) {
        return;
      }

      onCanvasInvalidated();
      return;
    }

    if (data.method === 'files.changed') {
      onCanvasRegistryChanged?.();
    }
  }, [onCanvasInvalidated, onCanvasRegistryChanged]);

  useEffect(() => {
    if (!canvasId && !onCanvasRegistryChanged) {
      return undefined;
    }

    currentCanvasIdRef.current = canvasId;
    const wsUrl = resolveFileSyncWsUrl({
      location: typeof window !== 'undefined'
        ? {
            protocol: window.location.protocol,
            hostname: window.location.hostname,
          }
        : undefined,
    });
    wsUrlRef.current = wsUrl;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (canvasId) {
        sendRequest('canvas.subscribe', {
          canvasId,
          ...(workspaceRootPath ? { rootPath: workspaceRootPath } : {}),
        }).catch((err) => console.error('[CanvasRuntime] Subscribe failed:', err));
      }
    };

    ws.onmessage = handleMessage;
    ws.onerror = (error) => console.error('[CanvasRuntime] WebSocket error:', error);
    ws.onclose = () => {
      rejectPendingRequests('WebSocket disconnected before response');
    };

    return () => {
      rejectPendingRequests('WebSocket connection was reset');
      if (ws.readyState === WebSocket.OPEN && canvasId) {
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          id: ++requestIdCounter,
          method: 'canvas.unsubscribe',
          params: {
            canvasId,
            ...(workspaceRootPath ? { rootPath: workspaceRootPath } : {}),
          },
        } satisfies JsonRpcRequest));
      }
      ws.close();
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
    };
  }, [canvasId, handleMessage, onCanvasRegistryChanged, rejectPendingRequests, sendRequest, workspaceRootPath]);

  const withCommon = useCallback((params: Record<string, unknown>) => {
    const targetCanvasId = typeof params.canvasId === 'string' ? params.canvasId : canvasId;
    if (!targetCanvasId) {
      throw new Error('CANVAS_ID_NOT_READY');
    }

    const { canvasVersions, clientId } = useGraphStore.getState();
    const baseVersion = canvasVersions[targetCanvasId] ?? null;
    if (!baseVersion || isClientOnlyDraftSourceVersion(baseVersion)) {
      throw new Error('SOURCE_VERSION_NOT_READY');
    }

    const commandId = crypto.randomUUID();
    rememberOwnCommand(recentOwnCommandsRef.current, commandId, Date.now());
    useGraphStore.getState().setLastAppliedCommandId(commandId);

    return {
      ...params,
      baseVersion,
      canvasId: targetCanvasId,
      originId: clientId,
      commandId,
      ...(workspaceRootPath ? { rootPath: workspaceRootPath } : {}),
    };
  }, [canvasId, workspaceRootPath]);

  const applyResultVersion = useCallback((result: unknown): RpcMutationResult => {
    const typed = result as RpcMutationResult;
    if (typed?.newVersion && typed.canvasId) {
      useGraphStore.getState().setCanvasVersion(typed.canvasId, typed.newVersion);
    }
    if (typed?.commandId) {
      rememberOwnCommand(recentOwnCommandsRef.current, typed.commandId, Date.now());
      useGraphStore.getState().setLastAppliedCommandId(typed.commandId);
    }
    return typed;
  }, []);

  const mutationExecutor = useMemo(() => createPerCanvasMutationExecutor({
    sendRequest: (method, params) => sendRequest(method, params),
    buildCommonParams: withCommon,
    applyResultVersion,
    onVersionConflictActual: (actualVersion) => {
      const activeCanvasId = currentCanvasIdRef.current;
      if (activeCanvasId) {
        useGraphStore.getState().setCanvasVersion(activeCanvasId, actualVersion);
      }
    },
    onConflictRetry: (event) => {
      editDebugLog('mutation-version-conflict-retry', event.error, {
        method: event.method,
        canvasId: event.canvasId,
        attempt: event.attempt,
        maxRetry: event.maxRetry,
        expected: event.expected,
        actual: event.actual,
        mutation_total_10m: event.metrics.mutationTotal10m,
        version_conflict_total_10m: event.metrics.versionConflictTotal10m,
        version_conflict_rate_10m: event.metrics.versionConflictRate10m,
        threshold: event.metrics.threshold,
        should_enable_server_mutex: event.metrics.shouldEnableServerMutex,
      });
    },
  }), [applyResultVersion, sendRequest, withCommon]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isEditDebugEnabled()) {
      return;
    }

    const debugMetrics = Object.freeze({
      getSnapshot: () => mutationExecutor.getMetricsSnapshot(),
      reset: () => mutationExecutor.resetMetrics(),
    });
    window.__MAGAM_EDIT_METRICS__ = debugMetrics;

    return () => {
      if (window.__MAGAM_EDIT_METRICS__ === debugMetrics) {
        delete window.__MAGAM_EDIT_METRICS__;
      }
    };
  }, [mutationExecutor]);

  const updateNode = useCallback(async (
    nodeId: string,
    props: Record<string, unknown>,
    options?: UpdateNodeMutationOptions,
    targetCanvasId?: string | null,
  ): Promise<RpcMutationResult> => {
    const resolvedCanvasId = targetCanvasId ?? canvasId;
    if (!resolvedCanvasId) return {};
    return mutationExecutor.enqueueMutation({
      method: 'node.update',
      canvasId: resolvedCanvasId,
      buildParams: () => ({
        canvasId: resolvedCanvasId,
        nodeId,
        props,
        ...(options?.commandType ? { commandType: options.commandType } : {}),
      }),
    });
  }, [canvasId, mutationExecutor]);

  const moveNode = useCallback(async (
    nodeId: string,
    x: number,
    y: number,
    targetCanvasId?: string | null,
  ): Promise<RpcMutationResult> => {
    const resolvedCanvasId = targetCanvasId ?? canvasId;
    if (!resolvedCanvasId) return {};
    return mutationExecutor.enqueueMutation({
      method: 'node.move',
      canvasId: resolvedCanvasId,
      buildParams: () => ({ canvasId: resolvedCanvasId, nodeId, x, y }),
    });
  }, [canvasId, mutationExecutor]);

  const createNode = useCallback(async (
    node: Record<string, unknown>,
    targetCanvasId?: string | null,
  ): Promise<RpcMutationResult> => {
    const resolvedCanvasId = targetCanvasId ?? canvasId;
    if (!resolvedCanvasId) {
      throw new Error('SOURCE_VERSION_NOT_READY');
    }
    return mutationExecutor.enqueueMutation({
      method: 'node.create',
      canvasId: resolvedCanvasId,
      buildParams: () => ({ canvasId: resolvedCanvasId, node }),
    });
  }, [canvasId, mutationExecutor]);

  const createCanvasNode = useCallback(async (
    node: Record<string, unknown>,
    targetCanvasId?: string | null,
  ): Promise<RpcMutationResult> => {
    const resolvedCanvasId = targetCanvasId ?? canvasId;
    if (!resolvedCanvasId) {
      throw new Error('SOURCE_VERSION_NOT_READY');
    }
    return mutationExecutor.enqueueMutation({
      method: 'canvas.node.create',
      canvasId: resolvedCanvasId,
      buildParams: () => ({ canvasId: resolvedCanvasId, node }),
    });
  }, [canvasId, mutationExecutor]);

  const insertObjectBodyBlock = useCallback(async (
    input: {
      objectId: string;
      block: Record<string, unknown>;
      afterBlockId?: string;
    },
    targetCanvasId?: string | null,
  ): Promise<RpcMutationResult> => {
    const resolvedCanvasId = targetCanvasId ?? canvasId;
    if (!resolvedCanvasId) {
      throw new Error('SOURCE_VERSION_NOT_READY');
    }
    return mutationExecutor.enqueueMutation({
      method: 'object.body.block.insert',
      canvasId: resolvedCanvasId,
      buildParams: () => ({
        canvasId: resolvedCanvasId,
        objectId: input.objectId,
        block: input.block,
        ...(input.afterBlockId ? { afterBlockId: input.afterBlockId } : {}),
      }),
    });
  }, [canvasId, mutationExecutor]);

  const deleteNode = useCallback(async (
    nodeId: string,
    targetCanvasId?: string | null,
  ): Promise<RpcMutationResult> => {
    const resolvedCanvasId = targetCanvasId ?? canvasId;
    if (!resolvedCanvasId) return {};
    return mutationExecutor.enqueueMutation({
      method: 'node.delete',
      canvasId: resolvedCanvasId,
      buildParams: () => ({ canvasId: resolvedCanvasId, nodeId }),
    });
  }, [canvasId, mutationExecutor]);

  const reparentNode = useCallback(async (
    nodeId: string,
    newParentId?: string | null,
    targetCanvasId?: string | null,
  ): Promise<RpcMutationResult> => {
    const resolvedCanvasId = targetCanvasId ?? canvasId;
    if (!resolvedCanvasId) return {};
    return mutationExecutor.enqueueMutation({
      method: 'node.reparent',
      canvasId: resolvedCanvasId,
      buildParams: () => ({
        canvasId: resolvedCanvasId,
        nodeId,
        ...(newParentId ? { newParentId } : {}),
      }),
    });
  }, [canvasId, mutationExecutor]);

  const applyEventSnapshot = useCallback(async (event: Parameters<typeof applyEditCompletionSnapshot>[0], direction: 'before' | 'after'): Promise<void> => {
    await applyEditCompletionSnapshot(event, direction, {
      moveNode,
      updateNode,
      createNode,
      createCanvasNode,
      insertObjectBodyBlock,
      deleteNode,
      reparentNode,
    });
  }, [createCanvasNode, createNode, deleteNode, insertObjectBodyBlock, moveNode, reparentNode, updateNode]);

  const undoLastEdit = useCallback(async (): Promise<boolean> => {
    const state = useGraphStore.getState();
    const event = state.peekUndoEditEvent();
    if (!event) {
      return false;
    }
    await applyEventSnapshot(event, 'before');
    useGraphStore.getState().commitUndoEventSuccess(event.eventId);
    if (shouldReloadAfterHistoryReplay(event)) {
      onCanvasInvalidated();
    }
    return true;
  }, [applyEventSnapshot, onCanvasInvalidated]);

  const redoLastEdit = useCallback(async (): Promise<boolean> => {
    const state = useGraphStore.getState();
    const event = state.peekRedoEditEvent();
    if (!event) {
      return false;
    }
    await applyEventSnapshot(event, 'after');
    useGraphStore.getState().commitRedoEventSuccess(event.eventId);
    if (shouldReloadAfterHistoryReplay(event)) {
      onCanvasInvalidated();
    }
    return true;
  }, [applyEventSnapshot, onCanvasInvalidated]);

  return {
    updateNode,
    moveNode,
    createNode,
    createCanvasNode,
    insertObjectBodyBlock,
    deleteNode,
    reparentNode,
    undoLastEdit,
    redoLastEdit,
  };
}
