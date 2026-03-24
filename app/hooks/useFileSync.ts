/**
 * useFileSync Hook - WebSocket client for file synchronization
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useGraphStore } from '@/store/graph';
import type { EditCompletionEvent } from '@/store/graph';
import { editDebugLog, isEditDebugEnabled } from '@/utils/editDebug';
import {
    applyEditCompletionSnapshot,
    buildWatchedFilesSignature,
    createPerFileMutationExecutor,
    normalizeCompatibilityWatchedFiles,
    pruneExpiredOwnCommands,
    rememberOwnCommand,
    resolveFileSyncWsUrl,
    RpcClientError,
    shouldReloadAfterHistoryReplay,
    shouldReloadForFileChange,
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
        filePath?: string;
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

function looksLikeCompatibilityPath(value: string | null | undefined): boolean {
    return typeof value === 'string' && (value.includes('/') || value.endsWith('.tsx'));
}

export function useFileSync(
    canvasId: string | null,
    compatibilityFilePath: string | null,
    workspaceRootPath: string | null,
    onFileChange: () => void,
    onFilesChange?: () => void,
    dependencyFiles: string[] = [],
) {
    const wsRef = useRef<WebSocket | null>(null);
    const pendingRequestsRef = useRef<Map<number, PendingRequestEntry>>(new Map());
    const currentCanvasIdRef = useRef<string | null>(null);
    const currentCompatibilityFilePathRef = useRef<string | null>(null);
    const watchedFilesRef = useRef<Set<string>>(new Set());
    const wsUrlRef = useRef<string>(resolveFileSyncWsUrl());
    const recentOwnCommandsRef = useRef<Map<string, number>>(new Map());
    const dependencyFilesSignature = useMemo(
        () => buildWatchedFilesSignature([...dependencyFiles].sort()),
        [dependencyFiles],
    );
    const watchedFiles = useMemo(
        () => normalizeCompatibilityWatchedFiles(compatibilityFilePath, dependencyFiles),
        [compatibilityFilePath, dependencyFilesSignature],
    );
    const watchedFilesSignature = useMemo(
        () => buildWatchedFilesSignature(watchedFiles),
        [watchedFiles],
    );

    const rejectPendingRequests = useCallback((reason: string) => {
        if (pendingRequestsRef.current.size === 0) {
            return;
        }

        const error = new Error(reason);
        pendingRequestsRef.current.forEach((pending) => {
            editDebugLog('rpc-request-aborted', error, {
                method: pending.meta.method,
                canvasId: pending.meta.canvasId ?? null,
                filePath: pending.meta.filePath ?? null,
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

    const sendRequest = useCallback(async (method: string, params: Record<string, unknown>): Promise<unknown> => {
        return new Promise((resolve, reject) => {
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
                    filePath: typeof params.filePath === 'string' ? params.filePath : undefined,
                    nodeId: typeof params.nodeId === 'string' ? params.nodeId : undefined,
                    commandType: typeof params.commandType === 'string' ? params.commandType : undefined,
                },
            });

            setTimeout(() => {
                const pending = pendingRequestsRef.current.get(id);
                if (pending) {
                    pendingRequestsRef.current.delete(id);
                    const timeoutError = new Error(`Request timeout: ${method}`);
                    editDebugLog('rpc-request-timeout', timeoutError, {
                        method: pending.meta.method,
                        canvasId: pending.meta.canvasId ?? null,
                        filePath: pending.meta.filePath ?? null,
                        nodeId: pending.meta.nodeId ?? null,
                        commandType: pending.meta.commandType ?? null,
                        durationMs: Date.now() - pending.meta.startedAt,
                        wsUrl: wsUrlRef.current,
                        readyState: wsRef.current?.readyState ?? null,
                    });
                    pending.reject(timeoutError);
                }
            }, REQUEST_TIMEOUT);

            wsRef.current.send(JSON.stringify(request));
        });
    }, []);

    const handleMessage = useCallback((event: MessageEvent) => {
        let data: JsonRpcResponse;
        try {
            data = JSON.parse(event.data);
        } catch {
            console.error('[FileSync] Failed to parse message:', event.data);
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

        if (data.method === 'file.changed') {
            const changedFile = (
                typeof data.params?.resolvedFilePath === 'string'
                    ? data.params.resolvedFilePath
                    : data.params?.filePath
            ) as string;
            if (typeof changedFile !== 'string' || changedFile.length === 0) {
                return;
            }
            if (watchedFilesRef.current.has(changedFile)) {
                const incomingVersion = data.params?.version;
                const incomingOriginId = data.params?.originId;
                const incomingCommandId = data.params?.commandId;
                const incomingCanvasId = typeof data.params?.canvasId === 'string' ? data.params.canvasId : undefined;
                const { clientId, lastAppliedCommandId, setSourceVersionForFile, setCanvasVersion } = useGraphStore.getState();
                pruneExpiredOwnCommands(recentOwnCommandsRef.current, Date.now());

                if (typeof incomingVersion === 'string') {
                    setSourceVersionForFile(changedFile, incomingVersion);
                    if (incomingCanvasId) {
                        setCanvasVersion(incomingCanvasId, incomingVersion);
                    }
                }

                const shouldReload = shouldReloadForFileChange({
                    changedFile,
                    currentFile: currentCompatibilityFilePathRef.current,
                    changedCanvasId: incomingCanvasId,
                    currentCanvasId: currentCanvasIdRef.current,
                    watchedFiles: watchedFilesRef.current,
                    incomingOriginId,
                    incomingCommandId,
                    clientId,
                    recentOwnCommandIds: new Set(recentOwnCommandsRef.current.keys()),
                    lastAppliedCommandId,
                });

                if (!shouldReload) {
                    console.log('[FileSync] Ignored self-origin file.changed');
                    return;
                }

                onFileChange();
            }
        }

        if (data.method === 'files.changed') {
            onFilesChange?.();
        }
    }, [onFileChange, onFilesChange]);

    useEffect(() => {
        if (watchedFiles.length === 0) return;

        currentCanvasIdRef.current = canvasId;
        currentCompatibilityFilePathRef.current = compatibilityFilePath;
        watchedFilesRef.current = new Set(watchedFiles);
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
                sendRequest('file.subscribe', {
                    canvasId,
                    ...(workspaceRootPath ? { rootPath: workspaceRootPath } : {}),
                }).catch((err) => console.error('[FileSync] Subscribe failed:', err));
            }
            watchedFiles.forEach((watchedFilePath) => {
                if (watchedFilePath === compatibilityFilePath && canvasId) {
                    return;
                }
                sendRequest('file.subscribe', {
                    filePath: watchedFilePath,
                    ...(workspaceRootPath ? { rootPath: workspaceRootPath } : {}),
                }).catch((err) => console.error('[FileSync] Subscribe failed:', err));
            });
        };

        ws.onmessage = handleMessage;
        ws.onerror = (error) => console.error('[FileSync] WebSocket error:', error);
        ws.onclose = () => {
            rejectPendingRequests('WebSocket disconnected before response');
            console.log('[FileSync] Disconnected from server');
        };

        return () => {
            rejectPendingRequests('WebSocket connection was reset');
            ws.close();
            if (wsRef.current === ws) {
                wsRef.current = null;
            }
            watchedFilesRef.current = new Set();
        };
    }, [canvasId, compatibilityFilePath, handleMessage, rejectPendingRequests, sendRequest, watchedFiles, watchedFilesSignature, workspaceRootPath]);

    const withCommon = useCallback((params: Record<string, unknown>) => {
        const targetCanvasId = typeof params.canvasId === 'string' ? params.canvasId : canvasId;
        if (!targetCanvasId) {
            throw new Error('CANVAS_ID_NOT_READY');
        }

        const { sourceVersion, canvasVersions, clientId } = useGraphStore.getState();
        const baseVersion = canvasVersions[targetCanvasId]
            ?? (targetCanvasId === canvasId ? sourceVersion : null);
        // Client-only draft placeholders must be materialized before mutations run.
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
        if (typed?.newVersion) {
            if (typed.canvasId) {
                useGraphStore.getState().setCanvasVersion(typed.canvasId, typed.newVersion);
            }
            const versionFilePath = typed.resolvedFilePath ?? typed.filePath;
            if (versionFilePath) {
                useGraphStore.getState().setSourceVersionForFile(versionFilePath, typed.newVersion);
            } else {
                useGraphStore.getState().setSourceVersion(resolvedVersion);
            }
        }
        if (typed?.commandId) {
            rememberOwnCommand(recentOwnCommandsRef.current, typed.commandId, Date.now());
            useGraphStore.getState().setLastAppliedCommandId(typed.commandId);
        }
        return resolvedVersion && !typed.newVersion
            ? { ...typed, newVersion: resolvedVersion }
            : typed;
    }, []);

    const resolveMutationTarget = useCallback((
        targetCompatibilityFilePath?: string | null,
        targetCanvasId?: string | null,
    ): { canvasId: string | null; compatibilityFilePath: string | null } => {
        if (targetCanvasId) {
            return {
                canvasId: targetCanvasId,
                compatibilityFilePath: targetCompatibilityFilePath ?? compatibilityFilePath,
            };
        }

        if (looksLikeCompatibilityPath(targetCompatibilityFilePath)) {
            return {
                canvasId,
                compatibilityFilePath: targetCompatibilityFilePath ?? compatibilityFilePath,
            };
        }

        return {
            canvasId: targetCompatibilityFilePath ?? canvasId,
            compatibilityFilePath,
        };
    }, [canvasId, compatibilityFilePath]);

    const mutationExecutor = useMemo(() => createPerFileMutationExecutor({
        sendRequest: (method, params) => sendRequest(method, params),
        buildCommonParams: withCommon,
        applyResultVersion,
        onVersionConflictActual: (actualVersion) => {
            useGraphStore.getState().setSourceVersion(actualVersion);
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
        targetCompatibilityFilePath: string | null = compatibilityFilePath,
        options?: UpdateNodeMutationOptions,
        targetCanvasId?: string | null,
    ): Promise<RpcMutationResult> => {
        const target = resolveMutationTarget(targetCompatibilityFilePath, targetCanvasId);
        const resolvedCanvasId = target.canvasId;
        if (!resolvedCanvasId) return {};
        return mutationExecutor.enqueueMutation({
            method: 'node.update',
            canvasId: resolvedCanvasId as string,
            buildParams: () => ({
                canvasId: resolvedCanvasId,
                nodeId,
                props,
                ...(options?.commandType ? { commandType: options.commandType } : {}),
            }),
        });
    }, [compatibilityFilePath, mutationExecutor, resolveMutationTarget]);

    const moveNode = useCallback(async (
        nodeId: string,
        x: number,
        y: number,
        targetCompatibilityFilePath: string | null = compatibilityFilePath,
        targetCanvasId?: string | null,
    ): Promise<RpcMutationResult> => {
        const target = resolveMutationTarget(targetCompatibilityFilePath, targetCanvasId);
        if (!target.canvasId) return {};
        return mutationExecutor.enqueueMutation({
            method: 'node.move',
            canvasId: target.canvasId,
            buildParams: () => ({ canvasId: target.canvasId, nodeId, x, y }),
        });
    }, [compatibilityFilePath, mutationExecutor, resolveMutationTarget]);

    const createNode = useCallback(async (
        node: Record<string, unknown>,
        targetCompatibilityFilePath: string | null = compatibilityFilePath,
        targetCanvasId?: string | null,
    ): Promise<RpcMutationResult> => {
        const target = resolveMutationTarget(targetCompatibilityFilePath, targetCanvasId);
        if (!target.canvasId) {
            throw new Error('SOURCE_VERSION_NOT_READY');
        }
        return mutationExecutor.enqueueMutation({
            method: 'node.create',
            canvasId: target.canvasId,
            buildParams: () => ({ canvasId: target.canvasId, node }),
        });
    }, [compatibilityFilePath, mutationExecutor, resolveMutationTarget]);

    const deleteNode = useCallback(async (
        nodeId: string,
        targetCompatibilityFilePath: string | null = compatibilityFilePath,
        targetCanvasId?: string | null,
    ): Promise<RpcMutationResult> => {
        const target = resolveMutationTarget(targetCompatibilityFilePath, targetCanvasId);
        if (!target.canvasId) return {};
        return mutationExecutor.enqueueMutation({
            method: 'node.delete',
            canvasId: target.canvasId,
            buildParams: () => ({ canvasId: target.canvasId, nodeId }),
        });
    }, [compatibilityFilePath, mutationExecutor, resolveMutationTarget]);

    const reparentNode = useCallback(async (
        nodeId: string,
        newParentId?: string | null,
        targetCompatibilityFilePath: string | null = compatibilityFilePath,
        targetCanvasId?: string | null,
    ): Promise<RpcMutationResult> => {
        const target = resolveMutationTarget(targetCompatibilityFilePath, targetCanvasId);
        if (!target.canvasId) return {};
        return mutationExecutor.enqueueMutation({
            method: 'node.reparent',
            canvasId: target.canvasId,
            buildParams: () => ({
                canvasId: target.canvasId,
                nodeId,
                ...(newParentId ? { newParentId } : {}),
            }),
        });
    }, [compatibilityFilePath, mutationExecutor, resolveMutationTarget]);

    const applyEventSnapshot = useCallback(async (
        event: EditCompletionEvent,
        direction: 'before' | 'after',
    ): Promise<void> => {
        await applyEditCompletionSnapshot(event, direction, {
            moveNode,
            updateNode,
            createNode,
            deleteNode,
            reparentNode,
        });
    }, [createNode, deleteNode, moveNode, reparentNode, updateNode]);

    const undoLastEdit = useCallback(async (): Promise<boolean> => {
        const state = useGraphStore.getState();
        const event = state.peekUndoEditEvent();
        if (!event) {
            return false;
        }
        await applyEventSnapshot(event, 'before');
        useGraphStore.getState().commitUndoEventSuccess(event.eventId);
        if (shouldReloadAfterHistoryReplay(event)) {
            onFileChange();
        }
        return true;
    }, [applyEventSnapshot, onFileChange]);

    const redoLastEdit = useCallback(async (): Promise<boolean> => {
        const state = useGraphStore.getState();
        const event = state.peekRedoEditEvent();
        if (!event) {
            return false;
        }
        await applyEventSnapshot(event, 'after');
        useGraphStore.getState().commitRedoEventSuccess(event.eventId);
        if (shouldReloadAfterHistoryReplay(event)) {
            onFileChange();
        }
        return true;
    }, [applyEventSnapshot, onFileChange]);

    return { updateNode, moveNode, createNode, deleteNode, reparentNode, undoLastEdit, redoLastEdit };
}
