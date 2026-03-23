import { NextResponse } from 'next/server';
import {
  AppStatePersistenceRepository,
  createAppStatePgliteDb,
  type AppPreferenceValue,
} from '../../../../../libs/shared/src/lib/app-state-persistence';
import { API_SHARED_MESSAGES, formatApiRequestFailure } from '../../_shared/messages';
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

  const message = error instanceof Error ? error.message : API_SHARED_MESSAGES.unknownError;
  console.error(API_SHARED_MESSAGES.routeLog.appStatePreferences, message);
  return NextResponse.json(
    { error: formatApiRequestFailure('app-state preferences', message) },
    { status: 500 },
  );
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'APP_STATE_400_INVALID_JSON', API_SHARED_MESSAGES.requestBodyMustBeJsonObject);
  }

  return body as Record<string, unknown>;
}

function requirePreferenceKey(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ApiError(400, 'APP_STATE_400_INVALID_KEY', API_SHARED_MESSAGES.keyRequired);
  }

  return value.trim();
}

function parsePreferenceValue(value: unknown): AppPreferenceValue {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }

  throw new ApiError(
    400,
    'APP_STATE_400_INVALID_VALUE',
    API_SHARED_MESSAGES.requestJsonCompatibleValue,
  );
}

export async function GET(request: Request) {
  const { repository, close } = await createRepository();
  try {
    const key = requirePreferenceKey(new URL(request.url).searchParams.get('key'));
    return NextResponse.json(await repository.getPreference(key));
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
    const preference = await repository.setPreference({
      key: requirePreferenceKey(body.key),
      valueJson: parsePreferenceValue(body.valueJson),
    });

    return NextResponse.json(preference);
  } catch (error) {
    return toJsonErrorResponse(error);
  } finally {
    await close();
  }
}
