import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

let workspaceRoot: string;

async function loadRoute() {
  vi.resetModules();
  return import('./route');
}

describe('assets/file integration', () => {
  beforeEach(async () => {
    workspaceRoot = await mkdtemp(path.join(tmpdir(), 'magam-file-route-'));
    await mkdir(path.join(workspaceRoot, 'assets', 'images'), { recursive: true });
    process.env.MAGAM_TARGET_DIR = workspaceRoot;
  });

  afterEach(async () => {
    delete process.env.MAGAM_TARGET_DIR;
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('serves existing image from workspace', async () => {
    const assetPath = path.join(workspaceRoot, 'assets', 'images', 'logo.png');
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x00,
    ]);
    await writeFile(assetPath, png);

    const { GET } = await loadRoute();
    const response = await GET(new Request(`http://localhost/api/assets/file?path=${encodeURIComponent('assets/images/logo.png')}`));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');

    const body = Buffer.from(await response.arrayBuffer());
    expect(body.equals(png)).toBe(true);
  });

  it('blocks traversal attempts', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/assets/file?path=../../etc/passwd'));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('IMG_400_INVALID_SOURCE');
  });
});
