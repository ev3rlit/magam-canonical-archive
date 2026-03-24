import path from 'node:path';
import { API_SHARED_MESSAGES } from '../_shared/messages';
import { renderCanonicalCanvas } from '../../../../libs/shared/src/lib/canonical-query';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const requestedCanvasId = isRecord(body) && typeof body.canvasId === 'string'
      ? body.canvasId.trim()
      : '';
    if (!isRecord(body) || !requestedCanvasId) {
      return Response.json(
        { error: API_SHARED_MESSAGES.renderCanvasIdRequired },
        { status: 400 },
      );
    }

    const rawRootPath = typeof body.rootPath === 'string'
      ? body.rootPath
      : typeof body.root === 'string'
        ? body.root
        : undefined;
    if (rawRootPath !== undefined && !path.isAbsolute(rawRootPath.trim())) {
      return Response.json(
        { error: API_SHARED_MESSAGES.rootPathAbsolute },
        { status: 400 },
      );
    }

    const rootPath = rawRootPath ? path.resolve(rawRootPath.trim()) : process.cwd();
    const rendered = await renderCanonicalCanvas({
      targetDir: rootPath,
      canvasId: requestedCanvasId,
    });

    return Response.json(rendered);
  } catch (error) {
    const message = error instanceof Error ? error.message : API_SHARED_MESSAGES.unknownError;
    const code = typeof (error as { code?: unknown })?.code === 'string'
      ? (error as { code: string }).code
      : null;
    const status = code === 'INVALID_ARGUMENT'
      ? 400
      : code === 'DOCUMENT_NOT_FOUND' || code === 'WORKSPACE_NOT_FOUND'
        ? 404
        : 500;
    console.error(API_SHARED_MESSAGES.routeLog.renderProxy, message);

    return Response.json(
      {
        error: message,
        type: status === 500 ? 'RENDER_ERROR' : 'VALIDATION_ERROR',
        ...(code ? { code } : {}),
        ...(error instanceof Error && error.stack ? { details: error.stack } : {}),
      },
      { status },
    );
  }
}
