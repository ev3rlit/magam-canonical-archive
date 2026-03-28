import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { cliError, persistenceFailureToCliError } from '../canonical-cli';
import {
  createCanonicalPgliteDb,
  CanonicalPersistenceRepository,
  resolveCanonicalMigrationsFolder,
} from '../canonical-persistence';
import type { HeadlessServiceContext } from '../canonical-cli';
import {
  getCurrentCanvasRevision,
  getWorkspaceCanvas,
  listWorkspaceCanvases,
} from '../canonical-query/workspace-canvas';
import type {
  CanonicalCanvasShellRecord,
  CreateCanonicalCanvasShellInput,
  GetCanonicalCanvasShellInput,
  ListCanonicalCanvasShellInput,
} from './types';

function sanitizeWorkspaceId(targetDir: string): string {
  const base = path.basename(targetDir).trim() || 'workspace';
  const sanitized = base
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized || 'workspace';
}

function resolveWorkspaceId(targetDir: string, workspaceId?: string): string {
  const trimmed = workspaceId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : sanitizeWorkspaceId(targetDir);
}

function resolveMigrationsFolder(): string {
  return resolveCanonicalMigrationsFolder(process.cwd());
}

async function withCanonicalCanvasContext<T>(
  targetDirInput: string,
  workspaceIdInput: string | undefined,
  run: (context: HeadlessServiceContext, workspaceId: string) => Promise<T>,
): Promise<T> {
  const targetDir = path.resolve(targetDirInput);
  const workspaceId = resolveWorkspaceId(targetDir, workspaceIdInput);
  const handle = await createCanonicalPgliteDb(targetDir, {
    migrationsFolder: resolveMigrationsFolder(),
    runMigrations: true,
  });

  try {
    const repository = new CanonicalPersistenceRepository(handle.db);
    const context: HeadlessServiceContext = {
      db: handle.db,
      repository,
      targetDir,
      dataDir: handle.dataDir,
      defaultWorkspaceId: workspaceId,
    };
    return await run(context, workspaceId);
  } finally {
    await handle.close();
  }
}

export async function listCanonicalCanvases(
  input: ListCanonicalCanvasShellInput,
): Promise<CanonicalCanvasShellRecord[]> {
  return withCanonicalCanvasContext(input.targetDir, input.workspaceId, async (context, workspaceId) => (
    listWorkspaceCanvases(context, workspaceId)
  ));
}

export async function getCanonicalCanvas(
  input: GetCanonicalCanvasShellInput,
): Promise<CanonicalCanvasShellRecord> {
  return withCanonicalCanvasContext(input.targetDir, input.workspaceId, async (context, workspaceId) => (
    getWorkspaceCanvas(context, input.canvasId, workspaceId)
  ));
}

export async function createCanonicalCanvas(
  input: CreateCanonicalCanvasShellInput,
): Promise<CanonicalCanvasShellRecord> {
  return withCanonicalCanvasContext(input.targetDir, input.workspaceId, async (context, workspaceId) => {
    const canvasId = input.canvasId?.trim() || `doc-${randomUUID()}`;
    const title = typeof input.title === 'string' && input.title.trim().length > 0
      ? input.title.trim()
      : null;
    const revisionNo = (await getCurrentCanvasRevision(context, canvasId)) + 1;
    const createdAt = new Date();
    const appendResult = await context.repository.appendCanvasRevision({
      id: `docrev-${randomUUID()}`,
      canvasId,
      revisionNo,
      authorKind: input.actor?.kind ?? 'system',
      authorId: input.actor?.id ?? 'canonical-canvas-shell',
      mutationBatch: {
        op: 'canvas.create',
        canvasShell: {
          workspaceId,
          title,
          createdAt: createdAt.toISOString(),
        },
      },
      createdAt,
    });

    if (!appendResult.ok) {
      throw persistenceFailureToCliError(appendResult);
    }

    return getWorkspaceCanvas(context, canvasId, workspaceId);
  });
}
