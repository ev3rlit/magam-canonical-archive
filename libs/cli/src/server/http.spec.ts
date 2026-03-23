import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

type HttpSpecMocks = {
  actualFsRef: { current: null | typeof import('fs') };
  mockGlob: ReturnType<typeof vi.fn>;
  mockTranspileWithMetadata: ReturnType<typeof vi.fn>;
  mockExecute: ReturnType<typeof vi.fn>;
  mockExistsSync: ReturnType<typeof vi.fn>;
  mockReadFileSync: ReturnType<typeof vi.fn>;
  mockMkdirSync: ReturnType<typeof vi.fn>;
  mockWriteFileSync: ReturnType<typeof vi.fn>;
};

function getHttpSpecMocks(): HttpSpecMocks {
  const globalState = globalThis as typeof globalThis & { __HTTP_SPEC_MOCKS__?: HttpSpecMocks };
  if (!globalState.__HTTP_SPEC_MOCKS__) {
    globalState.__HTTP_SPEC_MOCKS__ = {
      actualFsRef: { current: null },
      mockGlob: vi.fn(),
      mockTranspileWithMetadata: vi.fn(),
      mockExecute: vi.fn(),
      mockExistsSync: vi.fn(),
      mockReadFileSync: vi.fn(),
      mockMkdirSync: vi.fn(),
      mockWriteFileSync: vi.fn(),
    };
  }

  return globalState.__HTTP_SPEC_MOCKS__;
}

const {
  actualFsRef,
  mockGlob,
  mockTranspileWithMetadata,
  mockExecute,
  mockExistsSync,
  mockReadFileSync,
  mockMkdirSync,
  mockWriteFileSync,
} = getHttpSpecMocks();
const require = createRequire(import.meta.url);

// Mock fast-glob
vi.mock('fast-glob', () => ({
  default: mockGlob,
}));

// Mock dependencies
vi.mock('../core/transpiler', () => ({
  transpile: vi.fn(),
  transpileWithMetadata: mockTranspileWithMetadata,
}));

vi.mock('../core/executor', () => ({
  execute: mockExecute,
}));

vi.mock('fs', () => {
  const actual = require('node:fs') as typeof import('node:fs');
  actualFsRef.current = actual;
  return {
    ...actual,
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    mkdirSync: mockMkdirSync,
    writeFileSync: mockWriteFileSync,
  };
});

// Import after mocks
import { startHttpServer, HttpServerResult } from './http';
import * as fs from 'fs';

