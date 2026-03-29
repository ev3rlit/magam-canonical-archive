import { mkdir } from 'fs/promises';
import { resolve } from 'path';
import {
  CanonicalPersistenceRepository,
  createCanvasRuntimeServiceContext,
  createCanonicalPgliteDb,
  redoCanvasMutation,
  undoCanvasMutation,
  type CanvasRedoRequestV1,
  type CanvasUndoRequestV1,
  type MutationResultEnvelopeV1,
} from '../../../libs/shared/src';
import { RPC_ERRORS } from '../rpc';
import {
  createIntentScopedDiagnostics,
  withDiagnostics,
} from '../shared/errors';
import {
  ensureOptionalRootPath,
  ensureString,
  sanitizeWorkspaceId,
  type RpcContext,
  type RpcMethodRegistry,
} from '../shared/params';

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

function ensureRuntimeCommonParams(params: Record<string, unknown>) {
  const canvasId = ensureString(params.canvasId, 'canvasId');
  const originId = ensureString(params.originId, 'originId');
  const commandId = ensureString(params.commandId, 'commandId');
  const rootPath = ensureOptionalRootPath(params.rootPath, 'rootPath');
  return { canvasId, originId, commandId, rootPath };
}

function ensureCanvasUndoRequest(
  value: Record<string, unknown>,
  fallbackCanvasId?: string,
): CanvasUndoRequestV1 {
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

function ensureCanvasRedoRequest(
  value: Record<string, unknown>,
  fallbackCanvasId?: string,
): CanvasRedoRequestV1 {
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

async function handleCanvasRuntimeUndo(
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
  const request = ensureCanvasUndoRequest(params, common.canvasId);

  try {
    const runtimeMutation = await withCanonicalContext(
      common.rootPath,
      async ({ db, repository, targetDir, dataDir, workspaceId }) => {
        const runtimeContext = createCanvasRuntimeServiceContext({
          db,
          repository,
          targetDir,
          dataDir,
          defaultWorkspaceId: workspaceId,
        });
        return undoCanvasMutation(runtimeContext, request);
      },
    );

    const canvasRevision = runtimeMutation.envelope.ok
      ? runtimeMutation.envelope.data.canvasRevisionAfter ?? undefined
      : undefined;
    return {
      success: runtimeMutation.envelope.ok,
      commandId: common.commandId,
      canvasId: request.canvasId,
      ...(typeof canvasRevision === 'number' ? { canvasRevision } : {}),
      runtimeResult: runtimeMutation.envelope,
    };
  } catch (error) {
    const diagnostics = createIntentScopedDiagnostics({
      failedAction: 'canvas.runtime.undo',
      stage: 'ws.canvas.runtime.undo',
      details: { canvasId: request.canvasId },
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

async function handleCanvasRuntimeRedo(
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
  const request = ensureCanvasRedoRequest(params, common.canvasId);

  try {
    const runtimeMutation = await withCanonicalContext(
      common.rootPath,
      async ({ db, repository, targetDir, dataDir, workspaceId }) => {
        const runtimeContext = createCanvasRuntimeServiceContext({
          db,
          repository,
          targetDir,
          dataDir,
          defaultWorkspaceId: workspaceId,
        });
        return redoCanvasMutation(runtimeContext, request);
      },
    );

    const canvasRevision = runtimeMutation.envelope.ok
      ? runtimeMutation.envelope.data.canvasRevisionAfter ?? undefined
      : undefined;
    return {
      success: runtimeMutation.envelope.ok,
      commandId: common.commandId,
      canvasId: request.canvasId,
      ...(typeof canvasRevision === 'number' ? { canvasRevision } : {}),
      runtimeResult: runtimeMutation.envelope,
    };
  } catch (error) {
    const diagnostics = createIntentScopedDiagnostics({
      failedAction: 'canvas.runtime.redo',
      stage: 'ws.canvas.runtime.redo',
      details: { canvasId: request.canvasId },
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

export const historyHandlers: RpcMethodRegistry = {
  'canvas.runtime.undo': handleCanvasRuntimeUndo,
  'canvas.runtime.redo': handleCanvasRuntimeRedo,
};
