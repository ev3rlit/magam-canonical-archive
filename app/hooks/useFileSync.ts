/**
 * useFileSync Hook - WebSocket client for file synchronization
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useGraphStore } from '@/store/graph';
import type { EditCompletionEvent } from '@/store/graph';
import { editDebugLog, isEditDebugEnabled } from '@/utils/editDebug';

const REQUEST_TIMEOUT = 5000;
const OWN_COMMAND_TTL_MS = 60_000;

export const MAX_VERSION_CONFLICT_RETRY = 1;
export const VERSION_CONFLICT_METRIC_WINDOW_MS = 10 * 60 * 1000;
export const VERSION_CONFLICT_RATE_THRESHOLD = 0.02;

type MutationMethod = 'node.update' | 'node.move' | 'node.create' | 'node.delete' | 'node.reparent';
type UpdateNodeCommandType =
    | 'node.move.relative'
    | 'node.content.update'
    | 'node.style.update'
    | 'node.rename';

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

export interface RpcMutationResult {
    success?: boolean;
    newVersion?: string;
    commandId?: string;
    filePath?: string;
}

export interface UpdateNodeMutationOptions {
    commandType?: UpdateNodeCommandType;
}

export interface EditEventMutators {
    moveNode: (nodeId: string, x: number, y: number, targetFilePath?: string | null) => Promise<unknown>;
    updateNode: (
        nodeId: string,
        props: Record<string, unknown>,
        targetFilePath?: string | null,
        options?: UpdateNodeMutationOptions,
    ) => Promise<unknown>;
    createNode: (node: Record<string, unknown>, targetFilePath?: string | null) => Promise<unknown>;
    deleteNode: (nodeId: string, targetFilePath?: string | null) => Promise<unknown>;
    reparentNode: (nodeId: string, newParentId?: string | null, targetFilePath?: string | null) => Promise<unknown>;
}

type VersionConflictData = {
    expected?: unknown;
    actual?: unknown;
};

type VersionConflictErrorLike = {
    code?: unknown;
    message?: unknown;
    data?: unknown;
};

export interface VersionConflictMetricsSnapshot {
    windowMs: number;
    threshold: number;
    mutationTotal10m: number;
    versionConflictTotal10m: number;
    versionConflictRate10m: number;
    shouldEnableServerMutex: boolean;
    updatedAt: number;
}

export interface VersionConflictMetricsTracker {
    recordMutation: () => VersionConflictMetricsSnapshot;
    recordVersionConflict: () => VersionConflictMetricsSnapshot;
    getSnapshot: () => VersionConflictMetricsSnapshot;
    reset: () => void;
}

type RetryEvent = {
    method: MutationMethod;
    filePath: string;
    attempt: number;
    maxRetry: number;
    expected?: string;
    actual?: string;
    metrics: VersionConflictMetricsSnapshot;
    error: unknown;
};

type CreateMutationExecutorInput = {
    sendRequest: (method: MutationMethod, params: Record<string, unknown>) => Promise<unknown>;
    buildCommonParams: (params: Record<string, unknown>) => Record<string, unknown>;
    applyResultVersion: (result: unknown) => RpcMutationResult;
    onVersionConflictActual?: (actualVersion: string) => void;
    onConflictRetry?: (event: RetryEvent) => void;
    metricsTracker?: VersionConflictMetricsTracker;
};

type EnqueueMutationInput = {
    method: MutationMethod;
    filePath: string;
    buildParams: () => Record<string, unknown>;
};

declare global {
    interface Window {
        __MAGAM_EDIT_METRICS__?: Readonly<{
            getSnapshot: () => VersionConflictMetricsSnapshot;
            reset: () => void;
        }>;
    }
}

export class RpcClientError extends Error {
    code: number;
    data?: unknown;

    constructor(code: number, message: string, data?: unknown) {
        super(message);
        this.name = 'RpcClientError';
        this.code = code;
        this.data = data;
    }
}

let requestIdCounter = 0;

export function resolveFileSyncWsUrl(input?: {
    port?: string;
    location?: {
        protocol?: string;
        hostname?: string;
    };
}): string {
    const port = input?.port ?? process.env.NEXT_PUBLIC_MAGAM_WS_PORT ?? '3001';
    const protocol = input?.location?.protocol === 'https:' ? 'wss' : 'ws';
    const hostname = input?.location?.hostname || 'localhost';
    return `${protocol}://${hostname}:${port}`;
}

export function normalizeWatchedFiles(filePath: string | null, dependencyFiles: string[]): string[] {
    return Array.from(new Set(
        [filePath, ...dependencyFiles].filter((value): value is string => typeof value === 'string' && value.length > 0),
    )).sort();
}

export function buildWatchedFilesSignature(files: string[]): string {
    return files.join('\n');
}

function pruneExpiredOwnCommands(commands: Map<string, number>, now: number): void {
    commands.forEach((issuedAt, commandId) => {
        if ((now - issuedAt) > OWN_COMMAND_TTL_MS) {
            commands.delete(commandId);
        }
    });
}

function rememberOwnCommand(commands: Map<string, number>, commandId: string, now: number): void {
    pruneExpiredOwnCommands(commands, now);
    commands.set(commandId, now);
}

function pruneExpiredTimestamps(timestamps: number[], now: number, windowMs: number): void {
    while (timestamps.length > 0 && (now - timestamps[0]) > windowMs) {
        timestamps.shift();
    }
}

function toOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function extractVersionConflictVersions(error: unknown): { expected?: string; actual?: string } {
    const data = (error as VersionConflictErrorLike)?.data as VersionConflictData | undefined;
    return {
        expected: toOptionalString(data?.expected),
        actual: toOptionalString(data?.actual),
    };
}

export function isVersionConflictError(error: unknown): error is VersionConflictErrorLike {
    const candidate = error as VersionConflictErrorLike | undefined;
    if (!candidate) return false;
    return candidate.code === 40901 || candidate.message === 'VERSION_CONFLICT';
}

export function createVersionConflictMetricsTracker(input?: {
    windowMs?: number;
    threshold?: number;
    now?: () => number;
}): VersionConflictMetricsTracker {
    const mutationTimestamps: number[] = [];
    const versionConflictTimestamps: number[] = [];
    const windowMs = input?.windowMs ?? VERSION_CONFLICT_METRIC_WINDOW_MS;
    const threshold = input?.threshold ?? VERSION_CONFLICT_RATE_THRESHOLD;
    const now = input?.now ?? Date.now;

    const buildSnapshot = (): VersionConflictMetricsSnapshot => {
        const timestamp = now();
        pruneExpiredTimestamps(mutationTimestamps, timestamp, windowMs);
        pruneExpiredTimestamps(versionConflictTimestamps, timestamp, windowMs);

        const mutationTotal10m = mutationTimestamps.length;
        const versionConflictTotal10m = versionConflictTimestamps.length;
        const versionConflictRate10m = mutationTotal10m === 0
            ? 0
            : versionConflictTotal10m / mutationTotal10m;

        return {
            windowMs,
            threshold,
            mutationTotal10m,
            versionConflictTotal10m,
            versionConflictRate10m,
            shouldEnableServerMutex: versionConflictRate10m >= threshold,
            updatedAt: timestamp,
        };
    };

    return {
        recordMutation: () => {
            mutationTimestamps.push(now());
            return buildSnapshot();
        },
        recordVersionConflict: () => {
            versionConflictTimestamps.push(now());
            return buildSnapshot();
        },
        getSnapshot: () => buildSnapshot(),
        reset: () => {
            mutationTimestamps.length = 0;
            versionConflictTimestamps.length = 0;
        },
    };
}

export function createPerFileMutationExecutor(input: CreateMutationExecutorInput): {
    enqueueMutation: (mutation: EnqueueMutationInput) => Promise<RpcMutationResult>;
    getMetricsSnapshot: () => VersionConflictMetricsSnapshot;
    resetMetrics: () => void;
} {
    const queueTails = new Map<string, Promise<void>>();
    const metrics = input.metricsTracker ?? createVersionConflictMetricsTracker();

    const executeWithRetry = async (mutation: EnqueueMutationInput): Promise<RpcMutationResult> => {
        metrics.recordMutation();

        let retryAttempt = 0;
        while (true) {
            try {
                const params = input.buildCommonParams(mutation.buildParams());
                const result = await input.sendRequest(mutation.method, params);
                return input.applyResultVersion(result);
            } catch (error) {
                if (!isVersionConflictError(error)) {
                    throw error;
                }

                const { expected, actual } = extractVersionConflictVersions(error);
                const metricsSnapshot = metrics.recordVersionConflict();

                if (retryAttempt >= MAX_VERSION_CONFLICT_RETRY) {
                    throw error;
                }

                retryAttempt += 1;
                if (actual) {
                    input.onVersionConflictActual?.(actual);
                }
                input.onConflictRetry?.({
                    method: mutation.method,
                    filePath: mutation.filePath,
                    attempt: retryAttempt,
                    maxRetry: MAX_VERSION_CONFLICT_RETRY,
                    expected,
                    actual,
                    metrics: metricsSnapshot,
                    error,
                });
            }
        }
    };

    const enqueueMutation = async (mutation: EnqueueMutationInput): Promise<RpcMutationResult> => {
        const previousTail = queueTails.get(mutation.filePath) || Promise.resolve();
        const run = previousTail
            .catch(() => undefined)
            .then(() => executeWithRetry(mutation));

        const nextTail = run.then(() => undefined, () => undefined);
        queueTails.set(mutation.filePath, nextTail);
        nextTail.finally(() => {
            if (queueTails.get(mutation.filePath) === nextTail) {
                queueTails.delete(mutation.filePath);
            }
        });

        return run;
    };

    return {
        enqueueMutation,
        getMetricsSnapshot: () => metrics.getSnapshot(),
        resetMetrics: () => metrics.reset(),
    };
}

export function shouldReloadAfterHistoryReplay(event: EditCompletionEvent): boolean {
    return (
        event.type === 'NODE_RENAMED'
        || event.type === 'NODE_CREATED'
        || event.type === 'NODE_REPARENTED'
    );
}

export async function applyEditCompletionSnapshot(
    event: EditCompletionEvent,
    direction: 'before' | 'after',
    mutators: EditEventMutators,
): Promise<void> {
    const snapshot = direction === 'before' ? event.before : event.after;

    if (event.type === 'ABSOLUTE_MOVE_COMMITTED') {
        const x = snapshot.x;
        const y = snapshot.y;
        if (typeof x !== 'number' || typeof y !== 'number') {
            throw new Error('INVALID_EVENT_SNAPSHOT');
        }
        await mutators.moveNode(event.nodeId, x, y, event.filePath);
        return;
    }

    if (event.type === 'TEXT_EDIT_COMMITTED' || event.type === 'CONTENT_UPDATED') {
        const content = snapshot.content;
        if (typeof content !== 'string') {
            throw new Error('INVALID_EVENT_SNAPSHOT');
        }
        await mutators.updateNode(event.nodeId, { content }, event.filePath, {
            commandType: 'node.content.update',
        });
        return;
    }

    if (event.type === 'STYLE_UPDATED') {
        await mutators.updateNode(event.nodeId, snapshot, event.filePath, {
            commandType: 'node.style.update',
        });
        return;
    }

    if (event.type === 'NODE_RENAMED') {
        const beforeId = event.before.id;
        const afterId = event.after.id;
        if (typeof beforeId !== 'string' || typeof afterId !== 'string') {
            throw new Error('INVALID_EVENT_SNAPSHOT');
        }
        const targetNodeId = direction === 'before' ? afterId : beforeId;
        const nextId = direction === 'before' ? beforeId : afterId;
        await mutators.updateNode(targetNodeId, { id: nextId }, event.filePath, {
            commandType: 'node.rename',
        });
        return;
    }

    if (event.type === 'NODE_CREATED') {
        const createInput = event.after.create;
        if (!createInput || typeof createInput !== 'object') {
            throw new Error('INVALID_EVENT_SNAPSHOT');
        }
        if (direction === 'before') {
            const createdId = (createInput as { id?: unknown }).id;
            if (typeof createdId !== 'string') {
                throw new Error('INVALID_EVENT_SNAPSHOT');
            }
            await mutators.deleteNode(createdId, event.filePath);
            return;
        }
        await mutators.createNode(createInput as Record<string, unknown>, event.filePath);
        return;
    }

    if (event.type === 'NODE_REPARENTED') {
        const parentId = 'parentId' in snapshot ? snapshot.parentId : undefined;
        if (parentId !== null && parentId !== undefined && typeof parentId !== 'string') {
            throw new Error('INVALID_EVENT_SNAPSHOT');
        }
        await mutators.reparentNode(event.nodeId, parentId ?? undefined, event.filePath);
        return;
    }

    const patchProps: Record<string, unknown> = {};
    if ('gap' in snapshot && typeof snapshot.gap === 'number') {
        patchProps.gap = snapshot.gap;
    }
    if ('at' in snapshot && snapshot.at && typeof snapshot.at === 'object') {
        patchProps.at = snapshot.at;
    }
    if (Object.keys(patchProps).length === 0) {
        throw new Error('INVALID_EVENT_SNAPSHOT');
    }
    await mutators.updateNode(event.nodeId, patchProps, event.filePath, {
        commandType: 'node.move.relative',
    });
}

export function shouldReloadForFileChange(input: {
    changedFile: string;
    currentFile: string | null;
    watchedFiles: Set<string>;
    incomingOriginId?: unknown;
    incomingCommandId?: unknown;
    clientId: string;
    recentOwnCommandIds?: Set<string>;
    lastAppliedCommandId?: string;
}): boolean {
    if (!input.watchedFiles.has(input.changedFile)) return false;

    const isSelfEvent =
        input.incomingOriginId === input.clientId &&
        typeof input.incomingCommandId === 'string';

    if (isSelfEvent && input.recentOwnCommandIds?.has(input.incomingCommandId as string)) {
        return false;
    }

    const isCurrentFileSelfEvent =
        input.changedFile === input.currentFile &&
        isSelfEvent &&
        input.incomingCommandId === input.lastAppliedCommandId;

    return !isCurrentFileSelfEvent;
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
        if (!baseVersion) {
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
