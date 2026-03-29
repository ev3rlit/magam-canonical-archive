import { useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  CanvasMutationBatchV1,
  CanvasEditingProjectionResponseV1,
  CanvasHierarchyProjectionResponseV1,
  CanvasRenderProjectionResponseV1,
  CanvasRuntimeCommandV1,
  CanvasRedoRequestV1,
  CanvasUndoRequestV1,
} from '../../libs/shared/src/lib/canvas-runtime';
import { getDesktopHostBridge } from '@/features/host/renderer/hostCapabilities';
import { useGraphStore } from '@/store/graph';
import { editDebugLog, isEditDebugEnabled } from '@/utils/editDebug';
import {
  createPerCanvasMutationExecutor,
  rememberOwnCommand,
  RpcClientError,
  type MutationMethod,
  type RpcMutationResult,
  type UpdateNodeMutationOptions,
  type VersionConflictMetricsSnapshot,
} from './useFileSync.shared';
import {
  buildCanvasNodeCreateCommand,
  buildObjectBodyBlockInsertCommand,
  buildRuntimeContentUpdateCommand,
  buildRuntimePresentationStylePatch,
  resolveCanonicalObjectId,
  resolveRuntimeContentKind,
  resolveSourceNodeId,
} from '@/ws/shared/runtimeTransforms';

export { RpcClientError } from './useFileSync.shared';

export interface CanvasRuntimeProjectionQueryResult {
  canvasId: string;
  hierarchyProjection: CanvasHierarchyProjectionResponseV1;
  renderProjection: CanvasRenderProjectionResponseV1;
  editingProjection: CanvasEditingProjectionResponseV1;
}

export interface RuntimeReconciliationSnapshot {
  canvasId: string;
  workspaceId: string;
  workspaceRuntimeVersion: {
    versionToken: string;
  } | null;
  canvasMetadataVersion: {
    metadataRevisionNo: number;
    versionToken: string;
  } | null;
  nodeVersions: Array<{
    headRevisionNo: number;
    nodeId: string;
    versionToken: string;
  }>;
}

declare global {
  interface Window {
    __MAGAM_EDIT_METRICS__?: Readonly<{
      getSnapshot: () => VersionConflictMetricsSnapshot;
      reset: () => void;
    }>;
  }
}

