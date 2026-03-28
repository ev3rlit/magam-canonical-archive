import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

const COMPATIBILITY_DOCUMENT_EXTENSIONS = new Set(['.tsx']);
const COMPATIBILITY_DOCUMENT_SOURCE = [
  "import { Canvas } from '@magam/core';",
  '',
  'export default function UntitledCanvas() {',
  '  return <Canvas></Canvas>;',
  '}',
  '',
].join('\n');

const SKIPPED_DIR_NAMES = new Set(['node_modules']);

export type WorkspaceHealthStatus = 'ok' | 'missing' | 'not-directory' | 'unreadable';

export type WorkspaceHealth = {
  status: WorkspaceHealthStatus;
  message?: string;
};

export type CompatibilityWorkspaceCanvasSummary = {
  filePath: string;
  size: number;
  modifiedAt: number;
};

export type WorkspaceCanvasSummary = CompatibilityWorkspaceCanvasSummary;

export type WorkspaceProbeResult = {
  rootPath: string;
  workspaceName: string;
  health: WorkspaceHealth;
  canvasCount: number;
  canvases: CompatibilityWorkspaceCanvasSummary[];
  lastModifiedAt: number | null;
};

export type FileBrowserAction = 'open' | 'reveal';

export type FileBrowserLaunchResult = {
  rootPath: string;
  targetPath: string;
  requestedAction: FileBrowserAction;
  mode: FileBrowserAction;
  launched: true;
};

export class ApiError extends Error {
  status: number;

  code: string;

  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error
    && ('code' in error)
    && (error as NodeJS.ErrnoException).code === 'ENOENT';
}

function isPermissionError(error: unknown): boolean {
  return error instanceof Error
    && ('code' in error)
    && ((error as NodeJS.ErrnoException).code === 'EACCES'
      || (error as NodeJS.ErrnoException).code === 'EPERM');
}

function normalizeAbsolutePath(rawPath: string, fieldName: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) {
    throw new ApiError(400, 'WS_400_INVALID_ROOT_PATH', `${fieldName} is required`);
  }

  if (!path.isAbsolute(trimmed)) {
    throw new ApiError(400, 'WS_400_INVALID_ROOT_PATH', `${fieldName} must be an absolute path`);
  }

  return path.resolve(trimmed);
}

export function resolveDefaultWorkspaceRootPath(): string {
  return path.resolve(process.env['MAGAM_TARGET_DIR'] || process.cwd());
}

function isWithinRoot(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function normalizeWorkspaceTargetPath(rootPath: string, rawPath: string, fieldName: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) {
    throw new ApiError(400, 'DOC_400_INVALID_PATH', `${fieldName} is required`);
  }

  const candidatePath = path.isAbsolute(trimmed)
    ? path.resolve(trimmed)
    : path.resolve(rootPath, trimmed);

  if (!isWithinRoot(rootPath, candidatePath) && candidatePath !== rootPath) {
    throw new ApiError(400, 'DOC_400_INVALID_PATH', `${fieldName} must stay within the workspace root`);
  }

  return candidatePath;
}

function toWorkspaceRelativePath(rootPath: string, absolutePath: string): string {
  return path.relative(rootPath, absolutePath).replace(/\\/g, '/');
}

