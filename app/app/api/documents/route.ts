import path from 'node:path';
import { NextResponse } from 'next/server';
import {
  createCanonicalDocument,
  listCanonicalDocuments,
  type CanonicalDocumentShellRecord,
} from '../../../../libs/shared/src/lib/canonical-document-shell';
import { isCanonicalCliError } from '../../../../libs/shared/src/lib/canonical-cli';
import {
  ApiError,
  createDocumentSourceVersion,
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

function toRouteDocumentSummary(document: CanonicalDocumentShellRecord) {
  return {
    documentId: document.documentId,
    workspaceId: document.workspaceId,
    filePath: document.filePath ?? `documents/${document.documentId}.graph.tsx`,
    modifiedAt: document.updatedAt?.getTime() ?? document.createdAt?.getTime() ?? null,
    latestRevision: document.latestRevision,
  };
}

function toCompatibilitySourceVersion(document: CanonicalDocumentShellRecord): string {
  return createDocumentSourceVersion(JSON.stringify({
    documentId: document.documentId,
    workspaceId: document.workspaceId,
    latestRevision: document.latestRevision,
  }));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rootPath = resolveDocumentRootPath(pickRootPath(searchParams));

    const workspace = await requireWorkspaceRoot(rootPath);
    const documents = await listCanonicalDocuments({
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
        documentCount: documents.length,
      },
      documentCount: documents.length,
      documents: documents.map(toRouteDocumentSummary),
      lastModifiedAt: documents.reduce<number | null>((latest, document) => {
        const timestamp = document.updatedAt?.getTime() ?? document.createdAt?.getTime() ?? null;
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
    const rootPath = resolveDocumentRootPath(rawRootPath);

    const workspace = await requireWorkspaceRoot(rootPath);
    const rawFilePath = typeof body.filePath === 'string'
      ? body.filePath
      : typeof body.path === 'string'
        ? body.path
        : null;

    let created: CanonicalDocumentShellRecord;
    try {
      created = await createCanonicalDocument({
        targetDir: workspace.rootPath,
        filePath: rawFilePath,
        actor: {
          kind: 'system',
          id: 'api.documents',
        },
      });
    } catch (error) {
      if (isCanonicalCliError(error) && error.code === 'INVALID_ARGUMENT') {
        throw new ApiError(400, 'DOC_400_INVALID_PATH', error.message, error.details);
      }
      throw error;
    }

    return NextResponse.json({
      code: 'DOC_201_CREATED',
      rootPath: workspace.rootPath,
      root: workspace.rootPath,
      workspaceName: workspace.workspaceName,
      created: true,
      ...toRouteDocumentSummary(created),
      sourceVersion: toCompatibilitySourceVersion(created),
    }, { status: 201 });
  } catch (error) {
    return toJsonErrorResponse(error);
  }
}
