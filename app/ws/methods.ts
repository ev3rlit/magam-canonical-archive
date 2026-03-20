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
        resolvedFilePath: string;
        version: string;
        originId: string;
        commandId: string;
        rootPath?: string;
    }) => void;
}

type RpcHandler = (params: Record<string, unknown>, ctx: RpcContext) => Promise<unknown>;
type UpdateCommandType =
    | 'node.move.relative'
    | 'node.content.update'
    | 'node.style.update'
    | 'node.rename'
    | 'node.group.update'
    | 'node.z-order.update';
const fileMutationLocks = new Map<string, Promise<void>>();
const pluginInstancesByFile = new Map<string, Map<string, PluginInstanceRuntimeRecord>>();

interface PluginInstanceRuntimeRecord {
    id: string;
    pluginExportId: string;
    pluginVersionId: string;
    displayName: string;
    props: Record<string, unknown>;
    bindingConfig: Record<string, unknown>;
    persistedState: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createIntentScopedDiagnostics(input: {
    failedAction: string;
    stage: string;
    details?: Record<string, unknown>;
}): Record<string, unknown> {
    return {
        failedAction: input.failedAction,
        rollbackPolicy: 'intent-scoped',
        stage: input.stage,
        ...(input.details ?? {}),
    };
}

function withDiagnostics(
    data: unknown,
    diagnostics: Record<string, unknown>,
): Record<string, unknown> {
    const base = isRecord(data) ? data : {};
    const existingRollback = isRecord(base.rollback) ? base.rollback : {};
    return {
        ...base,
        rollback: {
            ...existingRollback,
            ...diagnostics,
        },
    };
}

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

function ensureOptionalRootPath(value: unknown, fieldName: string): string | undefined {
    const rootPath = ensureOptionalString(value, fieldName);
    if (rootPath === undefined) {
        return undefined;
    }

    const trimmed = rootPath.trim();
    if (!trimmed) {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: `${fieldName} must not be empty` };
    }
    if (!isAbsolute(trimmed)) {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: `${fieldName} must be an absolute path` };
    }

    return resolve(trimmed);
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
        || value === 'node.group.update'
        || value === 'node.z-order.update'
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
    if (keys.length === 1 && ('groupId' in props)) {
        return 'node.group.update';
    }
    if (keys.length === 1 && typeof props.zIndex === 'number') {
        return 'node.z-order.update';
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

function ensureRecord(value: unknown, fieldName: string): Record<string, unknown> {
    if (!isRecord(value)) {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: `${fieldName} must be an object` };
    }
    return value;
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function getPluginBucket(resolvedFilePath: string): Map<string, PluginInstanceRuntimeRecord> {
    let bucket = pluginInstancesByFile.get(resolvedFilePath);
    if (!bucket) {
        bucket = new Map<string, PluginInstanceRuntimeRecord>();
        pluginInstancesByFile.set(resolvedFilePath, bucket);
    }
    return bucket;
}

function toPluginInstanceSnapshot(record: PluginInstanceRuntimeRecord): PluginInstanceRuntimeRecord {
    return {
        ...record,
        props: cloneRecord(record.props),
        bindingConfig: cloneRecord(record.bindingConfig),
        persistedState: cloneRecord(record.persistedState),
    };
}

function ensurePluginInstanceInput(value: unknown): {
    id: string;
    pluginExportId: string;
    pluginVersionId: string;
    displayName?: string;
    props?: Record<string, unknown>;
    bindingConfig?: Record<string, unknown>;
    persistedState?: Record<string, unknown>;
} {
    const input = ensureRecord(value, 'instance');
    const id = ensureString(input.id, 'instance.id');
    const pluginExportId = ensureString(input.pluginExportId, 'instance.pluginExportId');
    const pluginVersionId = ensureString(input.pluginVersionId, 'instance.pluginVersionId');
    const displayName = ensureOptionalString(input.displayName, 'instance.displayName');
    const props = input.props === undefined ? undefined : ensureRecord(input.props, 'instance.props');
    const bindingConfig = input.bindingConfig === undefined
        ? undefined
        : ensureRecord(input.bindingConfig, 'instance.bindingConfig');
    const persistedState = input.persistedState === undefined
        ? undefined
        : ensureRecord(input.persistedState, 'instance.persistedState');

    return {
        id,
        pluginExportId,
        pluginVersionId,
        ...(displayName ? { displayName } : {}),
        ...(props ? { props } : {}),
        ...(bindingConfig ? { bindingConfig } : {}),
        ...(persistedState ? { persistedState } : {}),
    };
}

async function mutatePluginRuntimeWithContract<T>(
    common: { filePath: string; resolvedFilePath: string; rootPath?: string; baseVersion: string; originId: string; commandId: string },
    mutator: (bucket: Map<string, PluginInstanceRuntimeRecord>) => T,
): Promise<{ success: boolean; newVersion: string; commandId: string; filePath: string; resolvedFilePath: string; data: T }> {
    return runWithOptionalFileMutex(common.resolvedFilePath, async () => {
        await ensureBaseVersion(common.resolvedFilePath, common.baseVersion);
        const bucket = getPluginBucket(common.resolvedFilePath);
        const data = mutator(bucket);
        const newVersion = await getFileVersion(common.resolvedFilePath);
        return {
            success: true,
            newVersion,
            commandId: common.commandId,
            filePath: common.filePath,
            resolvedFilePath: common.resolvedFilePath,
            data,
        };
    });
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

function resolveWorkspaceFilePath(filePath: string, rootPath?: string): string {
    if (isAbsolute(filePath)) {
        return filePath;
    }
    const workspaceRoot = resolve(rootPath || process.env.MAGAM_TARGET_DIR || process.cwd());
    return resolve(workspaceRoot, filePath);
}

function ensureCommonParams(params: Record<string, unknown>) {
    const filePath = ensureString(params.filePath, 'filePath');
    const baseVersion = ensureString(params.baseVersion, 'baseVersion');
    const originId = ensureString(params.originId, 'originId');
    const commandId = ensureString(params.commandId, 'commandId');
    const rootPath = ensureOptionalRootPath(params.rootPath, 'rootPath');
    const resolvedFilePath = resolveWorkspaceFilePath(filePath, rootPath);
    return { filePath, resolvedFilePath, rootPath, baseVersion, originId, commandId };
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
    common: { filePath: string; resolvedFilePath: string; rootPath?: string; baseVersion: string; originId: string; commandId: string },
    mutator: () => Promise<void>,
): Promise<{ success: boolean; newVersion: string; commandId: string; filePath: string; resolvedFilePath: string }> {
    return runWithOptionalFileMutex(common.resolvedFilePath, async () => {
        await ensureBaseVersion(common.resolvedFilePath, common.baseVersion);
        await mutator();
        const newVersion = await getFileVersion(common.resolvedFilePath);
        ctx.notifyFileChanged?.({
            filePath: common.filePath,
            resolvedFilePath: common.resolvedFilePath,
            version: newVersion,
            originId: common.originId,
            commandId: common.commandId,
            ...(common.rootPath ? { rootPath: common.rootPath } : {}),
        });
        return {
            success: true,
            newVersion,
            commandId: common.commandId,
            filePath: common.filePath,
            resolvedFilePath: common.resolvedFilePath,
        };
    });
}

async function handleFileSubscribe(params: Record<string, unknown>, ctx: RpcContext): Promise<{ success: boolean }> {
    const filePath = ensureString(params.filePath, 'filePath');
    const rootPath = ensureOptionalRootPath(params.rootPath, 'rootPath');
    ctx.subscriptions.add(resolveWorkspaceFilePath(filePath, rootPath));
    return { success: true };
}

async function handleFileUnsubscribe(params: Record<string, unknown>, ctx: RpcContext): Promise<{ success: boolean }> {
    const filePath = ensureString(params.filePath, 'filePath');
    const rootPath = ensureOptionalRootPath(params.rootPath, 'rootPath');
    ctx.subscriptions.delete(resolveWorkspaceFilePath(filePath, rootPath));
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
        const failedAction = commandType ?? 'node.update';
        const diagnostics = createIntentScopedDiagnostics({
            failedAction,
            stage: 'ws.node.update',
            details: { nodeId },
        });
        if (typeof (e as any).code === 'number') {
            const typed = e as { code: number; message?: string; data?: unknown };
            throw {
                code: typed.code,
                message: typed.message,
                data: withDiagnostics(typed.data, diagnostics),
            };
        }
        const message = (e as Error).message;
        if (message === 'NODE_NOT_FOUND') throw { ...RPC_ERRORS.NODE_NOT_FOUND, data: withDiagnostics({ nodeId }, diagnostics) };
        if (message === 'EDIT_NOT_ALLOWED') throw { ...RPC_ERRORS.EDIT_NOT_ALLOWED, data: withDiagnostics({ nodeId, commandType }, diagnostics) };
        if (message === 'ID_COLLISION') {
            const collisionId = typeof props.id === 'string' ? props.id : nodeId;
            throw { ...RPC_ERRORS.ID_COLLISION, data: withDiagnostics({ collisionIds: [collisionId] }, diagnostics) };
        }
        if (message === 'CONTENT_CONTRACT_VIOLATION') {
            throw {
                ...RPC_ERRORS.CONTENT_CONTRACT_VIOLATION,
                data: withDiagnostics({ nodeId, path: 'capabilities.content' }, diagnostics),
            };
        }
        throw { ...RPC_ERRORS.PATCH_FAILED, data: withDiagnostics({ reason: message }, diagnostics) };
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
        const diagnostics = createIntentScopedDiagnostics({
            failedAction: 'node.move',
            stage: 'ws.node.move',
            details: { nodeId },
        });
        if (typeof (e as any).code === 'number') {
            const typed = e as { code: number; message?: string; data?: unknown };
            throw {
                code: typed.code,
                message: typed.message,
                data: withDiagnostics(typed.data, diagnostics),
            };
        }
        const message = (e as Error).message;
        if (message === 'NODE_NOT_FOUND') throw { ...RPC_ERRORS.NODE_NOT_FOUND, data: withDiagnostics({ nodeId }, diagnostics) };
        throw { ...RPC_ERRORS.PATCH_FAILED, data: withDiagnostics({ reason: message }, diagnostics) };
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

    if (
        !node.type
        || ![
            'shape',
            'rectangle',
            'ellipse',
            'diamond',
            'line',
            'text',
            'markdown',
            'mindmap',
            'sticky',
            'sticker',
            'washi-tape',
            'image',
        ].includes(node.type)
    ) {
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
        const diagnostics = createIntentScopedDiagnostics({
            failedAction: 'node.create',
            stage: 'ws.node.create',
            details: { nodeId: node.id },
        });
        if (typeof (e as any).code === 'number') {
            const typed = e as { code: number; message?: string; data?: unknown };
            throw {
                code: typed.code,
                message: typed.message,
                data: withDiagnostics(typed.data, diagnostics),
            };
        }
        const message = (e as Error).message;
        if (message === 'ID_COLLISION') throw { ...RPC_ERRORS.ID_COLLISION, data: withDiagnostics({ collisionIds: [node.id] }, diagnostics) };
        if (message === 'NODE_NOT_FOUND') throw { ...RPC_ERRORS.NODE_NOT_FOUND, data: withDiagnostics({ nodeId: node.id }, diagnostics) };
        throw { ...RPC_ERRORS.PATCH_FAILED, data: withDiagnostics({ reason: message }, diagnostics) };
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
        const diagnostics = createIntentScopedDiagnostics({
            failedAction: 'node.delete',
            stage: 'ws.node.delete',
            details: { nodeId },
        });
        if (typeof (e as any).code === 'number') {
            const typed = e as { code: number; message?: string; data?: unknown };
            throw {
                code: typed.code,
                message: typed.message,
                data: withDiagnostics(typed.data, diagnostics),
            };
        }
        const message = (e as Error).message;
        if (message === 'NODE_NOT_FOUND') throw { ...RPC_ERRORS.NODE_NOT_FOUND, data: withDiagnostics({ nodeId }, diagnostics) };
        if (message === 'EDIT_NOT_ALLOWED') throw { ...RPC_ERRORS.EDIT_NOT_ALLOWED, data: withDiagnostics({ nodeId }, diagnostics) };
        throw { ...RPC_ERRORS.PATCH_FAILED, data: withDiagnostics({ reason: message }, diagnostics) };
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
        const diagnostics = createIntentScopedDiagnostics({
            failedAction: 'node.reparent',
            stage: 'ws.node.reparent',
            details: { nodeId, newParentId: newParentId ?? null },
        });
        if (typeof (e as any).code === 'number') {
            const typed = e as { code: number; message?: string; data?: unknown };
            throw {
                code: typed.code,
                message: typed.message,
                data: withDiagnostics(typed.data, diagnostics),
            };
        }
        const message = (e as Error).message;
        if (message === 'NODE_NOT_FOUND') throw { ...RPC_ERRORS.NODE_NOT_FOUND, data: withDiagnostics({ nodeId }, diagnostics) };
        if (message === 'MINDMAP_CYCLE') throw { ...RPC_ERRORS.MINDMAP_CYCLE, data: withDiagnostics({ nodeId, newParentId }, diagnostics) };
        if (message === 'EDIT_NOT_ALLOWED') throw { ...RPC_ERRORS.EDIT_NOT_ALLOWED, data: withDiagnostics({ nodeId, newParentId }, diagnostics) };
        throw { ...RPC_ERRORS.PATCH_FAILED, data: withDiagnostics({ reason: message }, diagnostics) };
    }
}

async function handlePluginInstanceCreate(
    params: Record<string, unknown>,
    _ctx: RpcContext,
): Promise<{ success: boolean; newVersion: string; commandId: string; filePath: string; instance: PluginInstanceRuntimeRecord }> {
    const common = ensureCommonParams(params);
    const input = ensurePluginInstanceInput(params.instance);

    try {
        const result = await mutatePluginRuntimeWithContract(common, (bucket) => {
            if (bucket.has(input.id)) {
                throw {
                    ...RPC_ERRORS.PLUGIN_INSTANCE_ID_CONFLICT,
                    data: { instanceId: input.id },
                };
            }

            const now = new Date().toISOString();
            const nextRecord: PluginInstanceRuntimeRecord = {
                id: input.id,
                pluginExportId: input.pluginExportId,
                pluginVersionId: input.pluginVersionId,
                displayName: input.displayName ?? input.pluginExportId,
                props: cloneRecord(input.props ?? {}),
                bindingConfig: cloneRecord(input.bindingConfig ?? {}),
                persistedState: cloneRecord(input.persistedState ?? {}),
                createdAt: now,
                updatedAt: now,
            };
            bucket.set(nextRecord.id, nextRecord);
            return toPluginInstanceSnapshot(nextRecord);
        });

        return {
            success: result.success,
            newVersion: result.newVersion,
            commandId: result.commandId,
            filePath: result.filePath,
            instance: result.data,
        };
    } catch (error) {
        const e = error as { code?: number; message?: string; data?: unknown } | Error;
        const diagnostics = createIntentScopedDiagnostics({
            failedAction: 'plugin-instance.create',
            stage: 'ws.plugin-instance.create',
            details: { instanceId: input.id },
        });
        if (typeof (e as any).code === 'number') {
            const typed = e as { code: number; message?: string; data?: unknown };
            throw {
                code: typed.code,
                message: typed.message,
                data: withDiagnostics(typed.data, diagnostics),
            };
        }
        throw {
            ...RPC_ERRORS.PLUGIN_RUNTIME_UNAVAILABLE,
            data: withDiagnostics({ reason: (e as Error).message }, diagnostics),
        };
    }
}

async function handlePluginInstanceUpdateProps(
    params: Record<string, unknown>,
    _ctx: RpcContext,
): Promise<{ success: boolean; newVersion: string; commandId: string; filePath: string; instance: PluginInstanceRuntimeRecord }> {
    const common = ensureCommonParams(params);
    const instanceId = ensureString(params.instanceId, 'instanceId');
    const patch = ensureRecord(params.patch, 'patch');

    try {
        const result = await mutatePluginRuntimeWithContract(common, (bucket) => {
            const existing = bucket.get(instanceId);
            if (!existing) {
                throw {
                    ...RPC_ERRORS.PLUGIN_INSTANCE_NOT_FOUND,
                    data: { instanceId },
                };
            }
            const next: PluginInstanceRuntimeRecord = {
                ...existing,
                props: {
                    ...existing.props,
                    ...cloneRecord(patch),
                },
                updatedAt: new Date().toISOString(),
            };
            bucket.set(instanceId, next);
            return toPluginInstanceSnapshot(next);
        });

        return {
            success: result.success,
            newVersion: result.newVersion,
            commandId: result.commandId,
            filePath: result.filePath,
            instance: result.data,
        };
    } catch (error) {
        const e = error as { code?: number; message?: string; data?: unknown } | Error;
        const diagnostics = createIntentScopedDiagnostics({
            failedAction: 'plugin-instance.update-props',
            stage: 'ws.plugin-instance.update-props',
            details: { instanceId },
        });
        if (typeof (e as any).code === 'number') {
            const typed = e as { code: number; message?: string; data?: unknown };
            throw {
                code: typed.code,
                message: typed.message,
                data: withDiagnostics(typed.data, diagnostics),
            };
        }
        throw {
            ...RPC_ERRORS.PLUGIN_RUNTIME_UNAVAILABLE,
            data: withDiagnostics({ reason: (e as Error).message }, diagnostics),
        };
    }
}

async function handlePluginInstanceUpdateBinding(
    params: Record<string, unknown>,
    _ctx: RpcContext,
): Promise<{ success: boolean; newVersion: string; commandId: string; filePath: string; instance: PluginInstanceRuntimeRecord }> {
    const common = ensureCommonParams(params);
    const instanceId = ensureString(params.instanceId, 'instanceId');
    const bindingConfig = ensureRecord(params.bindingConfig, 'bindingConfig');

    try {
        const result = await mutatePluginRuntimeWithContract(common, (bucket) => {
            const existing = bucket.get(instanceId);
            if (!existing) {
                throw {
                    ...RPC_ERRORS.PLUGIN_INSTANCE_NOT_FOUND,
                    data: { instanceId },
                };
            }
            const next: PluginInstanceRuntimeRecord = {
                ...existing,
                bindingConfig: cloneRecord(bindingConfig),
                updatedAt: new Date().toISOString(),
            };
            bucket.set(instanceId, next);
            return toPluginInstanceSnapshot(next);
        });

        return {
            success: result.success,
            newVersion: result.newVersion,
            commandId: result.commandId,
            filePath: result.filePath,
            instance: result.data,
        };
    } catch (error) {
        const e = error as { code?: number; message?: string; data?: unknown } | Error;
        const diagnostics = createIntentScopedDiagnostics({
            failedAction: 'plugin-instance.update-binding',
            stage: 'ws.plugin-instance.update-binding',
            details: { instanceId },
        });
        if (typeof (e as any).code === 'number') {
            const typed = e as { code: number; message?: string; data?: unknown };
            throw {
                code: typed.code,
                message: typed.message,
                data: withDiagnostics(typed.data, diagnostics),
            };
        }
        throw {
            ...RPC_ERRORS.PLUGIN_RUNTIME_UNAVAILABLE,
            data: withDiagnostics({ reason: (e as Error).message }, diagnostics),
        };
    }
}

async function handlePluginInstanceRemove(
    params: Record<string, unknown>,
    _ctx: RpcContext,
): Promise<{ success: boolean; newVersion: string; commandId: string; filePath: string; removedInstanceId: string }> {
    const common = ensureCommonParams(params);
    const instanceId = ensureString(params.instanceId, 'instanceId');

    try {
        const result = await mutatePluginRuntimeWithContract(common, (bucket) => {
            const deleted = bucket.delete(instanceId);
            if (!deleted) {
                throw {
                    ...RPC_ERRORS.PLUGIN_INSTANCE_NOT_FOUND,
                    data: { instanceId },
                };
            }
            return { removedInstanceId: instanceId };
        });

        return {
            success: result.success,
            newVersion: result.newVersion,
            commandId: result.commandId,
            filePath: result.filePath,
            removedInstanceId: result.data.removedInstanceId,
        };
    } catch (error) {
        const e = error as { code?: number; message?: string; data?: unknown } | Error;
        const diagnostics = createIntentScopedDiagnostics({
            failedAction: 'plugin-instance.remove',
            stage: 'ws.plugin-instance.remove',
            details: { instanceId },
        });
        if (typeof (e as any).code === 'number') {
            const typed = e as { code: number; message?: string; data?: unknown };
            throw {
                code: typed.code,
                message: typed.message,
                data: withDiagnostics(typed.data, diagnostics),
            };
        }
        throw {
            ...RPC_ERRORS.PLUGIN_RUNTIME_UNAVAILABLE,
            data: withDiagnostics({ reason: (e as Error).message }, diagnostics),
        };
    }
}

async function handlePluginInstanceList(
    params: Record<string, unknown>,
    _ctx: RpcContext,
): Promise<{ success: boolean; filePath: string; instances: PluginInstanceRuntimeRecord[] }> {
    const filePath = ensureString(params.filePath, 'filePath');
    const rootPath = ensureOptionalRootPath(params.rootPath, 'rootPath');
    const resolvedFilePath = resolveWorkspaceFilePath(filePath, rootPath);
    const bucket = getPluginBucket(resolvedFilePath);
    const instances = Array.from(bucket.values()).map(toPluginInstanceSnapshot);
    return {
        success: true,
        filePath,
        instances,
    };
}

export const methods: Record<string, RpcHandler> = {
    'file.subscribe': handleFileSubscribe,
    'file.unsubscribe': handleFileUnsubscribe,
    'node.update': handleNodeUpdate,
    'node.move': handleNodeMove,
    'node.create': handleNodeCreate,
    'node.delete': handleNodeDelete,
    'node.reparent': handleNodeReparent,
    'plugin-instance.create': handlePluginInstanceCreate,
    'plugin-instance.update-props': handlePluginInstanceUpdateProps,
    'plugin-instance.update-binding': handlePluginInstanceUpdateBinding,
    'plugin-instance.remove': handlePluginInstanceRemove,
    'plugin-instance.list': handlePluginInstanceList,
};
