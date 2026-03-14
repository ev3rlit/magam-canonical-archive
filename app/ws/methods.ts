/**
 * JSON-RPC Method Handlers
 */

import { readFile } from 'fs/promises';
import { createHash } from 'crypto';
import { isAbsolute, resolve } from 'path';
import {
    patchFile,
    patchNodeCreate,
    patchNodeContent,
    patchNodeDelete,
    patchNodePosition,
    patchNodeRelativePosition,
    patchNodeRename,
    patchNodeReparent,
    patchNodeStyle,
    getGlobalIdentifierCollisions,
    NodeProps,
    CreateNodeInput,
} from './filePatcher';
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
type UpdateCommandType =
    | 'node.move.relative'
    | 'node.content.update'
    | 'node.style.update'
    | 'node.rename';
const fileMutationLocks = new Map<string, Promise<void>>();

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

function ensureOptionalUpdateCommandType(value: unknown): UpdateCommandType | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (
        value === 'node.move.relative'
        || value === 'node.content.update'
        || value === 'node.style.update'
        || value === 'node.rename'
    ) {
        return value;
    }
    throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'commandType is invalid' };
}

function isOffsetOnlyAtPatch(value: unknown): boolean {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const keys = Object.keys(value as Record<string, unknown>);
    return keys.length === 1 && keys[0] === 'offset' && typeof (value as Record<string, unknown>).offset === 'number';
}

function inferUpdateCommandType(props: NodeProps, explicitType?: UpdateCommandType): UpdateCommandType | undefined {
    if (explicitType) {
        return explicitType;
    }

    const keys = Object.keys(props);
    if (keys.length === 1 && typeof props.id === 'string') {
        return 'node.rename';
    }
    if (keys.length === 1 && typeof props.content === 'string') {
        return 'node.content.update';
    }
    if (keys.length === 1 && typeof props.gap === 'number') {
        return 'node.move.relative';
    }
    if (keys.length === 1 && isOffsetOnlyAtPatch(props.at)) {
        return 'node.move.relative';
    }
    return undefined;
}

function ensureNumber(value: unknown, fieldName: string): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: `${fieldName} must be a number` };
    }
    return value;
}

function ensureCreatePlacement(value: unknown): CreateNodeInput['placement'] | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (!value || typeof value !== 'object') {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'node.placement is invalid' };
    }

    const placement = value as Record<string, unknown>;
    const mode = placement.mode;
    if (mode === 'canvas-absolute') {
        return {
            mode,
            x: ensureNumber(placement.x, 'node.placement.x'),
            y: ensureNumber(placement.y, 'node.placement.y'),
        };
    }
    if (mode === 'mindmap-child') {
        return {
            mode,
            parentId: ensureString(placement.parentId, 'node.placement.parentId'),
        };
    }
    if (mode === 'mindmap-sibling') {
        return {
            mode,
            siblingOf: ensureString(placement.siblingOf, 'node.placement.siblingOf'),
            parentId: placement.parentId === null ? null : ensureOptionalString(placement.parentId, 'node.placement.parentId') ?? null,
        };
    }

    throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'node.placement.mode is invalid' };
}

function isFileMutexEnabled(): boolean {
    return process.env.MAGAM_WS_ENABLE_FILE_MUTEX === '1';
}

export function runWithOptionalFileMutex<T>(filePath: string, task: () => Promise<T>): Promise<T> {
    if (!isFileMutexEnabled()) {
        return task();
    }

    const previousLock = fileMutationLocks.get(filePath) || Promise.resolve();
    const run = previousLock
        .catch(() => undefined)
        .then(() => task());
    const nextLock = run.then(() => undefined, () => undefined);

    fileMutationLocks.set(filePath, nextLock);
    nextLock.finally(() => {
        if (fileMutationLocks.get(filePath) === nextLock) {
            fileMutationLocks.delete(filePath);
        }
    });

    return run;
}

function resolveWorkspaceFilePath(filePath: string): string {
    if (isAbsolute(filePath)) {
        return filePath;
    }
    const workspaceRoot = resolve(process.env.MAGAM_TARGET_DIR || process.cwd());
    return resolve(workspaceRoot, filePath);
}

