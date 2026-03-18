/**
 * JSON-RPC 2.0 Types and Utilities
 */

export interface JsonRpcRequest {
    jsonrpc: '2.0';
    id?: number | string;
    method: string;
    params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: number | string;
    result?: unknown;
    error?: JsonRpcError;
}

export interface JsonRpcNotification {
    jsonrpc: '2.0';
    method: string;
    params?: Record<string, unknown>;
}

export interface JsonRpcError {
    code: number;
    message: string;
    data?: unknown;
}

// Standard JSON-RPC Error Codes
export const RPC_ERRORS = {
    PARSE_ERROR: { code: -32700, message: 'Parse error' },
    INVALID_REQUEST: { code: -32600, message: 'Invalid Request' },
    METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
    INVALID_PARAMS: { code: 40001, message: 'INVALID_PARAMS' },
    INTERNAL_ERROR: { code: -32603, message: 'Internal error' },
    // Bidirectional-edit contract errors
    FILE_NOT_FOUND: { code: 40401, message: 'FILE_NOT_FOUND' },
    NODE_NOT_FOUND: { code: 40401, message: 'NODE_NOT_FOUND' },
    VERSION_CONFLICT: { code: 40901, message: 'VERSION_CONFLICT' },
    MINDMAP_CYCLE: { code: 40902, message: 'MINDMAP_CYCLE' },
    ID_COLLISION: { code: 40903, message: 'ID_COLLISION' },
    EDIT_NOT_ALLOWED: { code: 42201, message: 'EDIT_NOT_ALLOWED' },
    INVALID_OBJECT_CORE: { code: 42202, message: 'INVALID_OBJECT_CORE' },
    INVALID_CAPABILITY: { code: 42203, message: 'INVALID_CAPABILITY' },
    INVALID_CAPABILITY_PAYLOAD: { code: 42204, message: 'INVALID_CAPABILITY_PAYLOAD' },
    ALIAS_NORMALIZATION_FAILED: { code: 42205, message: 'ALIAS_NORMALIZATION_FAILED' },
    INVALID_ALIAS_ROLE_BINDING: { code: 42206, message: 'INVALID_ALIAS_ROLE_BINDING' },
    LEGACY_INFERENCE_FAILED: { code: 42207, message: 'LEGACY_INFERENCE_FAILED' },
    CONTENT_CONTRACT_VIOLATION: { code: 42208, message: 'CONTENT_CONTRACT_VIOLATION' },
    INVALID_CONTENT_ROLE_BINDING: { code: 42209, message: 'INVALID_CONTENT_ROLE_BINDING' },
    RENDER_ROUTE_UNRESOLVED: { code: 42210, message: 'RENDER_ROUTE_UNRESOLVED' },
    PATCH_SURFACE_VIOLATION: { code: 42211, message: 'PATCH_SURFACE_VIOLATION' },
    INTENT_NOT_REGISTERED: { code: 42212, message: 'INTENT_NOT_REGISTERED' },
    INTENT_SURFACE_NOT_ALLOWED: { code: 42213, message: 'INTENT_SURFACE_NOT_ALLOWED' },
    INTENT_GATING_DENIED: { code: 42214, message: 'INTENT_GATING_DENIED' },
    INTENT_PAYLOAD_INVALID: { code: 42215, message: 'INTENT_PAYLOAD_INVALID' },
    DISPATCH_PLAN_INVALID: { code: 42216, message: 'DISPATCH_PLAN_INVALID' },
    OPTIMISTIC_CONFLICT: { code: 40904, message: 'OPTIMISTIC_CONFLICT' },
    INVALID_INTENT: { code: 42212, message: 'INVALID_INTENT' },
    NORMALIZATION_FAILED: { code: 42213, message: 'NORMALIZATION_FAILED' },
    GATE_BLOCKED: { code: 42214, message: 'GATE_BLOCKED' },
    PATCH_FAILED: { code: 50001, message: 'PATCH_FAILED' },
    EXECUTION_FAILED: { code: 50002, message: 'EXECUTION_FAILED' },
    ADOPTION_VIOLATION: { code: 50003, message: 'ADOPTION_VIOLATION' },
} as const;

export function createResponse(id: number | string, result: unknown): JsonRpcResponse {
    return { jsonrpc: '2.0', id, result };
}

export function createErrorResponse(
    id: number | string,
    code: number,
    message: string,
    data?: unknown
): JsonRpcResponse {
    return { jsonrpc: '2.0', id, error: { code, message, data } };
}

export function createNotification(
    method: string,
    params?: Record<string, unknown>
): JsonRpcNotification {
    return { jsonrpc: '2.0', method, params };
}

export function isValidRequest(data: unknown): data is JsonRpcRequest {
    if (typeof data !== 'object' || data === null) return false;
    const req = data as Record<string, unknown>;
    return req.jsonrpc === '2.0' && typeof req.method === 'string';
}
