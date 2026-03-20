import { proxyCompatibilityRequest } from '@/features/host/rpc';

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