function ensureCommonParams(params: Record<string, unknown>) {
    const filePath = ensureString(params.filePath, 'filePath');
    const baseVersion = ensureString(params.baseVersion, 'baseVersion');
    const originId = ensureString(params.originId, 'originId');
    const commandId = ensureString(params.commandId, 'commandId');
    const resolvedFilePath = resolveWorkspaceFilePath(filePath);
    return { filePath, resolvedFilePath, baseVersion, originId, commandId };
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
    common: { filePath: string; resolvedFilePath: string; baseVersion: string; originId: string; commandId: string },
    mutator: () => Promise<void>,
): Promise<{ success: boolean; newVersion: string; commandId: string; filePath: string }> {
    return runWithOptionalFileMutex(common.resolvedFilePath, async () => {
        await ensureBaseVersion(common.resolvedFilePath, common.baseVersion);
        await mutator();
        const newVersion = await getFileVersion(common.resolvedFilePath);
        ctx.notifyFileChanged?.({
            filePath: common.filePath,
            version: newVersion,
            originId: common.originId,
            commandId: common.commandId,
        });
        return {
            success: true,
            newVersion,
            commandId: common.commandId,
            filePath: common.filePath,
        };
    });
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
): Promise<{ success: boolean; newVersion: string; commandId: string; filePath: string }> {
    const common = ensureCommonParams(params);
    const nodeId = ensureString(params.nodeId, 'nodeId');
    const props = params.props as NodeProps | undefined;
    const explicitCommandType = ensureOptionalUpdateCommandType(params.commandType);

    if (!props || typeof props !== 'object') {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'props is required' };
    }

    const commandType = inferUpdateCommandType(props, explicitCommandType);

    try {
        return await mutateWithContract(ctx, common, async () => {
            const collisionIds = await getGlobalIdentifierCollisions(common.resolvedFilePath);
            if (collisionIds.length > 0) {
                throw { ...RPC_ERRORS.ID_COLLISION, data: { collisionIds } };
            }

            if (commandType === 'node.move.relative') {
                await patchNodeRelativePosition(common.resolvedFilePath, nodeId, props);
                return;
            }
            if (commandType === 'node.content.update') {
                if (typeof props.content !== 'string') {
                    throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'content must be a string' };
                }
                await patchNodeContent(common.resolvedFilePath, nodeId, props.content);
                return;
            }
            if (commandType === 'node.style.update') {
                await patchNodeStyle(common.resolvedFilePath, nodeId, props);
                return;
            }
            if (commandType === 'node.rename') {
                if (typeof props.id !== 'string' || props.id.length === 0) {
                    throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'id must be a string' };
                }
                await patchNodeRename(common.resolvedFilePath, nodeId, props.id);
                return;
            }

            await patchFile(common.resolvedFilePath, nodeId, props);
        });
    } catch (error) {
        const e = error as { code?: number; message?: string; data?: unknown } | Error;
        if (typeof (e as any).code === 'number') throw e;
        const message = (e as Error).message;
        if (message === 'NODE_NOT_FOUND') throw { ...RPC_ERRORS.NODE_NOT_FOUND, data: { nodeId } };
        if (message === 'EDIT_NOT_ALLOWED') throw { ...RPC_ERRORS.EDIT_NOT_ALLOWED, data: { nodeId, commandType } };
        if (message === 'ID_COLLISION') {
            const collisionId = typeof props.id === 'string' ? props.id : nodeId;
            throw { ...RPC_ERRORS.ID_COLLISION, data: { collisionIds: [collisionId] } };
        }
        throw { ...RPC_ERRORS.PATCH_FAILED, data: message };
    }
}