function createCanvasSourceVersion(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

function shouldSkipEntry(name: string): boolean {
  return name.startsWith('.') || SKIPPED_DIR_NAMES.has(name);
}

async function readWorkspaceCanvases(rootPath: string): Promise<CompatibilityWorkspaceCanvasSummary[]> {
  const results: CompatibilityWorkspaceCanvasSummary[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (shouldSkipEntry(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(path.join(currentDir, entry.name));
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (!COMPATIBILITY_DOCUMENT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        continue;
      }

      const absolutePath = path.join(currentDir, entry.name);
      const info = await stat(absolutePath);
      results.push({
        filePath: toWorkspaceRelativePath(rootPath, absolutePath),
        size: info.size,
        modifiedAt: info.mtimeMs,
      });
    }
  }

  await walk(rootPath);

  results.sort((left, right) => left.filePath.localeCompare(right.filePath));
  return results;
}

export function createCompatibilityCanvasSource(): string {
  return COMPATIBILITY_DOCUMENT_SOURCE;
}

export const createDefaultCanvasSource = createCompatibilityCanvasSource;

export function createCompatibilityGeneratedCanvasPath(existingFiles: Iterable<string>): string {
  const taken = new Set(existingFiles);
  const useDocsFolder = Array.from(taken).some((filePath) => filePath.startsWith('docs/'));
  let counter = 1;

  while (true) {
    const relativePath = `${useDocsFolder ? 'docs/' : ''}untitled-${counter}.graph.tsx`;
    if (!taken.has(relativePath)) {
      return relativePath;
    }
    counter += 1;
  }
}

export const createGeneratedCanvasPath = createCompatibilityGeneratedCanvasPath;

export function normalizeWorkspaceRootPath(rawPath: string): string {
  return normalizeAbsolutePath(rawPath, 'rootPath');
}

export function resolveCompatibilityCanvasPath(rootPath: string, rawPath: string): string {
  const absolutePath = normalizeWorkspaceTargetPath(rootPath, rawPath, 'filePath');
  if (path.extname(absolutePath).toLowerCase() !== '.tsx') {
    throw new ApiError(422, 'DOC_422_UNSUPPORTED_EXTENSION', 'Canvases must use the .tsx extension');
  }

  return absolutePath;
}

export const resolveWorkspaceCanvasPath = resolveCompatibilityCanvasPath;

export function resolveWorkspaceBrowserTargetPath(rootPath: string, rawPath?: string | null): string {
  if (!rawPath) {
    return rootPath;
  }

  return normalizeWorkspaceTargetPath(rootPath, rawPath, 'targetPath');
}

export async function probeWorkspace(rootPathInput: string): Promise<WorkspaceProbeResult> {
  const rootPath = normalizeWorkspaceRootPath(rootPathInput);
  const workspaceName = path.basename(rootPath) || rootPath;

  try {
    const info = await stat(rootPath);
    if (!info.isDirectory()) {
      return {
        rootPath,
        workspaceName,
        health: {
          status: 'not-directory',
          message: 'Workspace root is not a directory',
        },
        canvasCount: 0,
        canvases: [],
        lastModifiedAt: null,
      };
    }

    try {
      const canvases = await readWorkspaceCanvases(rootPath);
      const lastModifiedAt = canvases.length > 0
        ? Math.max(...canvases.map((canvas) => canvas.modifiedAt))
        : null;

      return {
        rootPath,
        workspaceName,
        health: { status: 'ok' },
        canvasCount: canvases.length,
        canvases,
        lastModifiedAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        rootPath,
        workspaceName,
        health: {
          status: 'unreadable',
          message: `Failed to read workspace canvases: ${message}`,
        },
        canvasCount: 0,
        canvases: [],
        lastModifiedAt: null,
      };
    }
  } catch (error) {
    if (isMissingPathError(error)) {
      return {
        rootPath,
        workspaceName,
        health: {
          status: 'missing',
          message: 'Workspace root does not exist',
        },
        canvasCount: 0,
        canvases: [],
        lastModifiedAt: null,
      };
    }

    if (isPermissionError(error)) {
      return {
        rootPath,
        workspaceName,
        health: {
          status: 'unreadable',
          message: 'Workspace root is not readable',
        },
        canvasCount: 0,
        canvases: [],
        lastModifiedAt: null,
      };
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new ApiError(500, 'WS_500_PROBE_FAILED', `Failed to inspect workspace: ${message}`);
  }
}

function mapWorkspaceHealthToHttpStatus(status: WorkspaceHealthStatus): number {
  switch (status) {
    case 'missing':
      return 404;
    case 'not-directory':
      return 422;
    case 'unreadable':
      return 500;
    case 'ok':
      return 200;
    default:
      return 500;
  }
}

export async function requireWorkspaceRoot(rootPathInput: string): Promise<WorkspaceProbeResult> {
  const probe = await probeWorkspace(rootPathInput);
  if (probe.health.status === 'ok') {
    return probe;
  }

  throw new ApiError(
    mapWorkspaceHealthToHttpStatus(probe.health.status),
    `WS_${mapWorkspaceHealthToHttpStatus(probe.health.status)}_WORKSPACE_${probe.health.status.replace(/-/g, '_').toUpperCase()}`,
    probe.health.message || 'Workspace is not available',
  );
}

export async function ensureWorkspaceRoot(rootPathInput: string): Promise<WorkspaceProbeResult> {
  const rootPath = normalizeWorkspaceRootPath(rootPathInput);

  try {
    const existing = await stat(rootPath);
    if (!existing.isDirectory()) {
      throw new ApiError(409, 'WS_409_ROOT_NOT_DIRECTORY', 'Workspace root is not a directory');
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (isMissingPathError(error)) {
      try {
        await mkdir(rootPath, { recursive: true });
      } catch (mkdirError) {
        const message = mkdirError instanceof Error ? mkdirError.message : 'Unknown error';
        throw new ApiError(500, 'WS_500_ROOT_CREATE_FAILED', `Failed to create workspace root: ${message}`);
      }
    } else {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ApiError(500, 'WS_500_ROOT_STAT_FAILED', `Failed to inspect workspace root: ${message}`);
    }
  }

  return requireWorkspaceRoot(rootPath);
}

async function waitForCommandExit(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });

    child.once('error', (error) => {
      reject(error);
    });

    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`File browser command exited with code ${code ?? 'null'}${signal ? ` signal ${signal}` : ''}`));
    });

    child.unref();
  });
}

