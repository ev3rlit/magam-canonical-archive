import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import glob from 'fast-glob';
import {
  createCanonicalCanvas,
  listCanonicalCanvases,
  type CanonicalCanvasShellRecord,
} from '../../../shared/src/lib/canonical-canvas-shell';
import { isCanonicalCliError } from '../../../shared/src/lib/canonical-cli';
import { renderCanonicalCanvas } from '../../../shared/src/lib/canonical-query';
import {
  ApiError,
  createCompatibilityCanvasSource,
  createCanvasSourceVersion,
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
  AppPreferenceValue,
  AppWorkspaceStatus,
} from '../../../shared/src/lib/app-state-persistence';
import { CLI_MESSAGES } from '../messages';

const DEFAULT_PORT = 3002;

export interface HttpServerConfig {
  targetDir: string;
  port?: number;
}

export interface HttpServerResult {
  port: number;
  close: () => Promise<void>;
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
      } else if (req.method === 'GET' && url.pathname === '/app-state/recent-canvases') {
        await handleAppStateRecentCanvasesList(url, res, appStateRepository);
      } else if (req.method === 'POST' && url.pathname === '/app-state/recent-canvases') {
        await handleAppStateRecentCanvasesUpsert(req, res, appStateRepository);
      } else if (req.method === 'DELETE' && url.pathname === '/app-state/recent-canvases') {
        await handleAppStateRecentCanvasesDelete(url, res, appStateRepository);
      } else if (req.method === 'GET' && url.pathname === '/app-state/preferences') {
        await handleAppStatePreferencesGet(url, res, appStateRepository);
      } else if (req.method === 'POST' && url.pathname === '/app-state/preferences') {
        await handleAppStatePreferencesSet(req, res, appStateRepository);
      } else if (req.method === 'GET' && url.pathname === '/workspaces') {
        await handleWorkspaceProbe(url, res, config.targetDir);
      } else if (req.method === 'POST' && url.pathname === '/workspaces') {
        await handleWorkspaceMutation(req, res);
      } else if (req.method === 'GET' && url.pathname === '/canvases') {
        await handleCanvasesList(url, res);
      } else if (req.method === 'POST' && url.pathname === '/canvases') {
        await handleCanvasesCreate(req, res);
      } else if (req.method === 'GET' && url.pathname === '/file-tree') {
        await handleFileTree(url, res, config.targetDir);
      } else if (req.method === 'GET' && url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', targetDir: config.targetDir }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: CLI_MESSAGES.httpServer.notFound }));
      }
    } catch (error: any) {
      console.error(CLI_MESSAGES.httpServer.serverError, error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: error.message || CLI_MESSAGES.httpServer.internalServerError,
        type: 'SERVER_ERROR',
        details: error.stack
      }));
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      console.log(CLI_MESSAGES.httpServer.listening(port));
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
    throw new ApiError(400, 'APP_STATE_400_INVALID_FIELD', CLI_MESSAGES.httpServer.fieldRequired(fieldName));
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
    CLI_MESSAGES.httpServer.statusMustBeOneOf,
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

  throw new ApiError(400, 'APP_STATE_400_INVALID_DATE', CLI_MESSAGES.httpServer.dateFieldsMustBeValid);
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
    CLI_MESSAGES.httpServer.nullableStringField(fieldName),
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
    CLI_MESSAGES.httpServer.requestJsonCompatibleValue,
  );
}

function writeAppStateError(
  res: http.ServerResponse,
  error: unknown,
  routeLabel: string,
  fallbackMessage: string,
): void {
  writeApiError(res, error, {
    logLabel: CLI_MESSAGES.httpServer.appStateUnexpectedErrorLog(routeLabel),
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
    writeAppStateError(res, error, 'app-state/workspaces', CLI_MESSAGES.httpServer.appStateWorkspacesRequestFailed);
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
      invalidJsonMessage: CLI_MESSAGES.httpServer.requestBodyMustBeJsonObject,
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
    writeAppStateError(res, error, 'app-state/workspaces', CLI_MESSAGES.httpServer.appStateWorkspacesRequestFailed);
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
    writeAppStateError(res, error, 'app-state/workspaces', CLI_MESSAGES.httpServer.appStateWorkspacesRequestFailed);
  }
}

async function handleAppStateSessionGet(
  res: http.ServerResponse,
  repository: AppStatePersistenceRepository,
) {
  try {
    writeJson(res, 200, await repository.getWorkspaceSession());
  } catch (error) {
    writeAppStateError(res, error, 'app-state/session', CLI_MESSAGES.httpServer.appStateSessionRequestFailed);
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
      invalidJsonMessage: CLI_MESSAGES.httpServer.requestBodyMustBeJsonObject,
    });

    const session = await repository.setWorkspaceSession({
      activeWorkspaceId: parseAppStateNullableString(
        'activeWorkspaceId' in body ? body.activeWorkspaceId : body.workspaceId,
        'activeWorkspaceId',
      ),
    });

    writeJson(res, 200, session);
  } catch (error) {
    writeAppStateError(res, error, 'app-state/session', CLI_MESSAGES.httpServer.appStateSessionRequestFailed);
  }
}

