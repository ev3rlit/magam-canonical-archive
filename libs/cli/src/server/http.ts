import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import { createHash } from 'crypto';
import glob from 'fast-glob';
import { transpileWithMetadata } from '../core/transpiler';
import { execute } from '../core/executor';
import { ChatHandler } from '../chat/handler';
import {
  createCanonicalDocument,
  listCanonicalDocuments,
  type CanonicalDocumentShellRecord,
} from '../../../shared/src/lib/canonical-document-shell';
import { isCanonicalCliError } from '../../../shared/src/lib/canonical-cli';
import {
  ApiError,
  createDocumentSourceVersion,
  ensureWorkspaceRoot,
  openWorkspaceInFileBrowser,
  probeWorkspace,
  requireWorkspaceRoot,
} from '../../../shared/src/lib/workspace-shell';
import {
  AppStatePersistenceRepository,
  createAppStatePgliteDb,
} from '../../../shared/src/lib/app-state-persistence';
import type {
  ChatPermissionMode,
  ProviderId,
  SendChatRequest,
  StopChatRequest,
} from '@magam/shared';
import type {
  AppPreferenceValue,
  AppWorkspaceStatus,
} from '../../../shared/src/lib/app-state-persistence';

const DEFAULT_PORT = 3002;

export interface HttpServerConfig {
  targetDir: string;
  port?: number;
}

export interface HttpServerResult {
  port: number;
  close: () => Promise<void>;
}

interface RenderPipelineTiming {
  totalMs: number;
  hashMs: number;
  transpileMs: number;
  executeMs: number;
}

interface RenderPipelineResult {
  graph: RenderLikeNode;
  sourceVersion: string;
  sourceVersions: Record<string, string>;
  timing: RenderPipelineTiming;
  cacheState: 'hit' | 'miss' | 'dedupe-hit';
}

interface RenderCacheEntry extends RenderPipelineResult {
  cachedAt: number;
}

const RENDER_CACHE_MAX = parseInt(process.env.MAGAM_RENDER_CACHE_MAX || '200', 10);
const RENDER_CACHE_TTL_MS = parseInt(process.env.MAGAM_RENDER_CACHE_TTL_MS || `${10 * 60 * 1000}`, 10);
const renderCache = new Map<string, RenderCacheEntry>();
const renderInFlight = new Map<string, Promise<RenderPipelineResult>>();

function createRenderCacheKey(absolutePath: string, sourceVersion: string): string {
  return `${absolutePath}::${sourceVersion}`;
}

function pruneRenderCache(now = Date.now()) {
  for (const [key, entry] of renderCache.entries()) {
    if ((now - entry.cachedAt) > RENDER_CACHE_TTL_MS) {
      renderCache.delete(key);
    }
  }

  while (renderCache.size > RENDER_CACHE_MAX) {
    const oldest = renderCache.keys().next().value;
    if (!oldest) {
      break;
    }
    renderCache.delete(oldest);
  }
}

function getRenderCacheEntry(key: string): RenderCacheEntry | null {
  const now = Date.now();
  const entry = renderCache.get(key);
  if (!entry) {
    return null;
  }

  if ((now - entry.cachedAt) > RENDER_CACHE_TTL_MS) {
    renderCache.delete(key);
    return null;
  }

  return entry;
}

function setRenderCacheEntry(key: string, value: RenderPipelineResult): RenderCacheEntry {
  const entry: RenderCacheEntry = {
    ...value,
    cachedAt: Date.now(),
  };
  renderCache.set(key, entry);
  pruneRenderCache(entry.cachedAt);
  return entry;
}

function logRenderPipeline(
  filePath: string,
  cache: RenderPipelineResult['cacheState'],
  timing: RenderPipelineTiming,
  sourceVersion: string,
) {
  console.info('[Perf][render]', {
    filePath,
    cache,
    sourceVersion,
    totalMs: timing.totalMs,
    hashMs: timing.hashMs,
    transpileMs: timing.transpileMs,
    executeMs: timing.executeMs,
  });
}

