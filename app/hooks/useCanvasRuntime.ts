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
} from '../../libs/shared/src/lib/canvas-runtime';
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
import type { JsonRpcNotification, JsonRpcRequest, JsonRpcResponse } from '@/ws/rpc';

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

function resolveSourceNodeId(node: { id: string; data?: unknown }): string {
  const data = isRecord(node.data) ? node.data : {};
  const runtimeEditing = isRecord(data.runtimeEditing) ? data.runtimeEditing : null;
  if (typeof runtimeEditing?.nodeId === 'string' && runtimeEditing.nodeId.length > 0) {
    return runtimeEditing.nodeId;
  }

  const sourceMeta = isRecord(data.sourceMeta) ? data.sourceMeta : null;
  if (typeof sourceMeta?.sourceId === 'string' && sourceMeta.sourceId.length > 0) {
    return sourceMeta.sourceId;
  }

  return node.id;
}

function resolveCanonicalObjectId(node: { id: string; data?: unknown }): string | null {
  const data = isRecord(node.data) ? node.data : {};
  const runtimeEditing = isRecord(data.runtimeEditing) ? data.runtimeEditing : null;
  if (typeof runtimeEditing?.canonicalObjectId === 'string' && runtimeEditing.canonicalObjectId.length > 0) {
    return runtimeEditing.canonicalObjectId;
  }

  const canonicalObject = isRecord(data.canonicalObject) ? data.canonicalObject : null;
  const core = canonicalObject && isRecord(canonicalObject.core) ? canonicalObject.core : null;
  if (typeof core?.id === 'string' && core.id.length > 0) {
    return core.id;
  }

  return null;
}

function resolveContentKind(node: { type?: string; data?: unknown }): 'text' | 'markdown' | 'media' | 'sequence' | 'document' {
  const data = isRecord(node.data) ? node.data : {};
  const canonicalObject = isRecord(data.canonicalObject) ? data.canonicalObject : null;
  const capabilities = canonicalObject && isRecord(canonicalObject.capabilities)
    ? canonicalObject.capabilities
    : null;
  const content = capabilities && isRecord(capabilities.content)
    ? capabilities.content
    : null;
  const kind = typeof content?.kind === 'string' ? content.kind : null;
  if (kind === 'text' || kind === 'markdown' || kind === 'media' || kind === 'sequence' || kind === 'document') {
    return kind;
  }
  return node.type === 'text' ? 'text' : 'markdown';
}

function toRuntimeNodeKind(nodeType: string): Extract<CanvasRuntimeCommandV1, { name: 'canvas.node.create' }>['kind'] {
  return nodeType === 'sticker' ? 'sticker' : 'node';
}

function toRuntimeNodeType(nodeType: string): string {
  return nodeType === 'mindmap' ? 'shape' : nodeType;
}

function toRuntimeCreatePlacement(placement: Record<string, unknown>): Extract<CanvasRuntimeCommandV1, { name: 'canvas.node.create' }>['placement'] {
  if (placement.mode === 'mindmap-child' && typeof placement.parentId === 'string') {
    return {
      mode: 'mindmap-child',
      parentNodeId: placement.parentId,
    };
  }

  if (placement.mode === 'mindmap-sibling' && typeof placement.siblingOf === 'string') {
    return {
      mode: 'mindmap-sibling',
      siblingOfNodeId: placement.siblingOf,
      parentNodeId: placement.parentId === null
        ? null
        : typeof placement.parentId === 'string'
          ? placement.parentId
          : null,
    };
  }

  if (placement.mode === 'mindmap-root' && typeof placement.x === 'number' && typeof placement.y === 'number') {
    return {
      mode: 'mindmap-root',
      x: placement.x,
      y: placement.y,
      mindmapId: typeof placement.mindmapId === 'string' && placement.mindmapId.length > 0
        ? placement.mindmapId
        : `mindmap-${crypto.randomUUID()}`,
    };
  }

  if (typeof placement.x === 'number' && typeof placement.y === 'number') {
    return {
      mode: 'canvas-absolute',
      x: placement.x,
      y: placement.y,
    };
  }

  throw new Error('INVALID_RUNTIME_CREATE_PLACEMENT');
}

