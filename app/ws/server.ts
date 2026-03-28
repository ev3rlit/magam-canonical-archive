/**
 * WebSocket Server with JSON-RPC 2.0
 *
 * Run: bun run app/ws/server.ts
 */
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
} from './routes';
import type { RpcContext } from './shared/params';
import {
    createCanvasSubscriptionKey,
    isCanvasSubscriptionKey,
    WS_NOTIFICATION_METHODS,
} from './shared/subscriptions';
import { WS_SERVER_MESSAGES } from './messages';

const PORT = parseInt(process.env.MAGAM_WS_PORT || '3001', 10);

// Client connections with their subscriptions
const clients = new Map<unknown, Set<string>>();

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
                notifyCanvasChanged: broadcastCanvasChanged,
            };

            try {
                const result = await handler(request.params || {}, ctx);
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

// Graceful shutdown
process.on('SIGINT', () => {
    console.log(WS_SERVER_MESSAGES.shuttingDown);
    server.stop();
    process.exit(0);
});
