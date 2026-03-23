import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const {
  actualFsRef,
  mockGlob,
  mockTranspileWithMetadata,
  mockExecute,
  mockExistsSync,
  mockReadFileSync,
  mockMkdirSync,
  mockWriteFileSync,
  mockChatGetProviders,
  mockChatSend,
  mockChatStop,
  mockChatListSessions,
  mockChatGetSession,
  mockChatCreateSession,
  mockChatUpdateSession,
  mockChatDeleteSession,
  mockChatListMessages,
  mockChatListGroups,
  mockChatCreateGroup,
  mockChatUpdateGroup,
  mockChatDeleteGroup,
  mockChatAppendSystemMessage,
} = vi.hoisted(() => ({
  actualFsRef: { current: null as null | typeof import('fs') },
  mockGlob: vi.fn(),
  mockTranspileWithMetadata: vi.fn(),
  mockExecute: vi.fn(),
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockChatGetProviders: vi.fn(),
  mockChatSend: vi.fn(),
  mockChatStop: vi.fn(),
  mockChatListSessions: vi.fn(),
  mockChatGetSession: vi.fn(),
  mockChatCreateSession: vi.fn(),
  mockChatUpdateSession: vi.fn(),
  mockChatDeleteSession: vi.fn(),
  mockChatListMessages: vi.fn(),
  mockChatListGroups: vi.fn(),
  mockChatCreateGroup: vi.fn(),
  mockChatUpdateGroup: vi.fn(),
  mockChatDeleteGroup: vi.fn(),
  mockChatAppendSystemMessage: vi.fn(),
}));

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

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  actualFsRef.current = actual;
  return {
    ...actual,
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    mkdirSync: mockMkdirSync,
    writeFileSync: mockWriteFileSync,
  };
});

