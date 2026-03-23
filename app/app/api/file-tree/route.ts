import path from 'node:path';
import { API_SHARED_MESSAGES } from '../_shared/messages';
import { proxyCompatibilityRequest } from '@/features/host/rpc';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

function pickRootPath(searchParams: URLSearchParams): string | null {
  return searchParams.get('rootPath') || searchParams.get('root');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rootPath = pickRootPath(searchParams);
  if (rootPath && !path.isAbsolute(rootPath.trim())) {
    return Response.json(
      { error: API_SHARED_MESSAGES.fileTreeRootAbsolute },
      { status: 400 },
    );
  }

  const pathname = rootPath
    ? `/file-tree?rootPath=${encodeURIComponent(path.resolve(rootPath.trim()))}`
    : '/file-tree';

  return proxyCompatibilityRequest({
    headers: {
      'x-magam-proxy': 'file-tree',
    },
    method: 'GET',
    pathname,
  });
}