function hashSourceContent(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

function createEmptyCanvasDocumentSource(): string {
  return [
    "import { Canvas } from '@magam/core';",
    '',
    'export default function UntitledDocument() {',
    '  return <Canvas></Canvas>;',
    '}',
    '',
  ].join('\n');
}

function listWorkspaceRelativeCandidates(
  targetDir: string,
  candidatePath: string | undefined,
  fallbackPath: string,
): string[] {
  const workspaceName = path.basename(path.resolve(targetDir));
  const candidates: string[] = [];
  const seen = new Set<string>();

  const pushCandidate = (value: string | undefined) => {
    if (!value) return;
    const normalized = value
      .replace(/\\/g, '/')
      .replace(/^\.\//, '')
      .replace(/^\/+/, '');
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  if (candidatePath && path.isAbsolute(candidatePath)) {
    const relativePath = path.relative(targetDir, path.normalize(candidatePath));
    if (relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
      pushCandidate(relativePath.split(path.sep).join('/'));
    }
  } else {
    pushCandidate(candidatePath);
    let stripped = (candidatePath || '').replace(/\\/g, '/').replace(/^\.\//, '');
    while (stripped === workspaceName || stripped.startsWith(`${workspaceName}/`)) {
      stripped = stripped === workspaceName ? '' : stripped.slice(workspaceName.length + 1);
      pushCandidate(stripped);
    }
  }

  pushCandidate(fallbackPath);
  return candidates;
}

function normalizeWorkspacePath(targetDir: string, candidatePath: string | undefined, fallbackPath: string): string {
  const candidates = listWorkspaceRelativeCandidates(targetDir, candidatePath, fallbackPath);
  if (candidates.length === 0) {
    return fallbackPath.replace(/\\/g, '/');
  }

  for (const relativePath of candidates) {
    const resolvedCandidate = path.resolve(targetDir, relativePath);
    if (!resolvedCandidate.startsWith(path.resolve(targetDir))) {
      continue;
    }
    return relativePath;
  }

  return fallbackPath.replace(/\\/g, '/');
}

function resolveWorkspaceFilePath(targetDir: string, requestedPath: string): {
  absolutePath: string;
  workspacePath: string;
} {
  const candidates = listWorkspaceRelativeCandidates(targetDir, requestedPath, requestedPath);

  for (const workspacePath of candidates) {
    const absolutePath = path.resolve(targetDir, workspacePath);
    if (fs.existsSync(absolutePath)) {
      return { absolutePath, workspacePath };
    }
  }

  const workspacePath = candidates[0] || requestedPath.replace(/\\/g, '/');
  return {
    absolutePath: path.resolve(targetDir, workspacePath),
    workspacePath,
  };
}

/**
 * File tree node structure for folder tree view
 */
export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

export async function startHttpServer(config: HttpServerConfig): Promise<HttpServerResult> {
  const port = config.port ?? (parseInt(process.env.MAGAM_HTTP_PORT || '') || DEFAULT_PORT);
  const chatHandler = new ChatHandler({ targetDir: config.targetDir });
  const appStateHandle = await createAppStatePgliteDb(config.targetDir, { runMigrations: true });
  const appStateRepository = new AppStatePersistenceRepository(appStateHandle.db);

  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url!, `http://localhost:${port}`);
    const sessionIdMatch = url.pathname.match(/^\/chat\/sessions\/([^/]+)$/);
    const sessionMessagesMatch = url.pathname.match(/^\/chat\/sessions\/([^/]+)\/messages$/);
    const groupIdMatch = url.pathname.match(/^\/chat\/groups\/([^/]+)$/);

    try {
      if (req.method === 'POST' && url.pathname === '/render') {
        await handleRender(req, res, config.targetDir);
      } else if (req.method === 'POST' && url.pathname === '/files') {
        await handleCreateFile(req, res, config.targetDir);
      } else if (req.method === 'GET' && url.pathname === '/files') {
        await handleFiles(req, res, config.targetDir);
      } else if (req.method === 'GET' && url.pathname === '/app-state/workspaces') {
        await handleAppStateWorkspacesList(res, appStateRepository);
      } else if (req.method === 'POST' && url.pathname === '/app-state/workspaces') {
        await handleAppStateWorkspacesUpsert(req, res, appStateRepository);
      } else if (req.method === 'DELETE' && url.pathname === '/app-state/workspaces') {
        await handleAppStateWorkspacesDelete(url, res, appStateRepository);
      } else if (req.method === 'GET' && url.pathname === '/app-state/session') {
        await handleAppStateSessionGet(res, appStateRepository);
      } else if (req.method === 'POST' && url.pathname === '/app-state/session') {
        await handleAppStateSessionSet(req, res, appStateRepository);
      } else if (req.method === 'GET' && url.pathname === '/app-state/recent-documents') {
        await handleAppStateRecentDocumentsList(url, res, appStateRepository);
      } else if (req.method === 'POST' && url.pathname === '/app-state/recent-documents') {
        await handleAppStateRecentDocumentsUpsert(req, res, appStateRepository);
      } else if (req.method === 'DELETE' && url.pathname === '/app-state/recent-documents') {
        await handleAppStateRecentDocumentsDelete(url, res, appStateRepository);
      } else if (req.method === 'GET' && url.pathname === '/app-state/preferences') {
        await handleAppStatePreferencesGet(url, res, appStateRepository);
      } else if (req.method === 'POST' && url.pathname === '/app-state/preferences') {
        await handleAppStatePreferencesSet(req, res, appStateRepository);
      } else if (req.method === 'GET' && url.pathname === '/workspaces') {
        await handleWorkspaceProbe(url, res, config.targetDir);
      } else if (req.method === 'POST' && url.pathname === '/workspaces') {
        await handleWorkspaceMutation(req, res);
      } else if (req.method === 'GET' && url.pathname === '/documents') {
        await handleDocumentsList(url, res);
      } else if (req.method === 'POST' && url.pathname === '/documents') {
        await handleDocumentsCreate(req, res);
      } else if (req.method === 'GET' && url.pathname === '/file-tree') {
        await handleFileTree(url, res, config.targetDir);
      } else if (req.method === 'GET' && url.pathname === '/chat/providers') {
        await handleChatProviders(res, chatHandler);
      } else if (req.method === 'GET' && url.pathname === '/chat/sessions') {
        await handleChatSessionsList(url, res, chatHandler);
      } else if (req.method === 'POST' && url.pathname === '/chat/sessions') {
        await handleChatSessionsCreate(req, res, chatHandler);
      } else if (req.method === 'GET' && sessionIdMatch) {
        await handleChatSessionGet(res, chatHandler, decodeURIComponent(sessionIdMatch[1]));
      } else if (req.method === 'PATCH' && sessionIdMatch) {
        await handleChatSessionPatch(req, res, chatHandler, decodeURIComponent(sessionIdMatch[1]));
      } else if (req.method === 'DELETE' && sessionIdMatch) {
        await handleChatSessionDelete(res, chatHandler, decodeURIComponent(sessionIdMatch[1]));
      } else if (req.method === 'GET' && sessionMessagesMatch) {
        await handleChatSessionMessages(url, res, chatHandler, decodeURIComponent(sessionMessagesMatch[1]));
      } else if (req.method === 'GET' && url.pathname === '/chat/groups') {
        await handleChatGroupsList(res, chatHandler);
      } else if (req.method === 'POST' && url.pathname === '/chat/groups') {
        await handleChatGroupsCreate(req, res, chatHandler);
      } else if (req.method === 'PATCH' && groupIdMatch) {
        await handleChatGroupPatch(req, res, chatHandler, decodeURIComponent(groupIdMatch[1]));
      } else if (req.method === 'DELETE' && groupIdMatch) {
        await handleChatGroupDelete(res, chatHandler, decodeURIComponent(groupIdMatch[1]));
      } else if (req.method === 'POST' && url.pathname === '/chat/send') {
        await handleChatSend(req, res, chatHandler);
      } else if (req.method === 'POST' && url.pathname === '/chat/stop') {
        await handleChatStop(req, res, chatHandler);
      } else if (req.method === 'GET' && url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', targetDir: config.targetDir }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error: any) {
      console.error('Server Error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: error.message || 'Internal Server Error',
        type: 'SERVER_ERROR',
        details: error.stack
      }));
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      console.log(`HTTP render server listening on port ${port}`);
      resolve({
        port,
        close: async () => {
          await new Promise<void>((r) => server.close(() => r()));
          await appStateHandle.close();
        },
      });
    });

    server.on('error', (err) => {
      reject(err);
    });
  });
}

