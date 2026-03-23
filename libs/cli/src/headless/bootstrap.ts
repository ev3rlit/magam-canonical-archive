import path from 'node:path';
import {
  CanonicalPersistenceRepository,
  cliError,
  createCanonicalPgliteDb,
  type HeadlessServiceContext,
} from '@magam/shared';

export interface HeadlessBootstrapOptions {
  targetDir?: string;
  workspaceRef?: string;
  requireWorkspace?: boolean;
  canvasRef?: string;
  requireDocument?: boolean;
}

export interface HeadlessCliContext extends HeadlessServiceContext {
  handle: Awaited<ReturnType<typeof createCanonicalPgliteDb>>;
  workspaceIds: string[];
  canvasIds: string[];
  resolvedWorkspaceId?: string;
  resolvedCanvasId?: string;
}

function sanitizeWorkspaceId(targetDir: string): string {
  const base = path.basename(targetDir).trim() || 'workspace';
  const sanitized = base
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized || 'workspace';
}

function resolveTargetDir(targetDir?: string): string {
  return path.resolve(targetDir ?? process.env['MAGAM_TARGET_DIR'] ?? process.cwd());
}

async function discoverWorkspaceIds(
  repository: CanonicalPersistenceRepository,
  db: HeadlessServiceContext['db'],
  defaultWorkspaceId: string,
): Promise<string[]> {
  const rows = await db.query.canonicalObjects.findMany({
    columns: {
      workspaceId: true,
    },
  });
  const repositoryIds = (await repository.listCanonicalObjects(defaultWorkspaceId)).map((record) => record.workspaceId);
  return [...new Set([defaultWorkspaceId, ...repositoryIds, ...rows.map((row) => row.workspaceId)])];
}

async function discoverCanvasIds(db: HeadlessServiceContext['db']): Promise<string[]> {
  const [nodes, bindings, revisions] = await Promise.all([
    db.query.canvasNodes.findMany({
      columns: { canvasId: true },
    }),
    db.query.canvasBindings.findMany({
      columns: { canvasId: true },
    }),
    db.query.canvasRevisions.findMany({
      columns: { canvasId: true },
    }),
  ]);

  return [...new Set([
    ...nodes.map((row) => row.canvasId),
    ...bindings.map((row) => row.canvasId),
    ...revisions.map((row) => row.canvasId),
  ])];
}

function resolveWorkspaceRef(input: {
  explicit?: string;
  discovered: string[];
  defaultWorkspaceId: string;
  required: boolean;
}): string | undefined {
  if (input.explicit) {
    return input.explicit;
  }

  if (!input.required) {
    return undefined;
  }

  if (input.discovered.length === 0) {
    return input.defaultWorkspaceId;
  }

  if (input.discovered.length === 1) {
    return input.discovered[0];
  }

  throw cliError('INVALID_ARGUMENT', '--workspace is required when multiple workspaces exist.', {
    details: { workspaceIds: input.discovered },
  });
}

function resolveCanvasRef(input: {
  explicit?: string;
  discovered: string[];
  required: boolean;
}): string | undefined {
  if (input.explicit) {
    return input.explicit;
  }

  if (!input.required) {
    return undefined;
  }

  if (input.discovered.length === 1) {
    return input.discovered[0];
  }

  throw cliError('INVALID_ARGUMENT', '--document is required when a single document cannot be inferred.', {
    details: { canvasIds: input.discovered },
  });
}

export async function withHeadlessContext<T>(
  options: HeadlessBootstrapOptions,
  run: (context: HeadlessCliContext) => Promise<T>,
): Promise<T> {
  const targetDir = resolveTargetDir(options.targetDir);
  const defaultWorkspaceId = process.env['MAGAM_WORKSPACE_ID']?.trim() || sanitizeWorkspaceId(targetDir);

  let handle: Awaited<ReturnType<typeof createCanonicalPgliteDb>> | null = null;
  try {
    handle = await createCanonicalPgliteDb(targetDir, {
      runMigrations: true,
    });
  } catch (error) {
    throw cliError('WORKSPACE_BOOTSTRAP_FAILED', 'Failed to bootstrap canonical workspace services.', {
      details: {
        targetDir,
        message: error instanceof Error ? error.message : 'bootstrap failed',
      },
    });
  }

  try {
    const repository = new CanonicalPersistenceRepository(handle.db);
    const workspaceIds = await discoverWorkspaceIds(repository, handle.db, defaultWorkspaceId);
    const canvasIds = await discoverCanvasIds(handle.db);
    const resolvedWorkspaceId = resolveWorkspaceRef({
      explicit: options.workspaceRef,
      discovered: workspaceIds.filter((workspaceId) => workspaceId !== defaultWorkspaceId || workspaceIds.length === 1),
      defaultWorkspaceId,
      required: options.requireWorkspace ?? false,
    });
    const resolvedCanvasId = resolveCanvasRef({
      explicit: options.canvasRef,
      discovered: canvasIds,
      required: options.requireDocument ?? false,
    });

    return await run({
      handle,
      db: handle.db,
      repository,
      targetDir,
      dataDir: handle.dataDir,
      defaultWorkspaceId,
      workspaceIds,
      canvasIds,
      ...(resolvedWorkspaceId ? { resolvedWorkspaceId } : {}),
      ...(resolvedCanvasId ? { resolvedCanvasId } : {}),
    });
  } finally {
    await handle.close();
  }
}
