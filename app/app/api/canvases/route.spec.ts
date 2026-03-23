import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { GET, POST } from './route';

async function makeWorkspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'magam-documents-'));
  return root;
}

describe('canvases route', () => {
  let root: string;

  beforeEach(async () => {
    root = await makeWorkspace();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('lists canonical canvases from workspace-local persistence instead of tsx scans', async () => {
    await POST(new Request('http://localhost/api/canvases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootPath: root, path: 'docs/alpha.graph.tsx' }),
    }));
    await POST(new Request('http://localhost/api/canvases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootPath: root, path: 'notes/archive/beta.graph.tsx' }),
    }));

    const response = await GET(new Request(`http://localhost/api/canvases?root=${encodeURIComponent(root)}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe('DOC_200_LISTED');
    expect(body.rootPath).toBe(root);
    expect(body.health.state).toBe('ok');
    expect(body.health.canvasCount).toBe(2);
    expect(body.canvasCount).toBe(2);
    expect(body.canvases.map((canvas: { filePath: string }) => canvas.filePath).sort()).toEqual([
      'docs/alpha.graph.tsx',
      'notes/archive/beta.graph.tsx',
    ]);
    expect(body.canvases[0]).toEqual(expect.objectContaining({
      canvasId: expect.any(String),
      workspaceId: expect.any(String),
      latestRevision: 1,
    }));
  });

  it('rejects relative roots', async () => {
    const response = await GET(new Request('http://localhost/api/canvases?root=docs/workspace'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('DOC_400_INVALID_ROOT_PATH');
  });

  it('creates a canvas with the existing canvases prefix when canvases already exist', async () => {
    await mkdir(path.join(root, 'docs'), { recursive: true });
    const response = await POST(new Request('http://localhost/api/canvases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootPath: root }),
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.code).toBe('DOC_201_CREATED');
    expect(body.filePath).toMatch(/^canvases\/doc-/);
    expect(body.sourceVersion).toMatch(/^sha256:/);
    expect(body.canvasId).toMatch(/^doc-/);
    expect(body.workspaceId).toBe(path.basename(root).toLowerCase());
    expect(body.latestRevision).toBe(1);
  });

  it('creates a canvas at an explicit path inside the workspace root', async () => {
    const response = await POST(new Request('http://localhost/api/canvases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootPath: root, path: 'notes/overview.graph.tsx' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.filePath).toBe('notes/overview.graph.tsx');
    expect(body.canvasId).toMatch(/^doc-/);
  });

  it('rejects path traversal outside the root', async () => {
    const response = await POST(new Request('http://localhost/api/canvases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootPath: root, path: '../escape.graph.tsx' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('DOC_400_INVALID_PATH');
  });
});
