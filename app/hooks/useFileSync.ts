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
    normalizeWatchedFiles,
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

export function useFileSync(
    filePath: string | null,
    onFileChange: () => void,
    onFilesChange?: () => void,
    dependencyFiles: string[] = [],
) {
    const wsRef = useRef<WebSocket | null>(null);
    const pendingRequestsRef = useRef<Map<number, PendingRequestEntry>>(new Map());
    const currentFileRef = useRef<string | null>(null);
    const watchedFilesRef = useRef<Set<string>>(new Set());
    const wsUrlRef = useRef<string>(resolveFileSyncWsUrl());
    const recentOwnCommandsRef = useRef<Map<string, number>>(new Map());
    const dependencyFilesSignature = useMemo(
        () => buildWatchedFilesSignature([...dependencyFiles].sort()),
        [dependencyFiles],
    );
    const watchedFiles = useMemo(
        () => normalizeWatchedFiles(filePath, dependencyFiles),
        [dependencyFilesSignature, filePath],
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
            const changedFile = data.params?.filePath as string;
            if (watchedFilesRef.current.has(changedFile)) {
                const incomingVersion = data.params?.version;
                const incomingOriginId = data.params?.originId;
                const incomingCommandId = data.params?.commandId;
                const { clientId, lastAppliedCommandId, setSourceVersionForFile } = useGraphStore.getState();
                pruneExpiredOwnCommands(recentOwnCommandsRef.current, Date.now());

                if (typeof incomingVersion === 'string') {
                    setSourceVersionForFile(changedFile, incomingVersion);
                }

                const shouldReload = shouldReloadForFileChange({
                    changedFile,
                    currentFile: currentFileRef.current,
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

        currentFileRef.current = filePath;
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
            watchedFiles.forEach((watchedFilePath) => {
                sendRequest('file.subscribe', { filePath: watchedFilePath }).catch((err) => console.error('[FileSync] Subscribe failed:', err));
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
    }, [filePath, handleMessage, rejectPendingRequests, sendRequest, watchedFiles, watchedFilesSignature]);

    const withCommon = useCallback((params: Record<string, unknown>) => {
        const targetFilePath = typeof params.filePath === 'string' ? params.filePath : filePath;
        if (!targetFilePath) {
            throw new Error('FILE_PATH_NOT_READY');
        }

        const { sourceVersion, sourceVersions, clientId } = useGraphStore.getState();
        const baseVersion = sourceVersions[targetFilePath]
            ?? (targetFilePath === filePath ? sourceVersion : null);
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
            originId: clientId,
            commandId,
        };
    }, [filePath]);

    const applyResultVersion = useCallback((result: unknown): RpcMutationResult => {
        const typed = result as RpcMutationResult;
        if (typed?.newVersion) {
            if (typed.filePath) {
                useGraphStore.getState().setSourceVersionForFile(typed.filePath, typed.newVersion);
            } else {
                useGraphStore.getState().setSourceVersion(typed.newVersion);
            }
        }
        if (typed?.commandId) {
            rememberOwnCommand(recentOwnCommandsRef.current, typed.commandId, Date.now());
            useGraphStore.getState().setLastAppliedCommandId(typed.commandId);
        }
        return typed;
    }, []);

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
                filePath: event.filePath,
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
        targetFilePath: string | null = filePath,
        options?: UpdateNodeMutationOptions,
    ): Promise<RpcMutationResult> => {
        if (!targetFilePath) return {};
        return mutationExecutor.enqueueMutation({
            method: 'node.update',
            filePath: targetFilePath,
            buildParams: () => ({
                filePath: targetFilePath,
                nodeId,
                props,
                ...(options?.commandType ? { commandType: options.commandType } : {}),
            }),
        });
    }, [filePath, mutationExecutor]);

    const moveNode = useCallback(async (
        nodeId: string,
        x: number,
        y: number,
        targetFilePath: string | null = filePath,
    ): Promise<RpcMutationResult> => {
        if (!targetFilePath) return {};
        return mutationExecutor.enqueueMutation({
            method: 'node.move',
            filePath: targetFilePath,
            buildParams: () => ({ filePath: targetFilePath, nodeId, x, y }),
        });
    }, [filePath, mutationExecutor]);

    const createNode = useCallback(async (
        node: Record<string, unknown>,
        targetFilePath: string | null = filePath,
    ): Promise<RpcMutationResult> => {
        if (!targetFilePath) {
            throw new Error('SOURCE_VERSION_NOT_READY');
        }
        return mutationExecutor.enqueueMutation({
            method: 'node.create',
            filePath: targetFilePath,
            buildParams: () => ({ filePath: targetFilePath, node }),
        });
    }, [filePath, mutationExecutor]);

    const deleteNode = useCallback(async (
        nodeId: string,
        targetFilePath: string | null = filePath,
    ): Promise<RpcMutationResult> => {
        if (!targetFilePath) return {};
        return mutationExecutor.enqueueMutation({
            method: 'node.delete',
            filePath: targetFilePath,
            buildParams: () => ({ filePath: targetFilePath, nodeId }),
        });
    }, [filePath, mutationExecutor]);

    const reparentNode = useCallback(async (
        nodeId: string,
        newParentId?: string | null,
        targetFilePath: string | null = filePath,
    ): Promise<RpcMutationResult> => {
        if (!targetFilePath) return {};
        return mutationExecutor.enqueueMutation({
            method: 'node.reparent',
            filePath: targetFilePath,
            buildParams: () => ({
                filePath: targetFilePath,
                nodeId,
                ...(newParentId ? { newParentId } : {}),
            }),
        });
    }, [filePath, mutationExecutor]);

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