export function buildFileBrowserLaunchPlan(input: {
  platform: NodeJS.Platform;
  rootPath: string;
  targetPath?: string | null;
  action: FileBrowserAction;
}): { command: string; args: string[]; mode: FileBrowserAction } {
  const targetPath = resolveWorkspaceBrowserTargetPath(input.rootPath, input.targetPath);

  if (input.platform === 'darwin') {
    if (input.action === 'reveal' && targetPath !== input.rootPath) {
      return { command: 'open', args: ['-R', targetPath], mode: 'reveal' };
    }

    return { command: 'open', args: [targetPath], mode: 'open' };
  }

  if (input.platform === 'win32') {
    if (input.action === 'reveal' && targetPath !== input.rootPath) {
      return { command: 'explorer', args: [`/select,${targetPath}`], mode: 'reveal' };
    }

    return { command: 'explorer', args: [targetPath], mode: 'open' };
  }

  if (input.platform === 'linux') {
    if (input.action === 'reveal' && targetPath !== input.rootPath) {
      return { command: 'xdg-open', args: [path.dirname(targetPath)], mode: 'open' };
    }

    return { command: 'xdg-open', args: [targetPath], mode: 'open' };
  }

  throw new ApiError(501, 'WS_501_FILE_BROWSER_UNSUPPORTED', `File browser reveal is not supported on ${input.platform}`);
}

export async function openWorkspaceInFileBrowser(input: {
  platform: NodeJS.Platform;
  rootPath: string;
  targetPath?: string | null;
  action: FileBrowserAction;
}): Promise<FileBrowserLaunchResult> {
  const plan = buildFileBrowserLaunchPlan(input);
  await waitForCommandExit(plan.command, plan.args);

  return {
    rootPath: input.rootPath,
    targetPath: resolveWorkspaceBrowserTargetPath(input.rootPath, input.targetPath),
    requestedAction: input.action,
    mode: plan.mode,
    launched: true,
  };
}

export async function createCompatibilityWorkspaceCanvas(input: {
  rootPath: string;
  filePath?: string | null;
}): Promise<{ filePath: string; sourceVersion: string }> {
  const probe = await ensureWorkspaceRoot(input.rootPath);
  const relativeFilePath = input.filePath && input.filePath.trim().length > 0
    ? input.filePath.trim()
    : createCompatibilityGeneratedCanvasPath(probe.canvases.map((canvas) => canvas.filePath));
  const absoluteFilePath = resolveCompatibilityCanvasPath(probe.rootPath, relativeFilePath);

  try {
    const existing = await stat(absoluteFilePath);
    if (existing.isFile()) {
      throw new ApiError(409, 'DOC_409_ALREADY_EXISTS', 'Canvas already exists');
    }

    throw new ApiError(409, 'DOC_409_PATH_NOT_AVAILABLE', 'Canvas path is not available');
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (!isMissingPathError(error)) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ApiError(500, 'DOC_500_CREATE_FAILED', `Failed to inspect target file: ${message}`);
    }
  }

  await mkdir(path.dirname(absoluteFilePath), { recursive: true });
  const content = createCompatibilityCanvasSource();
  await writeFile(absoluteFilePath, content, 'utf-8');

  return {
    filePath: toWorkspaceRelativePath(probe.rootPath, absoluteFilePath),
    sourceVersion: createCanvasSourceVersion(content),
  };
}

export const createWorkspaceCanvas = createCompatibilityWorkspaceCanvas;

export { toWorkspaceRelativePath, createCanvasSourceVersion };
