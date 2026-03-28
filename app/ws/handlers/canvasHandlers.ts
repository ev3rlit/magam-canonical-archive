import { mkdir } from 'fs/promises';
import { resolve } from 'path';
import {
  buildEditingProjection,
  buildHierarchyProjection,
  buildRenderProjection,
  CanonicalPersistenceRepository,
  createCanvasRuntimeServiceContext,
  createCanonicalPgliteDb,
  dispatchCanvasMutation,
  type CanvasMutationBatchV1,
  type ContentBlock,
  type MutationResultEnvelopeV1,
} from '../../../libs/shared/src';
import { RPC_ERRORS } from '../rpc';
import {
  createIntentScopedDiagnostics,
  runtimeFailureToRpcError,
  withDiagnostics,
} from '../shared/errors';
import {
  ensureContentBlock,
  ensureCreatePlacement,
  ensureNumber,
  ensureOptionalRootPath,
  ensureOptionalString,
  ensureOptionalUpdateCommandType,
  ensureRecord,
  ensureString,
  inferUpdateCommandType,
  sanitizeWorkspaceId,
  type CreateNodeInput,
  type NodeProps,
  type RpcContext,
  type RpcMethodRegistry,
} from '../shared/params';
import { notifyCanvasChanged } from '../shared/responses';
import {
  createCanvasSubscriptionKey,
  WS_SUBSCRIPTION_METHODS,
} from '../shared/subscriptions';
import {
  buildCanvasNodeCreateCommand,
  buildObjectBodyBlockInsertCommand,
  buildRuntimeContentUpdateCommand,
  buildRuntimePresentationStylePatch,
  normalizeRuntimeContentKind,
} from '../shared/runtimeTransforms';
import {
  applyNodeCreatePatch,
  applyNodeDeletePatch,
  applyNodeMovePatch,
  applyNodeReparentPatch,
  applyNodeUpdatePatch,
  applyObjectBodyBlockInsertPatch,
  applyRuntimeCompatibilityAdapter,
  ensureCompatibilityParams,
  type CompatibilityCommonParams,
  withCompatibilityMutation,
} from './compatibilityHandlers';

