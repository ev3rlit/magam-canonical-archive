/**
 * useCanvasRuntime Hook - WebSocket client for canvas runtime synchronization
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import type {
  CanvasMutationBatchV1,
  CanvasEditingProjectionResponseV1,
  CanvasHierarchyProjectionResponseV1,
  CanvasRenderProjectionResponseV1,
  CanvasRuntimeCommandV1,
  CanvasRedoRequestV1,
  CanvasUndoRequestV1,
} from '../../libs/shared/src/lib/canvas-runtime';
import { useGraphStore } from '@/store/graph';
import { editDebugLog, isEditDebugEnabled } from '@/utils/editDebug';
import {
  createPerCanvasMutationExecutor,
  pruneExpiredOwnCommands,
  rememberOwnCommand,
  resolveFileSyncWsUrl,
  RpcClientError,
  shouldReloadForCanvasChange,
  type MutationMethod,
  type RpcMutationResult,
  type UpdateNodeMutationOptions,
  type VersionConflictMetricsSnapshot,
} from './useFileSync.shared';
import type { JsonRpcNotification, JsonRpcRequest, JsonRpcResponse } from '@/ws/rpc';
import {
  buildCanvasNodeCreateCommand,
  buildObjectBodyBlockInsertCommand,
  buildRuntimeContentUpdateCommand,
  buildRuntimePresentationStylePatch,
  resolveCanonicalObjectId,
  resolveRuntimeContentKind,
  resolveSourceNodeId,
} from '@/ws/shared/runtimeTransforms';
import {
  WS_NOTIFICATION_METHODS,
  WS_SUBSCRIPTION_METHODS,
} from '@/ws/shared/subscriptions';

export { RpcClientError } from './useFileSync.shared';

const REQUEST_TIMEOUT = 5000;

export interface CanvasRuntimeProjectionQueryResult {
  canvasId: string;
  hierarchyProjection: CanvasHierarchyProjectionResponseV1;
  renderProjection: CanvasRenderProjectionResponseV1;
  editingProjection: CanvasEditingProjectionResponseV1;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function buildCanvasSubscriptionRequests(input: {
  canvasId: string;
  workspaceRootPath?: string | null;
  startingId: number;
  subscribe: boolean;
}): JsonRpcRequest[] {
  const params = {
    canvasId: input.canvasId,
    ...(input.workspaceRootPath ? { rootPath: input.workspaceRootPath } : {}),
  };
  const methods = input.subscribe
    ? [
        WS_SUBSCRIPTION_METHODS.canvasSubscribe,
        WS_SUBSCRIPTION_METHODS.fileSubscribe,
      ]
    : [
        WS_SUBSCRIPTION_METHODS.canvasUnsubscribe,
        WS_SUBSCRIPTION_METHODS.fileUnsubscribe,
      ];

  return methods.map((method, index) => ({
    jsonrpc: '2.0',
    id: input.startingId + index,
    method,
    params,
  }));
}

export function isSubscriptionNotificationMethod(method: string): boolean {
  return (
    method === WS_NOTIFICATION_METHODS.canvasChanged
    || method === WS_NOTIFICATION_METHODS.fileChanged
    || method === WS_NOTIFICATION_METHODS.filesChanged
  );
}

export function useCanvasRuntime(
  canvasId: string | null,
  workspaceId: string | null,
  workspaceRootPath: string | null,
  onCanvasInvalidated: () => void,
  onCanvasRegistryChanged?: () => void,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const pendingRequestsRef = useRef<Map<number | string, PendingRequestEntry>>(new Map());
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
    let data: JsonRpcResponse | JsonRpcNotification;
    try {
      data = JSON.parse(event.data);
    } catch {
      console.error('[CanvasRuntime] Failed to parse message:', event.data);
      return;
    }

    if ('id' in data && data.id !== undefined) {
      const pending = pendingRequestsRef.current.get(data.id);
      if (pending) {
        pendingRequestsRef.current.delete(data.id);
        if ('error' in data && data.error) {
          pending.reject(new RpcClientError(data.error.code, data.error.message, data.error.data));
        } else {
          pending.resolve('result' in data ? data.result : undefined);
        }
      }
      return;
    }

    if ('method' in data && data.method === WS_NOTIFICATION_METHODS.canvasChanged) {
      const incomingCanvasId = typeof data.params?.canvasId === 'string' ? data.params.canvasId : undefined;
      const incomingVersion = typeof data.params?.newVersion === 'string' ? data.params.newVersion : undefined;
      const incomingCanvasRevision = typeof data.params?.canvasRevision === 'number' ? data.params.canvasRevision : undefined;
      const incomingOriginId = data.params?.originId;
      const incomingCommandId = data.params?.commandId;
      const { clientId, lastAppliedCommandId, setCanvasRevision, setCanvasVersion } = useGraphStore.getState();
      pruneExpiredOwnCommands(recentOwnCommandsRef.current, Date.now());

      if (incomingCanvasId && incomingVersion) {
        setCanvasVersion(incomingCanvasId, incomingVersion);
      }
      if (incomingCanvasId && incomingCanvasRevision !== undefined) {
        setCanvasRevision(incomingCanvasId, incomingCanvasRevision);
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

    if ('method' in data && data.method === WS_NOTIFICATION_METHODS.fileChanged) {
      const incomingCanvasId = typeof data.params?.canvasId === 'string' ? data.params.canvasId : undefined;
      const incomingVersion = typeof data.params?.version === 'string' ? data.params.version : undefined;
      const incomingOriginId = data.params?.originId;
      const incomingCommandId = typeof data.params?.commandId === 'string' ? data.params.commandId : undefined;
      const { clientId, setCanvasVersion } = useGraphStore.getState();
      pruneExpiredOwnCommands(recentOwnCommandsRef.current, Date.now());

      if (incomingCanvasId && incomingVersion) {
        setCanvasVersion(incomingCanvasId, incomingVersion);
      }

      const isOwnCommand = typeof incomingCommandId === 'string'
        && recentOwnCommandsRef.current.has(incomingCommandId)
        && incomingOriginId === clientId;
      if (!isOwnCommand) {
        onCanvasInvalidated();
      }
      return;
    }

    if ('method' in data && data.method === WS_NOTIFICATION_METHODS.filesChanged) {
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
        const requests = buildCanvasSubscriptionRequests({
          canvasId,
          workspaceRootPath,
          startingId: requestIdCounter + 1,
          subscribe: true,
        });
        requests.forEach((request) => {
          sendRequest(request.method, request.params || {}).catch((err) => {
            console.error('[CanvasRuntime] Subscribe failed:', err);
          });
        });
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
        const requests = buildCanvasSubscriptionRequests({
          canvasId,
          workspaceRootPath,
          startingId: requestIdCounter + 1,
          subscribe: false,
        });
        requests.forEach((request) => {
          requestIdCounter = Math.max(
            requestIdCounter,
            typeof request.id === 'number' ? request.id : requestIdCounter,
          );
          ws.send(JSON.stringify(request));
        });
      }
      ws.close();
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
    };
  }, [canvasId, handleMessage, onCanvasRegistryChanged, rejectPendingRequests, sendRequest, workspaceRootPath]);

  const withCommon = useCallback((method: MutationMethod, params: Record<string, unknown>) => {
    const targetCanvasId = typeof params.canvasId === 'string' ? params.canvasId : canvasId;
    if (!targetCanvasId) {
      throw new Error('CANVAS_ID_NOT_READY');
    }

    const { canvasVersions, clientId } = useGraphStore.getState();
    const requiresCompatibilityVersion = (
      method === 'canvas.node.create'
      || method === 'object.body.block.insert'
      || method === 'node.update'
      || method === 'node.move'
      || method === 'node.create'
      || method === 'node.delete'
      || method === 'node.reparent'
    );
    const baseVersion = canvasVersions[targetCanvasId] ?? null;
    if (requiresCompatibilityVersion && (!baseVersion || isClientOnlyDraftSourceVersion(baseVersion))) {
      throw new Error('SOURCE_VERSION_NOT_READY');
    }

    const commandId = crypto.randomUUID();
    rememberOwnCommand(recentOwnCommandsRef.current, commandId, Date.now());
    useGraphStore.getState().setLastAppliedCommandId(commandId);

    return {
      ...params,
      canvasId: targetCanvasId,
      originId: clientId,
      commandId,
      ...(requiresCompatibilityVersion && baseVersion ? { baseVersion } : {}),
      ...(workspaceRootPath ? { rootPath: workspaceRootPath } : {}),
    };
  }, [canvasId, workspaceRootPath]);

  const applyResultVersion = useCallback((result: unknown): RpcMutationResult => {
    const typed = result as RpcMutationResult;
    if (typed?.newVersion && typed.canvasId) {
      useGraphStore.getState().setCanvasVersion(typed.canvasId, typed.newVersion);
    }
    const nextCanvasRevision = typed?.canvasRevision
      ?? (typed?.runtimeResult?.ok ? typed.runtimeResult.data.canvasRevisionAfter ?? undefined : undefined);
    if (typed?.canvasId && typeof nextCanvasRevision === 'number') {
      useGraphStore.getState().setCanvasRevision(typed.canvasId, nextCanvasRevision);
    }
    if (typed?.commandId) {
      rememberOwnCommand(recentOwnCommandsRef.current, typed.commandId, Date.now());
      useGraphStore.getState().setLastAppliedCommandId(typed.commandId);
    }
    return typed;
  }, []);

  const getRuntimeProjections = useCallback(async (input?: {
    surfaceId?: string;
    nodeIds?: string[];
    workspaceId?: string;
  }): Promise<CanvasRuntimeProjectionQueryResult> => {
    if (!canvasId) {
      throw new Error('CANVAS_ID_NOT_READY');
    }

    const response = await sendRequest('canvas.runtime.projections', {
      canvasId,
      ...(workspaceRootPath ? { rootPath: workspaceRootPath } : {}),
      ...(input?.surfaceId ? { surfaceId: input.surfaceId } : {}),
      ...(input?.workspaceId ? { workspaceId: input.workspaceId } : {}),
      ...(input?.nodeIds && input.nodeIds.length > 0 ? { nodeIds: input.nodeIds } : {}),
    });

    return response as CanvasRuntimeProjectionQueryResult;
  }, [canvasId, sendRequest, workspaceRootPath]);

  const mutationExecutor = useMemo(() => createPerCanvasMutationExecutor({
    sendRequest: (method, params) => sendRequest(method, params),
    buildCommonParams: withCommon,
    applyResultVersion,
    onVersionConflictActual: (actualVersion) => {
      const activeCanvasId = currentCanvasIdRef.current;
      if (activeCanvasId && typeof actualVersion === 'number') {
        useGraphStore.getState().setCanvasRevision(activeCanvasId, actualVersion);
      } else if (activeCanvasId && typeof actualVersion === 'string') {
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

  const executeRuntimeMutation = useCallback(async (input: {
    canvasId?: string | null;
    dryRun?: boolean;
    reason?: string;
    commands: CanvasRuntimeCommandV1[];
  }): Promise<RpcMutationResult> => {
    const resolvedCanvasId = input.canvasId ?? canvasId;
    if (!resolvedCanvasId) {
      throw new Error('SOURCE_VERSION_NOT_READY');
    }

    const state = useGraphStore.getState();
    const canvasRevision = state.canvasRevisionsById[resolvedCanvasId];
    const sessionId = state.workspaceSessionKey ?? state.activeWorkspaceId ?? state.clientId;

    return mutationExecutor.enqueueMutation({
      method: 'canvas.runtime.mutate',
      canvasId: resolvedCanvasId,
      buildParams: () => ({
        canvasId: resolvedCanvasId,
        batch: {
          workspaceId: workspaceId ?? 'workspace',
          canvasId: resolvedCanvasId,
          actor: {
            kind: 'user',
            id: state.clientId,
          },
          sessionId,
          ...(typeof input.dryRun === 'boolean' ? { dryRun: input.dryRun } : {}),
          ...(input.reason ? { reason: input.reason } : {}),
          ...(typeof canvasRevision === 'number'
            ? {
                preconditions: {
                  canvasRevision,
                },
              }
            : {}),
          commands: input.commands,
        } satisfies CanvasMutationBatchV1,
      }),
    });
  }, [canvasId, mutationExecutor, workspaceId]);

  const resolveRuntimeNode = useCallback((nodeId: string) => {
    const state = useGraphStore.getState();
    return state.nodes.find((node) => (
      node.id === nodeId
      || resolveSourceNodeId(node) === nodeId
    )) ?? null;
  }, []);

  const updateNode = useCallback(async (
    nodeId: string,
    props: Record<string, unknown>,
    options?: UpdateNodeMutationOptions,
    targetCanvasId?: string | null,
  ): Promise<RpcMutationResult> => {
    const resolvedCanvasId = targetCanvasId ?? canvasId;
    if (!resolvedCanvasId) return {};

    if (options?.commandType === 'node.style.update') {
      return executeRuntimeMutation({
        canvasId: resolvedCanvasId,
        commands: [{
          name: 'canvas.node.presentation-style.update',
          canvasId: resolvedCanvasId,
          nodeId,
          presentationStyle: buildRuntimePresentationStylePatch(props),
        }],
      });
    }

    if (options?.commandType === 'node.content.update') {
      const runtimeNode = resolveRuntimeNode(nodeId);
      if (!runtimeNode) {
        throw new RpcClientError(40401, 'NODE_NOT_FOUND', { nodeId });
      }
      const objectId = resolveCanonicalObjectId(runtimeNode) ?? resolveSourceNodeId(runtimeNode);
      const kind = resolveRuntimeContentKind(runtimeNode);
      const content = typeof props.content === 'string' ? props.content : '';

      return executeRuntimeMutation({
        canvasId: resolvedCanvasId,
        commands: [buildRuntimeContentUpdateCommand({ objectId, kind, content })],
      });
    }

    if (options?.commandType === 'node.z-order.update' && typeof props.zIndex === 'number') {
      return executeRuntimeMutation({
        canvasId: resolvedCanvasId,
        commands: [{
          name: 'canvas.node.z-order.update',
          canvasId: resolvedCanvasId,
          nodeId,
          zIndex: props.zIndex,
        }],
      });
    }

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
  }, [canvasId, executeRuntimeMutation, mutationExecutor, resolveRuntimeNode]);

  const moveNode = useCallback(async (
    nodeId: string,
    x: number,
    y: number,
    targetCanvasId?: string | null,
  ): Promise<RpcMutationResult> => {
    const resolvedCanvasId = targetCanvasId ?? canvasId;
    if (!resolvedCanvasId) return {};
    return executeRuntimeMutation({
      canvasId: resolvedCanvasId,
      commands: [{
        name: 'canvas.node.move',
        canvasId: resolvedCanvasId,
        nodeId,
        x,
        y,
      }],
    });
  }, [canvasId, executeRuntimeMutation]);

  const createCanvasNode = useCallback(async (
    node: Record<string, unknown>,
    targetCanvasId?: string | null,
  ): Promise<RpcMutationResult> => {
    const resolvedCanvasId = targetCanvasId ?? canvasId;
    if (!resolvedCanvasId) {
      throw new Error('SOURCE_VERSION_NOT_READY');
    }
    const nodeId = typeof node.id === 'string' ? node.id : crypto.randomUUID();
    const nodeType = typeof node.type === 'string' ? node.type : 'shape';
    const props = isRecord(node.props) ? node.props : {};
    const commands: CanvasRuntimeCommandV1[] = [buildCanvasNodeCreateCommand({
      canvasId: resolvedCanvasId,
      nodeId,
      nodeType,
      props,
      placement: isRecord(node.placement) ? node.placement : undefined,
      generateId: crypto.randomUUID,
    })];

    if (typeof props.content === 'string' && props.content.length > 0) {
      commands.push(buildRuntimeContentUpdateCommand({
        objectId: nodeId,
        kind: 'markdown',
        content: props.content,
      }));
    }

    return executeRuntimeMutation({
      canvasId: resolvedCanvasId,
      commands,
    });
  }, [canvasId, executeRuntimeMutation]);

  const createNode = useCallback(async (
    node: Record<string, unknown>,
    targetCanvasId?: string | null,
  ): Promise<RpcMutationResult> => {
    return createCanvasNode(node, targetCanvasId);
  }, [createCanvasNode]);

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
    const runtimeNode = resolveRuntimeNode(input.objectId);
    const sourceNodeId = runtimeNode ? resolveSourceNodeId(runtimeNode) : input.objectId;
    return executeRuntimeMutation({
      canvasId: resolvedCanvasId,
      commands: [buildObjectBodyBlockInsertCommand({
        objectId: input.objectId,
        sourceNodeId,
        block: input.block,
        afterBlockId: input.afterBlockId,
        generateId: crypto.randomUUID,
      })],
    });
  }, [canvasId, executeRuntimeMutation, resolveRuntimeNode]);

  const deleteNode = useCallback(async (
    nodeId: string,
    targetCanvasId?: string | null,
  ): Promise<RpcMutationResult> => {
    const resolvedCanvasId = targetCanvasId ?? canvasId;
    if (!resolvedCanvasId) return {};
    return executeRuntimeMutation({
      canvasId: resolvedCanvasId,
      commands: [{
        name: 'canvas.node.delete',
        canvasId: resolvedCanvasId,
        nodeId,
      }],
    });
  }, [canvasId, executeRuntimeMutation]);

  const reparentNode = useCallback(async (
    nodeId: string,
    newParentId?: string | null,
    targetCanvasId?: string | null,
  ): Promise<RpcMutationResult> => {
    const resolvedCanvasId = targetCanvasId ?? canvasId;
    if (!resolvedCanvasId) return {};
    return executeRuntimeMutation({
      canvasId: resolvedCanvasId,
      commands: [{
        name: 'canvas.node.reparent',
        canvasId: resolvedCanvasId,
        nodeId,
        parentNodeId: newParentId ?? null,
      }],
    });
  }, [canvasId, executeRuntimeMutation]);

  const undoLastEdit = useCallback(async (): Promise<boolean> => {
    if (!canvasId) {
      return false;
    }

    const state = useGraphStore.getState();
    const request: CanvasUndoRequestV1 = {
      canvasId,
      actorId: state.clientId,
      sessionId: state.workspaceSessionKey ?? state.activeWorkspaceId ?? state.clientId,
    };

    const result = applyResultVersion(await sendRequest(
      'canvas.runtime.undo',
      withCommon('canvas.runtime.undo', request as unknown as Record<string, unknown>),
    ));
    if (!result.success || !result.runtimeResult?.ok) {
      return false;
    }

    onCanvasInvalidated();
    return true;
  }, [applyResultVersion, canvasId, onCanvasInvalidated, sendRequest, withCommon]);

  const redoLastEdit = useCallback(async (): Promise<boolean> => {
    if (!canvasId) {
      return false;
    }

    const state = useGraphStore.getState();
    const request: CanvasRedoRequestV1 = {
      canvasId,
      actorId: state.clientId,
      sessionId: state.workspaceSessionKey ?? state.activeWorkspaceId ?? state.clientId,
    };

    const result = applyResultVersion(await sendRequest(
      'canvas.runtime.redo',
      withCommon('canvas.runtime.redo', request as unknown as Record<string, unknown>),
    ));
    if (!result.success || !result.runtimeResult?.ok) {
      return false;
    }

    onCanvasInvalidated();
    return true;
  }, [applyResultVersion, canvasId, onCanvasInvalidated, sendRequest, withCommon]);

  return {
    dispatchRuntimeMutation: executeRuntimeMutation,
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
  };
}
