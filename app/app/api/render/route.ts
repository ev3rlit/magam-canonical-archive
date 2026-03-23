import path from 'node:path';
import { proxyCompatibilityRequest } from '@/features/host/rpc';

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
        { error: 'canvasId is required' },
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
        { error: 'rootPath must be an absolute path' },
        { status: 400 },
      );
    }

    const payload = {
      ...body,
      canvasId: requestedCanvasId,
      ...(rawRootPath ? { rootPath: path.resolve(rawRootPath.trim()) } : {}),
    };

    return proxyCompatibilityRequest({
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': request.headers.get('content-type') || 'application/json',
      },
      method: 'POST',
      pathname: '/render',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API Proxy] Error:', message);

    return Response.json(
      { error: `Failed to connect to render server: ${message}` },
      { status: 502 },
    );
  }
}
