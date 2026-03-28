/**
 * WebSocket Server with JSON-RPC 2.0 and File Watching
 * 
 * Run: bun run app/ws/server.ts
 */

import { watch } from 'chokidar';
import { isAbsolute, resolve } from 'path';
import { readFile } from 'fs/promises';
import { createHash } from 'crypto';
import {
    createResponse,
    createErrorResponse,
    createNotification,
    isValidRequest,
    RPC_ERRORS,
    type JsonRpcRequest,
} from './rpc';
import {
    getRouteHandler,
    isCompatibilitySubscriptionMethod,
} from './routes';
import type { RpcContext } from './shared/params';
import {
    createCanvasSubscriptionKey,
    isCanvasSubscriptionKey,
    matchesFileSubscription,
    WS_NOTIFICATION_METHODS,
} from './shared/subscriptions';
import { WS_SERVER_MESSAGES } from './messages';

const PORT = parseInt(process.env.MAGAM_WS_PORT || '3001', 10);
const WATCH_DIR = process.env.MAGAM_TARGET_DIR || './examples';

// Client connections with their subscriptions
const clients = new Map<unknown, Set<string>>();
const watchedCompatibilitySubscriptionPaths = new Set<string>();

const COMMAND_EVENT_TTL_MS = 3000;
const recentCommandEvents = new Map<string, number>();

console.log(WS_SERVER_MESSAGES.starting(PORT));

const server = Bun.serve({
    port: PORT,
    fetch(req, server) {
        // Upgrade HTTP to WebSocket
        const success = server.upgrade(req);
        if (success) return undefined;

        // Non-WebSocket request
        return new Response(WS_SERVER_MESSAGES.serverBanner, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
        });
    },
    websocket: {
        open(ws) {
            clients.set(ws, new Set());
            console.log(WS_SERVER_MESSAGES.clientConnected(clients.size));
        },

        async message(ws, msg) {
            const msgStr = typeof msg === 'string' ? msg : msg.toString();

            let request: JsonRpcRequest;
            try {
                request = JSON.parse(msgStr);
            } catch {
                ws.send(JSON.stringify(createErrorResponse(0, RPC_ERRORS.PARSE_ERROR.code, RPC_ERRORS.PARSE_ERROR.message)));
                return;
            }

            if (!isValidRequest(request)) {
                ws.send(JSON.stringify(createErrorResponse(0, RPC_ERRORS.INVALID_REQUEST.code, RPC_ERRORS.INVALID_REQUEST.message)));
                return;
            }

            // Notification (no id) - no response needed
            if (request.id === undefined) {
                console.log(WS_SERVER_MESSAGES.notificationReceived(request.method));
                return;
            }

            // Find handler
            const handler = getRouteHandler(request.method);
            if (!handler) {
                ws.send(JSON.stringify(createErrorResponse(
                    request.id,
                    RPC_ERRORS.METHOD_NOT_FOUND.code,
                    RPC_ERRORS.METHOD_NOT_FOUND.message
                )));
                return;
            }

            // Execute handler
            const ctx: RpcContext = {
                ws,
                subscriptions: clients.get(ws)!,
                notifyFileChanged: broadcastFileChanged,
                notifyCanvasChanged: broadcastCanvasChanged,
            };

            try {
                const result = await handler(request.params || {}, ctx);
                if (isCompatibilitySubscriptionMethod(request.method)) {
                    ctx.subscriptions.forEach((subscriptionPath) => {
                        if (isCanvasSubscriptionKey(subscriptionPath)) {
                            return;
                        }
                        ensureWatchedSubscriptionPath(subscriptionPath);
                    });
                }
                ws.send(JSON.stringify(createResponse(request.id, result)));
            } catch (error) {
                const err = error as { code?: number; message?: string; data?: unknown };
                ws.send(JSON.stringify(createErrorResponse(
                    request.id,
                    err.code || RPC_ERRORS.INTERNAL_ERROR.code,
                    err.message || RPC_ERRORS.INTERNAL_ERROR.message,
                    err.data
                )));
            }
        },

        close(ws) {
            clients.delete(ws);
            console.log(WS_SERVER_MESSAGES.clientDisconnected(clients.size));
        },
    },
});

console.log(WS_SERVER_MESSAGES.runningAt(PORT));

// File watcher
const watchPath = resolve(process.cwd(), WATCH_DIR);
console.log(WS_SERVER_MESSAGES.watchingPath(watchPath));

const watcher = watch(watchPath, {
    ignoreInitial: true,
    ignored: /(^|[\/\\])\../, // ignore dotfiles
});

function sendWsNotification(
    ws: unknown,
    method: string,
    params: Record<string, unknown>,
): void {
    (ws as { send: (data: string) => void }).send(
        JSON.stringify(createNotification(method, params))
    );
}

function forEachCanvasSubscriber(
    canvasId: string,
    callback: (ws: unknown) => void,
): void {
    clients.forEach((subscriptions, ws) => {
        if (!subscriptions.has(createCanvasSubscriptionKey(canvasId))) {
            return;
        }
        callback(ws);
    });
}

function forEachFileSubscriber(
    resolvedFilePath: string,
    callback: (ws: unknown) => void,
): void {
    clients.forEach((subscriptions, ws) => {
        let matched = false;
        for (const sub of subscriptions) {
            if (isCanvasSubscriptionKey(sub)) {
                continue;
            }
            if (matchesFileSubscription(resolvedFilePath, sub)) {
                matched = true;
                break;
            }
        }

        if (matched) {
            callback(ws);
        }
    });
}

function resolveCompatibilitySubscribedWatchPath(filePath: string, rootPath?: string): string {
    if (isAbsolute(filePath)) {
        return filePath;
    }

    return resolve(rootPath || watchPath, filePath);
}

