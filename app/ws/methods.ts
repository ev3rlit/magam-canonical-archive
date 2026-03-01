/**
 * JSON-RPC Method Handlers
 */

import { readFile } from 'fs/promises';
import { createHash } from 'crypto';
import { patchFile, patchNodeCreate, patchNodePosition, patchNodeReparent, NodeProps, CreateNodeInput } from './filePatcher';
import { RPC_ERRORS } from './rpc';

export interface RpcContext {
    ws: unknown;
    subscriptions: Set<string>;
    notifyFileChanged?: (payload: {
        filePath: string;
        version: string;
        originId: string;
        commandId: string;
    }) => void;
}

type RpcHandler = (params: Record<string, unknown>, ctx: RpcContext) => Promise<unknown>;

function ensureString(value: unknown, fieldName: string): string {
    if (!value || typeof value !== 'string') {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: `${fieldName} is required` };
    }
    return value;
}

function ensureOptionalString(value: unknown, fieldName: string): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string') {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: `${fieldName} must be a string` };
    }
    return value;
}

function ensureNumber(value: unknown, fieldName: string): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: `${fieldName} must be a number` };
    }
    return value;
}

function ensureCommonParams(params: Record<string, unknown>) {
    const filePath = ensureString(params.filePath, 'filePath');
    const baseVersion = ensureString(params.baseVersion, 'baseVersion');
    const originId = ensureString(params.originId, 'originId');
    const commandId = ensureString(params.commandId, 'commandId');
    return { filePath, baseVersion, originId, commandId };
}

async function getFileVersion(filePath: string): Promise<string> {
    const content = await readFile(filePath, 'utf-8');
    const digest = createHash('sha256').update(content).digest('hex');
    return `sha256:${digest}`;
}

async function ensureBaseVersion(filePath: string, baseVersion: string): Promise<void> {
    const currentVersion = await getFileVersion(filePath);
    if (baseVersion !== currentVersion) {
        throw {
            ...RPC_ERRORS.VERSION_CONFLICT,
            data: { expected: baseVersion, actual: currentVersion },
        };
    }
}

async function mutateWithContract(
    ctx: RpcContext,
    common: { filePath: string; baseVersion: string; originId: string; commandId: string },
    mutator: () => Promise<void>,
): Promise<{ success: boolean; newVersion: string; commandId: string }> {
    await ensureBaseVersion(common.filePath, common.baseVersion);
    await mutator();
    const newVersion = await getFileVersion(common.filePath);
    ctx.notifyFileChanged?.({
        filePath: common.filePath,
        version: newVersion,
        originId: common.originId,
        commandId: common.commandId,
    });
    return { success: true, newVersion, commandId: common.commandId };
}

async function handleFileSubscribe(params: Record<string, unknown>, ctx: RpcContext): Promise<{ success: boolean }> {
    const filePath = ensureString(params.filePath, 'filePath');
    ctx.subscriptions.add(filePath);
    return { success: true };
}

async function handleFileUnsubscribe(params: Record<string, unknown>, ctx: RpcContext): Promise<{ success: boolean }> {
    const filePath = ensureString(params.filePath, 'filePath');
    ctx.subscriptions.delete(filePath);
    return { success: true };
}

async function handleNodeUpdate(
    params: Record<string, unknown>,
    ctx: RpcContext,
): Promise<{ success: boolean; newVersion: string; commandId: string }> {
    const common = ensureCommonParams(params);
    const nodeId = ensureString(params.nodeId, 'nodeId');
    const props = params.props as NodeProps | undefined;

    if (!props || typeof props !== 'object') {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'props is required' };
    }

    try {
        return await mutateWithContract(ctx, common, async () => {
            await patchFile(common.filePath, nodeId, props);
        });
    } catch (error) {
        const e = error as { code?: number; message?: string; data?: unknown } | Error;
        if (typeof (e as any).code === 'number') throw e;
        const message = (e as Error).message;
        if (message === 'NODE_NOT_FOUND') throw { ...RPC_ERRORS.NODE_NOT_FOUND, data: { nodeId } };
        throw { ...RPC_ERRORS.PATCH_FAILED, data: message };
    }
}

async function handleNodeMove(
    params: Record<string, unknown>,
    ctx: RpcContext,
): Promise<{ success: boolean; newVersion: string; commandId: string }> {
    const common = ensureCommonParams(params);
    const nodeId = ensureString(params.nodeId, 'nodeId');
    const x = ensureNumber(params.x, 'x');
    const y = ensureNumber(params.y, 'y');

    try {
        return await mutateWithContract(ctx, common, async () => {
            await patchNodePosition(common.filePath, nodeId, x, y);
        });
    } catch (error) {
        const e = error as { code?: number; message?: string; data?: unknown } | Error;
        if (typeof (e as any).code === 'number') throw e;
        const message = (e as Error).message;
        if (message === 'NODE_NOT_FOUND') throw { ...RPC_ERRORS.NODE_NOT_FOUND, data: { nodeId } };
        throw { ...RPC_ERRORS.PATCH_FAILED, data: message };
    }
}

async function handleNodeCreate(
    params: Record<string, unknown>,
    ctx: RpcContext,
): Promise<{ success: boolean; newVersion: string; commandId: string }> {
    const common = ensureCommonParams(params);
    const node = params.node as CreateNodeInput | undefined;

    if (!node || typeof node !== 'object') {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'node is required' };
    }

    if (!node.id || typeof node.id !== 'string') {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'node.id is required' };
    }

    if (!node.type || !['shape', 'text', 'markdown', 'mindmap', 'sticker', 'washi-tape'].includes(node.type)) {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'node.type is invalid' };
    }

    try {
        return await mutateWithContract(ctx, common, async () => {
            await patchNodeCreate(common.filePath, node);
        });
    } catch (error) {
        const e = error as { code?: number; message?: string; data?: unknown } | Error;
        if (typeof (e as any).code === 'number') throw e;
        const message = (e as Error).message;
        throw { ...RPC_ERRORS.PATCH_FAILED, data: message };
    }
}

async function handleNodeReparent(
    params: Record<string, unknown>,
    ctx: RpcContext,
): Promise<{ success: boolean; newVersion: string; commandId: string }> {
    const common = ensureCommonParams(params);
    const nodeId = ensureString(params.nodeId, 'nodeId');
    const newParentId = ensureOptionalString(params.newParentId, 'newParentId');

    try {
        return await mutateWithContract(ctx, common, async () => {
            await patchNodeReparent(common.filePath, nodeId, newParentId || null);
        });
    } catch (error) {
        const e = error as { code?: number; message?: string; data?: unknown } | Error;
        if (typeof (e as any).code === 'number') throw e;
        const message = (e as Error).message;
        if (message === 'NODE_NOT_FOUND') throw { ...RPC_ERRORS.NODE_NOT_FOUND, data: { nodeId } };
        if (message === 'MINDMAP_CYCLE') throw { ...RPC_ERRORS.MINDMAP_CYCLE, data: { nodeId, newParentId } };
        throw { ...RPC_ERRORS.PATCH_FAILED, data: message };
    }
}

export const methods: Record<string, RpcHandler> = {
    'file.subscribe': handleFileSubscribe,
    'file.unsubscribe': handleFileUnsubscribe,
    'node.update': handleNodeUpdate,
    'node.move': handleNodeMove,
    'node.create': handleNodeCreate,
    'node.reparent': handleNodeReparent,
};
