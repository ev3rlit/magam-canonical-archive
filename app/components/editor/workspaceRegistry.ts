export type WorkspaceHealthState = 'ok' | 'missing' | 'not-directory' | 'unreadable';

export interface WorkspaceDocumentSummary {
  filePath: string;
  size?: number;
  modifiedAt?: number;
}

export interface WorkspaceProbeResponse {
  rootPath: string;
  workspaceName: string;
  health: {
    state: WorkspaceHealthState;
    message?: string;
    documentCount?: number;
  };
  documentCount: number;
  documents: WorkspaceDocumentSummary[];
  lastModifiedAt: number | null;
}

export interface RegisteredWorkspace {
  id: string;
  name: string;
  rootPath: string;
  status: WorkspaceHealthState;
  documentCount: number;
  lastModifiedAt: number | null;
  lastOpenedAt: number;
}

export interface WorkspaceSidebarDocument {
  absolutePath: string;
  relativePath: string;
  title: string;
}

export interface LastActiveDocumentMap {
  [workspaceId: string]: string;
}

const WORKSPACE_REGISTRY_STORAGE_KEY = 'magam:workspaceRegistry:v1';
const ACTIVE_WORKSPACE_STORAGE_KEY = 'magam:activeWorkspaceId:v1';
const LAST_ACTIVE_DOCUMENTS_STORAGE_KEY = 'magam:lastActiveDocuments:v1';

function safeReadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function readStoredWorkspaces(): RegisteredWorkspace[] {
  return safeReadJson<RegisteredWorkspace[]>(WORKSPACE_REGISTRY_STORAGE_KEY, []);
}

export function writeStoredWorkspaces(workspaces: RegisteredWorkspace[]): void {
  safeWriteJson(WORKSPACE_REGISTRY_STORAGE_KEY, workspaces);
}

export function readStoredActiveWorkspaceId(): string | null {
  return safeReadJson<string | null>(ACTIVE_WORKSPACE_STORAGE_KEY, null);
}

export function writeStoredActiveWorkspaceId(workspaceId: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (!workspaceId) {
    window.localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, JSON.stringify(workspaceId));
}

export function readLastActiveDocumentMap(): LastActiveDocumentMap {
  return safeReadJson<LastActiveDocumentMap>(LAST_ACTIVE_DOCUMENTS_STORAGE_KEY, {});
}

export function writeLastActiveDocumentMap(map: LastActiveDocumentMap): void {
  safeWriteJson(LAST_ACTIVE_DOCUMENTS_STORAGE_KEY, map);
}

export function buildRegisteredWorkspace(
  input: WorkspaceProbeResponse,
  existingId?: string,
): RegisteredWorkspace {
  return {
    id: existingId ?? crypto.randomUUID(),
    name: input.workspaceName,
    rootPath: input.rootPath,
    status: input.health.state,
    documentCount: input.documentCount,
    lastModifiedAt: input.lastModifiedAt,
    lastOpenedAt: Date.now(),
  };
}

function trimTrailingSeparators(value: string): string {
  return value.replace(/[\\/]+$/, '');
}

export function isAbsoluteLocalPath(value: string): boolean {
  return /^(?:[a-zA-Z]:[\\/]|\/)/.test(value);
}

function normalizePathSeparators(value: string): string {
  return value.replace(/\\/g, '/');
}

function basename(value: string): string {
  const normalized = normalizePathSeparators(value);
  const segments = normalized.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? normalized;
}

export function updateWorkspaceFromProbe(
  current: RegisteredWorkspace,
  probe: WorkspaceProbeResponse,
): RegisteredWorkspace {
  return {
    ...current,
    name: probe.workspaceName,
    rootPath: probe.rootPath,
    status: probe.health.state,
    documentCount: probe.documentCount,
    lastModifiedAt: probe.lastModifiedAt,
  };
}

export function resolveWorkspaceDocumentAbsolutePath(rootPath: string, relativePath: string): string {
  const normalizedRelativePath = normalizePathSeparators(relativePath).replace(/^\/+/, '');
  return `${normalizePathSeparators(trimTrailingSeparators(rootPath))}/${normalizedRelativePath}`;
}

export function normalizeWorkspaceDocumentPath(
  rootPath: string | null | undefined,
  filePath: string,
): string {
  const normalizedFilePath = normalizePathSeparators(filePath).trim();
  if (!normalizedFilePath) {
    return normalizedFilePath;
  }

  if (isAbsoluteLocalPath(normalizedFilePath) || !rootPath) {
    return normalizedFilePath;
  }

  return resolveWorkspaceDocumentAbsolutePath(rootPath, normalizedFilePath);
}

export function buildSidebarDocuments(
  rootPath: string,
  documents: WorkspaceDocumentSummary[],
): WorkspaceSidebarDocument[] {
  return documents.map((document) => ({
    absolutePath: resolveWorkspaceDocumentAbsolutePath(rootPath, document.filePath),
    relativePath: document.filePath,
    title: basename(document.filePath),
  }));
}

export function sortWorkspaces(workspaces: RegisteredWorkspace[]): RegisteredWorkspace[] {
  return [...workspaces].sort((left, right) => {
    if (right.lastOpenedAt !== left.lastOpenedAt) {
      return right.lastOpenedAt - left.lastOpenedAt;
    }

    return left.name.localeCompare(right.name);
  });
}

export function upsertWorkspace(
  workspaces: RegisteredWorkspace[],
  nextWorkspace: RegisteredWorkspace,
): RegisteredWorkspace[] {
  const existingIndex = workspaces.findIndex((workspace) => workspace.id === nextWorkspace.id);
  if (existingIndex === -1) {
    return sortWorkspaces([...workspaces, nextWorkspace]);
  }

  const next = [...workspaces];
  next[existingIndex] = nextWorkspace;
  return sortWorkspaces(next);
}

export function removeWorkspace(
  workspaces: RegisteredWorkspace[],
  workspaceId: string,
): RegisteredWorkspace[] {
  return workspaces.filter((workspace) => workspace.id !== workspaceId);
}
