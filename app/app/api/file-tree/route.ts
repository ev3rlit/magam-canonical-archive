import path from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

function pickRootPath(searchParams: URLSearchParams): string | null {
  return searchParams.get('rootPath') || searchParams.get('root');
}

export async function GET(request: Request) {
    const httpPort = process.env.MAGAM_HTTP_PORT || '3002';

    try {
        const { searchParams } = new URL(request.url);
        const rootPath = pickRootPath(searchParams);
        if (rootPath && !path.isAbsolute(rootPath.trim())) {
            return NextResponse.json(
                { error: 'rootPath must be an absolute path' },
                { status: 400 },
            );
        }

        const upstreamUrl = new URL(`http://localhost:${httpPort}/file-tree`);
        if (rootPath) {
            upstreamUrl.searchParams.set('rootPath', path.resolve(rootPath.trim()));
        }

        const res = await fetch(upstreamUrl, {
            cache: 'no-store',
            next: { revalidate: 0 },
            headers: {
                'x-magam-proxy': 'file-tree',
            },
        });
        const data = await res.json();

        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[API Proxy] FileTree Error:', message);

        return NextResponse.json(
            { error: `Failed to connect to render server: ${message}` },
            { status: 502 }
        );
    }
}
