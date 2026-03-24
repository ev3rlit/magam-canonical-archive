import path from 'node:path';
import { NextResponse } from 'next/server';
import { API_SHARED_MESSAGES } from '../_shared/messages';
import {
  createCanonicalCanvas,
  listCanonicalCanvases,
  type CanonicalCanvasShellRecord,
} from '../../../../libs/shared/src/lib/canonical-canvas-shell';
import { isCanonicalCliError } from '../../../../libs/shared/src/lib/canonical-cli';
import {
  ApiError,
  createCanvasSourceVersion,
  requireWorkspaceRoot,
} from '../workspaces/_shared';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

function pickRootPath(searchParams: URLSearchParams): string | null {
  return searchParams.get('rootPath') || searchParams.get('root');
}

function resolveCanvasRootPath(rawRootPath: unknown): string {
  if (typeof rawRootPath !== 'string') {
    throw new ApiError(400, 'DOC_400_INVALID_ROOT_PATH', API_SHARED_MESSAGES.rootPathRequired);
  }

  const trimmed = rawRootPath.trim();
  if (!trimmed || !path.isAbsolute(trimmed)) {
    throw new ApiError(400, 'DOC_400_INVALID_ROOT_PATH', API_SHARED_MESSAGES.rootPathAbsolute);
  }

  return trimmed;
}

function toJsonErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  if (isCanonicalCliError(error)) {
    const status = error.code === 'INVALID_ARGUMENT'
      ? 400
      : error.code === 'DOCUMENT_NOT_FOUND' || error.code === 'WORKSPACE_NOT_FOUND'
        ? 404
        : 422;
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details },
      { status },
    );
  }

  const message = error instanceof Error ? error.message : API_SHARED_MESSAGES.unknownError;
  console.error(API_SHARED_MESSAGES.routeLog.canvases, message);
  return NextResponse.json(
    { error: `${API_SHARED_MESSAGES.routeFailure.canvases}: ${message}`, code: 'DOC_500_REQUEST_FAILED' },
    { status: 500 },
  );
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : API_SHARED_MESSAGES.unknownError;
    throw new ApiError(400, 'DOC_400_INVALID_JSON', API_SHARED_MESSAGES.requestBodyMustBeValidJson(message));
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'DOC_400_INVALID_JSON', API_SHARED_MESSAGES.requestBodyMustBeJsonObject);
  }

  return body as Record<string, unknown>;
}

function toRouteCanvasSummary(canvas: CanonicalCanvasShellRecord) {
  return {
    canvasId: canvas.canvasId,
    workspaceId: canvas.workspaceId,
    title: canvas.title,
    modifiedAt: canvas.updatedAt?.getTime() ?? canvas.createdAt?.getTime() ?? null,
    latestRevision: canvas.latestRevision,
  };
}

function toCompatibilitySourceVersion(canvas: CanonicalCanvasShellRecord): string {
  return createCanvasSourceVersion(JSON.stringify({
    canvasId: canvas.canvasId,
    workspaceId: canvas.workspaceId,
    latestRevision: canvas.latestRevision,
  }));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rootPath = resolveCanvasRootPath(pickRootPath(searchParams));

    const workspace = await requireWorkspaceRoot(rootPath);
    const canvases = await listCanonicalCanvases({
      targetDir: workspace.rootPath,
    });
    return NextResponse.json({
      code: 'DOC_200_LISTED',
      rootPath: workspace.rootPath,
      root: workspace.rootPath,
      workspaceName: workspace.workspaceName,
      name: workspace.workspaceName,
      health: {
        state: workspace.health.status,
        message: workspace.health.message,
        canvasCount: canvases.length,
      },
      canvasCount: canvases.length,
      canvases: canvases.map(toRouteCanvasSummary),
      lastModifiedAt: canvases.reduce<number | null>((latest, canvas) => {
        const timestamp = canvas.updatedAt?.getTime() ?? canvas.createdAt?.getTime() ?? null;
        if (timestamp === null) {
          return latest;
        }
        return latest === null ? timestamp : Math.max(latest, timestamp);
      }, null),
    });
  } catch (error) {
    return toJsonErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const rawRootPath = 'rootPath' in body ? body.rootPath : body.root;
    const rootPath = resolveCanvasRootPath(rawRootPath);

    const workspace = await requireWorkspaceRoot(rootPath);
    const rawTitle = typeof body.title === 'string' ? body.title : null;

    let created: CanonicalCanvasShellRecord;
    try {
      created = await createCanonicalCanvas({
        targetDir: workspace.rootPath,
        title: rawTitle,
        actor: {
          kind: 'system',
          id: 'api.canvases',
        },
      });
    } catch (error) {
      throw error;
    }

    return NextResponse.json({
      code: 'DOC_201_CREATED',
      rootPath: workspace.rootPath,
      root: workspace.rootPath,
      workspaceName: workspace.workspaceName,
      created: true,
      ...toRouteCanvasSummary(created),
      sourceVersion: toCompatibilitySourceVersion(created),
    }, { status: 201 });
  } catch (error) {
    return toJsonErrorResponse(error);
  }
}
