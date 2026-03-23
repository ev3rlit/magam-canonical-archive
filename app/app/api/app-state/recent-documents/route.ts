import { NextResponse } from 'next/server';
import {
  AppStatePersistenceRepository,
  createAppStatePgliteDb,
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
  console.error('[api/app-state/recent-documents] unexpected error:', message);
  return NextResponse.json(
    { error: `Failed to handle app-state recent-documents request: ${message}` },
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

export async function GET(request: Request) {
  const { repository, close } = await createRepository();
  try {
    const workspaceId = requireString(
      new URL(request.url).searchParams.get('workspaceId'),
      'workspaceId',
    );
    return NextResponse.json(await repository.listRecentDocuments(workspaceId));
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
    const document = await repository.upsertRecentDocument({
      workspaceId: requireString(body.workspaceId, 'workspaceId'),
      documentPath: requireString(body.documentPath, 'documentPath'),
      lastOpenedAt: parseOptionalDate(body.lastOpenedAt),
    });

    return NextResponse.json(document);
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
    await repository.clearRecentDocuments(workspaceId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return toJsonErrorResponse(error);
  } finally {
    await close();
  }
}
