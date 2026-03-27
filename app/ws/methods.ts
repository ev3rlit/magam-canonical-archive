/**
 * JSON-RPC Method Handlers
 */

import { mkdir, readFile } from 'fs/promises';
import { createHash } from 'crypto';
import { basename, isAbsolute, resolve } from 'path';
import { resolveCanonicalCanvasCompatibilityFilePath } from '../../libs/shared/src/lib/canonical-canvas-shell';
import {
    buildEditingProjection,
    buildHierarchyProjection,
    buildRenderProjection,
    CanonicalPersistenceRepository,
    createCanonicalPgliteDb,
    createCanvasRuntimeServiceContext,
    dispatchCanvasMutation,
    redoCanvasMutation,
    undoCanvasMutation,
    type ContentBlock,
    type CanvasMutationBatchV1,
    type CanvasRedoRequestV1,
    type CanvasUndoRequestV1,
    type MutationResultEnvelopeV1,
    readContentBlocks,
} from '../../libs/shared/src';
import {
    patchFile,
    patchNodeBodyBlockInsert,
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
        canvasId?: string;
        filePath: string;
        resolvedFilePath: string;
        newVersion: string;
        originId: string;
        commandId: string;
        rootPath?: string;
        canvasRevision?: number;
    }) => void;
    notifyCanvasChanged?: (payload: {
        canvasId: string;
        canvasRevision: number;
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

function sanitizeWorkspaceId(targetDir: string): string {
    const base = basename(targetDir).trim() || 'workspace';
    const sanitized = base
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return sanitized || 'workspace';
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
    common: { canvasId?: string; filePath: string; resolvedFilePath: string; rootPath?: string; baseVersion: string; originId: string; commandId: string },
    mutator: (bucket: Map<string, PluginInstanceRuntimeRecord>) => T,
): Promise<{ success: boolean; newVersion: string; commandId: string; canvasId?: string; filePath: string; resolvedFilePath: string; data: T }> {
    return runWithOptionalFileMutex(common.resolvedFilePath, async () => {
        await ensureBaseVersion(common.resolvedFilePath, common.baseVersion);
        const bucket = getPluginBucket(common.resolvedFilePath);
        const data = mutator(bucket);
        const newVersion = await getFileVersion(common.resolvedFilePath);
        return {
            success: true,
            newVersion,
            commandId: common.commandId,
            canvasId: common.canvasId,
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
    if (mode === 'mindmap-root') {
        return {
            mode,
            x: ensureNumber(placement.x, 'node.placement.x'),
            y: ensureNumber(placement.y, 'node.placement.y'),
            mindmapId: ensureString(placement.mindmapId, 'node.placement.mindmapId'),
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

function ensureContentBlock(value: unknown): ContentBlock {
    const input = ensureRecord(value, 'block');
    const id = ensureString(input.id, 'block.id');
    const blockType = ensureString(input.blockType, 'block.blockType');

    if (blockType === 'markdown') {
        return {
            id,
            blockType: 'markdown',
            source: typeof input.source === 'string' ? input.source : '',
        };
    }

    if (blockType === 'text') {
        return {
            id,
            blockType: 'text',
            text: typeof input.text === 'string' ? input.text : '',
        };
    }

    if (!/^[A-Za-z0-9_-]+(?:[.-][A-Za-z0-9_-]+)*\.[A-Za-z0-9_-]+(?:[.-][A-Za-z0-9_-]+)*$/.test(blockType)) {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'block.blockType is invalid' };
    }

    return {
        id,
        blockType: blockType as Extract<ContentBlock, { payload: Record<string, unknown> }>['blockType'],
        payload: input.payload && typeof input.payload === 'object' ? input.payload as Record<string, unknown> : {},
        ...(typeof input.textualProjection === 'string' ? { textualProjection: input.textualProjection } : {}),
        ...(input.metadata && typeof input.metadata === 'object' ? { metadata: input.metadata as Record<string, unknown> } : {}),
    };
}

function toRuntimeBodyBlock(block: ContentBlock): { blockId: string; kind: 'paragraph' | 'callout' | 'custom'; props: Record<string, unknown> } {
    if (block.blockType === 'text') {
        return {
            blockId: block.id,
            kind: 'paragraph',
            props: {
                text: block.text,
            },
        };
    }

    if (block.blockType === 'markdown') {
        return {
            blockId: block.id,
            kind: 'callout',
            props: {
                source: block.source,
                text: block.source,
            },
        };
    }

    return {
        blockId: block.id,
        kind: 'custom',
        props: {
            ...(block.payload ?? {}),
            ...(block.textualProjection ? { textualProjection: block.textualProjection } : {}),
            ...(block.metadata ? { metadata: block.metadata } : {}),
        },
    };
}

function toLegacyBodyBlock(block: ReturnType<typeof toRuntimeBodyBlock> | { blockId: string; kind: string; props: Record<string, unknown> }): {
    blockType: string;
    source?: string;
    text?: string;
    payload?: Record<string, unknown>;
} {
    if (block.kind === 'paragraph') {
        return {
            blockType: 'text',
            text: typeof block.props.text === 'string' ? block.props.text : '',
        };
    }

    if (block.kind === 'callout') {
        return {
            blockType: 'markdown',
            source: typeof block.props.source === 'string' ? block.props.source : '',
        };
    }

    return {
        blockType: 'runtime.custom',
        payload: block.props,
    };
}

function toRuntimeNodeKind(nodeType: string): 'node' | 'sticker' {
    return nodeType === 'sticker' ? 'sticker' : 'node';
}

function toRuntimeNodeType(nodeType: string): string {
    return nodeType === 'mindmap' ? 'shape' : nodeType;
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

async function withCanonicalContext<T>(rootPath: string | undefined, run: (context: {
    db: Awaited<ReturnType<typeof createCanonicalPgliteDb>>['db'];
    repository: CanonicalPersistenceRepository;
    targetDir: string;
    dataDir: string | null;
    workspaceId: string;
}) => Promise<T>): Promise<T> {
    const targetDir = resolve(rootPath || process.env.MAGAM_TARGET_DIR || process.cwd());
    const workspaceId = process.env.MAGAM_WORKSPACE_ID?.trim() || sanitizeWorkspaceId(targetDir);
    await mkdir(resolve(targetDir, '.magam'), { recursive: true });
    const handle = await createCanonicalPgliteDb(targetDir, {
        migrationsFolder: resolve(process.cwd(), 'libs', 'shared', 'src', 'lib', 'canonical-persistence', 'drizzle'),
        runMigrations: true,
    });

    try {
        const repository = new CanonicalPersistenceRepository(handle.db);
        return await run({
            db: handle.db,
            repository,
            targetDir,
            dataDir: handle.dataDir,
            workspaceId,
        });
    } finally {
        await handle.close();
    }
}

async function resolveCanvasCompatibilityPath(canvasId: string, rootPath?: string): Promise<{ filePath: string; resolvedFilePath: string }> {
    const targetDir = resolve(rootPath || process.env.MAGAM_TARGET_DIR || process.cwd());
    const filePath = await resolveCanonicalCanvasCompatibilityFilePath({
        targetDir,
        canvasId,
    });
    if (!filePath) {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: `canvasId ${canvasId} has no compatibility path` };
    }
    return {
        filePath,
        resolvedFilePath: resolveWorkspaceFilePath(filePath, targetDir),
    };
}

async function ensureCommonParams(params: Record<string, unknown>) {
    const canvasId = ensureOptionalString(params.canvasId, 'canvasId');
    const inputFilePath = ensureOptionalString(params.filePath, 'filePath');
    if (!canvasId && !inputFilePath) {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'canvasId is required' };
    }
    const baseVersion = ensureString(params.baseVersion, 'baseVersion');
    const originId = ensureString(params.originId, 'originId');
    const commandId = ensureString(params.commandId, 'commandId');
    const rootPath = ensureOptionalRootPath(params.rootPath, 'rootPath');
    const resolved = inputFilePath
        ? { filePath: inputFilePath, resolvedFilePath: resolveWorkspaceFilePath(inputFilePath, rootPath) }
        : await resolveCanvasCompatibilityPath(canvasId as string, rootPath);
    return { canvasId: canvasId ?? undefined, filePath: resolved.filePath, resolvedFilePath: resolved.resolvedFilePath, rootPath, baseVersion, originId, commandId };
}

function ensureRuntimeCommonParams(params: Record<string, unknown>) {
    const canvasId = ensureString(params.canvasId, 'canvasId');
    const originId = ensureString(params.originId, 'originId');
    const commandId = ensureString(params.commandId, 'commandId');
    const rootPath = ensureOptionalRootPath(params.rootPath, 'rootPath');
    return { canvasId, originId, commandId, rootPath };
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
    common: { canvasId?: string; filePath: string; resolvedFilePath: string; rootPath?: string; baseVersion: string; originId: string; commandId: string },
    mutator: () => Promise<void>,
): Promise<{ success: boolean; newVersion: string; commandId: string; canvasId?: string; filePath: string; resolvedFilePath: string }> {
    return runWithOptionalFileMutex(common.resolvedFilePath, async () => {
        await ensureBaseVersion(common.resolvedFilePath, common.baseVersion);
        await mutator();
        const newVersion = await getFileVersion(common.resolvedFilePath);
        ctx.notifyFileChanged?.({
            canvasId: common.canvasId,
            filePath: common.filePath,
            resolvedFilePath: common.resolvedFilePath,
            newVersion,
            originId: common.originId,
            commandId: common.commandId,
            ...(common.rootPath ? { rootPath: common.rootPath } : {}),
        });
        return {
            success: true,
            newVersion,
            commandId: common.commandId,
            canvasId: common.canvasId,
            filePath: common.filePath,
            resolvedFilePath: common.resolvedFilePath,
        };
    });
}

function runtimeFailureToRpcError(envelope: MutationResultEnvelopeV1): never {
    if (envelope.ok) {
        throw { ...RPC_ERRORS.INTERNAL_ERROR, data: 'Expected runtime mutation failure.' };
    }

    if (envelope.error.code === 'VERSION_CONFLICT') {
        throw {
            ...RPC_ERRORS.VERSION_CONFLICT,
            data: {
                expected: envelope.error.details?.expectedCanvasRevision,
                actual: envelope.error.details?.actualCanvasRevision,
                ...envelope.error.details,
            },
        };
    }

    if (envelope.error.code === 'NOT_FOUND') {
        throw {
            ...RPC_ERRORS.NODE_NOT_FOUND,
            data: envelope.error.details,
        };
    }

    if (envelope.error.code === 'VALIDATION_FAILED') {
        throw {
            ...RPC_ERRORS.CONTENT_CONTRACT_VIOLATION,
            data: envelope.error.details,
        };
    }

    throw {
        ...RPC_ERRORS.PATCH_FAILED,
        data: envelope.error.details ?? { reason: envelope.error.message },
    };
}

async function executeRuntimeMutation(
    rootPath: string | undefined,
    buildBatch: (
        workspaceId: string,
        runtimeContext: ReturnType<typeof createCanvasRuntimeServiceContext>,
    ) => Promise<CanvasMutationBatchV1> | CanvasMutationBatchV1,
) {
    return withCanonicalContext(rootPath, async ({ db, repository, targetDir, dataDir, workspaceId }) => {
        const runtimeContext = createCanvasRuntimeServiceContext({
            db,
            repository,
            targetDir,
            dataDir,
            defaultWorkspaceId: workspaceId,
        });
        const batch = await buildBatch(workspaceId, runtimeContext);
        return dispatchCanvasMutation(runtimeContext, batch);
    });
}

function ensureRuntimeMutationBatch(
    value: unknown,
    fallbackCanvasId?: string,
): CanvasMutationBatchV1 {
    const batch = ensureRecord(value, 'batch');
    const commands = Array.isArray(batch.commands)
        ? batch.commands.filter((command): command is CanvasMutationBatchV1['commands'][number] => isRecord(command))
        : [];

    if (commands.length === 0) {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'batch.commands must include at least one command' };
    }

    const workspaceId = typeof batch.workspaceId === 'string' && batch.workspaceId.length > 0
        ? batch.workspaceId
        : 'workspace';
    const canvasId = typeof batch.canvasId === 'string' && batch.canvasId.length > 0
        ? batch.canvasId
        : fallbackCanvasId;

    return {
        workspaceId,
        ...(canvasId ? { canvasId } : {}),
        ...(typeof batch.reason === 'string' ? { reason: batch.reason } : {}),
        ...(typeof batch.sessionId === 'string' && batch.sessionId.length > 0 ? { sessionId: batch.sessionId } : {}),
        ...(typeof batch.dryRun === 'boolean' ? { dryRun: batch.dryRun } : {}),
        ...(isRecord(batch.actor) && typeof batch.actor.kind === 'string' && typeof batch.actor.id === 'string'
            ? {
                actor: {
                    kind: batch.actor.kind as CanvasMutationBatchV1['actor'] extends infer T
                        ? T extends { kind: infer U; id: string }
                            ? U
                            : never
                        : never,
                    id: batch.actor.id,
                },
            }
            : {}),
        ...(isRecord(batch.preconditions) && typeof batch.preconditions.canvasRevision === 'number'
            ? {
                preconditions: {
                    canvasRevision: batch.preconditions.canvasRevision,
                },
            }
            : {}),
        commands,
    };
}

function ensureCanvasUndoRequest(value: Record<string, unknown>, fallbackCanvasId?: string): CanvasUndoRequestV1 {
    const canvasId = typeof value.canvasId === 'string' && value.canvasId.length > 0
        ? value.canvasId
        : fallbackCanvasId;
    if (!canvasId) {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'canvasId is required' };
    }

    return {
        canvasId,
        actorId: ensureString(value.actorId, 'actorId'),
        sessionId: ensureString(value.sessionId, 'sessionId'),
    };
}

function ensureCanvasRedoRequest(value: Record<string, unknown>, fallbackCanvasId?: string): CanvasRedoRequestV1 {
    const canvasId = typeof value.canvasId === 'string' && value.canvasId.length > 0
        ? value.canvasId
        : fallbackCanvasId;
    if (!canvasId) {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'canvasId is required' };
    }

    return {
        canvasId,
        actorId: ensureString(value.actorId, 'actorId'),
        sessionId: ensureString(value.sessionId, 'sessionId'),
    };
}

function getCompatibilityPatchNodeId(input: {
    command: CanvasMutationBatchV1['commands'][number];
    nodesByObjectId: Map<string, string>;
}): string {
    if ('nodeId' in input.command && typeof input.command.nodeId === 'string') {
        return input.command.nodeId;
    }

    if ('objectId' in input.command && typeof input.command.objectId === 'string') {
        return input.nodesByObjectId.get(input.command.objectId) ?? input.command.objectId;
    }

    throw { ...RPC_ERRORS.PATCH_SURFACE_VIOLATION, data: { reason: 'Cannot resolve compatibility patch node id.' } };
}

function resolveAfterBlockIdForCompatibilityPatch(input: {
    command: Extract<CanvasMutationBatchV1['commands'][number], { name: 'object.body.block.insert' }>;
    objectRecord: Parameters<typeof readContentBlocks>[0];
}): string | undefined {
    const blocks = readContentBlocks(input.objectRecord ?? {}) ?? [];
    const position = input.command.position;

    if (position.mode === 'start') {
        return undefined;
    }

    if (position.mode === 'end') {
        return blocks.at(-1)?.id;
    }

    if (position.mode === 'index') {
        return position.index > 0 ? blocks[position.index - 1]?.id : undefined;
    }

    if (position.mode === 'anchor') {
        const match = position.anchorId.match(/:body-(before|after):([^:]+)$/);
        if (!match) {
            return blocks.at(-1)?.id;
        }

        const [, relation, blockId] = match;
        if (relation === 'after') {
            return blockId;
        }

        const index = blocks.findIndex((block) => block.id === blockId);
        return index > 0 ? blocks[index - 1]?.id : undefined;
    }

    return blocks.at(-1)?.id;
}

async function applyRuntimeMutationCompatibilityPatches(input: {
    runtimeContext: ReturnType<typeof createCanvasRuntimeServiceContext>;
    batch: CanvasMutationBatchV1;
    resolvedFilePath: string;
}): Promise<void> {
    const nodes = input.batch.canvasId
        ? await input.runtimeContext.repository.listCanvasNodes(input.batch.canvasId)
        : [];
    const nodesByObjectId = new Map(
        nodes
            .filter((node) => typeof node.canonicalObjectId === 'string' && node.canonicalObjectId.length > 0)
            .map((node) => [node.canonicalObjectId as string, node.id]),
    );

    for (const command of input.batch.commands) {
        switch (command.name) {
            case 'canvas.node.create': {
                const props: Record<string, unknown> = {
                    ...(typeof command.transform?.width === 'number' ? { width: command.transform.width } : {}),
                    ...(typeof command.transform?.height === 'number' ? { height: command.transform.height } : {}),
                    ...(typeof command.transform?.rotation === 'number' ? { rotation: command.transform.rotation } : {}),
                    ...(typeof command.presentationStyle?.fillColor === 'string' ? { fill: command.presentationStyle.fillColor } : {}),
                    ...(typeof command.presentationStyle?.strokeColor === 'string' ? { stroke: command.presentationStyle.strokeColor } : {}),
                    ...(typeof command.presentationStyle?.strokeWidth === 'number' ? { strokeWidth: command.presentationStyle.strokeWidth } : {}),
                    ...(typeof command.presentationStyle?.opacity === 'number' ? { opacity: command.presentationStyle.opacity } : {}),
                    ...(typeof command.presentationStyle?.textColor === 'string' ? { color: command.presentationStyle.textColor } : {}),
                    ...(typeof command.presentationStyle?.fontFamily === 'string' ? { fontFamily: command.presentationStyle.fontFamily } : {}),
                    ...(typeof command.presentationStyle?.fontSize === 'number' ? { fontSize: command.presentationStyle.fontSize } : {}),
                    ...(typeof command.renderProfile?.inkProfile === 'string' ? { inkProfile: command.renderProfile.inkProfile } : {}),
                    ...(typeof command.renderProfile?.paperBlend === 'string' ? { paperBlend: command.renderProfile.paperBlend } : {}),
                };

                const placement = command.placement.mode === 'mindmap-child'
                    ? { mode: 'mindmap-child' as const, parentId: command.placement.parentNodeId }
                    : command.placement.mode === 'mindmap-sibling'
                        ? {
                            mode: 'mindmap-sibling' as const,
                            siblingOf: command.placement.siblingOfNodeId,
                            parentId: command.placement.parentNodeId,
                        }
                        : command.placement.mode === 'mindmap-root'
                            ? {
                                mode: 'mindmap-root' as const,
                                x: command.placement.x,
                                y: command.placement.y,
                                mindmapId: typeof command.placement.mindmapId === 'string' && command.placement.mindmapId.length > 0
                                    ? command.placement.mindmapId
                                    : `mindmap-${command.nodeId}`,
                            }
                            : {
                                mode: 'canvas-absolute' as const,
                                x: command.placement.x,
                                y: command.placement.y,
                            };

                await patchNodeCreate(input.resolvedFilePath, {
                    id: command.nodeId,
                    type: (command.nodeType ?? 'shape') as CreateNodeInput['type'],
                    props,
                    placement,
                });
                break;
            }

            case 'canvas.node.move':
                await patchNodePosition(input.resolvedFilePath, command.nodeId, command.x, command.y);
                break;

            case 'canvas.node.reparent':
                await patchNodeReparent(input.resolvedFilePath, command.nodeId, command.parentNodeId);
                break;

            case 'canvas.node.resize':
                await patchFile(input.resolvedFilePath, command.nodeId, {
                    width: command.nextSize.width,
                    height: command.nextSize.height,
                    size: {
                        width: command.nextSize.width,
                        height: command.nextSize.height,
                    },
                });
                break;

            case 'canvas.node.rotate':
                await patchFile(input.resolvedFilePath, command.nodeId, { rotation: command.nextRotation });
                break;

            case 'canvas.node.presentation-style.update': {
                const patch: Record<string, unknown> = {
                    ...(typeof command.presentationStyle.fillColor === 'string' ? { fill: command.presentationStyle.fillColor } : {}),
                    ...(typeof command.presentationStyle.strokeColor === 'string' ? { stroke: command.presentationStyle.strokeColor } : {}),
                    ...(typeof command.presentationStyle.strokeWidth === 'number' ? { strokeWidth: command.presentationStyle.strokeWidth } : {}),
                    ...(typeof command.presentationStyle.opacity === 'number' ? { opacity: command.presentationStyle.opacity } : {}),
                    ...(typeof command.presentationStyle.textColor === 'string' ? { color: command.presentationStyle.textColor } : {}),
                    ...(typeof command.presentationStyle.fontFamily === 'string' ? { fontFamily: command.presentationStyle.fontFamily } : {}),
                    ...(typeof command.presentationStyle.fontSize === 'number' ? { fontSize: command.presentationStyle.fontSize } : {}),
                };
                if (Object.keys(patch).length > 0) {
                    await patchNodeStyle(input.resolvedFilePath, command.nodeId, patch as NodeProps);
                }
                break;
            }

            case 'canvas.node.render-profile.update':
                await patchFile(input.resolvedFilePath, command.nodeId, {
                    ...command.renderProfile,
                });
                break;

            case 'canvas.node.rename':
                await patchFile(input.resolvedFilePath, command.nodeId, {
                    label: command.nextDisplayName,
                });
                break;

            case 'canvas.node.delete':
                await patchNodeDelete(input.resolvedFilePath, command.nodeId);
                break;

            case 'canvas.node.z-order.update':
                await patchFile(input.resolvedFilePath, command.nodeId, { zIndex: command.zIndex });
                break;

            case 'object.content.update': {
                const nodeId = getCompatibilityPatchNodeId({ command, nodesByObjectId });
                const nextContent = typeof command.patch.text === 'string'
                    ? command.patch.text
                    : typeof command.patch.source === 'string'
                        ? command.patch.source
                        : typeof command.patch.value === 'string'
                            ? command.patch.value
                            : null;
                if (nextContent !== null) {
                    await patchNodeContent(input.resolvedFilePath, nodeId, nextContent);
                }
                break;
            }

            case 'object.body.block.insert': {
                const nodeId = getCompatibilityPatchNodeId({ command, nodesByObjectId });
                const objectResult = await input.runtimeContext.repository.getCanonicalObject(
                    input.batch.workspaceId,
                    command.objectId,
                );
                if (!objectResult.ok) {
                    throw { ...RPC_ERRORS.NODE_NOT_FOUND, data: { objectId: command.objectId } };
                }
                const afterBlockId = resolveAfterBlockIdForCompatibilityPatch({
                    command,
                    objectRecord: objectResult.value,
                });
                await patchNodeBodyBlockInsert(
                    input.resolvedFilePath,
                    nodeId,
                    toLegacyBodyBlock(command.block),
                    afterBlockId,
                );
                break;
            }

            default:
                throw {
                    ...RPC_ERRORS.PATCH_SURFACE_VIOLATION,
                    data: {
                        reason: `Unsupported compatibility patch command ${command.name}.`,
                    },
                };
        }
    }
}

async function handleCanvasRuntimeMutate(
    params: Record<string, unknown>,
    ctx: RpcContext,
): Promise<{ success: boolean; commandId: string; canvasId: string; canvasRevision?: number; runtimeResult: MutationResultEnvelopeV1 }> {
    const common = ensureRuntimeCommonParams(params);
    const initialBatch = ensureRuntimeMutationBatch(params.batch, common.canvasId);

    try {
        const runtimeMutation = await executeRuntimeMutation(common.rootPath, (workspaceId) => ({
            ...initialBatch,
            workspaceId,
            canvasId: initialBatch.canvasId ?? common.canvasId,
        }));
        if (!runtimeMutation.envelope.ok) {
            runtimeFailureToRpcError(runtimeMutation.envelope);
        }

        const canvasRevision = runtimeMutation.envelope.data.canvasRevisionAfter ?? undefined;
        if (!runtimeMutation.envelope.data.dryRun && typeof canvasRevision === 'number') {
            ctx.notifyCanvasChanged?.({
                canvasId: common.canvasId,
                canvasRevision,
                originId: common.originId,
                commandId: common.commandId,
                ...(common.rootPath ? { rootPath: common.rootPath } : {}),
            });
        }

        return {
            success: true,
            commandId: common.commandId,
            canvasId: common.canvasId,
            ...(typeof canvasRevision === 'number' ? { canvasRevision } : {}),
            runtimeResult: runtimeMutation.envelope,
        };
    } catch (error) {
        const e = error as { code?: number; message?: string; data?: unknown } | Error;
        const diagnostics = createIntentScopedDiagnostics({
            failedAction: 'canvas.runtime.mutate',
            stage: 'ws.canvas.runtime.mutate',
            details: {
                canvasId: initialBatch.canvasId ?? common.canvasId ?? null,
            },
        });
        if (typeof (e as any).code === 'number') {
            const typed = e as { code: number; message?: string; data?: unknown };
            throw {
                code: typed.code,
                message: typed.message,
                data: withDiagnostics(typed.data, diagnostics),
            };
        }
        throw { ...RPC_ERRORS.PATCH_FAILED, data: withDiagnostics({ reason: (e as Error).message }, diagnostics) };
    }
}

async function handleCanvasRuntimeUndo(
    params: Record<string, unknown>,
    ctx: RpcContext,
): Promise<{ success: boolean; commandId: string; canvasId: string; canvasRevision?: number; runtimeResult: MutationResultEnvelopeV1 }> {
    const common = ensureRuntimeCommonParams(params);
    const request = ensureCanvasUndoRequest(params, common.canvasId);

    try {
        const runtimeMutation = await withCanonicalContext(common.rootPath, async ({ db, repository, targetDir, dataDir, workspaceId }) => {
            const runtimeContext = createCanvasRuntimeServiceContext({
                db,
                repository,
                targetDir,
                dataDir,
                defaultWorkspaceId: workspaceId,
            });
            return undoCanvasMutation(runtimeContext, request);
        });

        const canvasRevision = runtimeMutation.envelope.ok
            ? runtimeMutation.envelope.data.canvasRevisionAfter ?? undefined
            : undefined;
        if (runtimeMutation.envelope.ok && typeof canvasRevision === 'number') {
            ctx.notifyCanvasChanged?.({
                canvasId: request.canvasId,
                canvasRevision,
                originId: common.originId,
                commandId: common.commandId,
                ...(common.rootPath ? { rootPath: common.rootPath } : {}),
            });
        }

        return {
            success: runtimeMutation.envelope.ok,
            commandId: common.commandId,
            canvasId: request.canvasId,
            ...(typeof canvasRevision === 'number' ? { canvasRevision } : {}),
            runtimeResult: runtimeMutation.envelope,
        };
    } catch (error) {
        const e = error as { code?: number; message?: string; data?: unknown } | Error;
        const diagnostics = createIntentScopedDiagnostics({
            failedAction: 'canvas.runtime.undo',
            stage: 'ws.canvas.runtime.undo',
            details: {
                canvasId: request.canvasId,
            },
        });
        if (typeof (e as any).code === 'number') {
            const typed = e as { code: number; message?: string; data?: unknown };
            throw {
                code: typed.code,
                message: typed.message,
                data: withDiagnostics(typed.data, diagnostics),
            };
        }
        throw { ...RPC_ERRORS.PATCH_FAILED, data: withDiagnostics({ reason: (e as Error).message }, diagnostics) };
    }
}

async function handleCanvasRuntimeRedo(
    params: Record<string, unknown>,
    ctx: RpcContext,
): Promise<{ success: boolean; commandId: string; canvasId: string; canvasRevision?: number; runtimeResult: MutationResultEnvelopeV1 }> {
    const common = ensureRuntimeCommonParams(params);
    const request = ensureCanvasRedoRequest(params, common.canvasId);

    try {
        const runtimeMutation = await withCanonicalContext(common.rootPath, async ({ db, repository, targetDir, dataDir, workspaceId }) => {
            const runtimeContext = createCanvasRuntimeServiceContext({
                db,
                repository,
                targetDir,
                dataDir,
                defaultWorkspaceId: workspaceId,
            });
            return redoCanvasMutation(runtimeContext, request);
        });

        const canvasRevision = runtimeMutation.envelope.ok
            ? runtimeMutation.envelope.data.canvasRevisionAfter ?? undefined
            : undefined;
        if (runtimeMutation.envelope.ok && typeof canvasRevision === 'number') {
            ctx.notifyCanvasChanged?.({
                canvasId: request.canvasId,
                canvasRevision,
                originId: common.originId,
                commandId: common.commandId,
                ...(common.rootPath ? { rootPath: common.rootPath } : {}),
            });
        }

        return {
            success: runtimeMutation.envelope.ok,
            commandId: common.commandId,
            canvasId: request.canvasId,
            ...(typeof canvasRevision === 'number' ? { canvasRevision } : {}),
            runtimeResult: runtimeMutation.envelope,
        };
    } catch (error) {
        const e = error as { code?: number; message?: string; data?: unknown } | Error;
        const diagnostics = createIntentScopedDiagnostics({
            failedAction: 'canvas.runtime.redo',
            stage: 'ws.canvas.runtime.redo',
            details: {
                canvasId: request.canvasId,
            },
        });
        if (typeof (e as any).code === 'number') {
            const typed = e as { code: number; message?: string; data?: unknown };
            throw {
                code: typed.code,
                message: typed.message,
                data: withDiagnostics(typed.data, diagnostics),
            };
        }
        throw { ...RPC_ERRORS.PATCH_FAILED, data: withDiagnostics({ reason: (e as Error).message }, diagnostics) };
    }
}

async function handleFileSubscribe(params: Record<string, unknown>, ctx: RpcContext): Promise<{ success: boolean }> {
    const rootPath = ensureOptionalRootPath(params.rootPath, 'rootPath');
    const canvasId = ensureOptionalString(params.canvasId, 'canvasId');
    const filePath = ensureOptionalString(params.filePath, 'filePath');
    if (!canvasId && !filePath) {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'canvasId is required' };
    }
    if (filePath) {
        ctx.subscriptions.add(resolveWorkspaceFilePath(filePath, rootPath));
        return { success: true };
    }
    const resolved = await resolveCanvasCompatibilityPath(canvasId as string, rootPath);
    ctx.subscriptions.add(resolved.resolvedFilePath);
    return { success: true };
}

async function handleCanvasSubscribe(params: Record<string, unknown>, ctx: RpcContext): Promise<{ success: boolean }> {
    const canvasId = ensureString(params.canvasId, 'canvasId');
    ctx.subscriptions.add(`canvas:${canvasId}`);
    return { success: true };
}

async function handleFileUnsubscribe(params: Record<string, unknown>, ctx: RpcContext): Promise<{ success: boolean }> {
    const rootPath = ensureOptionalRootPath(params.rootPath, 'rootPath');
    const canvasId = ensureOptionalString(params.canvasId, 'canvasId');
    const filePath = ensureOptionalString(params.filePath, 'filePath');
    if (!canvasId && !filePath) {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'canvasId is required' };
    }
    if (filePath) {
        ctx.subscriptions.delete(resolveWorkspaceFilePath(filePath, rootPath));
        return { success: true };
    }
    const resolved = await resolveCanvasCompatibilityPath(canvasId as string, rootPath);
    ctx.subscriptions.delete(resolved.resolvedFilePath);
    return { success: true };
}

async function handleCanvasUnsubscribe(params: Record<string, unknown>, ctx: RpcContext): Promise<{ success: boolean }> {
    const canvasId = ensureString(params.canvasId, 'canvasId');
    ctx.subscriptions.delete(`canvas:${canvasId}`);
    return { success: true };
}

async function handleCanvasRuntimeProjections(
    params: Record<string, unknown>,
    _ctx: RpcContext,
): Promise<{
    canvasId: string;
    hierarchyProjection: Awaited<ReturnType<typeof buildHierarchyProjection>>;
    renderProjection: Awaited<ReturnType<typeof buildRenderProjection>>;
    editingProjection: Awaited<ReturnType<typeof buildEditingProjection>>;
}> {
    const canvasId = ensureString(params.canvasId, 'canvasId');
    const rootPath = ensureOptionalRootPath(params.rootPath, 'rootPath');
    const surfaceId = ensureOptionalString(params.surfaceId, 'surfaceId');
    const workspaceIdParam = ensureOptionalString(params.workspaceId, 'workspaceId');
    const nodeIds = Array.isArray(params.nodeIds)
        ? params.nodeIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
        : undefined;

    return withCanonicalContext(rootPath, async ({ db, repository, targetDir, dataDir, workspaceId }) => {
        const runtimeContext = createCanvasRuntimeServiceContext({
            db,
            repository,
            targetDir,
            dataDir,
            defaultWorkspaceId: workspaceId,
        });
        const resolvedWorkspaceId = workspaceIdParam ?? workspaceId;

        const [hierarchyProjection, renderProjection, editingProjection] = await Promise.all([
            buildHierarchyProjection(runtimeContext, {
                canvasId,
                workspaceId: resolvedWorkspaceId,
                ...(surfaceId ? { surfaceId } : {}),
            }),
            buildRenderProjection(runtimeContext, {
                canvasId,
                workspaceId: resolvedWorkspaceId,
                ...(surfaceId ? { surfaceId } : {}),
            }),
            buildEditingProjection(runtimeContext, {
                canvasId,
                workspaceId: resolvedWorkspaceId,
                ...(surfaceId ? { surfaceId } : {}),
                ...(nodeIds && nodeIds.length > 0 ? { nodeIds } : {}),
            }),
        ]);

        return {
            canvasId,
            hierarchyProjection,
            renderProjection,
            editingProjection,
        };
    });
}

async function handleNodeUpdate(
    params: Record<string, unknown>,
    ctx: RpcContext,
): Promise<{ success: boolean; newVersion: string; commandId: string; filePath: string; runtimeResult?: MutationResultEnvelopeV1 }> {
    const common = await ensureCommonParams(params);
    const nodeId = ensureString(params.nodeId, 'nodeId');
    const props = params.props as NodeProps | undefined;
    const explicitCommandType = ensureOptionalUpdateCommandType(params.commandType);

    if (!props || typeof props !== 'object') {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'props is required' };
    }

    const commandType = inferUpdateCommandType(props, explicitCommandType);

    try {
        let runtimeResult: MutationResultEnvelopeV1 | undefined;
        const result = await mutateWithContract(ctx, common, async () => {
            if (common.canvasId && commandType && commandType !== 'node.move.relative' && commandType !== 'node.group.update' && commandType !== 'node.rename') {
                const runtimeMutation = await executeRuntimeMutation(common.rootPath, async (workspaceId, runtimeContext) => {
                    if (commandType === 'node.style.update') {
                        return {
                            workspaceId,
                            canvasId: common.canvasId!,
                            commands: [{
                                name: 'canvas.node.presentation-style.update',
                                canvasId: common.canvasId!,
                                nodeId,
                                presentationStyle: {
                                    ...(typeof props.fill === 'string' ? { fillColor: props.fill } : {}),
                                    ...(typeof props.stroke === 'string' ? { strokeColor: props.stroke } : {}),
                                    ...(typeof props.strokeWidth === 'number' ? { strokeWidth: props.strokeWidth } : {}),
                                    ...(typeof props.opacity === 'number' ? { opacity: props.opacity } : {}),
                                    ...(typeof props.color === 'string' ? { textColor: props.color } : {}),
                                    ...(typeof props.fontFamily === 'string' ? { fontFamily: props.fontFamily } : {}),
                                    ...(typeof props.fontSize === 'number' ? { fontSize: props.fontSize } : {}),
                                },
                            }],
                        };
                    }

                    if (commandType === 'node.z-order.update') {
                        return {
                            workspaceId,
                            canvasId: common.canvasId!,
                            commands: [{
                                name: 'canvas.node.z-order.update',
                                canvasId: common.canvasId!,
                                nodeId,
                                zIndex: ensureNumber(props.zIndex, 'props.zIndex'),
                            }],
                        };
                    }

                    const nodeRecord = await runtimeContext.repository.getCanvasNode(common.canvasId!, nodeId);
                    if (!nodeRecord.ok) {
                        throw { ...RPC_ERRORS.NODE_NOT_FOUND, data: { nodeId } };
                    }
                    const objectId = nodeRecord.value.canonicalObjectId ?? nodeId;
                    const objectRecord = await runtimeContext.repository.getCanonicalObject(workspaceId, objectId);
                    if (!objectRecord.ok) {
                        throw { ...RPC_ERRORS.NODE_NOT_FOUND, data: { nodeId, objectId } };
                    }
                    const contentKind = objectRecord.value.primaryContentKind === 'text'
                        ? 'text'
                        : objectRecord.value.primaryContentKind === 'media'
                            ? 'media'
                            : objectRecord.value.primaryContentKind === 'sequence'
                                ? 'sequence'
                                : 'markdown';

                        return {
                            workspaceId,
                            canvasId: common.canvasId!,
                            commands: [{
                                name: 'object.content.update',
                            objectId,
                            kind: contentKind,
                            patch: contentKind === 'text'
                                ? { text: props.content, value: props.content }
                                : { source: props.content, value: props.content },
                            expectedContentKind: contentKind,
                        }],
                    };
                });

                if (!runtimeMutation.envelope.ok) {
                    runtimeFailureToRpcError(runtimeMutation.envelope);
                }
                runtimeResult = runtimeMutation.envelope;
            }

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
        return runtimeResult ? { ...result, runtimeResult } : result;
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
): Promise<{ success: boolean; newVersion: string; commandId: string; filePath: string; runtimeResult?: MutationResultEnvelopeV1 }> {
    const common = await ensureCommonParams(params);
    const nodeId = ensureString(params.nodeId, 'nodeId');
    const x = ensureNumber(params.x, 'x');
    const y = ensureNumber(params.y, 'y');

    try {
        let runtimeResult: MutationResultEnvelopeV1 | undefined;
        const result = await mutateWithContract(ctx, common, async () => {
            if (common.canvasId) {
                const runtimeMutation = await executeRuntimeMutation(common.rootPath, (workspaceId) => ({
                    workspaceId,
                    canvasId: common.canvasId!,
                    commands: [{
                        name: 'canvas.node.move',
                        canvasId: common.canvasId!,
                        nodeId,
                        x,
                        y,
                    }],
                }));

                if (!runtimeMutation.envelope.ok) {
                    runtimeFailureToRpcError(runtimeMutation.envelope);
                }
                runtimeResult = runtimeMutation.envelope;
            }

            const collisionIds = await getGlobalIdentifierCollisions(common.resolvedFilePath);
            if (collisionIds.length > 0) {
                throw { ...RPC_ERRORS.ID_COLLISION, data: { collisionIds } };
            }
            await patchNodePosition(common.resolvedFilePath, nodeId, x, y);
        });
        return runtimeResult ? { ...result, runtimeResult } : result;
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
): Promise<{ success: boolean; newVersion: string; commandId: string; filePath: string; runtimeResult?: MutationResultEnvelopeV1 }> {
    const common = await ensureCommonParams(params);
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
        let runtimeResult: MutationResultEnvelopeV1 | undefined;
        const result = await mutateWithContract(ctx, common, async () => {
            if (common.canvasId) {
                const runtimeMutation = await executeRuntimeMutation(common.rootPath, (workspaceId) => ({
                    workspaceId,
                    canvasId: common.canvasId,
                    commands: [{
                        name: 'canvas.node.create',
                        canvasId: common.canvasId!,
                        nodeId: node.id,
                        kind: toRuntimeNodeKind(node.type),
                        nodeType: toRuntimeNodeType(node.type),
                        placement: node.placement?.mode === 'mindmap-child'
                            ? { mode: 'mindmap-child', parentNodeId: node.placement.parentId }
                            : node.placement?.mode === 'mindmap-sibling'
                                ? {
                                    mode: 'mindmap-sibling',
                                    siblingOfNodeId: node.placement.siblingOf,
                                    parentNodeId: node.placement.parentId,
                                }
                                : node.placement?.mode === 'mindmap-root'
                                    ? {
                                    mode: 'mindmap-root',
                                    x: node.placement.x,
                                    y: node.placement.y,
                                    mindmapId: node.placement.mindmapId ?? `mindmap-${node.id}`,
                                }
                                    : {
                                        mode: 'canvas-absolute',
                                        x: ensureNumber((node.placement as Record<string, unknown>).x, 'node.placement.x'),
                                        y: ensureNumber((node.placement as Record<string, unknown>).y, 'node.placement.y'),
                                    },
                    }],
                }));

                if (!runtimeMutation.envelope.ok) {
                    runtimeFailureToRpcError(runtimeMutation.envelope);
                }
                runtimeResult = runtimeMutation.envelope;
            }

            const collisionIds = await getGlobalIdentifierCollisions(common.resolvedFilePath);
            if (collisionIds.length > 0) {
                throw { ...RPC_ERRORS.ID_COLLISION, data: { collisionIds } };
            }
            await patchNodeCreate(common.resolvedFilePath, node);
        });
        return runtimeResult ? { ...result, runtimeResult } : result;
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

async function handleCanvasNodeCreate(
    params: Record<string, unknown>,
    ctx: RpcContext,
): Promise<{ success: boolean; newVersion: string; commandId: string; filePath: string; runtimeResult?: MutationResultEnvelopeV1 }> {
    const common = await ensureCommonParams(params);
    const node = params.node as CreateNodeInput | undefined;

    if (!node || typeof node !== 'object') {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'node is required' };
    }

    if (!common.canvasId) {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'canvasId is required' };
    }

    const nodeId = ensureString(node.id, 'node.id');
    const nodeType = ensureString(node.type, 'node.type') as CreateNodeInput['type'];
    const placement = ensureCreatePlacement(node.placement);

    if (
        ![
            'shape',
            'rectangle',
            'ellipse',
            'diamond',
            'line',
            'text',
            'markdown',
            'sticky',
            'sticker',
            'washi-tape',
            'image',
        ].includes(nodeType)
    ) {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'node.type is invalid' };
    }

    if (!placement) {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'node.placement is required' };
    }

    try {
        let runtimeResult: MutationResultEnvelopeV1 | undefined;
        const result = await mutateWithContract(ctx, common, async () => {
            const runtimeMutation = await executeRuntimeMutation(common.rootPath, (workspaceId) => ({
                workspaceId,
                canvasId: common.canvasId!,
                commands: [{
                    name: 'canvas.node.create',
                    canvasId: common.canvasId!,
                    nodeId,
                    kind: toRuntimeNodeKind(nodeType),
                    nodeType: toRuntimeNodeType(nodeType),
                    placement: placement.mode === 'mindmap-child'
                        ? { mode: 'mindmap-child', parentNodeId: placement.parentId }
                        : placement.mode === 'mindmap-sibling'
                            ? {
                                mode: 'mindmap-sibling',
                                siblingOfNodeId: placement.siblingOf,
                                parentNodeId: placement.parentId,
                            }
                            : placement.mode === 'mindmap-root'
                                ? {
                                mode: 'mindmap-root',
                                x: placement.x,
                                y: placement.y,
                                mindmapId: placement.mindmapId ?? `mindmap-${nodeId}`,
                            }
                                : {
                                    mode: 'canvas-absolute',
                                    x: placement.x,
                                    y: placement.y,
                                },
                    transform: {
                        ...(typeof (node.props as Record<string, unknown> | undefined)?.width === 'number'
                            ? { width: (node.props as Record<string, unknown>).width as number }
                            : {}),
                        ...(typeof (node.props as Record<string, unknown> | undefined)?.height === 'number'
                            ? { height: (node.props as Record<string, unknown>).height as number }
                            : {}),
                    },
                    presentationStyle: {
                        ...(typeof (node.props as Record<string, unknown> | undefined)?.fill === 'string'
                            ? { fillColor: (node.props as Record<string, unknown>).fill as string }
                            : {}),
                        ...(typeof (node.props as Record<string, unknown> | undefined)?.stroke === 'string'
                            ? { strokeColor: (node.props as Record<string, unknown>).stroke as string }
                            : {}),
                    },
                }],
            }));

            if (!runtimeMutation.envelope.ok) {
                runtimeFailureToRpcError(runtimeMutation.envelope);
            }
            runtimeResult = runtimeMutation.envelope;

            await patchNodeCreate(common.resolvedFilePath, {
                id: nodeId,
                type: nodeType,
                props: {
                    ...ensureRecord(node.props ?? {}, 'node.props'),
                    ...(typeof (node.props as Record<string, unknown> | undefined)?.content === 'string'
                        ? { content: (node.props as Record<string, unknown>).content }
                        : {}),
                },
                placement,
            });
        });
        return runtimeResult ? { ...result, runtimeResult } : result;
    } catch (error) {
        const e = error as { code?: number; message?: string; data?: unknown } | Error;
        const diagnostics = createIntentScopedDiagnostics({
            failedAction: 'canvas.node.create',
            stage: 'ws.canvas.node.create',
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
        if (message === 'NODE_NOT_FOUND') {
            throw { ...RPC_ERRORS.NODE_NOT_FOUND, data: withDiagnostics({ nodeId }, diagnostics) };
        }
        throw { ...RPC_ERRORS.PATCH_FAILED, data: withDiagnostics({ reason: message }, diagnostics) };
    }
}

async function handleObjectBodyBlockInsert(
    params: Record<string, unknown>,
    ctx: RpcContext,
): Promise<{ success: boolean; newVersion: string; commandId: string; filePath: string; runtimeResult?: MutationResultEnvelopeV1 }> {
    const common = await ensureCommonParams(params);
    if (!common.canvasId) {
        throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'canvasId is required' };
    }

    const objectId = ensureString(params.objectId, 'objectId');
    const block = ensureContentBlock(params.block);
    const afterBlockId = ensureOptionalString(params.afterBlockId, 'afterBlockId');

    try {
        let runtimeResult: MutationResultEnvelopeV1 | undefined;
        const result = await mutateWithContract(ctx, common, async () => {
            const runtimeMutation = await executeRuntimeMutation(common.rootPath, (workspaceId) => ({
                workspaceId,
                canvasId: common.canvasId!,
                commands: [{
                    name: 'object.body.block.insert',
                    objectId,
                    block: toRuntimeBodyBlock(block),
                    position: afterBlockId
                        ? { mode: 'anchor', anchorId: `node:${objectId}:body-after:${afterBlockId}` }
                        : { mode: 'end' },
                }],
            }));

            if (!runtimeMutation.envelope.ok) {
                runtimeFailureToRpcError(runtimeMutation.envelope);
            }
            runtimeResult = runtimeMutation.envelope;

            await patchNodeBodyBlockInsert(common.resolvedFilePath, objectId, block, afterBlockId);
        });
        return runtimeResult ? { ...result, runtimeResult } : result;
    } catch (error) {
        const e = error as { code?: number; message?: string; data?: unknown } | Error;
        const diagnostics = createIntentScopedDiagnostics({
            failedAction: 'object.body.block.insert',
            stage: 'ws.object.body.block.insert',
            details: { objectId, blockId: block.id },
        });
        if (typeof (e as any).code === 'number') {
            const typed = e as { code: number; message?: string; data?: unknown };
            throw {
                code: typed.code,
                message: typed.message,
                data: withDiagnostics(typed.data, diagnostics),
            };
        }
        throw { ...RPC_ERRORS.PATCH_FAILED, data: withDiagnostics({ reason: (e as Error).message }, diagnostics) };
    }
}

async function handleNodeDelete(
    params: Record<string, unknown>,
    ctx: RpcContext,
): Promise<{ success: boolean; newVersion: string; commandId: string; filePath: string; runtimeResult?: MutationResultEnvelopeV1 }> {
    const common = await ensureCommonParams(params);
    const nodeId = ensureString(params.nodeId, 'nodeId');

    try {
        let runtimeResult: MutationResultEnvelopeV1 | undefined;
        const result = await mutateWithContract(ctx, common, async () => {
            if (common.canvasId) {
                const runtimeMutation = await executeRuntimeMutation(common.rootPath, (workspaceId) => ({
                    workspaceId,
                    canvasId: common.canvasId!,
                    commands: [{
                        name: 'canvas.node.delete',
                        canvasId: common.canvasId!,
                        nodeId,
                    }],
                }));

                if (!runtimeMutation.envelope.ok) {
                    runtimeFailureToRpcError(runtimeMutation.envelope);
                }
                runtimeResult = runtimeMutation.envelope;
            }

            await patchNodeDelete(common.resolvedFilePath, nodeId);
        });
        return runtimeResult ? { ...result, runtimeResult } : result;
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
): Promise<{ success: boolean; newVersion: string; commandId: string; filePath: string; runtimeResult?: MutationResultEnvelopeV1 }> {
    const common = await ensureCommonParams(params);
    const nodeId = ensureString(params.nodeId, 'nodeId');
    const newParentId = ensureOptionalString(params.newParentId, 'newParentId');

    try {
        let runtimeResult: MutationResultEnvelopeV1 | undefined;
        const result = await mutateWithContract(ctx, common, async () => {
            if (common.canvasId) {
                const runtimeMutation = await executeRuntimeMutation(common.rootPath, (workspaceId) => ({
                    workspaceId,
                    canvasId: common.canvasId!,
                    commands: [{
                        name: 'canvas.node.reparent',
                        canvasId: common.canvasId!,
                        nodeId,
                        parentNodeId: newParentId ?? null,
                    }],
                }));

                if (!runtimeMutation.envelope.ok) {
                    runtimeFailureToRpcError(runtimeMutation.envelope);
                }
                runtimeResult = runtimeMutation.envelope;
            }

            await patchNodeReparent(common.resolvedFilePath, nodeId, newParentId || null);
        });
        return runtimeResult ? { ...result, runtimeResult } : result;
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
    const common = await ensureCommonParams(params);
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
    const common = await ensureCommonParams(params);
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
    const common = await ensureCommonParams(params);
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
    const common = await ensureCommonParams(params);
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
    'canvas.subscribe': handleCanvasSubscribe,
    'canvas.unsubscribe': handleCanvasUnsubscribe,
    'canvas.runtime.projections': handleCanvasRuntimeProjections,
    'canvas.runtime.mutate': handleCanvasRuntimeMutate,
    'canvas.runtime.undo': handleCanvasRuntimeUndo,
    'canvas.runtime.redo': handleCanvasRuntimeRedo,
    'canvas.node.create': handleCanvasNodeCreate,
    'object.body.block.insert': handleObjectBodyBlockInsert,
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
