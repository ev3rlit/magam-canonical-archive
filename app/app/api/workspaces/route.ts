import { NextResponse } from 'next/server';
import { API_SHARED_MESSAGES } from '../_shared/messages';
import {
  ApiError,
  ensureWorkspaceRoot,
  openWorkspaceInFileBrowser,
  probeWorkspace,
  resolveDefaultWorkspaceRootPath,
  requireWorkspaceRoot,
} from './_shared';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

function pickRootPath(searchParams: URLSearchParams): string | null {
  return searchParams.get('rootPath') || searchParams.get('root');
}

function toJsonErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : API_SHARED_MESSAGES.unknownError;
  console.error(API_SHARED_MESSAGES.routeLog.workspaces, message);
  return NextResponse.json(
    { error: `${API_SHARED_MESSAGES.routeFailure.workspaces}: ${message}`, code: 'WS_500_REQUEST_FAILED' },
    { status: 500 },
  );
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'WS_400_INVALID_JSON', API_SHARED_MESSAGES.requestBodyMustBeJsonObject);
  }

  return body as Record<string, unknown>;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rootPath = pickRootPath(searchParams) || resolveDefaultWorkspaceRootPath();

    const workspace = await probeWorkspace(rootPath);
    return NextResponse.json({
      code: workspace.health.status === 'ok' ? 'WS_200_HEALTHY' : 'WS_200_PROBED',
      rootPath: workspace.rootPath,
      root: workspace.rootPath,
      workspaceName: workspace.workspaceName,
      name: workspace.workspaceName,
      health: {
        state: workspace.health.status,
        message: workspace.health.message,
        canvasCount: workspace.canvasCount,
      },
      canvasCount: workspace.canvasCount,
      canvases: workspace.canvases,
      lastModifiedAt: workspace.lastModifiedAt,
    });
  } catch (error) {
    return toJsonErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const rawRootPath = body.rootPath;
    if (typeof rawRootPath !== 'string') {
      throw new ApiError(400, 'WS_400_INVALID_ROOT_PATH', API_SHARED_MESSAGES.rootPathRequired);
    }

    const rawAction = body.action;
    if (rawAction !== 'open' && rawAction !== 'reveal' && rawAction !== 'ensure') {
      throw new ApiError(400, 'WS_400_INVALID_ACTION', API_SHARED_MESSAGES.actionRequired);
    }

    if (rawAction === 'ensure') {
      const ensured = await ensureWorkspaceRoot(rawRootPath);
      return NextResponse.json({
        code: 'WS_200_READY',
        rootPath: ensured.rootPath,
        root: ensured.rootPath,
        workspaceName: ensured.workspaceName,
        name: ensured.workspaceName,
        health: {
          state: ensured.health.status,
          message: ensured.health.message,
          canvasCount: ensured.canvasCount,
        },
        canvasCount: ensured.canvasCount,
        canvases: ensured.canvases,
        lastModifiedAt: ensured.lastModifiedAt,
      });
    }

    const workspace = await requireWorkspaceRoot(rawRootPath);
    const result = await openWorkspaceInFileBrowser({
      platform: process.platform,
      rootPath: workspace.rootPath,
      action: rawAction,
    });
    const { rootPath: _resultRootPath, ...resultPayload } = result;

    return NextResponse.json({
      code: rawAction === 'reveal' ? 'WS_200_REVEALED' : 'WS_200_OPENED',
      rootPath: workspace.rootPath,
      root: workspace.rootPath,
      workspaceName: workspace.workspaceName,
      name: workspace.workspaceName,
      ...resultPayload,
    });
  } catch (error) {
    return toJsonErrorResponse(error);
  }
}
