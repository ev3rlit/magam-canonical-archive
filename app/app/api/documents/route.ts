import path from 'node:path';
import { NextResponse } from 'next/server';
import {
  ApiError,
  createWorkspaceDocument,
  requireWorkspaceRoot,
} from '../workspaces/_shared';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

function pickRootPath(searchParams: URLSearchParams): string | null {
  return searchParams.get('rootPath') || searchParams.get('root');
}

function resolveDocumentRootPath(rawRootPath: unknown): string {
  if (typeof rawRootPath !== 'string') {
    throw new ApiError(400, 'DOC_400_INVALID_ROOT_PATH', 'rootPath is required');
  }

  const trimmed = rawRootPath.trim();
  if (!trimmed || !path.isAbsolute(trimmed)) {
    throw new ApiError(400, 'DOC_400_INVALID_ROOT_PATH', 'rootPath must be an absolute path');
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

  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error('[api/documents] unexpected error:', message);
  return NextResponse.json(
    { error: `Failed to handle documents request: ${message}`, code: 'DOC_500_REQUEST_FAILED' },
    { status: 500 },
  );
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new ApiError(400, 'DOC_400_INVALID_JSON', `Request body must be valid JSON: ${message}`);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'DOC_400_INVALID_JSON', 'Request body must be a JSON object');
  }

  return body as Record<string, unknown>;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rootPath = resolveDocumentRootPath(pickRootPath(searchParams));

    const workspace = await requireWorkspaceRoot(rootPath);
    return NextResponse.json({
      code: 'DOC_200_LISTED',
      rootPath: workspace.rootPath,
      root: workspace.rootPath,
      workspaceName: workspace.workspaceName,
      documentCount: workspace.documentCount,
      documents: workspace.documents,
      lastModifiedAt: workspace.lastModifiedAt,
    });
  } catch (error) {
    return toJsonErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const rawRootPath = 'rootPath' in body ? body.rootPath : body.root;
    const rootPath = resolveDocumentRootPath(rawRootPath);

    const workspace = await requireWorkspaceRoot(rootPath);
    const rawFilePath = typeof body.filePath === 'string'
      ? body.filePath
      : typeof body.path === 'string'
        ? body.path
        : null;

    const created = await createWorkspaceDocument({
      rootPath: workspace.rootPath,
      filePath: rawFilePath,
    });

    return NextResponse.json({
      code: 'DOC_201_CREATED',
      rootPath: workspace.rootPath,
      root: workspace.rootPath,
      workspaceName: workspace.workspaceName,
      created: true,
      ...created,
    }, { status: 201 });
  } catch (error) {
    return toJsonErrorResponse(error);
  }
}