async function handleNodeMove(
    params: Record<string, unknown>,
    ctx: RpcContext,
): Promise<{ success: boolean; newVersion: string; commandId: string; filePath: string }> {
    const common = ensureCommonParams(params);
    const nodeId = ensureString(params.nodeId, 'nodeId');
    const x = ensureNumber(params.x, 'x');
    const y = ensureNumber(params.y, 'y');

    try {
        return await mutateWithContract(ctx, common, async () => {
            const collisionIds = await getGlobalIdentifierCollisions(common.resolvedFilePath);
            if (collisionIds.length > 0) {
                throw { ...RPC_ERRORS.ID_COLLISION, data: { collisionIds } };
            }
            await patchNodePosition(common.resolvedFilePath, nodeId, x, y);
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
): Promise<{ success: boolean; newVersion: string; commandId: string; filePath: string }> {
    const common = ensureCommonParams(params);
    const node = params.node as CreateNodeInput | undefined;

    if (!node || typeof node !== 'object') {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'node is required' };
    }

    if (!node.id || typeof node.id !== 'string') {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'node.id is required' };
    }

    if (!node.type || !['shape', 'text', 'markdown', 'mindmap', 'sticky', 'sticker', 'washi-tape', 'image'].includes(node.type)) {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'node.type is invalid' };
    }

    node.placement = ensureCreatePlacement(node.placement);

    try {
        return await mutateWithContract(ctx, common, async () => {
            const collisionIds = await getGlobalIdentifierCollisions(common.resolvedFilePath);
            if (collisionIds.length > 0) {
                throw { ...RPC_ERRORS.ID_COLLISION, data: { collisionIds } };
            }
            await patchNodeCreate(common.resolvedFilePath, node);
        });
    } catch (error) {
        const e = error as { code?: number; message?: string; data?: unknown } | Error;
        if (typeof (e as any).code === 'number') throw e;
        const message = (e as Error).message;
        if (message === 'ID_COLLISION') throw { ...RPC_ERRORS.ID_COLLISION, data: { collisionIds: [node.id] } };
        if (message === 'NODE_NOT_FOUND') throw { ...RPC_ERRORS.NODE_NOT_FOUND, data: { nodeId: node.id } };
        throw { ...RPC_ERRORS.PATCH_FAILED, data: message };
    }
}

async function handleNodeDelete(
    params: Record<string, unknown>,
    ctx: RpcContext,
): Promise<{ success: boolean; newVersion: string; commandId: string; filePath: string }> {
    const common = ensureCommonParams(params);
    const nodeId = ensureString(params.nodeId, 'nodeId');

    try {
        return await mutateWithContract(ctx, common, async () => {
            await patchNodeDelete(common.resolvedFilePath, nodeId);
        });
    } catch (error) {
        const e = error as { code?: number; message?: string; data?: unknown } | Error;
        if (typeof (e as any).code === 'number') throw e;
        const message = (e as Error).message;
        if (message === 'NODE_NOT_FOUND') throw { ...RPC_ERRORS.NODE_NOT_FOUND, data: { nodeId } };
        if (message === 'EDIT_NOT_ALLOWED') throw { ...RPC_ERRORS.EDIT_NOT_ALLOWED, data: { nodeId } };
        throw { ...RPC_ERRORS.PATCH_FAILED, data: message };
    }
}

async function handleNodeReparent(
    params: Record<string, unknown>,
    ctx: RpcContext,
): Promise<{ success: boolean; newVersion: string; commandId: string; filePath: string }> {
    const common = ensureCommonParams(params);
    const nodeId = ensureString(params.nodeId, 'nodeId');
    const newParentId = ensureOptionalString(params.newParentId, 'newParentId');

    try {
        return await mutateWithContract(ctx, common, async () => {
            await patchNodeReparent(common.resolvedFilePath, nodeId, newParentId || null);
        });
    } catch (error) {
        const e = error as { code?: number; message?: string; data?: unknown } | Error;
        if (typeof (e as any).code === 'number') throw e;
        const message = (e as Error).message;
        if (message === 'NODE_NOT_FOUND') throw { ...RPC_ERRORS.NODE_NOT_FOUND, data: { nodeId } };
        if (message === 'MINDMAP_CYCLE') throw { ...RPC_ERRORS.MINDMAP_CYCLE, data: { nodeId, newParentId } };
        if (message === 'EDIT_NOT_ALLOWED') throw { ...RPC_ERRORS.EDIT_NOT_ALLOWED, data: { nodeId, newParentId } };
        throw { ...RPC_ERRORS.PATCH_FAILED, data: message };
    }
}

export const methods: Record<string, RpcHandler> = {
    'file.subscribe': handleFileSubscribe,
    'file.unsubscribe': handleFileUnsubscribe,
    'node.update': handleNodeUpdate,
    'node.move': handleNodeMove,
    'node.create': handleNodeCreate,
    'node.delete': handleNodeDelete,
    'node.reparent': handleNodeReparent,
};