function requireAppStateString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ApiError(400, 'APP_STATE_400_INVALID_FIELD', `${fieldName} is required.`);
  }

  return value.trim();
}

function parseAppStateWorkspaceStatus(value: unknown): AppWorkspaceStatus {
  if (
    value === 'ok'
    || value === 'missing'
    || value === 'not-directory'
    || value === 'unreadable'
  ) {
    return value;
  }

  throw new ApiError(
    400,
    'APP_STATE_400_INVALID_STATUS',
    'status must be one of ok, missing, not-directory, unreadable.',
  );
}

function parseAppStateOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const next = new Date(value);
    if (!Number.isNaN(next.getTime())) {
      return next;
    }
  }

  throw new ApiError(400, 'APP_STATE_400_INVALID_DATE', 'Date fields must be valid date values.');
}

function parseAppStateNullableString(value: unknown, fieldName: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return value.trim() || null;
  }

  throw new ApiError(
    400,
    `APP_STATE_400_INVALID_${fieldName.toUpperCase()}`,
    `${fieldName} must be a string, null, or undefined.`,
  );
}

function parseAppStatePreferenceValue(value: unknown): AppPreferenceValue {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value as string | number | boolean | null;
  }

  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }

  throw new ApiError(
    400,
    'APP_STATE_400_INVALID_VALUE',
    'valueJson must be a JSON-compatible primitive, object, or null.',
  );
}

function writeAppStateError(
  res: http.ServerResponse,
  error: unknown,
  routeLabel: string,
  fallbackMessage: string,
): void {
  writeApiError(res, error, {
    logLabel: `[${routeLabel}] unexpected error:`,
    fallbackCode: 'APP_STATE_500_REQUEST_FAILED',
    fallbackMessage,
  });
}

async function handleAppStateWorkspacesList(
  res: http.ServerResponse,
  repository: AppStatePersistenceRepository,
) {
  try {
    writeJson(res, 200, await repository.listWorkspaces());
  } catch (error) {
    writeAppStateError(res, error, 'app-state/workspaces', 'Failed to handle app-state workspaces request');
  }
}

async function handleAppStateWorkspacesUpsert(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  repository: AppStatePersistenceRepository,
) {
  try {
    const body = await parseJsonObjectBody(req, {
      invalidJsonCode: 'APP_STATE_400_INVALID_JSON',
      invalidJsonMessage: 'Request body must be a JSON object.',
    });

    const workspace = await repository.upsertWorkspace({
      id: requireAppStateString(body.id, 'id'),
      rootPath: requireAppStateString(body.rootPath, 'rootPath'),
      displayName: requireAppStateString(body.displayName, 'displayName'),
      status: parseAppStateWorkspaceStatus(body.status),
      isPinned: typeof body.isPinned === 'boolean' ? body.isPinned : undefined,
      lastOpenedAt: parseAppStateOptionalDate(body.lastOpenedAt),
      lastSeenAt: parseAppStateOptionalDate(body.lastSeenAt),
    });

    writeJson(res, 200, workspace);
  } catch (error) {
    writeAppStateError(res, error, 'app-state/workspaces', 'Failed to handle app-state workspaces request');
  }
}

async function handleAppStateWorkspacesDelete(
  url: URL,
  res: http.ServerResponse,
  repository: AppStatePersistenceRepository,
) {
  try {
    const workspaceId = requireAppStateString(url.searchParams.get('workspaceId'), 'workspaceId');
    await repository.removeWorkspace(workspaceId);
    writeJson(res, 200, { deleted: true });
  } catch (error) {
    writeAppStateError(res, error, 'app-state/workspaces', 'Failed to handle app-state workspaces request');
  }
}

async function handleAppStateSessionGet(
  res: http.ServerResponse,
  repository: AppStatePersistenceRepository,
) {
  try {
    writeJson(res, 200, await repository.getWorkspaceSession());
  } catch (error) {
    writeAppStateError(res, error, 'app-state/session', 'Failed to handle app-state session request');
  }
}

async function handleAppStateSessionSet(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  repository: AppStatePersistenceRepository,
) {
  try {
    const body = await parseJsonObjectBody(req, {
      invalidJsonCode: 'APP_STATE_400_INVALID_JSON',
      invalidJsonMessage: 'Request body must be a JSON object.',
    });

    const session = await repository.setWorkspaceSession({
      activeWorkspaceId: parseAppStateNullableString(
        'activeWorkspaceId' in body ? body.activeWorkspaceId : body.workspaceId,
        'activeWorkspaceId',
      ),
    });

    writeJson(res, 200, session);
  } catch (error) {
    writeAppStateError(res, error, 'app-state/session', 'Failed to handle app-state session request');
  }
}

async function handleAppStateRecentDocumentsList(
  url: URL,
  res: http.ServerResponse,
  repository: AppStatePersistenceRepository,
) {
  try {
    const workspaceId = requireAppStateString(url.searchParams.get('workspaceId'), 'workspaceId');
    writeJson(res, 200, await repository.listRecentDocuments(workspaceId));
  } catch (error) {
    writeAppStateError(
      res,
      error,
      'app-state/recent-documents',
      'Failed to handle app-state recent-documents request',
    );
  }
}

async function handleAppStateRecentDocumentsUpsert(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  repository: AppStatePersistenceRepository,
) {
  try {
    const body = await parseJsonObjectBody(req, {
      invalidJsonCode: 'APP_STATE_400_INVALID_JSON',
      invalidJsonMessage: 'Request body must be a JSON object.',
    });

    const recentDocument = await repository.upsertRecentDocument({
      workspaceId: requireAppStateString(body.workspaceId, 'workspaceId'),
      documentPath: requireAppStateString(body.documentPath, 'documentPath'),
      lastOpenedAt: parseAppStateOptionalDate(body.lastOpenedAt),
    });

    writeJson(res, 200, recentDocument);
  } catch (error) {
    writeAppStateError(
      res,
      error,
      'app-state/recent-documents',
      'Failed to handle app-state recent-documents request',
    );
  }
}

