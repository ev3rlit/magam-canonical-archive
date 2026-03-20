import { proxyCompatibilityRequest } from '@/features/host/rpc';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET() {
  return proxyCompatibilityRequest({
    headers: {
      'x-magam-proxy': 'file-tree',
    },
    method: 'GET',
    pathname: '/file-tree',
  });
}