async function handleAppStateRecentCanvasesList(
  url: URL,
  res: http.ServerResponse,
  repository: AppStatePersistenceRepository,
) {
  try {
    const workspaceId = requireAppStateString(url.searchParams.get('workspaceId'), 'workspaceId');
    writeJson(res, 200, await repository.listRecentCanvases(workspaceId));
  } catch (error) {
    writeAppStateError(
      res,
      error,
      'app-state/recent-canvases',
      CLI_MESSAGES.httpServer.appStateRecentCanvasesRequestFailed,
    );
  }
}

async function handleAppStateRecentCanvasesUpsert(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  repository: AppStatePersistenceRepository,
) {
  try {
    const body = await parseJsonObjectBody(req, {
      invalidJsonCode: 'APP_STATE_400_INVALID_JSON',
      invalidJsonMessage: CLI_MESSAGES.httpServer.requestBodyMustBeJsonObject,
    });

    const recentCanvas = await repository.upsertRecentCanvas({
      workspaceId: requireAppStateString(body.workspaceId, 'workspaceId'),
      canvasPath: requireAppStateString(body.canvasPath, 'canvasPath'),
      lastOpenedAt: parseAppStateOptionalDate(body.lastOpenedAt),
    });

    writeJson(res, 200, recentCanvas);
  } catch (error) {
    writeAppStateError(
      res,
      error,
      'app-state/recent-canvases',
      CLI_MESSAGES.httpServer.appStateRecentCanvasesRequestFailed,
    );
  }
}

async function handleAppStateRecentCanvasesDelete(
  url: URL,
  res: http.ServerResponse,
  repository: AppStatePersistenceRepository,
) {
  try {
    const workspaceId = requireAppStateString(url.searchParams.get('workspaceId'), 'workspaceId');
    await repository.clearRecentCanvases(workspaceId);
    writeJson(res, 200, { deleted: true });
  } catch (error) {
    writeAppStateError(
      res,
      error,
      'app-state/recent-canvases',
      CLI_MESSAGES.httpServer.appStateRecentCanvasesRequestFailed,
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
    writeAppStateError(res, error, 'app-state/preferences', CLI_MESSAGES.httpServer.appStatePreferencesRequestFailed);
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
      invalidJsonMessage: CLI_MESSAGES.httpServer.requestBodyMustBeJsonObject,
    });

    const preference = await repository.setPreference({
      key: requireAppStateString(body.key, 'key'),
      valueJson: parseAppStatePreferenceValue(body.valueJson),
    });

    writeJson(res, 200, preference);
  } catch (error) {
    writeAppStateError(res, error, 'app-state/preferences', CLI_MESSAGES.httpServer.appStatePreferencesRequestFailed);
  }
}