async function handleAppStateRecentDocumentsDelete(
  url: URL,
  res: http.ServerResponse,
  repository: AppStatePersistenceRepository,
) {
  try {
    const workspaceId = requireAppStateString(url.searchParams.get('workspaceId'), 'workspaceId');
    await repository.clearRecentDocuments(workspaceId);
    writeJson(res, 200, { deleted: true });
  } catch (error) {
    writeAppStateError(
      res,
      error,
      'app-state/recent-documents',
      'Failed to handle app-state recent-documents request',
    );
  }
}

async function handleAppStatePreferencesGet(
  url: URL,
  res: http.ServerResponse,
  repository: AppStatePersistenceRepository,
) {
  try {
    const key = requireAppStateString(url.searchParams.get('key'), 'key');
    writeJson(res, 200, await repository.getPreference(key));
  } catch (error) {
    writeAppStateError(res, error, 'app-state/preferences', 'Failed to handle app-state preferences request');
  }
}

async function handleAppStatePreferencesSet(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  repository: AppStatePersistenceRepository,
) {
  try {
    const body = await parseJsonObjectBody(req, {
      invalidJsonCode: 'APP_STATE_400_INVALID_JSON',
      invalidJsonMessage: 'Request body must be a JSON object.',
    });

    const preference = await repository.setPreference({
      key: requireAppStateString(body.key, 'key'),
      valueJson: parseAppStatePreferenceValue(body.valueJson),
    });

    writeJson(res, 200, preference);
  } catch (error) {
    writeAppStateError(res, error, 'app-state/preferences', 'Failed to handle app-state preferences request');
  }
}

async function handleRender(req: http.IncomingMessage, res: http.ServerResponse, targetDir: string) {
  const body = await parseBody(req);
  const requestedFilePath = typeof body?.filePath === 'string' ? body.filePath.trim() : '';
  if (!requestedFilePath) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing filePath in body', type: 'VALIDATION_ERROR' }));
    return;
  }

  const rawRootPath = typeof body?.rootPath === 'string'
    ? body.rootPath.trim()
    : typeof body?.root === 'string'
      ? body.root.trim()
      : '';
  if (rawRootPath && !path.isAbsolute(rawRootPath)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'rootPath must be an absolute path', type: 'VALIDATION_ERROR' }));
    return;
  }

  const requestTargetDir = rawRootPath ? path.resolve(rawRootPath) : targetDir;
  const resolvedRequest = resolveWorkspaceFilePath(requestTargetDir, requestedFilePath);
  const absolutePath = resolvedRequest.absolutePath;
  if (!fs.existsSync(absolutePath)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `File not found: ${resolvedRequest.workspacePath}`, type: 'FILE_NOT_FOUND' }));
    return;
  }

  try {
    const pipelineResult = await runRenderPipeline({
      absolutePath,
      requestedFilePath: resolvedRequest.workspacePath,
      targetDir: requestTargetDir,
      requestStart: performance.now(),
    });

    logRenderPipeline(
      resolvedRequest.workspacePath,
      pipelineResult.cacheState,
      pipelineResult.timing,
      pipelineResult.sourceVersion,
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      graph: pipelineResult.graph,
      sourceVersion: pipelineResult.sourceVersion,
      sourceVersions: pipelineResult.sourceVersions,
      ...(typeof body?.documentId === 'string' && body.documentId.trim().length > 0
        ? { documentId: body.documentId.trim() }
        : {}),
    }));
  } catch (error: any) {
    console.error('Render Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: error.message,
      type: error.type || 'RENDER_ERROR',
      details: error.details || error.stack
    }));
  }
}

async function handleCreateFile(req: http.IncomingMessage, res: http.ServerResponse, targetDir: string) {
  const body = await parseBody(req);
  const requestedFilePath = typeof body?.filePath === 'string' ? body.filePath : '';

  if (!requestedFilePath) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing filePath in body', type: 'VALIDATION_ERROR' }));
    return;
  }

  const workspacePath = normalizeWorkspacePath(targetDir, requestedFilePath, requestedFilePath);
  if (!workspacePath.endsWith('.tsx')) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'filePath must point to a .tsx document', type: 'VALIDATION_ERROR' }));
    return;
  }

  const absolutePath = path.resolve(targetDir, workspacePath);
  if (fs.existsSync(absolutePath)) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `File already exists: ${workspacePath}`, type: 'FILE_EXISTS' }));
    return;
  }

  const content = createEmptyCanvasDocumentSource();
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, 'utf-8');

  res.writeHead(201, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    filePath: workspacePath,
    sourceVersion: hashSourceContent(content),
  }));
}

