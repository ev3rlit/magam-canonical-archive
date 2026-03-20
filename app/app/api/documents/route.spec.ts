import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { GET, POST } from './route';

async function makeWorkspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'magam-documents-'));
  await mkdir(path.join(root, 'docs'), { recursive: true });
  await mkdir(path.join(root, 'notes', 'archive'), { recursive: true });
  await writeFile(path.join(root, 'docs', 'alpha.graph.tsx'), 'export default function Alpha() { return null; }');
  await writeFile(path.join(root, 'notes', 'archive', 'beta.tsx'), 'export default function Beta() { return null; }');
  await writeFile(path.join(root, 'readme.md'), '# workspace');
  return root;
}

describe('documents route', () => {
  let root: string;

  beforeEach(async () => {
    root = await makeWorkspace();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('lists tsx documents under the workspace root', async () => {
    const response = await GET(new Request(`http://localhost/api/documents?root=${encodeURIComponent(root)}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe('DOC_200_LISTED');
    expect(body.rootPath).toBe(root);
    expect(body.documentCount).toBe(2);
    expect(body.documents.map((document: { filePath: string }) => document.filePath)).toEqual([
      'docs/alpha.graph.tsx',
      'notes/archive/beta.tsx',
    ]);
  });

  it('rejects relative roots', async () => {
    const response = await GET(new Request('http://localhost/api/documents?root=docs/workspace'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('DOC_400_INVALID_ROOT_PATH');
  });

  it('creates a document with the existing docs prefix when docs already exist', async () => {
    const response = await POST(new Request('http://localhost/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root }),
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.code).toBe('DOC_201_CREATED');
    expect(body.filePath).toBe('docs/untitled-1.graph.tsx');
    expect(body.sourceVersion).toMatch(/^sha256:/);
  });

  it('creates a document at an explicit path inside the workspace root', async () => {
    const response = await POST(new Request('http://localhost/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root, path: 'notes/overview.graph.tsx' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.filePath).toBe('notes/overview.graph.tsx');
  });

  it('rejects path traversal outside the root', async () => {
    const response = await POST(new Request('http://localhost/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root, path: '../escape.graph.tsx' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('DOC_400_INVALID_PATH');
  });
});
