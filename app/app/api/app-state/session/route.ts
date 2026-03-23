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
  console.error('[api/app-state/session] unexpected error:', message);
  return NextResponse.json(
    { error: `Failed to handle app-state session request: ${message}` },
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

function parseNullableString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return value.trim() || null;
  }

  throw new ApiError(
    400,
    'APP_STATE_400_INVALID_ACTIVE_WORKSPACE',
    'activeWorkspaceId must be a string, null, or undefined.',
  );
}

export async function GET() {
  const { repository, close } = await createRepository();
  try {
    return NextResponse.json(await repository.getWorkspaceSession());
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
    const session = await repository.setWorkspaceSession({
      activeWorkspaceId: parseNullableString(
        'activeWorkspaceId' in body ? body.activeWorkspaceId : body.workspaceId,
      ),
    });

    return NextResponse.json(session);
  } catch (error) {
    return toJsonErrorResponse(error);
  } finally {
    await close();
  }
}