async function runRenderPipeline(input: {
  absolutePath: string;
  requestedFilePath: string;
  targetDir: string;
  requestStart: number;
}): Promise<RenderPipelineResult> {
  const transpileStart = performance.now();
  const transpiled = await transpileWithMetadata(input.absolutePath);
  const transpileMs = performance.now() - transpileStart;

  const hashStart = performance.now();
  const sourceVersions = Object.fromEntries(
    transpiled.inputs
      .map((filePath) => {
        const normalizedPath = normalizeWorkspacePath(
          input.targetDir,
          filePath,
          input.requestedFilePath,
        );
        const content = fs.readFileSync(filePath, 'utf-8');
        return [normalizedPath, hashSourceContent(content)];
      })
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  const hashMs = performance.now() - hashStart;
  const requestedWorkspacePath = normalizeWorkspacePath(
    input.targetDir,
    input.absolutePath,
    input.requestedFilePath,
  );
  const sourceVersion = sourceVersions[requestedWorkspacePath];

  if (!sourceVersion) {
    throw new Error(`Missing source version for ${requestedWorkspacePath}`);
  }

  const graphVersion = hashSourceContent(
    Object.entries(sourceVersions)
      .map(([filePath, version]) => `${filePath}:${version}`)
      .join('\n'),
  );
  const cacheKey = createRenderCacheKey(input.absolutePath, graphVersion);
  const cached = getRenderCacheEntry(cacheKey);

  if (cached) {
    return {
      ...cached,
      cacheState: 'hit',
      timing: {
        ...cached.timing,
        hashMs,
        transpileMs,
        totalMs: performance.now() - input.requestStart,
      },
    };
  }

  const inFlight = renderInFlight.get(cacheKey);
  if (inFlight) {
    const deduped = await inFlight;
    return {
      ...deduped,
      cacheState: 'dedupe-hit',
      timing: {
        ...deduped.timing,
        hashMs,
        transpileMs,
        totalMs: performance.now() - input.requestStart,
      },
    };
  }

  const executeStart = performance.now();
  const renderPromise = (async (): Promise<RenderPipelineResult> => {
    const result = await execute(transpiled.code);
    const executeMs = performance.now() - executeStart;

    if (!result.isOk()) {
      console.error('[HttpServer] Execution failed:', result.error);
      const error = new Error(result.error.message);
      (error as Error & { type?: string; details?: unknown }).type = result.error.type || 'EXECUTION_ERROR';
      (error as Error & { details?: unknown }).details = result.error.originalError;
      throw error;
    }

    const graph = result.value as RenderLikeNode;
    for (const child of graph.children ?? []) {
      injectSourceMeta(child, {
        targetDir: input.targetDir,
        fallbackFilePath: input.requestedFilePath,
      });
    }

    return {
      graph,
      sourceVersion,
      sourceVersions,
      timing: {
        hashMs,
        transpileMs,
        executeMs,
        totalMs: performance.now() - input.requestStart,
      },
      cacheState: 'miss',
    };
  })();

  renderInFlight.set(cacheKey, renderPromise);

  try {
    return setRenderCacheEntry(cacheKey, await renderPromise);
  } finally {
    renderInFlight.delete(cacheKey);
  }
}

type RenderLikeNode = {
  type: string;
  props?: Record<string, any>;
  children?: RenderLikeNode[];
};

function deriveLocalSourceId(
  renderedId: string | undefined,
  magamScope: string | undefined,
): string {
  if (!renderedId) {
    return '';
  }

  if (!magamScope) {
    return renderedId;
  }

  const prefix = `${magamScope}.`;
  return renderedId.startsWith(prefix) ? renderedId.slice(prefix.length) : renderedId;
}

function injectSourceMeta(
  node: RenderLikeNode,
  input: {
    targetDir: string;
    fallbackFilePath: string;
  },
  mindmapScopeId?: string,
): void {
  if (!node || !node.props) return;

  const isMindmap = node.type === 'graph-mindmap';
  const nextScopeId = isMindmap ? (node.props.id as string | undefined) : mindmapScopeId;
  const jsxSource = node.props.__source as { fileName?: string; lineNumber?: number; columnNumber?: number } | undefined;
  const sourceFilePath = normalizeWorkspacePath(
    input.targetDir,
    jsxSource?.fileName,
    input.fallbackFilePath,
  );
  const magamScope = typeof node.props.__magamScope === 'string'
    ? node.props.__magamScope as string
    : undefined;

  const isRenderableNode =
    node.type === 'graph-node' ||
    node.type === 'graph-sticky' ||
    node.type === 'graph-shape' ||
    node.type === 'graph-text' ||
    node.type === 'graph-image' ||
    node.type === 'graph-sequence' ||
    node.type === 'graph-washi-tape';

  if (isRenderableNode) {
    const renderedId = node.props.id as string | undefined;
    const sourceId = deriveLocalSourceId(renderedId, magamScope);
    const existingSourceMeta = (
      node.props.sourceMeta && typeof node.props.sourceMeta === 'object'
        ? node.props.sourceMeta as Record<string, unknown>
        : {}
    );
    node.props.sourceMeta = {
      ...existingSourceMeta,
      sourceId,
      filePath: sourceFilePath,
      kind: nextScopeId ? 'mindmap' : 'canvas',
      ...(nextScopeId ? { scopeId: nextScopeId } : {}),
      ...(renderedId ? { renderedId } : {}),
      ...(magamScope ? { frameScope: magamScope, framePath: magamScope.split('.') } : {}),
    };
  }

  delete node.props.__source;
  delete node.props.__magamScope;

  for (const child of node.children ?? []) {
    injectSourceMeta(child, input, nextScopeId);
  }
}

async function handleFiles(req: http.IncomingMessage, res: http.ServerResponse, targetDir: string) {
  try {
    const files = await glob('**/*.tsx', { cwd: targetDir });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ files }));
  } catch (error: any) {
    console.error('Files Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: error.message,
      type: 'FILES_ERROR'
    }));
  }
}


interface FileEntry {
  path: string;
  type: 'file' | 'directory';
}

/**
 * Build a tree structure from a flat list of file entries
 */
function buildFileTree(entries: FileEntry[], rootName: string = 'root'): FileTreeNode {
  const root: FileTreeNode = {
    name: rootName,
    path: '',
    type: 'directory',
    children: []
  };

  for (const entry of entries) {
    const parts = entry.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      // Find existing child or create new one
      let child = current.children?.find(c => c.name === part);

      if (!child) {
        const type = isLast ? entry.type : 'directory';
        child = {
          name: part,
          path: currentPath,
          type: type,
          children: type === 'directory' ? [] : undefined
        };
        current.children?.push(child);
      }

      if (child.type === 'directory') {
        current = child;
      }
    }
  }

  // Sort children: directories first, then files, both alphabetically
  const sortChildren = (node: FileTreeNode) => {
    if (node.children) {
      node.children.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortChildren);
    }
  };
  sortChildren(root);

  return root;
}

async function handleFileTree(url: URL, res: http.ServerResponse, targetDir: string) {
  try {
    const rawRootPath = url.searchParams.get('rootPath') || url.searchParams.get('root');
    if (rawRootPath && !path.isAbsolute(rawRootPath)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'rootPath must be an absolute path', type: 'VALIDATION_ERROR' }));
      return;
    }

    const requestTargetDir = rawRootPath ? path.resolve(rawRootPath) : targetDir;
    const rawPaths = await glob(['**/*.tsx', '**/'], {
      cwd: requestTargetDir,
      onlyFiles: false,
      markDirectories: true,
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**']
    });

    const entries: FileEntry[] = rawPaths.map((p: string) => {
      const isDirectory = p.endsWith('/');
      return {
        path: isDirectory ? p.slice(0, -1) : p,
        type: isDirectory ? 'directory' : 'file'
      };
    });

    const tree = buildFileTree(entries, path.basename(requestTargetDir));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tree }));
  } catch (error: any) {
    console.error('FileTree Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: error.message,
      type: 'FILE_TREE_ERROR'
    }));
  }
}