async function handleRender(req: http.IncomingMessage, res: http.ServerResponse, targetDir: string) {
  const body = await parseBody(req);
  const requestedCanvasId = typeof body?.canvasId === 'string' ? body.canvasId.trim() : '';
  if (!requestedCanvasId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: CLI_MESSAGES.httpServer.missingCanvasId, type: 'VALIDATION_ERROR' }));
    return;
  }

  const rawRootPath = typeof body?.rootPath === 'string'
    ? body.rootPath.trim()
    : typeof body?.root === 'string'
      ? body.root.trim()
      : '';
  if (rawRootPath && !path.isAbsolute(rawRootPath)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: CLI_MESSAGES.httpServer.rootPathAbsolute, type: 'VALIDATION_ERROR' }));
    return;
  }

  const requestTargetDir = rawRootPath ? path.resolve(rawRootPath) : targetDir;

  try {
    const rendered = await renderCanonicalCanvas({
      targetDir: requestTargetDir,
      canvasId: requestedCanvasId,
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rendered));
  } catch (error: any) {
    if (isCanonicalCliError(error) && (error.code === 'DOCUMENT_NOT_FOUND' || error.code === 'WORKSPACE_NOT_FOUND')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message, type: 'FILE_NOT_FOUND' }));
      return;
    }
    console.error(CLI_MESSAGES.httpServer.renderError, error);
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
    res.end(JSON.stringify({ error: CLI_MESSAGES.httpServer.missingFilePath, type: 'VALIDATION_ERROR' }));
    return;
  }

  const workspacePath = normalizeWorkspacePath(targetDir, requestedFilePath, requestedFilePath);
  if (!workspacePath.endsWith('.tsx')) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: CLI_MESSAGES.httpServer.filePathMustBeTsx, type: 'VALIDATION_ERROR' }));
    return;
  }

  const absolutePath = path.resolve(targetDir, workspacePath);
  if (fs.existsSync(absolutePath)) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: CLI_MESSAGES.httpServer.fileAlreadyExists(workspacePath), type: 'FILE_EXISTS' }));
    return;
  }

  const content = createCompatibilityCanvasSource();
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, 'utf-8');

  res.writeHead(201, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    filePath: workspacePath,
    sourceVersion: createCanvasSourceVersion(content),
  }));
}

async function handleFiles(req: http.IncomingMessage, res: http.ServerResponse, targetDir: string) {
  try {
    const files = await glob('**/*.tsx', { cwd: targetDir });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ files }));
  } catch (error: any) {
    console.error(CLI_MESSAGES.httpServer.filesError, error);
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
      res.end(JSON.stringify({ error: CLI_MESSAGES.httpServer.rootPathAbsolute, type: 'VALIDATION_ERROR' }));
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
    console.error(CLI_MESSAGES.httpServer.fileTreeError, error);
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
      canvasCount: workspace.canvasCount,
    },
    canvasCount: workspace.canvasCount,
    canvases: workspace.canvases,
    lastModifiedAt: workspace.lastModifiedAt,
  };
}

function toCanvasesResponsePayload(workspace: Awaited<ReturnType<typeof requireWorkspaceRoot>>, code: string) {
  return {
    code,
    rootPath: workspace.rootPath,
    root: workspace.rootPath,
    workspaceName: workspace.workspaceName,
    name: workspace.workspaceName,
    health: {
      state: workspace.health.status,
      message: workspace.health.message,
      canvasCount: workspace.canvasCount,
    },
    canvasCount: workspace.canvasCount,
    canvases: workspace.canvases,
    lastModifiedAt: workspace.lastModifiedAt,
  };
}

function toCanonicalCanvasSummary(canvas: CanonicalCanvasShellRecord) {
  return {
    canvasId: canvas.canvasId,
    workspaceId: canvas.workspaceId,
    title: canvas.title,
    modifiedAt: canvas.updatedAt?.getTime() ?? canvas.createdAt?.getTime() ?? null,
    latestRevision: canvas.latestRevision,
  };
}

