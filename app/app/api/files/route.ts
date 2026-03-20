import { proxyCompatibilityRequest } from '@/features/host/rpc';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET() {
  return proxyCompatibilityRequest({
    method: 'GET',
    pathname: '/files',
  });
}

export async function POST(request: Request) {
  return proxyCompatibilityRequest({
    body: await request.text(),
    headers: {
      'Content-Type': request.headers.get('content-type') || 'application/json',
    },
    method: 'POST',
    pathname: '/files',
  });
}