type DesktopRpcEnvelope<T> =
  | { ok: true; result: T }
  | { ok: false; error: { code?: number | string; message: string; data?: unknown } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireDesktopBridge() {
  const bridge = getDesktopHostBridge();
  if (!bridge) {
    throw new Error('Desktop host bridge is not available.');
  }
  return bridge;
}

function toRpcClientError(error: { code?: number | string; message: string; data?: unknown }): RpcClientError {
  return new RpcClientError(
    typeof error.code === 'number' ? error.code : 50000,
    error.message,
    error.data,
  );
}

async function invokeDesktopRuntime<T>(method: string, payload?: unknown): Promise<T> {
  const bridge = requireDesktopBridge();
  const envelope = await bridge.rpc.invoke<DesktopRpcEnvelope<T>>(method, payload);
  if (!envelope.ok) {
    throw toRpcClientError(envelope.error);
  }
  return envelope.result;
}

export function buildRuntimeReconciliationFingerprint(
  snapshot: RuntimeReconciliationSnapshot | null,
): string {
  if (!snapshot) {
    return 'runtime:none';
  }

  return JSON.stringify({
    canvasId: snapshot.canvasId,
    workspaceId: snapshot.workspaceId,
    workspaceRuntimeVersion: snapshot.workspaceRuntimeVersion?.versionToken ?? null,
    canvasMetadataVersion: snapshot.canvasMetadataVersion?.versionToken ?? null,
    nodeVersions: [...snapshot.nodeVersions]
      .sort((left, right) => left.nodeId.localeCompare(right.nodeId))
      .map((nodeVersion) => ({
        nodeId: nodeVersion.nodeId,
        headRevisionNo: nodeVersion.headRevisionNo,
        versionToken: nodeVersion.versionToken,
      })),
  });
}

export function useCanvasRuntime(
  canvasId: string | null,
  workspaceId: string | null,
  workspaceRootPath: string | null,
  onCanvasInvalidated: () => void,
  onCanvasRegistryChanged?: () => void,
) {
  const currentCanvasIdRef = useRef<string | null>(null);
  const recentOwnCommandsRef = useRef<Map<string, number>>(new Map());
  const reconciliationFingerprintRef = useRef<string>('runtime:none');

  const sendRequest = useCallback(async (method: string, params: Record<string, unknown>): Promise<unknown> => (
    invokeDesktopRuntime(method, params)
  ), []);

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
    if (requiresCompatibilityVersion && (!baseVersion || baseVersion.startsWith('draft:'))) {
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

  const readRuntimeReconciliationSnapshot = useCallback(async (): Promise<RuntimeReconciliationSnapshot | null> => {
    if (!canvasId) {
      return null;
    }

    return invokeDesktopRuntime<RuntimeReconciliationSnapshot>('sync.watch', {
      canvasId,
      ...(workspaceRootPath ? { rootPath: workspaceRootPath } : {}),
    });
  }, [canvasId, workspaceRootPath]);

  const seedRuntimeReconciliationState = useCallback(async () => {
    const snapshot = await readRuntimeReconciliationSnapshot();
    reconciliationFingerprintRef.current = buildRuntimeReconciliationFingerprint(snapshot);
  }, [readRuntimeReconciliationSnapshot]);

  const reconcileRuntimeState = useCallback(async (): Promise<boolean> => {
    const snapshot = await readRuntimeReconciliationSnapshot();
    const nextFingerprint = buildRuntimeReconciliationFingerprint(snapshot);
    if (nextFingerprint === reconciliationFingerprintRef.current) {
      return false;
    }

    reconciliationFingerprintRef.current = nextFingerprint;
    return true;
  }, [readRuntimeReconciliationSnapshot]);

  const mutationExecutor = useMemo(() => createPerCanvasMutationExecutor({
    sendRequest: (method, params) => sendRequest(method, params),
    buildCommonParams: withCommon,
    applyResultVersion,
    onVersionConflictActual: () => {
      onCanvasInvalidated();
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
  }), [applyResultVersion, onCanvasInvalidated, sendRequest, withCommon]);

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

  useEffect(() => {
    currentCanvasIdRef.current = canvasId;
    if (!canvasId) {
      reconciliationFingerprintRef.current = 'runtime:none';
      return;
    }

    void seedRuntimeReconciliationState().catch((error) => {
      console.error('[CanvasRuntime] Failed to seed reconciliation state', error);
    });
  }, [canvasId, seedRuntimeReconciliationState, workspaceRootPath]);

  useEffect(() => {
    if (!canvasId) {
      return undefined;
    }

    const bridge = getDesktopHostBridge();
    if (!bridge) {
      return undefined;
    }

    const requestReconcile = () => {
      void reconcileRuntimeState()
        .then((changed) => {
          if (!changed) {
            return;
          }
          onCanvasRegistryChanged?.();
          onCanvasInvalidated();
        })
        .catch((error) => {
          console.error('[CanvasRuntime] Reconciliation failed', error);
        });
    };

    const unsubscribe = bridge.capabilities.lifecycle.onAppEvent((event) => {
      if (event.type === 'workspace-runtime-invalidated') {
        if (workspaceId && event.workspaceId !== workspaceId) {
          return;
        }
        requestReconcile();
        return;
      }

      if (event.type === 'backend-ready') {
        requestReconcile();
      }
    });

    const handleFocus = () => {
      requestReconcile();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestReconcile();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [canvasId, onCanvasInvalidated, onCanvasRegistryChanged, reconcileRuntimeState, workspaceId]);

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
  ): Promise<RpcMutationResult> => createCanvasNode(node, targetCanvasId), [createCanvasNode]);

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
    reconcileRuntimeState,
  };
}