function toCanonicalCanvasSourceVersion(canvas: CanonicalCanvasShellRecord): string {
  return createCanvasSourceVersion(JSON.stringify({
    canvasId: canvas.canvasId,
    workspaceId: canvas.workspaceId,
    latestRevision: canvas.latestRevision,
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

  const message = error instanceof Error ? error.message : CLI_MESSAGES.httpServer.unknownError;
  console.error(input.logLabel, message);
  writeJson(res, 500, {
    error: `${input.fallbackMessage}: ${message}`,
    code: input.fallbackCode,
  });
}

function pickRootPath(searchParams: URLSearchParams, fallbackRootPath?: string | null): string | null {
  return searchParams.get('rootPath') || searchParams.get('root') || fallbackRootPath || null;
}

function resolveCanvasRootPath(rawRootPath: unknown): string {
  if (typeof rawRootPath !== 'string') {
    throw new ApiError(400, 'DOC_400_INVALID_ROOT_PATH', CLI_MESSAGES.httpServer.rootPathRequired);
  }

  const trimmed = rawRootPath.trim();
  if (!trimmed || !path.isAbsolute(trimmed)) {
    throw new ApiError(400, 'DOC_400_INVALID_ROOT_PATH', CLI_MESSAGES.httpServer.rootPathAbsolute);
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
    const message = error instanceof Error ? error.message : CLI_MESSAGES.httpServer.unknownError;
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
      throw new ApiError(400, 'WS_400_INVALID_ROOT_PATH', CLI_MESSAGES.httpServer.rootPathRequired);
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
      logLabel: CLI_MESSAGES.httpServer.workspaceUnexpectedErrorLog,
      fallbackCode: 'WS_500_REQUEST_FAILED',
      fallbackMessage: CLI_MESSAGES.httpServer.workspaceRequestFailed,
    });
  }
}

async function handleWorkspaceMutation(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    const body = await parseJsonObjectBody(req, {
      invalidJsonCode: 'WS_400_INVALID_JSON',
      invalidJsonMessage: CLI_MESSAGES.httpServer.requestBodyMustBeJsonObject,
    });
    const rawRootPath = body.rootPath;
    if (typeof rawRootPath !== 'string') {
      throw new ApiError(400, 'WS_400_INVALID_ROOT_PATH', CLI_MESSAGES.httpServer.rootPathRequired);
    }

    const rawAction = body.action;
    if (rawAction !== 'open' && rawAction !== 'reveal' && rawAction !== 'ensure') {
      throw new ApiError(400, 'WS_400_INVALID_ACTION', CLI_MESSAGES.httpServer.actionMustBeOneOf);
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
      logLabel: CLI_MESSAGES.httpServer.workspaceUnexpectedErrorLog,
      fallbackCode: 'WS_500_REQUEST_FAILED',
      fallbackMessage: CLI_MESSAGES.httpServer.workspaceRequestFailed,
    });
  }
}

async function handleCanvasesList(url: URL, res: http.ServerResponse) {
  try {
    const rootPath = resolveCanvasRootPath(pickRootPath(url.searchParams));

    const workspace = await requireWorkspaceRoot(rootPath);
    const canvases = await listCanonicalCanvases({
      targetDir: workspace.rootPath,
    });
    writeJson(res, 200, {
      ...toCanvasesResponsePayload(workspace, 'DOC_200_LISTED'),
      canvasCount: canvases.length,
      canvases: canvases.map(toCanonicalCanvasSummary),
      lastModifiedAt: canvases.reduce<number | null>((latest, canvas) => {
        const timestamp = canvas.updatedAt?.getTime() ?? canvas.createdAt?.getTime() ?? null;
        if (timestamp === null) {
          return latest;
        }
        return latest === null ? timestamp : Math.max(latest, timestamp);
      }, null),
    });
  } catch (error) {
    writeApiError(res, error, {
      logLabel: CLI_MESSAGES.httpServer.canvasesUnexpectedErrorLog,
      fallbackCode: 'DOC_500_REQUEST_FAILED',
      fallbackMessage: CLI_MESSAGES.httpServer.canvasesRequestFailed,
    });
  }
}

async function handleCanvasesCreate(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    const body = await parseJsonObjectBody(req, {
      invalidJsonCode: 'DOC_400_INVALID_JSON',
      invalidJsonMessage: CLI_MESSAGES.httpServer.requestBodyMustBeJsonObject,
    });
    const rawRootPath = 'rootPath' in body ? body['rootPath'] : body['root'];
    const rootPath = resolveCanvasRootPath(rawRootPath);

    const workspace = await requireWorkspaceRoot(rootPath);
    const rawTitle = typeof body.title === 'string' ? body.title : null;
    let created: CanonicalCanvasShellRecord;
    try {
      created = await createCanonicalCanvas({
        targetDir: workspace.rootPath,
        title: rawTitle,
        actor: {
          kind: 'system',
          id: 'desktop.http',
        },
      });
    } catch (error) {
      throw error;
    }

    writeJson(res, 201, {
      code: 'DOC_201_CREATED',
      rootPath: workspace.rootPath,
      root: workspace.rootPath,
      workspaceName: workspace.workspaceName,
      created: true,
      ...toCanonicalCanvasSummary(created),
      sourceVersion: toCanonicalCanvasSourceVersion(created),
    });
  } catch (error) {
    writeApiError(res, error, {
      logLabel: CLI_MESSAGES.httpServer.canvasesUnexpectedErrorLog,
      fallbackCode: 'DOC_500_REQUEST_FAILED',
      fallbackMessage: CLI_MESSAGES.httpServer.canvasesRequestFailed,
    });
  }
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