vi.mock('../chat/handler', () => ({
  ChatHandler: class {
    constructor(_config: unknown) {}
    getProviders() {
      return mockChatGetProviders();
    }
    listSessions(query: unknown) {
      return mockChatListSessions(query);
    }
    getSession(sessionId: string) {
      return mockChatGetSession(sessionId);
    }
    createSession(input: unknown) {
      return mockChatCreateSession(input);
    }
    updateSession(sessionId: string, patch: unknown) {
      return mockChatUpdateSession(sessionId, patch);
    }
    deleteSession(sessionId: string) {
      return mockChatDeleteSession(sessionId);
    }
    listMessages(sessionId: string, cursor?: string, limit?: number) {
      return mockChatListMessages(sessionId, cursor, limit);
    }
    listGroups() {
      return mockChatListGroups();
    }
    createGroup(input: unknown) {
      return mockChatCreateGroup(input);
    }
    updateGroup(groupId: string, patch: unknown) {
      return mockChatUpdateGroup(groupId, patch);
    }
    deleteGroup(groupId: string) {
      return mockChatDeleteGroup(groupId);
    }
    appendSystemMessage(sessionId: string, content: string, metadata?: Record<string, unknown>) {
      return mockChatAppendSystemMessage(sessionId, content, metadata);
    }
    send(request: unknown) {
      return mockChatSend(request);
    }
    stop(sessionId: string) {
      return mockChatStop(sessionId);
    }
  },
}));

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

    mockChatGetProviders.mockResolvedValue([
      { id: 'claude', displayName: 'Claude Code', isInstalled: true },
    ]);

    mockChatSend.mockImplementation(async function* (request: any) {
      const sessionId = request?.sessionId ?? 'session-default';
      yield {
        type: 'tool_use',
        content: 'Building prompt context',
        metadata: { stage: 'prompt-build-start', sessionId },
      };
      yield {
        type: 'tool_use',
        content: `Running ${request?.providerId ?? 'unknown'} adapter`,
        metadata: { stage: 'adapter-start', sessionId },
      };
      yield {
        type: 'done',
        content: '',
        metadata: { sessionId },
      };
    });

    mockChatStop.mockImplementation(() => ({ stopped: false }));
    mockReadFileSync.mockImplementation((filePath: fs.PathLike, options?: any) => {
      const normalizedPath = String(filePath);
      if (normalizedPath.endsWith('.sql') || normalizedPath.includes('/drizzle/')) {
        return actualFsRef.current?.readFileSync(filePath, options);
      }
      return 'export default function Test() { return null; }';
    });
    mockChatListSessions.mockResolvedValue([]);
    mockChatGetSession.mockResolvedValue(undefined);
    mockChatCreateSession.mockResolvedValue({ id: 's-new', providerId: 'claude', title: 'New Chat', createdAt: Date.now(), updatedAt: Date.now(), groupId: null, archivedAt: null });
    mockChatUpdateSession.mockResolvedValue({ id: 's-new', providerId: 'claude', title: 'Updated', createdAt: Date.now(), updatedAt: Date.now(), groupId: null, archivedAt: null });
    mockChatDeleteSession.mockResolvedValue(true);
    mockChatListMessages.mockResolvedValue({ items: [], nextCursor: null });
    mockChatListGroups.mockResolvedValue([]);
    mockChatCreateGroup.mockResolvedValue({ id: 'g-new', name: 'G', sortOrder: 0, createdAt: Date.now(), updatedAt: Date.now(), color: null });
    mockChatUpdateGroup.mockResolvedValue({ id: 'g-new', name: 'G2', sortOrder: 0, createdAt: Date.now(), updatedAt: Date.now(), color: null });
    mockChatDeleteGroup.mockResolvedValue(true);
    mockChatAppendSystemMessage.mockResolvedValue({ id: 'm1' });

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
        expect(body.documentCount).toBe(1);
      } finally {
        await rm(workspaceRoot, { recursive: true, force: true });
      }
    });

    it('creates workspace documents through POST /documents', async () => {
      const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'magam-http-documents-'));

      try {
        const response = await fetch(`${baseUrl}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rootPath: workspaceRoot }),
        });
        const body = await response.json();

        expect(response.status).toBe(201);
        expect(body.code).toBe('DOC_201_CREATED');
        expect(body.rootPath).toBe(workspaceRoot);
        expect(body.filePath).toMatch(/^documents\/doc-/);
        expect(body.sourceVersion).toMatch(/^sha256:/);
        expect(body.documentId).toMatch(/^doc-/);
        expect(body.workspaceId).toBe(path.basename(workspaceRoot).toLowerCase());
        expect(body.latestRevision).toBe(1);

        const listed = await fetch(`${baseUrl}/documents?rootPath=${encodeURIComponent(workspaceRoot)}`);
        const listedBody = await listed.json();
        expect(listed.status).toBe(200);
        expect(listedBody.documentCount).toBe(1);
        expect(listedBody.documents[0]).toEqual(expect.objectContaining({
          documentId: body.documentId,
          workspaceId: body.workspaceId,
          filePath: body.filePath,
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

    it('lists, upserts, and clears recent documents', async () => {
      const initial = await requestJson('/app-state/recent-documents?workspaceId=workspace-3');
      expect(initial.response.status).toBe(200);
      expect(initial.body).toEqual([]);

      const upsert = await requestJson('/app-state/recent-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'workspace-3',
          documentPath: 'docs/alpha.graph.tsx',
        }),
      });
      expect(upsert.response.status).toBe(200);
      expect(upsert.body).toMatchObject({
        workspaceId: 'workspace-3',
        documentPath: 'docs/alpha.graph.tsx',
      });

      const listed = await requestJson('/app-state/recent-documents?workspaceId=workspace-3');
      expect(listed.response.status).toBe(200);
      expect(listed.body).toHaveLength(1);
      expect(listed.body[0]).toMatchObject({
        workspaceId: 'workspace-3',
        documentPath: 'docs/alpha.graph.tsx',
      });

      const cleared = await requestJson('/app-state/recent-documents?workspaceId=workspace-3', {
        method: 'DELETE',
      });
      expect(cleared.response.status).toBe(200);
      expect(cleared.body).toEqual({ deleted: true });

      const afterClear = await requestJson('/app-state/recent-documents?workspaceId=workspace-3');
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
    it('should return 400 if filePath is missing', async () => {
      const response = await fetch(`${baseUrl}/render`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.type).toBe('VALIDATION_ERROR');
    });

    it('should return 404 if file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      const response = await fetch(`${baseUrl}/render`, {
        method: 'POST',
        body: JSON.stringify({ filePath: 'missing.tsx' }),
      });
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.type).toBe('FILE_NOT_FOUND');
    });

    it('should render file successfully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockTranspileWithMetadata.mockResolvedValue({
        code: 'transpiled code',
        inputs: [`${targetDir}/exists.tsx`],
      });
      mockExecute.mockResolvedValue({ isOk: () => true, value: {} } as any);

      const response = await fetch(`${baseUrl}/render`, {
        method: 'POST',
        body: JSON.stringify({ filePath: 'exists.tsx' }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.graph).toEqual({});
      expect(typeof body.sourceVersion).toBe('string');
      expect(body.sourceVersion.startsWith('sha256:')).toBe(true);
      expect(body.sourceVersions).toEqual({
        'exists.tsx': body.sourceVersion,
      });
      // expect valid args
      expect(mockTranspileWithMetadata).toHaveBeenCalledWith(expect.stringContaining('exists.tsx'));
      expect(mockExecute).toHaveBeenCalledWith('transpiled code');
    });

    it('should render a canonical document by documentId even when no filePath is provided', async () => {
      const created = await fetch(`${baseUrl}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath: targetDir }),
      }).then((response) => response.json());

      mockExistsSync.mockImplementation((candidatePath: fs.PathLike) => (
        String(candidatePath).endsWith(`${created.documentId}.graph.tsx`)
      ));
      mockTranspileWithMetadata.mockResolvedValue({
        code: 'transpiled code',
        inputs: [`${targetDir}/${created.filePath}`],
      });
      mockExecute.mockResolvedValue({ isOk: () => true, value: {} } as any);

      const response = await fetch(`${baseUrl}/render`, {
        method: 'POST',
        body: JSON.stringify({ documentId: created.documentId, rootPath: targetDir }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.graph).toEqual({});
      expect(body.documentId).toBe(created.documentId);
      expect(mockTranspileWithMetadata).toHaveBeenCalledWith(
        `${targetDir}/${created.filePath}`,
      );
    });

    it('should normalize duplicated workspace prefixes in render requests', async () => {
      const workspaceName = path.basename(targetDir);
      mockExistsSync.mockImplementation((candidatePath: fs.PathLike) => (
        String(candidatePath) === `${targetDir}/nested/example.tsx`
      ));
      mockTranspileWithMetadata.mockResolvedValue({
        code: 'transpiled code',
        inputs: [`${targetDir}/nested/example.tsx`],
      });
      mockExecute.mockResolvedValue({ isOk: () => true, value: {} } as any);

      const response = await fetch(`${baseUrl}/render`, {
        method: 'POST',
        body: JSON.stringify({ filePath: `${workspaceName}/${workspaceName}/nested/example.tsx` }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.sourceVersions).toEqual({
        'nested/example.tsx': body.sourceVersion,
      });
      expect(mockTranspileWithMetadata).toHaveBeenCalledWith(
        `${targetDir}/nested/example.tsx`,
      );
    });

    it('should inject sourceMeta.filePath from JSX source info', async () => {
      mockExistsSync.mockReturnValue(true);
      mockTranspileWithMetadata.mockResolvedValue({
        code: 'transpiled code',
        inputs: [
          `${targetDir}/exists.tsx`,
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
        body: JSON.stringify({ filePath: 'exists.tsx' }),
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
        'exists.tsx': expect.stringMatching(/^sha256:/),
        'components/auth.tsx': expect.stringMatching(/^sha256:/),
      });
    });

    it('should derive frame-local sourceId for scoped reusable nodes', async () => {
      mockExistsSync.mockReturnValue(true);
      mockTranspileWithMetadata.mockResolvedValue({
        code: 'transpiled code',
        inputs: [
          `${targetDir}/exists.tsx`,
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
        body: JSON.stringify({ filePath: 'exists.tsx' }),
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
      mockExistsSync.mockReturnValue(true);
      mockTranspileWithMetadata.mockRejectedValue(new Error('Transpile error'));

      const response = await fetch(`${baseUrl}/render`, {
        method: 'POST',
        body: JSON.stringify({ filePath: 'error.tsx' }),
      });
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.type).toBe('RENDER_ERROR');
    });
  });

  describe('Chat endpoints', () => {
    it('should return providers list', async () => {
      const response = await fetch(`${baseUrl}/chat/providers`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(body.providers)).toBe(true);
    });

    it('should reject workingDirectory in request body', async () => {
      const response = await fetch(`${baseUrl}/chat/send`, {
        method: 'POST',
        body: JSON.stringify({
          message: 'hello',
          providerId: 'claude',
          workingDirectory: '/tmp/unsafe'
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.type).toBe('VALIDATION_ERROR');
    });


    it('should default permissionMode to auto', async () => {
      await fetch(`${baseUrl}/chat/send`, {
        method: 'POST',
        body: JSON.stringify({
          message: 'hello',
          providerId: 'claude'
        }),
      });

      expect(mockChatSend).toHaveBeenCalledWith(
        expect.objectContaining({ permissionMode: 'auto' }),
      );
    });


    it('should pass interactive permissionMode when provided', async () => {
      await fetch(`${baseUrl}/chat/send`, {
        method: 'POST',
        body: JSON.stringify({
          message: 'hello',
          providerId: 'claude',
          permissionMode: 'interactive'
        }),
      });

      expect(mockChatSend).toHaveBeenCalledWith(
        expect.objectContaining({ permissionMode: 'interactive' }),
      );
    });

    it('should forward valid model and reasoning effort fields', async () => {
      await fetch(`${baseUrl}/chat/send`, {
        method: 'POST',
        body: JSON.stringify({
          message: 'hello',
          providerId: 'claude',
          model: 'gpt-5',
          effort: 'high',
        }),
      });

      expect(mockChatSend).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-5', reasoningEffort: 'high' }),
      );
    });

    it('should ignore unsupported model/effort values safely', async () => {
      await fetch(`${baseUrl}/chat/send`, {
        method: 'POST',
        body: JSON.stringify({
          message: 'hello',
          providerId: 'claude',
          model: '../etc/passwd\u0000',
          effort: 'extreme',
        }),
      });

      const call = mockChatSend.mock.calls.at(-1)?.[0] as any;
      expect(call.model).toBeUndefined();
      expect(call.reasoningEffort).toBeUndefined();
    });

    it('should parse mention payloads and forward sanitized values', async () => {
      await fetch(`${baseUrl}/chat/send`, {
        method: 'POST',
        body: JSON.stringify({
          message: 'hello',
          providerId: 'claude',
          fileMentions: [
            { path: 'src/a.ts' },
            { path: '' },
            '../outside.ts',
            { nope: true },
          ],
          nodeMentions: [
            { id: 'n1', summary: 'first node', title: 'Node 1', type: 'text' },
            { id: '', summary: 'invalid' },
            { id: 'n2', summary: '' },
          ],
        }),
      });

      expect(mockChatSend).toHaveBeenCalledWith(
        expect.objectContaining({
          fileMentions: [{ path: 'src/a.ts' }, { path: '../outside.ts' }],
          nodeMentions: [{ id: 'n1', summary: 'first node', title: 'Node 1', type: 'text' }],
        }),
      );
    });

    it('should cap mention counts', async () => {
      const manyFileMentions = Array.from({ length: 20 }, (_, i) => ({ path: `f-${i}.ts` }));
      const manyNodeMentions = Array.from({ length: 50 }, (_, i) => ({ id: `n-${i}`, summary: `s-${i}` }));

      await fetch(`${baseUrl}/chat/send`, {
        method: 'POST',
        body: JSON.stringify({
          message: 'hello',
          providerId: 'claude',
          fileMentions: manyFileMentions,
          nodeMentions: manyNodeMentions,
        }),
      });

      expect(mockChatSend).toHaveBeenCalledWith(
        expect.objectContaining({
          fileMentions: expect.arrayContaining([{ path: 'f-0.ts' }, { path: 'f-9.ts' }]),
          nodeMentions: expect.arrayContaining([{ id: 'n-0', summary: 's-0' }, { id: 'n-19', summary: 's-19' }]),
        }),
      );

      const call = mockChatSend.mock.calls.at(-1)?.[0] as any;
      expect(call.fileMentions).toHaveLength(10);
      expect(call.nodeMentions).toHaveLength(20);
    });

    it('should stream SSE response for /chat/send with progress and done', async () => {
      const response = await fetch(`${baseUrl}/chat/send`, {
        method: 'POST',
        body: JSON.stringify({
          message: 'hello',
          providerId: 'claude',
          sessionId: 's-1',
          currentFile: 'index.tsx'
        }),
      });

      const text = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/event-stream');
      expect(text).toContain('event: chunk');
      expect(text).toContain('Building prompt context');
      expect(text).toContain('Running claude adapter');
      expect(text).toContain('event: done');
      expect(text).toContain('"sessionId":"s-1"');
    });

    it('should stop active session run', async () => {
      let stopped = false;
      mockChatSend.mockImplementation(async function* () {
        yield {
          type: 'tool_use',
          content: 'Building prompt context',
          metadata: { sessionId: 'active-session' },
        };
        await new Promise((resolve) => setTimeout(resolve, 30));
        if (stopped) {
          yield {
            type: 'done',
            content: '',
            metadata: {
              code: 'ABORTED',
              stopped: true,
              stopReason: 'client-stop',
              sessionId: 'active-session',
            },
          };
          return;
        }
        yield { type: 'done', content: '', metadata: { sessionId: 'active-session' } };
      });
      mockChatStop.mockImplementation(() => {
        stopped = true;
        return { stopped: true };
      });

      const sendPromise = fetch(`${baseUrl}/chat/send`, {
        method: 'POST',
        body: JSON.stringify({
          message: 'hello',
          providerId: 'gemini',
          sessionId: 'active-session',
          currentFile: 'index.tsx'
        }),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const stopResponse = await fetch(`${baseUrl}/chat/stop`, {
        method: 'POST',
        body: JSON.stringify({ sessionId: 'active-session' }),
      });
      const stopBody = await stopResponse.json();

      const sendResponse = await sendPromise;
      const streamText = await sendResponse.text();

      expect(stopResponse.status).toBe(200);
      expect(stopBody).toEqual({ stopped: true });
      expect(streamText).toContain('event: done');
      expect(streamText).toContain('"stopped":true');
      expect(streamText).toContain('"code":"ABORTED"');
      expect(streamText).not.toContain('event: error');
    });
  });

  describe('Chat session/group APIs', () => {
    it('lists sessions with filters', async () => {
      mockChatListSessions.mockResolvedValueOnce([{ id: 's1', title: 'A' }]);
      const response = await fetch(`${baseUrl}/chat/sessions?groupId=g1&q=abc&limit=20`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.sessions).toHaveLength(1);
      expect(mockChatListSessions).toHaveBeenCalledWith(
        expect.objectContaining({ groupId: 'g1', q: 'abc', limit: 20 }),
      );
    });

    it('creates and updates a session', async () => {
      const createResponse = await fetch(`${baseUrl}/chat/sessions`, {
        method: 'POST',
        body: JSON.stringify({ providerId: 'claude', title: 'S' }),
      });
      expect(createResponse.status).toBe(201);

      mockChatGetSession.mockResolvedValueOnce({ id: 's1', providerId: 'claude', title: 'S' });
      mockChatUpdateSession.mockResolvedValueOnce({ id: 's1', providerId: 'codex', title: 'S2' });

      const patchResponse = await fetch(`${baseUrl}/chat/sessions/s1`, {
        method: 'PATCH',
        body: JSON.stringify({ providerId: 'codex', title: 'S2' }),
      });

      expect(patchResponse.status).toBe(200);
      expect(mockChatAppendSystemMessage).toHaveBeenCalled();
    });

    it('lists session messages with cursor', async () => {
      mockChatListMessages.mockResolvedValueOnce({
        items: [{ id: 'm1', content: 'hello' }],
        nextCursor: '100:m1',
      });

      const response = await fetch(`${baseUrl}/chat/sessions/s1/messages?cursor=1:m0&limit=10`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.nextCursor).toBe('100:m1');
      expect(mockChatListMessages).toHaveBeenCalledWith('s1', '1:m0', 10);
    });

    it('handles groups CRUD', async () => {
      const listRes = await fetch(`${baseUrl}/chat/groups`);
      expect(listRes.status).toBe(200);

      const createRes = await fetch(`${baseUrl}/chat/groups`, {
        method: 'POST',
        body: JSON.stringify({ name: 'A' }),
      });
      expect(createRes.status).toBe(201);

      const patchRes = await fetch(`${baseUrl}/chat/groups/g1`, {
        method: 'PATCH',
        body: JSON.stringify({ name: 'A2' }),
      });
      expect(patchRes.status).toBe(200);

      const delRes = await fetch(`${baseUrl}/chat/groups/g1`, { method: 'DELETE' });
      expect(delRes.status).toBe(200);
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
