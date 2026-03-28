import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { isAbsolute, resolve } from 'path';
import { resolveCanonicalCanvasCompatibilityFilePath } from '../../../libs/shared/src/lib/canonical-canvas-shell';
import {
  createCanvasRuntimeServiceContext,
  readContentBlocks,
  type CanvasMutationBatchV1,
} from '../../../libs/shared/src';
import {
  CreateNodeInput,
  getGlobalIdentifierCollisions,
  NodeProps,
  patchFile,
  patchNodeBodyBlockInsert,
  patchNodeContent,
  patchNodeCreate,
  patchNodeDelete,
  patchNodePosition,
  patchNodeRelativePosition,
  patchNodeRename,
  patchNodeReparent,
  patchNodeStyle,
} from '../filePatcher';
import { RPC_ERRORS } from '../rpc';
import {
  createIntentScopedDiagnostics,
  withDiagnostics,
} from '../shared/errors';
import {
  cloneRecord,
  ensureOptionalRootPath,
  ensureOptionalString,
  ensureRecord,
  ensureString,
  type RpcContext,
  type RpcMethodRegistry,
  type UpdateCommandType,
} from '../shared/params';
import {
  buildCompatibilityMutationSuccess,
  notifyFileChanged,
  type CompatibilityMutationSuccess,
} from '../shared/responses';
import { toLegacyBodyBlock } from '../shared/params';
import { WS_SUBSCRIPTION_METHODS } from '../shared/subscriptions';

export interface CompatibilityCommonParams {
  canvasId?: string;
  filePath: string;
  resolvedFilePath: string;
  rootPath?: string;
  baseVersion: string;
  originId: string;
  commandId: string;
}

