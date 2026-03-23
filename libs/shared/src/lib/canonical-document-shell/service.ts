import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cliError, persistenceFailureToCliError } from '../canonical-cli';
import { createCanonicalPgliteDb, CanonicalPersistenceRepository } from '../canonical-persistence';
import type { HeadlessServiceContext } from '../canonical-cli';
import {
  getCurrentDocumentRevision,
  getWorkspaceDocument,
  listWorkspaceDocuments,
} from '../canonical-query/workspace-document';
import type {
  CanonicalDocumentShellRecord,
  CreateCanonicalDocumentShellInput,
  GetCanonicalDocumentShellInput,
  ListCanonicalDocumentShellInput,
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
  return fileURLToPath(new URL('../canonical-persistence/drizzle/', import.meta.url));
}

function normalizeCompatibilityFilePath(documentId: string, rawFilePath?: string | null): string {
  const fallback = `documents/${documentId}.graph.tsx`;
  if (!rawFilePath) {
    return fallback;
  }

  const normalized = path.posix.normalize(rawFilePath.replace(/\\/g, '/').trim()).replace(/^\/+/, '');
  if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    throw cliError('INVALID_ARGUMENT', 'filePath must stay within the workspace-relative compatibility shell.', {
      details: { filePath: rawFilePath },
    });
  }

  return normalized;
}

async function withCanonicalDocumentContext<T>(
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

export async function listCanonicalDocuments(
  input: ListCanonicalDocumentShellInput,
): Promise<CanonicalDocumentShellRecord[]> {
  return withCanonicalDocumentContext(input.targetDir, input.workspaceId, async (context, workspaceId) => (
    listWorkspaceDocuments(context, workspaceId)
  ));
}

export async function getCanonicalDocument(
  input: GetCanonicalDocumentShellInput,
): Promise<CanonicalDocumentShellRecord> {
  return withCanonicalDocumentContext(input.targetDir, input.workspaceId, async (context, workspaceId) => (
    getWorkspaceDocument(context, input.documentId, workspaceId)
  ));
}

export async function createCanonicalDocument(
  input: CreateCanonicalDocumentShellInput,
): Promise<CanonicalDocumentShellRecord> {
  return withCanonicalDocumentContext(input.targetDir, input.workspaceId, async (context, workspaceId) => {
    const documentId = input.documentId?.trim() || `doc-${randomUUID()}`;
    const filePath = normalizeCompatibilityFilePath(documentId, input.filePath);
    const revisionNo = (await getCurrentDocumentRevision(context, documentId)) + 1;
    const createdAt = new Date();
    const appendResult = await context.repository.appendDocumentRevision({
      id: `docrev-${randomUUID()}`,
      documentId,
      revisionNo,
      authorKind: input.actor?.kind ?? 'system',
      authorId: input.actor?.id ?? 'canonical-document-shell',
      mutationBatch: {
        op: 'document.create',
        documentShell: {
          workspaceId,
          filePath,
          createdAt: createdAt.toISOString(),
        },
      },
      createdAt,
    });

    if (!appendResult.ok) {
      throw persistenceFailureToCliError(appendResult);
    }

    return getWorkspaceDocument(context, documentId, workspaceId);
  });
}