function writeJson(res: http.ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function toWorkspaceResponsePayload(workspace: Awaited<ReturnType<typeof probeWorkspace>>, code: string) {
  return {
    code,
    rootPath: workspace.rootPath,
    root: workspace.rootPath,
    workspaceName: workspace.workspaceName,
    name: workspace.workspaceName,
    health: {
      state: workspace.health.status,
      message: workspace.health.message,
      documentCount: workspace.documentCount,
    },
    documentCount: workspace.documentCount,
    documents: workspace.documents,
    lastModifiedAt: workspace.lastModifiedAt,
  };
}

function toDocumentsResponsePayload(workspace: Awaited<ReturnType<typeof requireWorkspaceRoot>>, code: string) {
  return {
    code,
    rootPath: workspace.rootPath,
    root: workspace.rootPath,
    workspaceName: workspace.workspaceName,
    documentCount: workspace.documentCount,
    documents: workspace.documents,
    lastModifiedAt: workspace.lastModifiedAt,
  };
}

function toCanonicalDocumentSummary(document: CanonicalDocumentShellRecord) {
  return {
    documentId: document.documentId,
    workspaceId: document.workspaceId,
    filePath: document.filePath ?? `documents/${document.documentId}.graph.tsx`,
    modifiedAt: document.updatedAt?.getTime() ?? document.createdAt?.getTime() ?? null,
    latestRevision: document.latestRevision,
  };
}

function toCanonicalDocumentSourceVersion(document: CanonicalDocumentShellRecord): string {
  return createDocumentSourceVersion(JSON.stringify({
    documentId: document.documentId,
    workspaceId: document.workspaceId,
    latestRevision: document.latestRevision,
  }));
}

function writeApiError(
  res: http.ServerResponse,
  error: unknown,
  input: {
    logLabel: string;
    fallbackCode: string;
    fallbackMessage: string;
  },
): void {
  if (error instanceof ApiError) {
    writeJson(res, error.status, {
      error: error.message,
      code: error.code,
      details: error.details,
    });
    return;
  }

  if (isCanonicalCliError(error)) {
    const status = error.code === 'INVALID_ARGUMENT'
      ? 400
      : error.code === 'DOCUMENT_NOT_FOUND' || error.code === 'WORKSPACE_NOT_FOUND'
        ? 404
        : 422;
    writeJson(res, status, {
      error: error.message,
      code: error.code,
      details: error.details,
    });
    return;
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(input.logLabel, message);
  writeJson(res, 500, {
    error: `${input.fallbackMessage}: ${message}`,
    code: input.fallbackCode,
  });
}

function pickRootPath(searchParams: URLSearchParams, fallbackRootPath?: string | null): string | null {
  return searchParams.get('rootPath') || searchParams.get('root') || fallbackRootPath || null;
}

function resolveDocumentRootPath(rawRootPath: unknown): string {
  if (typeof rawRootPath !== 'string') {
    throw new ApiError(400, 'DOC_400_INVALID_ROOT_PATH', 'rootPath is required');
  }

  const trimmed = rawRootPath.trim();
  if (!trimmed || !path.isAbsolute(trimmed)) {
    throw new ApiError(400, 'DOC_400_INVALID_ROOT_PATH', 'rootPath must be an absolute path');
  }

  return trimmed;
}

async function parseJsonObjectBody(
  req: http.IncomingMessage,
  input: {
    invalidJsonCode: string;
    invalidJsonMessage: string;
  },
): Promise<Record<string, unknown>> {
  const rawBody = await new Promise<string>((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });

  if (!rawBody.trim()) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new ApiError(400, input.invalidJsonCode, `${input.invalidJsonMessage}: ${message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ApiError(400, input.invalidJsonCode, input.invalidJsonMessage);
  }

  return parsed as Record<string, unknown>;
}

async function handleWorkspaceProbe(
  url: URL,
  res: http.ServerResponse,
  targetDir: string,
) {
  try {
    const rootPath = pickRootPath(url.searchParams, targetDir);
    if (!rootPath) {
      throw new ApiError(400, 'WS_400_INVALID_ROOT_PATH', 'rootPath is required');
    }

    const workspace = await probeWorkspace(rootPath);
    writeJson(
      res,
      200,
      toWorkspaceResponsePayload(
        workspace,
        workspace.health.status === 'ok' ? 'WS_200_HEALTHY' : 'WS_200_PROBED',
      ),
    );
  } catch (error) {
    writeApiError(res, error, {
      logLabel: '[workspaces] unexpected error:',
      fallbackCode: 'WS_500_REQUEST_FAILED',
      fallbackMessage: 'Failed to handle workspace request',
    });
  }
}

async function handleWorkspaceMutation(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    const body = await parseJsonObjectBody(req, {
      invalidJsonCode: 'WS_400_INVALID_JSON',
      invalidJsonMessage: 'Request body must be a JSON object',
    });
    const rawRootPath = body.rootPath;
    if (typeof rawRootPath !== 'string') {
      throw new ApiError(400, 'WS_400_INVALID_ROOT_PATH', 'rootPath is required');
    }

    const rawAction = body.action;
    if (rawAction !== 'open' && rawAction !== 'reveal' && rawAction !== 'ensure') {
      throw new ApiError(400, 'WS_400_INVALID_ACTION', 'action must be "ensure", "open", or "reveal"');
    }

    if (rawAction === 'ensure') {
      const ensured = await ensureWorkspaceRoot(rawRootPath);
      writeJson(res, 200, toWorkspaceResponsePayload(ensured, 'WS_200_READY'));
      return;
    }

    const workspace = await requireWorkspaceRoot(rawRootPath);
    const rawTargetPath = typeof body.filePath === 'string'
      ? body.filePath
      : typeof body.targetPath === 'string'
        ? body.targetPath
        : null;
    const result = await openWorkspaceInFileBrowser({
      platform: process.platform,
      rootPath: workspace.rootPath,
      targetPath: rawTargetPath,
      action: rawAction,
    });
    const { rootPath: _resultRootPath, ...resultPayload } = result;

    writeJson(res, 200, {
      code: rawAction === 'reveal' ? 'WS_200_REVEALED' : 'WS_200_OPENED',
      rootPath: workspace.rootPath,
      root: workspace.rootPath,
      workspaceName: workspace.workspaceName,
      name: workspace.workspaceName,
      ...resultPayload,
    });
  } catch (error) {
    writeApiError(res, error, {
      logLabel: '[workspaces] unexpected error:',
      fallbackCode: 'WS_500_REQUEST_FAILED',
      fallbackMessage: 'Failed to handle workspace request',
    });
  }
}

async function handleDocumentsList(url: URL, res: http.ServerResponse) {
  try {
    const rootPath = resolveDocumentRootPath(pickRootPath(url.searchParams));

    const workspace = await requireWorkspaceRoot(rootPath);
    const documents = await listCanonicalDocuments({
      targetDir: workspace.rootPath,
    });
    writeJson(res, 200, {
      ...toDocumentsResponsePayload(workspace, 'DOC_200_LISTED'),
      documentCount: documents.length,
      documents: documents.map(toCanonicalDocumentSummary),
      lastModifiedAt: documents.reduce<number | null>((latest, document) => {
        const timestamp = document.updatedAt?.getTime() ?? document.createdAt?.getTime() ?? null;
        if (timestamp === null) {
          return latest;
        }
        return latest === null ? timestamp : Math.max(latest, timestamp);
      }, null),
    });
  } catch (error) {
    writeApiError(res, error, {
      logLabel: '[documents] unexpected error:',
      fallbackCode: 'DOC_500_REQUEST_FAILED',
      fallbackMessage: 'Failed to handle documents request',
    });
  }
}

async function handleDocumentsCreate(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    const body = await parseJsonObjectBody(req, {
      invalidJsonCode: 'DOC_400_INVALID_JSON',
      invalidJsonMessage: 'Request body must be a JSON object',
    });
    const rawRootPath = 'rootPath' in body ? body['rootPath'] : body['root'];
    const rootPath = resolveDocumentRootPath(rawRootPath);

    const workspace = await requireWorkspaceRoot(rootPath);
    const rawFilePath = typeof body.filePath === 'string'
      ? body.filePath
      : typeof body.path === 'string'
        ? body.path
        : null;
    let created: CanonicalDocumentShellRecord;
    try {
      created = await createCanonicalDocument({
        targetDir: workspace.rootPath,
        filePath: rawFilePath,
        actor: {
          kind: 'system',
          id: 'desktop.http',
        },
      });
    } catch (error) {
      if (isCanonicalCliError(error) && error.code === 'INVALID_ARGUMENT') {
        throw new ApiError(400, 'DOC_400_INVALID_PATH', error.message, error.details);
      }
      throw error;
    }

    writeJson(res, 201, {
      code: 'DOC_201_CREATED',
      rootPath: workspace.rootPath,
      root: workspace.rootPath,
      workspaceName: workspace.workspaceName,
      created: true,
      ...toCanonicalDocumentSummary(created),
      sourceVersion: toCanonicalDocumentSourceVersion(created),
    });
  } catch (error) {
    writeApiError(res, error, {
      logLabel: '[documents] unexpected error:',
      fallbackCode: 'DOC_500_REQUEST_FAILED',
      fallbackMessage: 'Failed to handle documents request',
    });
  }
}

async function handleChatProviders(res: http.ServerResponse, chatHandler: ChatHandler) {
  const providers = await chatHandler.getProviders();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ providers }));
}

async function handleChatSessionsList(url: URL, res: http.ServerResponse, chatHandler: ChatHandler) {
  const limit = Number(url.searchParams.get('limit') || '50');
  const sessions = await chatHandler.listSessions({
    groupId: url.searchParams.get('groupId') || undefined,
    providerId: normalizeProviderId(url.searchParams.get('providerId')),
    q: url.searchParams.get('q') || undefined,
    limit: Number.isFinite(limit) ? limit : 50,
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ sessions }));
}

async function handleChatSessionsCreate(req: http.IncomingMessage, res: http.ServerResponse, chatHandler: ChatHandler) {
  const body = await parseBody(req);
  const providerId = normalizeProviderId(body.providerId);
  if (!providerId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'providerId is required', type: 'VALIDATION_ERROR' }));
    return;
  }

  const session = await chatHandler.createSession({
    title: typeof body.title === 'string' ? body.title : undefined,
    providerId,
    groupId: body.groupId ?? null,
  });

  res.writeHead(201, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ session }));
}

async function handleChatSessionGet(res: http.ServerResponse, chatHandler: ChatHandler, sessionId: string) {
  const session = await chatHandler.getSession(sessionId);
  if (!session) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Session not found', type: 'NOT_FOUND' }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ session }));
}

async function handleChatSessionPatch(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  chatHandler: ChatHandler,
  sessionId: string,
) {
  const body = await parseBody(req);
  const before = await chatHandler.getSession(sessionId);
  if (!before) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Session not found', type: 'NOT_FOUND' }));
    return;
  }

  const nextProviderId = normalizeProviderId(body.providerId);

  const session = await chatHandler.updateSession(sessionId, {
    title: typeof body.title === 'string' ? body.title : undefined,
    providerId: nextProviderId,
    groupId: 'groupId' in body ? body.groupId : undefined,
  });

  if (nextProviderId && nextProviderId !== before.providerId) {
    await chatHandler.appendSystemMessage(
      sessionId,
      `Provider switched from ${before.providerId} to ${nextProviderId}`,
      { type: 'provider_switched', from: before.providerId, to: nextProviderId },
    );
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ session }));
}

async function handleChatSessionDelete(res: http.ServerResponse, chatHandler: ChatHandler, sessionId: string) {
  const deleted = await chatHandler.deleteSession(sessionId);
  if (!deleted) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Session not found', type: 'NOT_FOUND' }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ deleted: true }));
}

async function handleChatSessionMessages(url: URL, res: http.ServerResponse, chatHandler: ChatHandler, sessionId: string) {
  const limit = Number(url.searchParams.get('limit') || '50');
  const result = await chatHandler.listMessages(
    sessionId,
    url.searchParams.get('cursor') || undefined,
    Number.isFinite(limit) ? limit : 50,
  );

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result));
}

async function handleChatGroupsList(res: http.ServerResponse, chatHandler: ChatHandler) {
  const groups = await chatHandler.listGroups();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ groups }));
}

async function handleChatGroupsCreate(req: http.IncomingMessage, res: http.ServerResponse, chatHandler: ChatHandler) {
  const body = await parseBody(req);
  if (!body?.name || typeof body.name !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'name is required', type: 'VALIDATION_ERROR' }));
    return;
  }

  const group = await chatHandler.createGroup({
    name: body.name,
    color: typeof body.color === 'string' ? body.color : undefined,
    sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
  });

  res.writeHead(201, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ group }));
}

async function handleChatGroupPatch(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  chatHandler: ChatHandler,
  groupId: string,
) {
  const body = await parseBody(req);
  const group = await chatHandler.updateGroup(groupId, {
    name: typeof body.name === 'string' ? body.name : undefined,
    color: body.color === null || typeof body.color === 'string' ? body.color : undefined,
    sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
  });

  if (!group) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Group not found', type: 'NOT_FOUND' }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ group }));
}

async function handleChatGroupDelete(res: http.ServerResponse, chatHandler: ChatHandler, groupId: string) {
  const deleted = await chatHandler.deleteGroup(groupId);
  if (!deleted) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Group not found', type: 'NOT_FOUND' }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ deleted: true, fallbackGroupId: null }));
}


function normalizePermissionMode(raw: unknown): ChatPermissionMode {
  return raw === 'interactive' ? 'interactive' : 'auto';
}

function normalizeProviderId(raw: unknown): ProviderId | undefined {
  if (raw === 'claude' || raw === 'gemini' || raw === 'codex') return raw;
  return undefined;
}

function normalizeModel(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const model = raw.trim();
  if (!model || model.length > MAX_MODEL_LENGTH) return undefined;
  if (!MODEL_PATTERN.test(model)) return undefined;
  return model;
}

function normalizeReasoningEffort(raw: unknown): 'low' | 'medium' | 'high' | undefined {
  if (typeof raw !== 'string') return undefined;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
    return normalized;
  }
  return undefined;
}

const MAX_FILE_MENTIONS = 10;
const MAX_NODE_MENTIONS = 20;
const MAX_PATH_LENGTH = 512;
const MAX_NODE_FIELD_LENGTH = 2000;
const MAX_MODEL_LENGTH = 120;
const MODEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/;

function normalizeFileMentions(raw: unknown): SendChatRequest['fileMentions'] {
  if (!Array.isArray(raw)) return undefined;

  const mentions: NonNullable<SendChatRequest['fileMentions']> = [];
  for (const entry of raw.slice(0, MAX_FILE_MENTIONS)) {
    const mentionPath =
      typeof entry === 'string' ? entry.trim() : typeof entry?.path === 'string' ? entry.path.trim() : '';

    if (!mentionPath || mentionPath.length > MAX_PATH_LENGTH) {
      continue;
    }

    mentions.push({ path: mentionPath });
  }

  return mentions.length > 0 ? mentions : undefined;
}

function normalizeNodeMentions(raw: unknown): SendChatRequest['nodeMentions'] {
  if (!Array.isArray(raw)) return undefined;

  const mentions: NonNullable<SendChatRequest['nodeMentions']> = [];

  for (const entry of raw.slice(0, MAX_NODE_MENTIONS)) {
    if (!entry || typeof entry !== 'object') continue;

    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    if (!id || id.length > MAX_NODE_FIELD_LENGTH) continue;

    const sanitize = (value: unknown): string | undefined => {
      if (typeof value !== 'string') return undefined;
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      return trimmed.slice(0, MAX_NODE_FIELD_LENGTH);
    };

    const mention = {
      id,
      type: sanitize(entry.type),
      title: sanitize(entry.title),
      summary: sanitize(entry.summary),
    };

    if (!mention.summary) continue;
    mentions.push(mention);
  }

  return mentions.length > 0 ? mentions : undefined;
}

async function handleChatSend(req: http.IncomingMessage, res: http.ServerResponse, chatHandler: ChatHandler) {
  const body = (await parseBody(req)) as Partial<SendChatRequest> & { workingDirectory?: string };

  if (body.workingDirectory) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'workingDirectory must not be provided by client',
      type: 'VALIDATION_ERROR',
    }));
    return;
  }

  const providerId = normalizeProviderId(body.providerId);
  if (!body.message || !providerId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing message/providerId in body', type: 'VALIDATION_ERROR' }));
    return;
  }

  const normalizedEffort =
    normalizeReasoningEffort(body.reasoningEffort) ??
    normalizeReasoningEffort(body.effort) ??
    normalizeReasoningEffort(body.reasoning);

  const request: SendChatRequest = {
    message: body.message,
    providerId,
    sessionId: body.sessionId,
    currentFile: body.currentFile,
    permissionMode: normalizePermissionMode(body.permissionMode),
    model: normalizeModel(body.model),
    ...(normalizedEffort ? { reasoningEffort: normalizedEffort } : {}),
    fileMentions: normalizeFileMentions(body.fileMentions),
    nodeMentions: normalizeNodeMentions(body.nodeMentions),
  };

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  try {
    for await (const chunk of chatHandler.send(request)) {
      res.write(`event: ${chunk.type === 'done' ? 'done' : chunk.type === 'error' ? 'error' : 'chunk'}\n`);
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
  } catch (error: any) {
    const chunk = {
      type: 'error',
      content: error?.message || 'Chat stream failed',
      metadata: { stage: 'server-stream' },
    };
    res.write('event: error\n');
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  } finally {
    res.end();
  }
}

async function handleChatStop(req: http.IncomingMessage, res: http.ServerResponse, chatHandler: ChatHandler) {
  const body = (await parseBody(req)) as Partial<StopChatRequest>;
  if (!body.sessionId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing sessionId in body', type: 'VALIDATION_ERROR' }));
    return;
  }

  const stopped = chatHandler.stop(body.sessionId);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(stopped));
}

function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}
