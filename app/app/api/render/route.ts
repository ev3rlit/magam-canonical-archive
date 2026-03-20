import path from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  const httpPort = process.env.MAGAM_HTTP_PORT || '3002';

  try {
    const body = await request.json();
    if (!isRecord(body) || typeof body.filePath !== 'string' || body.filePath.trim().length === 0) {
      return NextResponse.json(
        { error: 'filePath is required' },
        { status: 400 }
      );
    }

    const rawRootPath = typeof body.rootPath === 'string'
      ? body.rootPath
      : typeof body.root === 'string'
        ? body.root
        : undefined;
    if (rawRootPath !== undefined && !path.isAbsolute(rawRootPath.trim())) {
      return NextResponse.json(
        { error: 'rootPath must be an absolute path' },
        { status: 400 }
      );
    }

    const payload = {
      ...body,
      filePath: body.filePath.trim(),
      ...(rawRootPath ? { rootPath: path.resolve(rawRootPath.trim()) } : {}),
    };

    const res = await fetch(`http://localhost:${httpPort}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API Proxy] Error:', message);

    return NextResponse.json(
      { error: `Failed to connect to render server: ${message}` },
      { status: 502 }
    );
  }
}