async function withCanonicalContext<T>(
  rootPath: string | undefined,
  run: (context: {
    db: Awaited<ReturnType<typeof createCanonicalPgliteDb>>['db'];
    repository: CanonicalPersistenceRepository;
    targetDir: string;
    dataDir: string | null;
    workspaceId: string;
  }) => Promise<T>,
): Promise<T> {
  const targetDir = resolve(rootPath || process.env.MAGAM_TARGET_DIR || process.cwd());
  const workspaceId = process.env.MAGAM_WORKSPACE_ID?.trim() || sanitizeWorkspaceId(targetDir);
  await mkdir(resolve(targetDir, '.magam'), { recursive: true });
  const handle = await createCanonicalPgliteDb(targetDir, {
    migrationsFolder: resolve(
      process.cwd(),
      'libs',
      'shared',
      'src',
      'lib',
      'canonical-persistence',
      'drizzle',
    ),
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

async function executeRuntimeMutation(
  rootPath: string | undefined,
  buildBatch: (
    workspaceId: string,
    runtimeContext: ReturnType<typeof createCanvasRuntimeServiceContext>,
  ) => Promise<CanvasMutationBatchV1> | CanvasMutationBatchV1,
): Promise<{
  runtimeContext: ReturnType<typeof createCanvasRuntimeServiceContext>;
  batch: CanvasMutationBatchV1;
  mutation: Awaited<ReturnType<typeof dispatchCanvasMutation>>;
}> {
  return withCanonicalContext(rootPath, async ({
    db,
    repository,
    targetDir,
    dataDir,
    workspaceId,
  }) => {
    const runtimeContext = createCanvasRuntimeServiceContext({
      db,
      repository,
      targetDir,
      dataDir,
      defaultWorkspaceId: workspaceId,
    });
    const batch = await buildBatch(workspaceId, runtimeContext);
    const mutation = await dispatchCanvasMutation(runtimeContext, batch);
    return {
      runtimeContext,
      batch,
      mutation,
    };
  });
}

function ensureRuntimeCommonParams(params: Record<string, unknown>) {
  const canvasId = ensureString(params.canvasId, 'canvasId');
  const originId = ensureString(params.originId, 'originId');
  const commandId = ensureString(params.commandId, 'commandId');
  const rootPath = ensureOptionalRootPath(params.rootPath, 'rootPath');
  return { canvasId, originId, commandId, rootPath };
}

function ensureRuntimeMutationBatch(
  value: unknown,
  fallbackCanvasId?: string,
): CanvasMutationBatchV1 {
  const batch = ensureRecord(value, 'batch');
  const commands = Array.isArray(batch.commands)
    ? batch.commands.filter(
        (command): command is CanvasMutationBatchV1['commands'][number] =>
          typeof command === 'object' && command !== null && !Array.isArray(command),
      )
    : [];

  if (commands.length === 0) {
    throw {
      ...RPC_ERRORS.INVALID_PARAMS,
      data: 'batch.commands must include at least one command',
    };
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
    ...(typeof batch.sessionId === 'string' && batch.sessionId.length > 0
      ? { sessionId: batch.sessionId }
      : {}),
    ...(typeof batch.dryRun === 'boolean' ? { dryRun: batch.dryRun } : {}),
    ...(typeof batch.actor === 'object'
      && batch.actor !== null
      && typeof (batch.actor as { kind?: unknown }).kind === 'string'
      && typeof (batch.actor as { id?: unknown }).id === 'string'
      ? {
          actor: {
            kind: (
              batch.actor as { kind: NonNullable<CanvasMutationBatchV1['actor']>['kind'] }
            ).kind,
            id: (batch.actor as { id: string }).id,
          },
        }
      : {}),
    ...(typeof batch.preconditions === 'object'
      && batch.preconditions !== null
      && typeof (batch.preconditions as { canvasRevision?: unknown }).canvasRevision === 'number'
      ? {
          preconditions: {
            canvasRevision: (batch.preconditions as { canvasRevision: number }).canvasRevision,
          },
        }
      : {}),
    commands,
  };
}

async function mutateCanvasCompatibility<T>(
  ctx: RpcContext,
  common: CompatibilityCommonParams,
  mutator: () => Promise<T>,
): Promise<{
  compatibilityResult: Awaited<ReturnType<typeof withCompatibilityMutation<T>>>;
}> {
  const compatibilityResult = await withCompatibilityMutation(ctx, common, mutator);
  return { compatibilityResult };
}

async function handleCanvasSubscribe(
  params: Record<string, unknown>,
  ctx: RpcContext,
): Promise<{ success: boolean }> {
  const canvasId = ensureString(params.canvasId, 'canvasId');
  ctx.subscriptions.add(createCanvasSubscriptionKey(canvasId));
  return { success: true };
}

async function handleCanvasUnsubscribe(
  params: Record<string, unknown>,
  ctx: RpcContext,
): Promise<{ success: boolean }> {
  const canvasId = ensureString(params.canvasId, 'canvasId');
  ctx.subscriptions.delete(createCanvasSubscriptionKey(canvasId));
  return { success: true };
}

async function handleCanvasRuntimeProjections(
  params: Record<string, unknown>,
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
    ? params.nodeIds.filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      )
    : undefined;

  return withCanonicalContext(rootPath, async ({
    db,
    repository,
    targetDir,
    dataDir,
    workspaceId,
  }) => {
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

async function handleCanvasRuntimeMutate(
  params: Record<string, unknown>,
  ctx: RpcContext,
): Promise<{
  success: boolean;
  commandId: string;
  canvasId: string;
  canvasRevision?: number;
  runtimeResult: MutationResultEnvelopeV1;
}> {
  const common = ensureRuntimeCommonParams(params);
  const initialBatch = ensureRuntimeMutationBatch(params.batch, common.canvasId);

  try {
    const { runtimeContext, batch, mutation } = await executeRuntimeMutation(
      common.rootPath,
      (workspaceId) => ({
        ...initialBatch,
        workspaceId,
        canvasId: initialBatch.canvasId ?? common.canvasId,
      }),
    );
    if (!mutation.envelope.ok) {
      runtimeFailureToRpcError(mutation.envelope);
    }

    const canvasRevision = mutation.envelope.data.canvasRevisionAfter ?? undefined;
    if (!mutation.envelope.data.dryRun && typeof canvasRevision === 'number') {
      await applyRuntimeCompatibilityAdapter({
        ctx,
        runtimeContext,
        batch,
        canvasId: common.canvasId,
        originId: common.originId,
        commandId: common.commandId,
        ...(common.rootPath ? { rootPath: common.rootPath } : {}),
        canvasRevision,
      });
      notifyCanvasChanged(ctx, {
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
      runtimeResult: mutation.envelope,
    };
  } catch (error) {
    const diagnostics = createIntentScopedDiagnostics({
      failedAction: 'canvas.runtime.mutate',
      stage: 'ws.canvas.runtime.mutate',
      details: {
        canvasId: initialBatch.canvasId ?? common.canvasId ?? null,
      },
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
      ...RPC_ERRORS.PATCH_FAILED,
      data: withDiagnostics({ reason: (typed as Error).message }, diagnostics),
    };
  }
}

async function handleNodeUpdate(
  params: Record<string, unknown>,
  ctx: RpcContext,
): Promise<{
  success: boolean;
  newVersion: string;
  commandId: string;
  filePath: string;
  runtimeResult?: MutationResultEnvelopeV1;
}> {
  const common = await ensureCompatibilityParams(params);
  const nodeId = ensureString(params.nodeId, 'nodeId');
  const props = params.props as NodeProps | undefined;
  const explicitCommandType = ensureOptionalUpdateCommandType(params.commandType);

  if (!props || typeof props !== 'object') {
    throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'props is required' };
  }

  const commandType = inferUpdateCommandType(props, explicitCommandType);

  try {
    let runtimeResult: MutationResultEnvelopeV1 | undefined;
    const { compatibilityResult } = await mutateCanvasCompatibility(ctx, common, async () => {
      if (
        common.canvasId
        && commandType
        && commandType !== 'node.move.relative'
        && commandType !== 'node.group.update'
        && commandType !== 'node.rename'
      ) {
        const { mutation } = await executeRuntimeMutation(
          common.rootPath,
          async (workspaceId, runtimeContext) => {
            if (commandType === 'node.style.update') {
              return {
                workspaceId,
                canvasId: common.canvasId!,
                commands: [{
                  name: 'canvas.node.presentation-style.update',
                  canvasId: common.canvasId!,
                  nodeId,
                  presentationStyle: buildRuntimePresentationStylePatch(
                    props as Record<string, unknown>,
                  ),
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

            const nodeRecord = await runtimeContext.repository.getCanvasNode(
              common.canvasId!,
              nodeId,
            );
            if (!nodeRecord.ok) {
              throw { ...RPC_ERRORS.NODE_NOT_FOUND, data: { nodeId } };
            }
            const objectId = nodeRecord.value.canonicalObjectId ?? nodeId;
            const objectRecord = await runtimeContext.repository.getCanonicalObject(
              workspaceId,
              objectId,
            );
            if (!objectRecord.ok) {
              throw { ...RPC_ERRORS.NODE_NOT_FOUND, data: { nodeId, objectId } };
            }
            const contentKind = normalizeRuntimeContentKind(
              objectRecord.value.primaryContentKind,
            );

            return {
              workspaceId,
              canvasId: common.canvasId!,
              commands: [buildRuntimeContentUpdateCommand({
                objectId,
                kind: contentKind,
                content: typeof props.content === 'string' ? props.content : '',
              })],
            };
          },
        );

        if (!mutation.envelope.ok) {
          runtimeFailureToRpcError(mutation.envelope);
        }
        runtimeResult = mutation.envelope;
      }

      await applyNodeUpdatePatch({
        resolvedFilePath: common.resolvedFilePath,
        nodeId,
        props,
        commandType,
      });
    });
    return runtimeResult
      ? { ...compatibilityResult, filePath: compatibilityResult.filePath, runtimeResult }
      : compatibilityResult;
  } catch (error) {
    const diagnostics = createIntentScopedDiagnostics({
      failedAction: commandType ?? 'node.update',
      stage: 'ws.node.update',
      details: { nodeId },
    });
    const typed = error as { code?: number; message?: string; data?: unknown } | Error;
    if (typeof (typed as { code?: number }).code === 'number') {
      throw {
        code: (typed as { code: number }).code,
        message: (typed as { message?: string }).message,
        data: withDiagnostics((typed as { data?: unknown }).data, diagnostics),
      };
    }
    const message = (typed as Error).message;
    if (message === 'NODE_NOT_FOUND') {
      throw {
        ...RPC_ERRORS.NODE_NOT_FOUND,
        data: withDiagnostics({ nodeId }, diagnostics),
      };
    }
    if (message === 'EDIT_NOT_ALLOWED') {
      throw {
        ...RPC_ERRORS.EDIT_NOT_ALLOWED,
        data: withDiagnostics({ nodeId, commandType }, diagnostics),
      };
    }
    if (message === 'ID_COLLISION') {
      const collisionId = typeof props.id === 'string' ? props.id : nodeId;
      throw {
        ...RPC_ERRORS.ID_COLLISION,
        data: withDiagnostics({ collisionIds: [collisionId] }, diagnostics),
      };
    }
    if (message === 'CONTENT_CONTRACT_VIOLATION') {
      throw {
        ...RPC_ERRORS.CONTENT_CONTRACT_VIOLATION,
        data: withDiagnostics({ nodeId, path: 'capabilities.content' }, diagnostics),
      };
    }
    throw {
      ...RPC_ERRORS.PATCH_FAILED,
      data: withDiagnostics({ reason: message }, diagnostics),
    };
  }
}

async function handleNodeMove(
  params: Record<string, unknown>,
  ctx: RpcContext,
): Promise<{
  success: boolean;
  newVersion: string;
  commandId: string;
  filePath: string;
  runtimeResult?: MutationResultEnvelopeV1;
}> {
  const common = await ensureCompatibilityParams(params);
  const nodeId = ensureString(params.nodeId, 'nodeId');
  const x = ensureNumber(params.x, 'x');
  const y = ensureNumber(params.y, 'y');

  try {
    let runtimeResult: MutationResultEnvelopeV1 | undefined;
    const { compatibilityResult } = await mutateCanvasCompatibility(ctx, common, async () => {
      if (common.canvasId) {
        const { mutation } = await executeRuntimeMutation(common.rootPath, (workspaceId) => ({
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

        if (!mutation.envelope.ok) {
          runtimeFailureToRpcError(mutation.envelope);
        }
        runtimeResult = mutation.envelope;
      }

      await applyNodeMovePatch({
        resolvedFilePath: common.resolvedFilePath,
        nodeId,
        x,
        y,
      });
    });
    return runtimeResult
      ? { ...compatibilityResult, filePath: compatibilityResult.filePath, runtimeResult }
      : compatibilityResult;
  } catch (error) {
    const diagnostics = createIntentScopedDiagnostics({
      failedAction: 'node.move',
      stage: 'ws.node.move',
      details: { nodeId },
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
      ...RPC_ERRORS.PATCH_FAILED,
      data: withDiagnostics({ reason: (typed as Error).message }, diagnostics),
    };
  }
}

async function handleNodeCreate(
  params: Record<string, unknown>,
  ctx: RpcContext,
): Promise<{
  success: boolean;
  newVersion: string;
  commandId: string;
  filePath: string;
  runtimeResult?: MutationResultEnvelopeV1;
}> {
  const common = await ensureCompatibilityParams(params);
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
    const { compatibilityResult } = await mutateCanvasCompatibility(ctx, common, async () => {
      if (common.canvasId) {
        const { mutation } = await executeRuntimeMutation(common.rootPath, (workspaceId) => ({
          workspaceId,
          canvasId: common.canvasId,
          commands: [buildCanvasNodeCreateCommand({
            canvasId: common.canvasId!,
            nodeId: node.id,
            nodeType: node.type,
            placement: node.placement,
            fallbackMindmapId: `mindmap-${node.id}`,
          })],
        }));

        if (!mutation.envelope.ok) {
          runtimeFailureToRpcError(mutation.envelope);
        }
        runtimeResult = mutation.envelope;
      }

      await applyNodeCreatePatch({
        resolvedFilePath: common.resolvedFilePath,
        node,
      });
    });
    return runtimeResult
      ? { ...compatibilityResult, filePath: compatibilityResult.filePath, runtimeResult }
      : compatibilityResult;
  } catch (error) {
    const diagnostics = createIntentScopedDiagnostics({
      failedAction: 'node.create',
      stage: 'ws.node.create',
      details: { nodeId: node.id },
    });
    const typed = error as { code?: number; message?: string; data?: unknown } | Error;
    if (typeof (typed as { code?: number }).code === 'number') {
      throw {
        code: (typed as { code: number }).code,
        message: (typed as { message?: string }).message,
        data: withDiagnostics((typed as { data?: unknown }).data, diagnostics),
      };
    }
    const message = (typed as Error).message;
    if (message === 'ID_COLLISION') {
      throw {
        ...RPC_ERRORS.ID_COLLISION,
        data: withDiagnostics({ collisionIds: [node.id] }, diagnostics),
      };
    }
    if (message === 'NODE_NOT_FOUND') {
      throw {
        ...RPC_ERRORS.NODE_NOT_FOUND,
        data: withDiagnostics({ nodeId: node.id }, diagnostics),
      };
    }
    throw {
      ...RPC_ERRORS.PATCH_FAILED,
      data: withDiagnostics({ reason: message }, diagnostics),
    };
  }
}

async function handleCanvasNodeCreate(
  params: Record<string, unknown>,
  ctx: RpcContext,
): Promise<{
  success: boolean;
  newVersion: string;
  commandId: string;
  filePath: string;
  runtimeResult?: MutationResultEnvelopeV1;
}> {
  const common = await ensureCompatibilityParams(params);
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
    const { compatibilityResult } = await mutateCanvasCompatibility(ctx, common, async () => {
      const { mutation } = await executeRuntimeMutation(common.rootPath, (workspaceId) => ({
        workspaceId,
        canvasId: common.canvasId!,
        commands: [buildCanvasNodeCreateCommand({
          canvasId: common.canvasId!,
          nodeId,
          nodeType,
          props: node.props as Record<string, unknown> | undefined,
          placement,
          fallbackMindmapId: `mindmap-${nodeId}`,
        })],
      }));

      if (!mutation.envelope.ok) {
        runtimeFailureToRpcError(mutation.envelope);
      }
      runtimeResult = mutation.envelope;

      await applyNodeCreatePatch({
        resolvedFilePath: common.resolvedFilePath,
        node: {
          id: nodeId,
          type: nodeType,
          props: {
            ...ensureRecord(node.props ?? {}, 'node.props'),
            ...(typeof (node.props as Record<string, unknown> | undefined)?.content === 'string'
              ? { content: (node.props as Record<string, unknown>).content }
              : {}),
          },
          placement,
        },
      });
    });
    return runtimeResult
      ? { ...compatibilityResult, filePath: compatibilityResult.filePath, runtimeResult }
      : compatibilityResult;
  } catch (error) {
    const diagnostics = createIntentScopedDiagnostics({
      failedAction: 'canvas.node.create',
      stage: 'ws.canvas.node.create',
      details: { nodeId },
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
      ...RPC_ERRORS.PATCH_FAILED,
      data: withDiagnostics({ reason: (typed as Error).message }, diagnostics),
    };
  }
}

async function handleObjectBodyBlockInsert(
  params: Record<string, unknown>,
  ctx: RpcContext,
): Promise<{
  success: boolean;
  newVersion: string;
  commandId: string;
  filePath: string;
  runtimeResult?: MutationResultEnvelopeV1;
}> {
  const common = await ensureCompatibilityParams(params);
  if (!common.canvasId) {
    throw { ...RPC_ERRORS.INVALID_PARAMS, data: 'canvasId is required' };
  }

  const objectId = ensureString(params.objectId, 'objectId');
  const block = ensureContentBlock(params.block);
  const afterBlockId = ensureOptionalString(params.afterBlockId, 'afterBlockId');

  try {
    let runtimeResult: MutationResultEnvelopeV1 | undefined;
    const { compatibilityResult } = await mutateCanvasCompatibility(ctx, common, async () => {
      const { mutation } = await executeRuntimeMutation(common.rootPath, (workspaceId) => ({
        workspaceId,
        canvasId: common.canvasId!,
        commands: [buildObjectBodyBlockInsertCommand({
          objectId,
          block: block as ContentBlock,
          afterBlockId,
        })],
      }));

      if (!mutation.envelope.ok) {
        runtimeFailureToRpcError(mutation.envelope);
      }
      runtimeResult = mutation.envelope;

      await applyObjectBodyBlockInsertPatch({
        resolvedFilePath: common.resolvedFilePath,
        objectId,
        block,
        afterBlockId,
      });
    });
    return runtimeResult
      ? { ...compatibilityResult, filePath: compatibilityResult.filePath, runtimeResult }
      : compatibilityResult;
  } catch (error) {
    const diagnostics = createIntentScopedDiagnostics({
      failedAction: 'object.body.block.insert',
      stage: 'ws.object.body.block.insert',
      details: { objectId, blockId: block.id },
    });
    const typed = error as { code?: number; message?: string; data?: unknown } | Error;
    if (typeof (typed as { code?: number }).code === 'number') {
      throw {
        code: (typed as { code: number }).code,
        message: (typed as { message?: string }).message,
        data: withDiagnostics((typed as { data?: unknown }).data, diagnostics),
      };
    }
    const message = (typed as Error).message;
    if (message === 'ID_COLLISION') {
      throw {
        ...RPC_ERRORS.ID_COLLISION,
        data: withDiagnostics({ collisionIds: [objectId] }, diagnostics),
      };
    }
    if (message === 'NODE_NOT_FOUND') {
      throw {
        ...RPC_ERRORS.NODE_NOT_FOUND,
        data: withDiagnostics({ objectId }, diagnostics),
      };
    }
    throw {
      ...RPC_ERRORS.PATCH_FAILED,
      data: withDiagnostics({ reason: message }, diagnostics),
    };
  }
}

async function handleNodeDelete(
  params: Record<string, unknown>,
  ctx: RpcContext,
): Promise<{
  success: boolean;
  newVersion: string;
  commandId: string;
  filePath: string;
  runtimeResult?: MutationResultEnvelopeV1;
}> {
  const common = await ensureCompatibilityParams(params);
  const nodeId = ensureString(params.nodeId, 'nodeId');

  try {
    let runtimeResult: MutationResultEnvelopeV1 | undefined;
    const { compatibilityResult } = await mutateCanvasCompatibility(ctx, common, async () => {
      if (common.canvasId) {
        const { mutation } = await executeRuntimeMutation(common.rootPath, (workspaceId) => ({
          workspaceId,
          canvasId: common.canvasId!,
          commands: [{
            name: 'canvas.node.delete',
            canvasId: common.canvasId!,
            nodeId,
          }],
        }));

        if (!mutation.envelope.ok) {
          runtimeFailureToRpcError(mutation.envelope);
        }
        runtimeResult = mutation.envelope;
      }

      await applyNodeDeletePatch({
        resolvedFilePath: common.resolvedFilePath,
        nodeId,
      });
    });
    return runtimeResult
      ? { ...compatibilityResult, filePath: compatibilityResult.filePath, runtimeResult }
      : compatibilityResult;
  } catch (error) {
    const diagnostics = createIntentScopedDiagnostics({
      failedAction: 'node.delete',
      stage: 'ws.node.delete',
      details: { nodeId },
    });
    const typed = error as { code?: number; message?: string; data?: unknown } | Error;
    if (typeof (typed as { code?: number }).code === 'number') {
      throw {
        code: (typed as { code: number }).code,
        message: (typed as { message?: string }).message,
        data: withDiagnostics((typed as { data?: unknown }).data, diagnostics),
      };
    }
    const message = (typed as Error).message;
    if (message === 'NODE_NOT_FOUND') {
      throw {
        ...RPC_ERRORS.NODE_NOT_FOUND,
        data: withDiagnostics({ nodeId }, diagnostics),
      };
    }
    throw {
      ...RPC_ERRORS.PATCH_FAILED,
      data: withDiagnostics({ reason: message }, diagnostics),
    };
  }
}

async function handleNodeReparent(
  params: Record<string, unknown>,
  ctx: RpcContext,
): Promise<{
  success: boolean;
  newVersion: string;
  commandId: string;
  filePath: string;
  runtimeResult?: MutationResultEnvelopeV1;
}> {
  const common = await ensureCompatibilityParams(params);
  const nodeId = ensureString(params.nodeId, 'nodeId');
  const newParentId = ensureOptionalString(params.newParentId, 'newParentId');

  try {
    let runtimeResult: MutationResultEnvelopeV1 | undefined;
    const { compatibilityResult } = await mutateCanvasCompatibility(ctx, common, async () => {
      if (common.canvasId) {
        const { mutation } = await executeRuntimeMutation(common.rootPath, (workspaceId) => ({
          workspaceId,
          canvasId: common.canvasId!,
          commands: [{
            name: 'canvas.node.reparent',
            canvasId: common.canvasId!,
            nodeId,
            parentNodeId: newParentId ?? null,
          }],
        }));

        if (!mutation.envelope.ok) {
          runtimeFailureToRpcError(mutation.envelope);
        }
        runtimeResult = mutation.envelope;
      }

      await applyNodeReparentPatch({
        resolvedFilePath: common.resolvedFilePath,
        nodeId,
        newParentId,
      });
    });
    return runtimeResult
      ? { ...compatibilityResult, filePath: compatibilityResult.filePath, runtimeResult }
      : compatibilityResult;
  } catch (error) {
    const diagnostics = createIntentScopedDiagnostics({
      failedAction: 'node.reparent',
      stage: 'ws.node.reparent',
      details: { nodeId, newParentId: newParentId ?? null },
    });
    const typed = error as { code?: number; message?: string; data?: unknown } | Error;
    if (typeof (typed as { code?: number }).code === 'number') {
      throw {
        code: (typed as { code: number }).code,
        message: (typed as { message?: string }).message,
        data: withDiagnostics((typed as { data?: unknown }).data, diagnostics),
      };
    }
    const message = (typed as Error).message;
    if (message === 'NODE_NOT_FOUND') {
      throw {
        ...RPC_ERRORS.NODE_NOT_FOUND,
        data: withDiagnostics({ nodeId }, diagnostics),
      };
    }
    if (message === 'MINDMAP_CYCLE') {
      throw {
        ...RPC_ERRORS.MINDMAP_CYCLE,
        data: withDiagnostics({ nodeId, newParentId }, diagnostics),
      };
    }
    if (message === 'EDIT_NOT_ALLOWED') {
      throw {
        ...RPC_ERRORS.EDIT_NOT_ALLOWED,
        data: withDiagnostics({ nodeId, newParentId }, diagnostics),
      };
    }
    throw {
      ...RPC_ERRORS.PATCH_FAILED,
      data: withDiagnostics({ reason: message }, diagnostics),
    };
  }
}

export const canvasSubscriptionHandlers: RpcMethodRegistry = {
  [WS_SUBSCRIPTION_METHODS.canvasSubscribe]: handleCanvasSubscribe,
  [WS_SUBSCRIPTION_METHODS.canvasUnsubscribe]: handleCanvasUnsubscribe,
};

export const canvasHandlers: RpcMethodRegistry = {
  ...canvasSubscriptionHandlers,
  'canvas.runtime.projections': handleCanvasRuntimeProjections,
  'canvas.runtime.mutate': handleCanvasRuntimeMutate,
  'canvas.node.create': handleCanvasNodeCreate,
  'object.body.block.insert': handleObjectBodyBlockInsert,
  'node.update': handleNodeUpdate,
  'node.move': handleNodeMove,
  'node.create': handleNodeCreate,
  'node.delete': handleNodeDelete,
  'node.reparent': handleNodeReparent,
};