export interface PluginInstanceRuntimeRecord {
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

const fileMutationLocks = new Map<string, Promise<void>>();
const pluginInstancesByFile = new Map<string, Map<string, PluginInstanceRuntimeRecord>>();

function isFileMutexEnabled(): boolean {
  return process.env.MAGAM_WS_ENABLE_FILE_MUTEX === '1';
}

export function runWithOptionalFileMutex<T>(
  filePath: string,
  task: () => Promise<T>,
): Promise<T> {
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

export function resolveWorkspaceFilePath(
  filePath: string,
  rootPath?: string,
): string {
  if (isAbsolute(filePath)) {
    return filePath;
  }
  const workspaceRoot = resolve(rootPath || process.env.MAGAM_TARGET_DIR || process.cwd());
  return resolve(workspaceRoot, filePath);
}

export async function tryResolveCanvasCompatibilityPath(
  canvasId: string,
  rootPath?: string,
): Promise<{ filePath: string; resolvedFilePath: string } | null> {
  const targetDir = resolve(rootPath || process.env.MAGAM_TARGET_DIR || process.cwd());
  const filePath = await resolveCanonicalCanvasCompatibilityFilePath({
    targetDir,
    canvasId,
  });
  if (!filePath) {
    return null;
  }
  return {
    filePath,
    resolvedFilePath: resolveWorkspaceFilePath(filePath, targetDir),
  };
}

export async function resolveCanvasCompatibilityPath(
  canvasId: string,
  rootPath?: string,
): Promise<{ filePath: string; resolvedFilePath: string }> {
  const resolved = await tryResolveCanvasCompatibilityPath(canvasId, rootPath);
  if (!resolved) {
    throw {
      ...RPC_ERRORS.INVALID_PARAMS,
      data: `canvasId ${canvasId} has no compatibility path`,
    };
  }
  return resolved;
}

async function getFileVersion(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf-8');
  const digest = createHash('sha256').update(content).digest('hex');
  return `sha256:${digest}`;
}

async function ensureBaseVersion(
  filePath: string,
  baseVersion: string,
): Promise<void> {
  const currentVersion = await getFileVersion(filePath);
  if (baseVersion !== currentVersion) {
    throw {
      ...RPC_ERRORS.VERSION_CONFLICT,
      data: { expected: baseVersion, actual: currentVersion },
    };
  }
}

export async function ensureCompatibilityParams(
  params: Record<string, unknown>,
): Promise<CompatibilityCommonParams> {
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
    ? {
        filePath: inputFilePath,
        resolvedFilePath: resolveWorkspaceFilePath(inputFilePath, rootPath),
      }
    : await resolveCanvasCompatibilityPath(canvasId as string, rootPath);
  return {
    canvasId: canvasId ?? undefined,
    filePath: resolved.filePath,
    resolvedFilePath: resolved.resolvedFilePath,
    rootPath,
    baseVersion,
    originId,
    commandId,
  };
}

export async function withCompatibilityMutation<T>(
  ctx: RpcContext,
  common: CompatibilityCommonParams,
  mutator: () => Promise<T>,
): Promise<CompatibilityMutationSuccess & { data: T }> {
  return runWithOptionalFileMutex(common.resolvedFilePath, async () => {
    await ensureBaseVersion(common.resolvedFilePath, common.baseVersion);
    const data = await mutator();
    const newVersion = await getFileVersion(common.resolvedFilePath);
    notifyFileChanged(ctx, {
      canvasId: common.canvasId,
      filePath: common.filePath,
      resolvedFilePath: common.resolvedFilePath,
      newVersion,
      originId: common.originId,
      commandId: common.commandId,
      ...(common.rootPath ? { rootPath: common.rootPath } : {}),
    });
    return {
      ...buildCompatibilityMutationSuccess({
        canvasId: common.canvasId,
        filePath: common.filePath,
        resolvedFilePath: common.resolvedFilePath,
        newVersion,
        commandId: common.commandId,
      }),
      data,
    };
  });
}

function getPluginBucket(
  resolvedFilePath: string,
): Map<string, PluginInstanceRuntimeRecord> {
  let bucket = pluginInstancesByFile.get(resolvedFilePath);
  if (!bucket) {
    bucket = new Map<string, PluginInstanceRuntimeRecord>();
    pluginInstancesByFile.set(resolvedFilePath, bucket);
  }
  return bucket;
}

function toPluginInstanceSnapshot(
  record: PluginInstanceRuntimeRecord,
): PluginInstanceRuntimeRecord {
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
  const pluginExportId = ensureString(
    input.pluginExportId,
    'instance.pluginExportId',
  );
  const pluginVersionId = ensureString(
    input.pluginVersionId,
    'instance.pluginVersionId',
  );
  const displayName = ensureOptionalString(input.displayName, 'instance.displayName');
  const props = input.props === undefined
    ? undefined
    : ensureRecord(input.props, 'instance.props');
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

async function withPluginRuntimeMutation<T>(
  common: CompatibilityCommonParams,
  mutator: (bucket: Map<string, PluginInstanceRuntimeRecord>) => T,
): Promise<CompatibilityMutationSuccess & { data: T }> {
  return runWithOptionalFileMutex(common.resolvedFilePath, async () => {
    await ensureBaseVersion(common.resolvedFilePath, common.baseVersion);
    const bucket = getPluginBucket(common.resolvedFilePath);
    const data = mutator(bucket);
    const newVersion = await getFileVersion(common.resolvedFilePath);
    return {
      ...buildCompatibilityMutationSuccess({
        canvasId: common.canvasId,
        filePath: common.filePath,
        resolvedFilePath: common.resolvedFilePath,
        newVersion,
        commandId: common.commandId,
      }),
      data,
    };
  });
}

export async function ensureNoIdentifierCollisions(
  resolvedFilePath: string,
): Promise<void> {
  const collisionIds = await getGlobalIdentifierCollisions(resolvedFilePath);
  if (collisionIds.length > 0) {
    throw { ...RPC_ERRORS.ID_COLLISION, data: { collisionIds } };
  }
}

export async function applyNodeUpdatePatch(input: {
  resolvedFilePath: string;
  nodeId: string;
  props: NodeProps;
  commandType?: UpdateCommandType;
}): Promise<void> {
  await ensureNoIdentifierCollisions(input.resolvedFilePath);

  if (input.commandType === 'node.move.relative') {
    await patchNodeRelativePosition(
      input.resolvedFilePath,
      input.nodeId,
      input.props,
    );
    return;
  }
  if (input.commandType === 'node.content.update') {
    if (typeof input.props.content !== 'string') {
      throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'content must be a string' };
    }
    await patchNodeContent(
      input.resolvedFilePath,
      input.nodeId,
      input.props.content,
    );
    return;
  }
  if (input.commandType === 'node.style.update') {
    await patchNodeStyle(input.resolvedFilePath, input.nodeId, input.props);
    return;
  }
  if (input.commandType === 'node.rename') {
    if (typeof input.props.id !== 'string' || input.props.id.length === 0) {
      throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'id must be a string' };
    }
    await patchNodeRename(input.resolvedFilePath, input.nodeId, input.props.id);
    return;
  }

  await patchFile(input.resolvedFilePath, input.nodeId, input.props);
}

export async function applyNodeMovePatch(input: {
  resolvedFilePath: string;
  nodeId: string;
  x: number;
  y: number;
}): Promise<void> {
  await ensureNoIdentifierCollisions(input.resolvedFilePath);
  await patchNodePosition(input.resolvedFilePath, input.nodeId, input.x, input.y);
}

export async function applyNodeCreatePatch(input: {
  resolvedFilePath: string;
  node: CreateNodeInput;
}): Promise<void> {
  await ensureNoIdentifierCollisions(input.resolvedFilePath);
  await patchNodeCreate(input.resolvedFilePath, input.node);
}

export async function applyObjectBodyBlockInsertPatch(input: {
  resolvedFilePath: string;
  objectId: string;
  block: {
    blockType: string;
    source?: string;
    text?: string;
    payload?: Record<string, unknown>;
  };
  afterBlockId?: string;
}): Promise<void> {
  await patchNodeBodyBlockInsert(
    input.resolvedFilePath,
    input.objectId,
    input.block,
    input.afterBlockId,
  );
}

export async function applyNodeDeletePatch(input: {
  resolvedFilePath: string;
  nodeId: string;
}): Promise<void> {
  await patchNodeDelete(input.resolvedFilePath, input.nodeId);
}

export async function applyNodeReparentPatch(input: {
  resolvedFilePath: string;
  nodeId: string;
  newParentId?: string | null;
}): Promise<void> {
  await patchNodeReparent(
    input.resolvedFilePath,
    input.nodeId,
    input.newParentId || null,
  );
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

  throw {
    ...RPC_ERRORS.PATCH_SURFACE_VIOLATION,
    data: { reason: 'Cannot resolve compatibility patch node id.' },
  };
}

function resolveAfterBlockIdForCompatibilityPatch(input: {
  command: Extract<
    CanvasMutationBatchV1['commands'][number],
    { name: 'object.body.block.insert' }
  >;
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

export async function applyRuntimeMutationCompatibilityPatches(input: {
  runtimeContext: ReturnType<typeof createCanvasRuntimeServiceContext>;
  batch: CanvasMutationBatchV1;
  resolvedFilePath: string;
}): Promise<void> {
  const nodes = input.batch.canvasId
    ? await input.runtimeContext.repository.listCanvasNodes(input.batch.canvasId)
    : [];
  const nodesByObjectId = new Map(
    nodes
      .filter(
        (node) => typeof node.canonicalObjectId === 'string' && node.canonicalObjectId.length > 0,
      )
      .map((node) => [node.canonicalObjectId as string, node.id]),
  );

  for (const command of input.batch.commands) {
    switch (command.name) {
      case 'canvas.node.create': {
        const props: Record<string, unknown> = {
          ...(typeof command.transform?.width === 'number'
            ? { width: command.transform.width }
            : {}),
          ...(typeof command.transform?.height === 'number'
            ? { height: command.transform.height }
            : {}),
          ...(typeof command.transform?.rotation === 'number'
            ? { rotation: command.transform.rotation }
            : {}),
          ...(typeof command.presentationStyle?.fillColor === 'string'
            ? { fill: command.presentationStyle.fillColor }
            : {}),
          ...(typeof command.presentationStyle?.strokeColor === 'string'
            ? { stroke: command.presentationStyle.strokeColor }
            : {}),
          ...(typeof command.presentationStyle?.strokeWidth === 'number'
            ? { strokeWidth: command.presentationStyle.strokeWidth }
            : {}),
          ...(typeof command.presentationStyle?.opacity === 'number'
            ? { opacity: command.presentationStyle.opacity }
            : {}),
          ...(typeof command.presentationStyle?.textColor === 'string'
            ? { color: command.presentationStyle.textColor }
            : {}),
          ...(typeof command.presentationStyle?.fontFamily === 'string'
            ? { fontFamily: command.presentationStyle.fontFamily }
            : {}),
          ...(typeof command.presentationStyle?.fontSize === 'number'
            ? { fontSize: command.presentationStyle.fontSize }
            : {}),
          ...(typeof command.renderProfile?.inkProfile === 'string'
            ? { inkProfile: command.renderProfile.inkProfile }
            : {}),
          ...(typeof command.renderProfile?.paperBlend === 'string'
            ? { paperBlend: command.renderProfile.paperBlend }
            : {}),
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
                  mindmapId: typeof command.placement.mindmapId === 'string'
                    && command.placement.mindmapId.length > 0
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
        await patchNodePosition(
          input.resolvedFilePath,
          command.nodeId,
          command.x,
          command.y,
        );
        break;

      case 'canvas.node.reparent':
        await patchNodeReparent(
          input.resolvedFilePath,
          command.nodeId,
          command.parentNodeId,
        );
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
        await patchFile(input.resolvedFilePath, command.nodeId, {
          rotation: command.nextRotation,
        });
        break;

      case 'canvas.node.presentation-style.update': {
        const patch: Record<string, unknown> = {
          ...(typeof command.presentationStyle.fillColor === 'string'
            ? { fill: command.presentationStyle.fillColor }
            : {}),
          ...(typeof command.presentationStyle.strokeColor === 'string'
            ? { stroke: command.presentationStyle.strokeColor }
            : {}),
          ...(typeof command.presentationStyle.strokeWidth === 'number'
            ? { strokeWidth: command.presentationStyle.strokeWidth }
            : {}),
          ...(typeof command.presentationStyle.opacity === 'number'
            ? { opacity: command.presentationStyle.opacity }
            : {}),
          ...(typeof command.presentationStyle.textColor === 'string'
            ? { color: command.presentationStyle.textColor }
            : {}),
          ...(typeof command.presentationStyle.fontFamily === 'string'
            ? { fontFamily: command.presentationStyle.fontFamily }
            : {}),
          ...(typeof command.presentationStyle.fontSize === 'number'
            ? { fontSize: command.presentationStyle.fontSize }
            : {}),
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
        await patchFile(input.resolvedFilePath, command.nodeId, {
          zIndex: command.zIndex,
        });
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

export async function applyRuntimeCompatibilityAdapter(input: {
  ctx: RpcContext;
  runtimeContext: ReturnType<typeof createCanvasRuntimeServiceContext>;
  batch: CanvasMutationBatchV1;
  canvasId: string;
  originId: string;
  commandId: string;
  rootPath?: string;
  canvasRevision?: number;
}): Promise<CompatibilityMutationSuccess | null> {
  const resolved = await tryResolveCanvasCompatibilityPath(
    input.canvasId,
    input.rootPath,
  );
  if (!resolved) {
    return null;
  }

  return runWithOptionalFileMutex(resolved.resolvedFilePath, async () => {
    await applyRuntimeMutationCompatibilityPatches({
      runtimeContext: input.runtimeContext,
      batch: input.batch,
      resolvedFilePath: resolved.resolvedFilePath,
    });
    const newVersion = await getFileVersion(resolved.resolvedFilePath);
    notifyFileChanged(input.ctx, {
      canvasId: input.canvasId,
      filePath: resolved.filePath,
      resolvedFilePath: resolved.resolvedFilePath,
      newVersion,
      originId: input.originId,
      commandId: input.commandId,
      ...(typeof input.canvasRevision === 'number'
        ? { canvasRevision: input.canvasRevision }
        : {}),
      ...(input.rootPath ? { rootPath: input.rootPath } : {}),
    });
    return buildCompatibilityMutationSuccess({
      canvasId: input.canvasId,
      filePath: resolved.filePath,
      resolvedFilePath: resolved.resolvedFilePath,
      newVersion,
      commandId: input.commandId,
    });
  });
}

async function handleFileSubscribe(
  params: Record<string, unknown>,
  ctx: RpcContext,
): Promise<{ success: boolean }> {
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

async function handleFileUnsubscribe(
  params: Record<string, unknown>,
  ctx: RpcContext,
): Promise<{ success: boolean }> {
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

async function handlePluginInstanceCreate(
  params: Record<string, unknown>,
): Promise<{
  success: boolean;
  newVersion: string;
  commandId: string;
  filePath: string;
  instance: PluginInstanceRuntimeRecord;
}> {
  const common = await ensureCompatibilityParams(params);
  const input = ensurePluginInstanceInput(params.instance);

  try {
    const result = await withPluginRuntimeMutation(common, (bucket) => {
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
    const diagnostics = createIntentScopedDiagnostics({
      failedAction: 'plugin-instance.create',
      stage: 'ws.plugin-instance.create',
      details: { instanceId: input.id },
    });
    const typed = error as { code?: number; message?: string; data?: unknown } | Error;
    if (typeof (typed as { code?: number }).code === 'number') {
      throw {
        code: (typed as { code: number }).code,
        message: (typed as { message?: string }).message,
        data: withDiagnostics((typed as { data?: unknown }).data, diagnostics),
      };
    }
    throw {
      ...RPC_ERRORS.PLUGIN_RUNTIME_UNAVAILABLE,
      data: withDiagnostics({ reason: (typed as Error).message }, diagnostics),
    };
  }
}

async function handlePluginInstanceUpdateProps(
  params: Record<string, unknown>,
): Promise<{
  success: boolean;
  newVersion: string;
  commandId: string;
  filePath: string;
  instance: PluginInstanceRuntimeRecord;
}> {
  const common = await ensureCompatibilityParams(params);
  const instanceId = ensureString(params.instanceId, 'instanceId');
  const patch = ensureRecord(params.patch, 'patch');

  try {
    const result = await withPluginRuntimeMutation(common, (bucket) => {
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
    const diagnostics = createIntentScopedDiagnostics({
      failedAction: 'plugin-instance.update-props',
      stage: 'ws.plugin-instance.update-props',
      details: { instanceId },
    });
    const typed = error as { code?: number; message?: string; data?: unknown } | Error;
    if (typeof (typed as { code?: number }).code === 'number') {
      throw {
        code: (typed as { code: number }).code,
        message: (typed as { message?: string }).message,
        data: withDiagnostics((typed as { data?: unknown }).data, diagnostics),
      };
    }
    throw {
      ...RPC_ERRORS.PLUGIN_RUNTIME_UNAVAILABLE,
      data: withDiagnostics({ reason: (typed as Error).message }, diagnostics),
    };
  }
}

async function handlePluginInstanceUpdateBinding(
  params: Record<string, unknown>,
): Promise<{
  success: boolean;
  newVersion: string;
  commandId: string;
  filePath: string;
  instance: PluginInstanceRuntimeRecord;
}> {
  const common = await ensureCompatibilityParams(params);
  const instanceId = ensureString(params.instanceId, 'instanceId');
  const bindingConfig = ensureRecord(params.bindingConfig, 'bindingConfig');

  try {
    const result = await withPluginRuntimeMutation(common, (bucket) => {
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
    const diagnostics = createIntentScopedDiagnostics({
      failedAction: 'plugin-instance.update-binding',
      stage: 'ws.plugin-instance.update-binding',
      details: { instanceId },
    });
    const typed = error as { code?: number; message?: string; data?: unknown } | Error;
    if (typeof (typed as { code?: number }).code === 'number') {
      throw {
        code: (typed as { code: number }).code,
        message: (typed as { message?: string }).message,
        data: withDiagnostics((typed as { data?: unknown }).data, diagnostics),
      };
    }
    throw {
      ...RPC_ERRORS.PLUGIN_RUNTIME_UNAVAILABLE,
      data: withDiagnostics({ reason: (typed as Error).message }, diagnostics),
    };
  }
}

async function handlePluginInstanceRemove(
  params: Record<string, unknown>,
): Promise<{
  success: boolean;
  newVersion: string;
  commandId: string;
  filePath: string;
  removedInstanceId: string;
}> {
  const common = await ensureCompatibilityParams(params);
  const instanceId = ensureString(params.instanceId, 'instanceId');

  try {
    const result = await withPluginRuntimeMutation(common, (bucket) => {
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
    const diagnostics = createIntentScopedDiagnostics({
      failedAction: 'plugin-instance.remove',
      stage: 'ws.plugin-instance.remove',
      details: { instanceId },
    });
    const typed = error as { code?: number; message?: string; data?: unknown } | Error;
    if (typeof (typed as { code?: number }).code === 'number') {
      throw {
        code: (typed as { code: number }).code,
        message: (typed as { message?: string }).message,
        data: withDiagnostics((typed as { data?: unknown }).data, diagnostics),
      };
    }
    throw {
      ...RPC_ERRORS.PLUGIN_RUNTIME_UNAVAILABLE,
      data: withDiagnostics({ reason: (typed as Error).message }, diagnostics),
    };
  }
}

async function handlePluginInstanceList(
  params: Record<string, unknown>,
): Promise<{
  success: boolean;
  filePath: string;
  instances: PluginInstanceRuntimeRecord[];
}> {
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

export const compatibilitySubscriptionHandlers: RpcMethodRegistry = {
  [WS_SUBSCRIPTION_METHODS.fileSubscribe]: handleFileSubscribe,
  [WS_SUBSCRIPTION_METHODS.fileUnsubscribe]: handleFileUnsubscribe,
};

export const compatibilityHandlers: RpcMethodRegistry = {
  ...compatibilitySubscriptionHandlers,
  'plugin-instance.create': handlePluginInstanceCreate,
  'plugin-instance.update-props': handlePluginInstanceUpdateProps,
  'plugin-instance.update-binding': handlePluginInstanceUpdateBinding,
  'plugin-instance.remove': handlePluginInstanceRemove,
  'plugin-instance.list': handlePluginInstanceList,
};