function toRuntimeBodyBlock(block: Record<string, unknown>): Extract<CanvasRuntimeCommandV1, { name: 'object.body.block.insert' }>['block'] {
  const blockId = typeof block.id === 'string' ? block.id : crypto.randomUUID();
  if (block.blockType === 'text') {
    return {
      blockId,
      kind: 'paragraph',
      props: {
        text: typeof block.text === 'string' ? block.text : '',
      },
    };
  }

  if (block.blockType === 'markdown') {
    return {
      blockId,
      kind: 'callout',
      props: {
        source: typeof block.source === 'string' ? block.source : '',
      },
    };
  }

  return {
    blockId,
    kind: 'custom',
    props: {
      ...(isRecord(block.payload) ? block.payload : {}),
      ...(typeof block.blockType === 'string' ? { blockType: block.blockType } : {}),
    },
  };
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

    if ('method' in data && data.method === 'canvas.changed') {
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

    if ('method' in data && data.method === 'files.changed') {
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

    return mutationExecutor.enqueueMutation({
      method: 'canvas.runtime.mutate',
      canvasId: resolvedCanvasId,
      buildParams: () => ({
        canvasId: resolvedCanvasId,
        batch: {
          workspaceId: workspaceId ?? 'workspace',
          canvasId: resolvedCanvasId,
          ...(typeof input.dryRun === 'boolean' ? { dryRun: input.dryRun } : {}),
          ...(input.reason ? { reason: input.reason } : {}),
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
          presentationStyle: {
            ...(typeof props.fill === 'string' ? { fillColor: props.fill } : {}),
            ...(typeof props.stroke === 'string' ? { strokeColor: props.stroke } : {}),
            ...(typeof props.strokeWidth === 'number' ? { strokeWidth: props.strokeWidth } : {}),
            ...(typeof props.opacity === 'number' ? { opacity: props.opacity } : {}),
            ...(typeof props.color === 'string' ? { textColor: props.color } : {}),
            ...(typeof props.fontFamily === 'string' ? { fontFamily: props.fontFamily } : {}),
            ...(typeof props.fontSize === 'number' ? { fontSize: props.fontSize } : {}),
          },
        }],
      });
    }

    if (options?.commandType === 'node.content.update') {
      const runtimeNode = resolveRuntimeNode(nodeId);
      if (!runtimeNode) {
        throw new RpcClientError(40401, 'NODE_NOT_FOUND', { nodeId });
      }
      const objectId = resolveCanonicalObjectId(runtimeNode) ?? resolveSourceNodeId(runtimeNode);
      const kind = resolveContentKind(runtimeNode);
      const content = typeof props.content === 'string' ? props.content : '';

      return executeRuntimeMutation({
        canvasId: resolvedCanvasId,
        commands: [{
          name: 'object.content.update',
          objectId,
          kind,
          patch: kind === 'text'
            ? { text: content, value: content }
            : { source: content, value: content },
          expectedContentKind: kind,
        }],
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
    const placement = toRuntimeCreatePlacement(isRecord(node.placement) ? node.placement : {});
    const commands: CanvasRuntimeCommandV1[] = [{
      name: 'canvas.node.create',
      canvasId: resolvedCanvasId,
      nodeId,
      kind: toRuntimeNodeKind(nodeType),
      nodeType: toRuntimeNodeType(nodeType),
      placement,
      transform: {
        ...(typeof props.width === 'number' ? { width: props.width } : {}),
        ...(typeof props.height === 'number' ? { height: props.height } : {}),
      },
      presentationStyle: {
        ...(typeof props.fill === 'string' ? { fillColor: props.fill } : {}),
        ...(typeof props.stroke === 'string' ? { strokeColor: props.stroke } : {}),
        ...(typeof props.strokeWidth === 'number' ? { strokeWidth: props.strokeWidth } : {}),
        ...(typeof props.color === 'string' ? { textColor: props.color } : {}),
        ...(typeof props.fontFamily === 'string' ? { fontFamily: props.fontFamily } : {}),
        ...(typeof props.fontSize === 'number' ? { fontSize: props.fontSize } : {}),
      },
    }];

    if (typeof props.content === 'string' && props.content.length > 0) {
      commands.push({
        name: 'object.content.update',
        objectId: nodeId,
        kind: 'markdown',
        patch: {
          source: props.content,
          value: props.content,
        },
        expectedContentKind: 'markdown',
      });
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
      commands: [{
        name: 'object.body.block.insert',
        objectId: input.objectId,
        block: toRuntimeBodyBlock(input.block),
        position: input.afterBlockId
          ? { mode: 'anchor', anchorId: `node:${sourceNodeId}:body-after:${input.afterBlockId}` }
          : { mode: 'end' },
      }],
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