describe('HTTP Render Server', () => {
  let serverResult: HttpServerResult;
  let baseUrl: string;
  let port: number;
  let targetDir: string;
  let nextPort = 4001;

  beforeEach(async () => {
    vi.clearAllMocks();
    targetDir = await mkdtemp(path.join(os.tmpdir(), 'magam-http-target-'));
    port = nextPort;
    nextPort += 1;
    baseUrl = `http://localhost:${port}`;
    if (!actualFsRef.current) {
      throw new Error('Expected actual fs implementation to be initialized.');
    }
    mockExistsSync.mockImplementation(actualFsRef.current.existsSync);
    mockReadFileSync.mockImplementation(actualFsRef.current.readFileSync as any);
    mockMkdirSync.mockImplementation(actualFsRef.current.mkdirSync as any);
    mockWriteFileSync.mockImplementation(actualFsRef.current.writeFileSync as any);
    mockReadFileSync.mockImplementation((filePath: fs.PathLike, options?: any) => {
      const normalizedPath = String(filePath);
      if (normalizedPath.endsWith('.sql') || normalizedPath.includes('/drizzle/')) {
        return actualFsRef.current?.readFileSync(filePath, options);
      }
      return 'export default function Test() { return null; }';
    });

    serverResult = await startHttpServer({ targetDir, port });
  });

  afterEach(async () => {
    if (serverResult) {
      await serverResult.close();
    }
    await rm(targetDir, { recursive: true, force: true });
  });

  async function requestJson(pathname: string, init?: RequestInit) {
    const response = await fetch(`${baseUrl}${pathname}`, init);
    const body = await response.json();
    return { response, body };
  }

  describe('GET /health', () => {
    it('should return ok status', async () => {
      const response = await fetch(`${baseUrl}/health`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ status: 'ok', targetDir });
    });
  });

  describe('GET /files', () => {
    it('should return list of files', async () => {
      mockGlob.mockResolvedValue(['file1.tsx', 'file2.tsx']);

      const response = await fetch(`${baseUrl}/files`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ files: ['file1.tsx', 'file2.tsx'] });
      expect(mockGlob).toHaveBeenCalledWith('**/*.tsx', { cwd: targetDir });
    });

    it('should handle glob errors', async () => {
      mockGlob.mockRejectedValue(new Error('Glob error'));

      const response = await fetch(`${baseUrl}/files`);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.type).toBe('FILES_ERROR');
    });
  });

  describe('POST /files', () => {
    it('should return 400 if filePath is missing', async () => {
      const response = await fetch(`${baseUrl}/files`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.type).toBe('VALIDATION_ERROR');
    });

    it('should create a new empty canvas document and return its source version', async () => {
      mockExistsSync.mockReturnValue(false);

      const response = await fetch(`${baseUrl}/files`, {
        method: 'POST',
        body: JSON.stringify({ filePath: 'docs/untitled-2.graph.tsx' }),
      });
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.filePath).toBe('docs/untitled-2.graph.tsx');
      expect(body.sourceVersion.startsWith('sha256:')).toBe(true);
      expect(mockMkdirSync).toHaveBeenCalledWith(`${targetDir}/docs`, { recursive: true });
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        `${targetDir}/docs/untitled-2.graph.tsx`,
        expect.stringContaining('<Canvas></Canvas>'),
        'utf-8',
      );
    });

    it('should reject when the target file already exists', async () => {
      mockExistsSync.mockReturnValue(true);

      const response = await fetch(`${baseUrl}/files`, {
        method: 'POST',
        body: JSON.stringify({ filePath: 'docs/untitled-2.graph.tsx' }),
      });
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.type).toBe('FILE_EXISTS');
    });
  });

  describe('Workspace shell endpoints', () => {
    it('reports workspace metadata through GET /workspaces', async () => {
      const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'magam-http-workspace-'));
      await mkdir(path.join(workspaceRoot, 'docs'), { recursive: true });
      await writeFile(path.join(workspaceRoot, 'docs', 'alpha.graph.tsx'), 'export default function Alpha() { return null; }');

      try {
        const response = await fetch(`${baseUrl}/workspaces?rootPath=${encodeURIComponent(workspaceRoot)}`);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.code).toBe('WS_200_HEALTHY');
        expect(body.rootPath).toBe(workspaceRoot);
        expect(body.health.state).toBe('ok');
        expect(body.canvasCount).toBe(1);
      } finally {
        await rm(workspaceRoot, { recursive: true, force: true });
      }
    });

    it('creates workspace canvases through POST /canvases', async () => {
      const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'magam-http-documents-'));

      try {
        const response = await fetch(`${baseUrl}/canvases`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rootPath: workspaceRoot }),
        });
        const body = await response.json();

        expect(response.status).toBe(201);
        expect(body.code).toBe('DOC_201_CREATED');
        expect(body.rootPath).toBe(workspaceRoot);
        expect(body.sourceVersion).toMatch(/^sha256:/);
        expect(body.canvasId).toMatch(/^doc-/);
        expect(body.workspaceId).toBe(path.basename(workspaceRoot).toLowerCase());
        expect(body.latestRevision).toBe(1);
        expect(body.title).toBeNull();

        const listed = await fetch(`${baseUrl}/canvases?rootPath=${encodeURIComponent(workspaceRoot)}`);
        const listedBody = await listed.json();
        expect(listed.status).toBe(200);
        expect(listedBody.health.state).toBe('ok');
        expect(listedBody.canvasCount).toBe(1);
        expect(listedBody.canvases[0]).toEqual(expect.objectContaining({
          canvasId: body.canvasId,
          workspaceId: body.workspaceId,
          title: null,
        }));
      } finally {
        await rm(workspaceRoot, { recursive: true, force: true });
      }
    });
  });

  describe('App-state endpoints', () => {
    it('lists, upserts, and deletes workspaces', async () => {
      const initial = await requestJson('/app-state/workspaces');
      expect(initial.response.status).toBe(200);
      expect(initial.body).toEqual([]);

      const upsert = await requestJson('/app-state/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'workspace-1',
          rootPath: '/tmp/workspace-1',
          displayName: 'Workspace 1',
          status: 'ok',
          isPinned: true,
        }),
      });
      expect(upsert.response.status).toBe(200);
      expect(upsert.body).toMatchObject({
        id: 'workspace-1',
        rootPath: '/tmp/workspace-1',
        displayName: 'Workspace 1',
        status: 'ok',
        isPinned: true,
      });

      const listed = await requestJson('/app-state/workspaces');
      expect(listed.response.status).toBe(200);
      expect(listed.body).toHaveLength(1);
      expect(listed.body[0]).toMatchObject({ id: 'workspace-1' });

      const deleted = await requestJson('/app-state/workspaces?workspaceId=workspace-1', {
        method: 'DELETE',
      });
      expect(deleted.response.status).toBe(200);
      expect(deleted.body).toEqual({ deleted: true });

      const afterDelete = await requestJson('/app-state/workspaces');
      expect(afterDelete.response.status).toBe(200);
      expect(afterDelete.body).toEqual([]);
    });

    it('gets and sets session', async () => {
      const initial = await requestJson('/app-state/session');
      expect(initial.response.status).toBe(200);
      expect(initial.body).toBeNull();

      const updated = await requestJson('/app-state/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeWorkspaceId: 'workspace-2' }),
      });
      expect(updated.response.status).toBe(200);
      expect(updated.body).toMatchObject({
        singletonKey: 'global',
        activeWorkspaceId: 'workspace-2',
      });

      const fetched = await requestJson('/app-state/session');
      expect(fetched.response.status).toBe(200);
      expect(fetched.body).toMatchObject({
        singletonKey: 'global',
        activeWorkspaceId: 'workspace-2',
      });
    });

    it('lists, upserts, and clears recent canvases', async () => {
      const initial = await requestJson('/app-state/recent-canvases?workspaceId=workspace-3');
      expect(initial.response.status).toBe(200);
      expect(initial.body).toEqual([]);

      const upsert = await requestJson('/app-state/recent-canvases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'workspace-3',
          canvasPath: 'docs/alpha.graph.tsx',
        }),
      });
      expect(upsert.response.status).toBe(200);
      expect(upsert.body).toMatchObject({
        workspaceId: 'workspace-3',
        canvasPath: 'docs/alpha.graph.tsx',
      });

      const listed = await requestJson('/app-state/recent-canvases?workspaceId=workspace-3');
      expect(listed.response.status).toBe(200);
      expect(listed.body).toHaveLength(1);
      expect(listed.body[0]).toMatchObject({
        workspaceId: 'workspace-3',
        canvasPath: 'docs/alpha.graph.tsx',
      });

      const cleared = await requestJson('/app-state/recent-canvases?workspaceId=workspace-3', {
        method: 'DELETE',
      });
      expect(cleared.response.status).toBe(200);
      expect(cleared.body).toEqual({ deleted: true });

      const afterClear = await requestJson('/app-state/recent-canvases?workspaceId=workspace-3');
      expect(afterClear.response.status).toBe(200);
      expect(afterClear.body).toEqual([]);
    });

    it('gets and sets preferences', async () => {
      const initial = await requestJson('/app-state/preferences?key=theme.mode');
      expect(initial.response.status).toBe(200);
      expect(initial.body).toBeNull();

      const updated = await requestJson('/app-state/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'theme.mode',
          valueJson: { mode: 'dark' },
        }),
      });
      expect(updated.response.status).toBe(200);
      expect(updated.body).toMatchObject({
        key: 'theme.mode',
        valueJson: { mode: 'dark' },
      });

      const fetched = await requestJson('/app-state/preferences?key=theme.mode');
      expect(fetched.response.status).toBe(200);
      expect(fetched.body).toMatchObject({
        key: 'theme.mode',
        valueJson: { mode: 'dark' },
      });
    });
  });

  describe('POST /render', () => {
    it('should return 400 if canvasId is missing', async () => {
      const response = await fetch(`${baseUrl}/render`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.type).toBe('VALIDATION_ERROR');
    });

    it('should return 404 if canvas does not exist', async () => {
      const response = await fetch(`${baseUrl}/render`, {
        method: 'POST',
        body: JSON.stringify({ canvasId: 'doc-missing', rootPath: targetDir }),
      });
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.type).toBe('FILE_NOT_FOUND');
    });

    it('should render canvas successfully', async () => {
      const created = await fetch(`${baseUrl}/canvases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath: targetDir }),
      }).then((response) => response.json());

      mockExistsSync.mockImplementation((candidatePath: fs.PathLike) => (
        String(candidatePath).endsWith(`${created.canvasId}.graph.tsx`)
          ? true
          : actualFsRef.current?.existsSync(candidatePath) ?? false
      ));
      mockTranspileWithMetadata.mockResolvedValue({
        code: 'transpiled code',
        inputs: [`${targetDir}/canvases/${created.canvasId}.graph.tsx`],
      });
      mockExecute.mockResolvedValue({ isOk: () => true, value: {} } as any);

      const response = await fetch(`${baseUrl}/render`, {
        method: 'POST',
        body: JSON.stringify({ canvasId: created.canvasId, rootPath: targetDir }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.graph).toEqual({});
      expect(body.canvasId).toBe(created.canvasId);
      expect(typeof body.sourceVersion).toBe('string');
      expect(body.sourceVersion.startsWith('sha256:')).toBe(true);
      expect(body.sourceVersions).toEqual({
        [`canvases/${created.canvasId}.graph.tsx`]: body.sourceVersion,
      });
      expect(mockTranspileWithMetadata).toHaveBeenCalledWith(
        `${targetDir}/canvases/${created.canvasId}.graph.tsx`,
      );
      expect(mockExecute).toHaveBeenCalledWith('transpiled code');
    });

    it('should render a canonical canvas by canvasId', async () => {
      const created = await fetch(`${baseUrl}/canvases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath: targetDir }),
      }).then((response) => response.json());

      mockExistsSync.mockImplementation((candidatePath: fs.PathLike) => (
        String(candidatePath).endsWith(`${created.canvasId}.graph.tsx`)
          ? true
          : actualFsRef.current?.existsSync(candidatePath) ?? false
      ));
      mockTranspileWithMetadata.mockResolvedValue({
        code: 'transpiled code',
        inputs: [`${targetDir}/canvases/${created.canvasId}.graph.tsx`],
      });
      mockExecute.mockResolvedValue({ isOk: () => true, value: {} } as any);

      const response = await fetch(`${baseUrl}/render`, {
        method: 'POST',
        body: JSON.stringify({ canvasId: created.canvasId, rootPath: targetDir }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.graph).toEqual({});
      expect(body.canvasId).toBe(created.canvasId);
      expect(mockTranspileWithMetadata).toHaveBeenCalledWith(
        `${targetDir}/canvases/${created.canvasId}.graph.tsx`,
      );
    });

    it('should inject sourceMeta.filePath from JSX source info', async () => {
      const created = await fetch(`${baseUrl}/canvases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath: targetDir }),
      }).then((response) => response.json());

      mockExistsSync.mockImplementation((candidatePath: fs.PathLike) => (
        String(candidatePath).endsWith(`${created.canvasId}.graph.tsx`)
          ? true
          : actualFsRef.current?.existsSync(candidatePath) ?? false
      ));
      mockTranspileWithMetadata.mockResolvedValue({
        code: 'transpiled code',
        inputs: [
          `${targetDir}/canvases/${created.canvasId}.graph.tsx`,
          `${targetDir}/components/auth.tsx`,
        ],
      });
      mockExecute.mockResolvedValue({
        isOk: () => true,
        value: {
          children: [
            {
              type: 'graph-node',
              props: {
                id: 'root',
                __source: { fileName: `${targetDir}/components/auth.tsx` },
              },
              children: [],
            },
          ],
        },
      } as any);

      const response = await fetch(`${baseUrl}/render`, {
        method: 'POST',
        body: JSON.stringify({ canvasId: created.canvasId, rootPath: targetDir }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.graph.children[0].props.sourceMeta).toEqual({
        sourceId: 'root',
        renderedId: 'root',
        filePath: 'components/auth.tsx',
        kind: 'canvas',
      });
      expect(body.sourceVersions).toMatchObject({
        [`canvases/${created.canvasId}.graph.tsx`]: expect.stringMatching(/^sha256:/),
        'components/auth.tsx': expect.stringMatching(/^sha256:/),
      });
    });

    it('should derive frame-local sourceId for scoped reusable nodes', async () => {
      const created = await fetch(`${baseUrl}/canvases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath: targetDir }),
      }).then((response) => response.json());

      mockExistsSync.mockImplementation((candidatePath: fs.PathLike) => (
        String(candidatePath).endsWith(`${created.canvasId}.graph.tsx`)
          ? true
          : actualFsRef.current?.existsSync(candidatePath) ?? false
      ));
      mockTranspileWithMetadata.mockResolvedValue({
        code: 'transpiled code',
        inputs: [
          `${targetDir}/canvases/${created.canvasId}.graph.tsx`,
          `${targetDir}/components/service-frame.tsx`,
        ],
      });
      mockExecute.mockResolvedValue({
        isOk: () => true,
        value: {
          children: [
            {
              type: 'graph-shape',
              props: {
                id: 'auth.cache.worker',
                __magamScope: 'auth.cache',
                __source: { fileName: `${targetDir}/components/service-frame.tsx` },
              },
              children: [],
            },
          ],
        },
      } as any);

      const response = await fetch(`${baseUrl}/render`, {
        method: 'POST',
        body: JSON.stringify({ canvasId: created.canvasId, rootPath: targetDir }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.graph.children[0].props.sourceMeta).toEqual({
        sourceId: 'worker',
        renderedId: 'auth.cache.worker',
        filePath: 'components/service-frame.tsx',
        kind: 'canvas',
        frameScope: 'auth.cache',
        framePath: ['auth', 'cache'],
      });
      expect(body.graph.children[0].props.__magamScope).toBeUndefined();
    });

    it('should handle render errors', async () => {
      const created = await fetch(`${baseUrl}/canvases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath: targetDir }),
      }).then((response) => response.json());

      mockExistsSync.mockImplementation((candidatePath: fs.PathLike) => (
        String(candidatePath).endsWith(`${created.canvasId}.graph.tsx`)
          ? true
          : actualFsRef.current?.existsSync(candidatePath) ?? false
      ));
      mockTranspileWithMetadata.mockRejectedValue(new Error('Transpile error'));

      const response = await fetch(`${baseUrl}/render`, {
        method: 'POST',
        body: JSON.stringify({ canvasId: created.canvasId, rootPath: targetDir }),
      });
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.type).toBe('RENDER_ERROR');
    });
  });

  describe('Removed chat endpoints', () => {
    it('returns not found for legacy chat routes', async () => {
      const requests: Array<[string, RequestInit | undefined]> = [
        ['/chat/providers', undefined],
        ['/chat/send', { method: 'POST', body: JSON.stringify({}) }],
        ['/chat/stop', { method: 'POST', body: JSON.stringify({}) }],
        ['/chat/sessions', undefined],
        ['/chat/sessions/s1', undefined],
        ['/chat/sessions/s1/messages', undefined],
        ['/chat/groups', undefined],
        ['/chat/groups/g1', { method: 'DELETE' }],
      ];

      for (const [pathname, init] of requests) {
        const response = await fetch(`${baseUrl}${pathname}`, init);
        const body = await response.json();
        expect(response.status).toBe(404);
        expect(body).toEqual({ error: 'Not found' });
      }
    });
  });

  describe('CORS', () => {
    it.skip('should handle OPTIONS requests', async () => {
      const response = await fetch(`${baseUrl}/render`, {
        method: 'OPTIONS',
      });

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });
  });
});
