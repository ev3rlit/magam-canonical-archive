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
  executeMutationBatch,
  isCanonicalCliError,
  type CanvasMutationBatchV1,
  type ContentBlock,
  type MutationBatch,
  type MutationOperation,
  type MutationResultEnvelopeV1,
} from '../../../libs/shared/src';
import { createCanvasSourceVersion } from '../../../libs/shared/src/lib/workspace-shell';
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
  type UpdateCommandType,
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

type CanonicalContext = {
  db: Awaited<ReturnType<typeof createCanonicalPgliteDb>>['db'];
  repository: CanonicalPersistenceRepository;
  targetDir: string;
  dataDir: string | null;
  workspaceId: string;
};

async function withCanonicalContext<T>(
  rootPath: string | undefined,
  run: (context: CanonicalContext) => Promise<T>,
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

function createVersionToken(input: {
  canvasId: string;
  workspaceId: string;
  canvasRevision: number | null;
}): string {
  return createCanvasSourceVersion(JSON.stringify({
    canvasId: input.canvasId,
    workspaceId: input.workspaceId,
    latestRevision: input.canvasRevision,
  }));
}

function ensureRuntimeCommonParams(params: Record<string, unknown>) {
  const canvasId = ensureString(params.canvasId, 'canvasId');
  const originId = ensureString(params.originId, 'originId');
  const commandId = ensureString(params.commandId, 'commandId');
  const rootPath = ensureOptionalRootPath(params.rootPath, 'rootPath');
  const baseVersion = ensureOptionalString(params.baseVersion, 'baseVersion');
  return { canvasId, originId, commandId, rootPath, baseVersion };
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

function mapCanonicalError(
  error: unknown,
  diagnostics: Record<string, unknown>,
): never {
  if (isCanonicalCliError(error)) {
    if (error.code === 'DOCUMENT_REVISION_CONFLICT') {
      throw {
        ...RPC_ERRORS.VERSION_CONFLICT,
        data: withDiagnostics(error.details, diagnostics),
      };
    }
    if (
      error.code === 'NODE_NOT_FOUND'
      || error.code === 'OBJECT_NOT_FOUND'
      || error.code === 'DOCUMENT_NOT_FOUND'
    ) {
      throw {
        ...RPC_ERRORS.NODE_NOT_FOUND,
        data: withDiagnostics(error.details, diagnostics),
      };
    }
    if (error.code === 'INVALID_ARGUMENT') {
      throw {
        ...RPC_ERRORS.INVALID_PARAMS,
        data: withDiagnostics(error.details ?? { reason: error.message }, diagnostics),
      };
    }
    throw {
      ...RPC_ERRORS.PATCH_FAILED,
      data: withDiagnostics(error.details ?? { reason: error.message }, diagnostics),
    };
  }

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

async function executeDirectCanvasMutation(input: {
  canvasId: string;
  commandId: string;
  originId: string;
  rootPath?: string;
  baseVersion?: string;
  buildOperations: (context: CanonicalContext) => Promise<MutationOperation[]> | MutationOperation[];
}, ctx: RpcContext): Promise<{
  success: boolean;
  newVersion: string;
  commandId: string;
  canvasId: string;
  canvasRevision?: number;
}> {
  return withCanonicalContext(input.rootPath, async (context) => {
    const batch: MutationBatch = {
      workspaceRef: context.workspaceId,
      canvasRef: input.canvasId,
      actor: {
        kind: 'user',
        id: input.originId,
      },
      ...(input.baseVersion ? {} : {}),
      operations: await input.buildOperations(context),
    };
    const result = await executeMutationBatch({
      context: {
        db: context.db,
        repository: context.repository,
        targetDir: context.targetDir,
        dataDir: context.dataDir,
        defaultWorkspaceId: context.workspaceId,
      },
      batch,
    });
    const newVersion = createVersionToken({
      canvasId: input.canvasId,
      workspaceId: context.workspaceId,
      canvasRevision: result.canvasRevisionAfter,
    });
    if (typeof result.canvasRevisionAfter === 'number') {
      notifyCanvasChanged(ctx, {
        canvasId: input.canvasId,
        canvasRevision: result.canvasRevisionAfter,
        originId: input.originId,
        commandId: input.commandId,
        ...(input.rootPath ? { rootPath: input.rootPath } : {}),
      });
    }
    return {
      success: true,
      newVersion,
      commandId: input.commandId,
      canvasId: input.canvasId,
      ...(typeof result.canvasRevisionAfter === 'number'
        ? { canvasRevision: result.canvasRevisionAfter }
        : {}),
    };
  });
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
    ? params.nodeIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
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
    const { batch, mutation } = await executeRuntimeMutation(
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
      notifyCanvasChanged(ctx, {
        canvasId: common.canvasId,
        canvasRevision,
        originId: common.originId,
        commandId: common.commandId,
        ...(common.rootPath ? { rootPath: common.rootPath } : {}),
      });
    }

    const newVersion = createVersionToken({
      canvasId: common.canvasId,
      workspaceId: batch.workspaceId,
      canvasRevision: mutation.envelope.ok ? mutation.envelope.data.canvasRevisionAfter : null,
    });

    return {
      success: true,
      commandId: common.commandId,
      canvasId: common.canvasId,
      ...(typeof canvasRevision === 'number' ? { canvasRevision } : {}),
      runtimeResult: mutation.envelope.ok
        ? {
            ...mutation.envelope,
            data: {
              ...mutation.envelope.data,
              version: newVersion,
            },
          }
        : mutation.envelope,
    };
  } catch (error) {
    mapCanonicalError(error, createIntentScopedDiagnostics({
      failedAction: 'canvas.runtime.mutate',
      stage: 'ws.canvas.runtime.mutate',
      details: { canvasId: common.canvasId },
    }));
  }
}

async function handleNodeUpdate(
  params: Record<string, unknown>,
  ctx: RpcContext,
): Promise<{
  success: boolean;
  newVersion: string;
  commandId: string;
  canvasId: string;
  canvasRevision?: number;
}> {
  const common = ensureRuntimeCommonParams(params);
  const nodeId = ensureString(params.nodeId, 'nodeId');
  const props = ensureRecord(params.props, 'props');
  const commandType = inferUpdateCommandType(props as NodeProps, ensureOptionalUpdateCommandType(params.commandType));

  try {
    return await executeDirectCanvasMutation({
      canvasId: common.canvasId,
      commandId: common.commandId,
      originId: common.originId,
      rootPath: common.rootPath,
      baseVersion: common.baseVersion,
      buildOperations: async (context) => {
        if (commandType === 'node.rename') {
          return [{
            op: 'canvas.node.rename',
            nodeId,
            nextNodeId: ensureString(props.id, 'props.id'),
          }];
        }
        if (commandType === 'node.z-order.update') {
          return [{
            op: 'canvas.node.z-order.update',
            nodeId,
            zIndex: ensureNumber(props.zIndex, 'props.zIndex'),
          }];
        }
        if (commandType === 'node.style.update') {
          return [{
            op: 'canvas.node.update',
            nodeId,
            stylePatch: props,
          }];
        }
        if (commandType === 'node.content.update') {
          const nodeRecord = await context.repository.getCanvasNode(common.canvasId, nodeId);
          if (!nodeRecord.ok) {
            throw nodeRecord;
          }
          const objectId = nodeRecord.value.canonicalObjectId ?? nodeId;
          const objectRecord = await context.repository.getCanonicalObject(context.workspaceId, objectId);
          if (!objectRecord.ok) {
            throw objectRecord;
          }
          return [buildRuntimeContentUpdateCommand({
            objectId,
            kind: normalizeRuntimeContentKind(objectRecord.value.primaryContentKind),
            content: typeof props.content === 'string' ? props.content : '',
          }) as unknown as MutationOperation];
        }
        return [{
          op: 'canvas.node.update',
          nodeId,
          propsPatch: props,
        }];
      },
    }, ctx);
  } catch (error) {
    mapCanonicalError(error, createIntentScopedDiagnostics({
      failedAction: commandType ?? 'node.update',
      stage: 'ws.node.update',
      details: { nodeId },
    }));
  }
}

async function handleNodeMove(
  params: Record<string, unknown>,
  ctx: RpcContext,
): Promise<{
  success: boolean;
  newVersion: string;
  commandId: string;
  canvasId: string;
  canvasRevision?: number;
}> {
  const common = ensureRuntimeCommonParams(params);
  const nodeId = ensureString(params.nodeId, 'nodeId');
  const x = ensureNumber(params.x, 'x');
  const y = ensureNumber(params.y, 'y');

  try {
    return await executeDirectCanvasMutation({
      canvasId: common.canvasId,
      commandId: common.commandId,
      originId: common.originId,
      rootPath: common.rootPath,
      baseVersion: common.baseVersion,
      buildOperations: () => [{
        op: 'canvas.node.move',
        nodeId,
        patch: { x, y },
      }],
    }, ctx);
  } catch (error) {
    mapCanonicalError(error, createIntentScopedDiagnostics({
      failedAction: 'node.move',
      stage: 'ws.node.move',
      details: { nodeId },
    }));
  }
}

async function handleNodeCreateBase(
  params: Record<string, unknown>,
  ctx: RpcContext,
): Promise<{
  success: boolean;
  newVersion: string;
  commandId: string;
  canvasId: string;
  canvasRevision?: number;
}> {
  const common = ensureRuntimeCommonParams(params);
  const node = ensureRecord(params.node, 'node') as unknown as CreateNodeInput;
  const nodeId = ensureString(node.id, 'node.id');
  const nodeType = ensureString(node.type, 'node.type') as CreateNodeInput['type'];
  const placement = ensureCreatePlacement(node.placement);

  try {
    return await executeDirectCanvasMutation({
      canvasId: common.canvasId,
      commandId: common.commandId,
      originId: common.originId,
      rootPath: common.rootPath,
      baseVersion: common.baseVersion,
      buildOperations: () => [{
        op: 'canvas.node.create',
        nodeId,
        nodeType,
        props: isRecord(node.props) ? node.props : undefined,
        placement: placement ?? undefined,
      } satisfies MutationOperation],
    }, ctx);
  } catch (error) {
    mapCanonicalError(error, createIntentScopedDiagnostics({
      failedAction: 'node.create',
      stage: 'ws.node.create',
      details: { nodeId },
    }));
  }
}

async function handleNodeCreate(
  params: Record<string, unknown>,
  ctx: RpcContext,
) {
  return handleNodeCreateBase(params, ctx);
}

async function handleCanvasNodeCreate(
  params: Record<string, unknown>,
  ctx: RpcContext,
) {
  return handleNodeCreateBase(params, ctx);
}

async function handleObjectBodyBlockInsert(
  params: Record<string, unknown>,
  ctx: RpcContext,
): Promise<{
  success: boolean;
  newVersion: string;
  commandId: string;
  canvasId: string;
  canvasRevision?: number;
}> {
  const common = ensureRuntimeCommonParams(params);
  const objectId = ensureString(params.objectId, 'objectId');
  const block = ensureContentBlock(params.block);
  const afterBlockId = ensureOptionalString(params.afterBlockId, 'afterBlockId');

  try {
    return await executeDirectCanvasMutation({
      canvasId: common.canvasId,
      commandId: common.commandId,
      originId: common.originId,
      rootPath: common.rootPath,
      baseVersion: common.baseVersion,
      buildOperations: () => [buildObjectBodyBlockInsertCommand({
        objectId,
        block: block as ContentBlock,
        afterBlockId,
        generateId: crypto.randomUUID,
      }) as unknown as MutationOperation],
    }, ctx);
  } catch (error) {
    mapCanonicalError(error, createIntentScopedDiagnostics({
      failedAction: 'object.body.block.insert',
      stage: 'ws.object.body.block.insert',
      details: { objectId, blockId: block.id },
    }));
  }
}

async function handleNodeDelete(
  params: Record<string, unknown>,
  ctx: RpcContext,
): Promise<{
  success: boolean;
  newVersion: string;
  commandId: string;
  canvasId: string;
  canvasRevision?: number;
}> {
  const common = ensureRuntimeCommonParams(params);
  const nodeId = ensureString(params.nodeId, 'nodeId');

  try {
    return await executeDirectCanvasMutation({
      canvasId: common.canvasId,
      commandId: common.commandId,
      originId: common.originId,
      rootPath: common.rootPath,
      baseVersion: common.baseVersion,
      buildOperations: () => [{
        op: 'canvas.node.delete',
        nodeId,
      }],
    }, ctx);
  } catch (error) {
    mapCanonicalError(error, createIntentScopedDiagnostics({
      failedAction: 'node.delete',
      stage: 'ws.node.delete',
      details: { nodeId },
    }));
  }
}

async function handleNodeReparent(
  params: Record<string, unknown>,
  ctx: RpcContext,
): Promise<{
  success: boolean;
  newVersion: string;
  commandId: string;
  canvasId: string;
  canvasRevision?: number;
}> {
  const common = ensureRuntimeCommonParams(params);
  const nodeId = ensureString(params.nodeId, 'nodeId');
  const newParentId = ensureOptionalString(params.newParentId, 'newParentId');

  try {
    return await executeDirectCanvasMutation({
      canvasId: common.canvasId,
      commandId: common.commandId,
      originId: common.originId,
      rootPath: common.rootPath,
      baseVersion: common.baseVersion,
      buildOperations: () => [{
        op: 'canvas.node.reparent',
        nodeId,
        parentNodeId: newParentId ?? null,
      }],
    }, ctx);
  } catch (error) {
    mapCanonicalError(error, createIntentScopedDiagnostics({
      failedAction: 'node.reparent',
      stage: 'ws.node.reparent',
      details: { nodeId, newParentId: newParentId ?? null },
    }));
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