function ensureWatchedSubscriptionPath(filePath: string, rootPath?: string): void {
    const resolvedPath = resolveCompatibilitySubscribedWatchPath(filePath, rootPath);
    if (watchedCompatibilitySubscriptionPaths.has(resolvedPath)) {
        return;
    }

    watcher.add(resolvedPath);
    watchedCompatibilitySubscriptionPaths.add(resolvedPath);
}

/**
 * Broadcast file list update to all connected clients
 */
function broadcastCompatibilityFileListUpdate(event: 'add' | 'unlink', filePath: string) {
    // Extract relative path from the full path
    const relativePath = filePath.startsWith(`${watchPath}/`)
        ? filePath.replace(`${watchPath}/`, '')
        : filePath;

    clients.forEach((_, ws) => {
        sendWsNotification(ws, WS_NOTIFICATION_METHODS.filesChanged, {
            event,
            filePath: relativePath,
            timestamp: Date.now(),
        });
    });

    console.log(WS_SERVER_MESSAGES.broadcastCompatibilityFilesChanged(event, relativePath));
}

function broadcastCanvasChanged(payload: {
    canvasId: string;
    canvasRevision: number;
    originId: string;
    commandId: string;
    rootPath?: string;
}) {
    const now = Date.now();
    forEachCanvasSubscriber(payload.canvasId, (ws) => {
        sendWsNotification(ws, WS_NOTIFICATION_METHODS.canvasChanged, {
            canvasId: payload.canvasId,
            canvasRevision: payload.canvasRevision,
            originId: payload.originId,
            commandId: payload.commandId,
            timestamp: now,
            ...(payload.rootPath ? { rootPath: payload.rootPath } : {}),
        });
    });
    console.log(WS_SERVER_MESSAGES.broadcastCanvasChanged(payload.canvasId));
}

function broadcastFileChanged(payload: {
    canvasId?: string;
    filePath: string;
    resolvedFilePath: string;
    newVersion: string;
    originId: string;
    commandId: string;
    canvasRevision?: number;
    rootPath?: string;
}) {
    const now = Date.now();
    recentCommandEvents.set(payload.resolvedFilePath, now);
    if (payload.canvasId) {
        forEachCanvasSubscriber(payload.canvasId, (ws) => {
            sendWsNotification(ws, WS_NOTIFICATION_METHODS.canvasChanged, {
                canvasId: payload.canvasId,
                newVersion: payload.newVersion,
                ...(typeof payload.canvasRevision === 'number' ? { canvasRevision: payload.canvasRevision } : {}),
                originId: payload.originId,
                commandId: payload.commandId,
                timestamp: now,
                ...(payload.rootPath ? { rootPath: payload.rootPath } : {}),
            });
        });
        console.log(WS_SERVER_MESSAGES.broadcastCanvasChanged(payload.canvasId));
    }

    forEachFileSubscriber(payload.resolvedFilePath, (ws) => {
        sendWsNotification(ws, WS_NOTIFICATION_METHODS.fileChanged, {
            ...(payload.canvasId ? { canvasId: payload.canvasId } : {}),
            filePath: payload.filePath,
            resolvedFilePath: payload.resolvedFilePath,
            version: payload.newVersion,
            originId: payload.originId,
            commandId: payload.commandId,
            timestamp: now,
            ...(payload.rootPath ? { rootPath: payload.rootPath } : {}),
        });
    });

    console.log(WS_SERVER_MESSAGES.broadcastFileChanged(payload.resolvedFilePath));
}

watcher.on('change', async (filePath) => {
    console.log(WS_SERVER_MESSAGES.fileChanged(filePath));

    const now = Date.now();
    const lastCommandEventAt = recentCommandEvents.get(filePath);
    if (lastCommandEventAt && now - lastCommandEventAt <= COMMAND_EVENT_TTL_MS) {
        // Command path already emitted full payload; suppress duplicate watcher echo.
        recentCommandEvents.delete(filePath);
        return;
    }

    let version = 'sha256:unknown';
    try {
        const content = await readFile(filePath, 'utf-8');
        version = `sha256:${createHash('sha256').update(content).digest('hex')}`;
    } catch (error) {
        console.warn(WS_SERVER_MESSAGES.failedToHashChangedFile, filePath, error);
    }

    // Broadcast to subscribed clients
    forEachFileSubscriber(filePath, (ws) => {
        sendWsNotification(ws, WS_NOTIFICATION_METHODS.fileChanged, {
            filePath,
            resolvedFilePath: filePath,
            version,
            originId: 'external',
            commandId: `watch:${now}`,
            timestamp: now,
        });
        console.log(WS_SERVER_MESSAGES.notifiedClientAbout(filePath));
    });
});

watcher.on('add', (filePath) => {
    // Only handle .tsx files
    if (!filePath.endsWith('.tsx')) return;
    console.log(WS_SERVER_MESSAGES.fileAdded(filePath));
    broadcastCompatibilityFileListUpdate('add', filePath);
});

watcher.on('unlink', (filePath) => {
    // Only handle .tsx files
    if (!filePath.endsWith('.tsx')) return;
    console.log(WS_SERVER_MESSAGES.fileDeleted(filePath));
    broadcastCompatibilityFileListUpdate('unlink', filePath);
});

watcher.on('error', (error) => {
    console.error(WS_SERVER_MESSAGES.watcherError, error);
});

console.log(WS_SERVER_MESSAGES.watcherInitialized);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log(WS_SERVER_MESSAGES.shuttingDown);
    watcher.close();
    server.stop();
    process.exit(0);
});
