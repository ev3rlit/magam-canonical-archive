import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { GET, POST } from './route';

async function makeWorkspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'magam-workspaces-'));
  await mkdir(path.join(root, 'docs'), { recursive: true });
  await writeFile(path.join(root, 'docs', 'alpha.graph.tsx'), 'export default function Alpha() { return null; }');
  return root;
}

describe('workspaces route', () => {
  let root: string;

  beforeEach(async () => {
    root = await makeWorkspace();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('reports workspace metadata and health', async () => {
    const response = await GET(new Request(`http://localhost/api/workspaces?root=${encodeURIComponent(root)}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe('WS_200_HEALTHY');
    expect(body.rootPath).toBe(root);
    expect(body.health.state).toBe('healthy');
    expect(body.health.documentCount).toBe(1);
  });

  it('returns missing health for a non-existent root', async () => {
    const missingRoot = path.join(root, 'missing-workspace');
    const response = await GET(new Request(`http://localhost/api/workspaces?root=${encodeURIComponent(missingRoot)}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.health.state).toBe('missing');
  });

  it('ensures a missing workspace root can be created explicitly', async () => {
    const missingRoot = path.join(root, 'new-workspace');
    const response = await POST(new Request('http://localhost/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootPath: missingRoot, action: 'ensure' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe('WS_200_READY');
    expect(body.rootPath).toBe(missingRoot);
    expect(body.health.state).toBe('ok');
  });

  it('reveal route validates the root before opening it', async () => {
    const response = await POST(new Request('http://localhost/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootPath: path.join(root, 'missing-workspace'), action: 'reveal' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe('WS_404_WORKSPACE_MISSING');
  });
});
