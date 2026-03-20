import { proxyCompatibilityRequest } from '@/features/host/rpc';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  return proxyCompatibilityRequest({
    body: await request.text(),
    headers: {
      'Content-Type': request.headers.get('content-type') || 'application/json',
    },
    method: 'POST',
    pathname: '/render',
  });
}
