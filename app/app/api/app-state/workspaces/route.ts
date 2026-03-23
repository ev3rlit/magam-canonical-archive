import { NextResponse } from 'next/server';
import {
  AppStatePersistenceRepository,
  createAppStatePgliteDb,
  type AppWorkspaceStatus,
} from '../../../../../libs/shared/src/lib/app-state-persistence';
import { ApiError } from '../../workspaces/_shared';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

async function createRepository() {
  const handle = await createAppStatePgliteDb(process.env.MAGAM_REPO_ROOT || process.cwd(), {
    runMigrations: true,
  });

  return {
    repository: new AppStatePersistenceRepository(handle.db),
    close: handle.close,
  };
}

function toJsonErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error('[api/app-state/workspaces] unexpected error:', message);
  return NextResponse.json(
    { error: `Failed to handle app-state workspaces request: ${message}` },
    { status: 500 },
  );
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'APP_STATE_400_INVALID_JSON', 'Request body must be a JSON object.');
  }

  return body as Record<string, unknown>;
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ApiError(400, 'APP_STATE_400_INVALID_FIELD', `${fieldName} is required.`);
  }

  return value.trim();
}

function parseWorkspaceStatus(value: unknown): AppWorkspaceStatus {
  if (
    value === 'ok'
    || value === 'missing'
    || value === 'not-directory'
    || value === 'unreadable'
  ) {
    return value;
  }

  throw new ApiError(
    400,
    'APP_STATE_400_INVALID_STATUS',
    'status must be one of ok, missing, not-directory, unreadable.',
  );
}

function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const next = new Date(value);
    if (!Number.isNaN(next.getTime())) {
      return next;
    }
  }

  throw new ApiError(400, 'APP_STATE_400_INVALID_DATE', 'Date fields must be valid date values.');
}

export async function GET() {
  const { repository, close } = await createRepository();
  try {
    return NextResponse.json(await repository.listWorkspaces());
  } catch (error) {
    return toJsonErrorResponse(error);
  } finally {
    await close();
  }
}

export async function POST(request: Request) {
  const { repository, close } = await createRepository();
  try {
    const body = await readJsonBody(request);
    const workspace = await repository.upsertWorkspace({
      id: requireString(body.id, 'id'),
      rootPath: requireString(body.rootPath, 'rootPath'),
      displayName: requireString(body.displayName, 'displayName'),
      status: parseWorkspaceStatus(body.status),
      isPinned: typeof body.isPinned === 'boolean' ? body.isPinned : undefined,
      lastOpenedAt: parseOptionalDate(body.lastOpenedAt),
      lastSeenAt: parseOptionalDate(body.lastSeenAt),
    });

    return NextResponse.json(workspace);
  } catch (error) {
    return toJsonErrorResponse(error);
  } finally {
    await close();
  }
}

export async function DELETE(request: Request) {
  const { repository, close } = await createRepository();
  try {
    const workspaceId = requireString(
      new URL(request.url).searchParams.get('workspaceId'),
      'workspaceId',
    );
    await repository.removeWorkspace(workspaceId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return toJsonErrorResponse(error);
  } finally {
    await close();
  }
}
