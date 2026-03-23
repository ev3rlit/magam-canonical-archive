import type { RendererRpcClient } from '../../features/host/renderer/rpcClient';
import type {
  AppPreferenceRecord,
  AppPreferenceUpsertInput,
  AppRecentDocumentRecord,
  AppRecentDocumentUpsertInput,
  AppWorkspaceRecord,
  AppWorkspaceSessionRecord,
  AppWorkspaceSessionUpdateInput,
  AppWorkspaceUpsertInput,
} from '../../../libs/shared/src/lib/app-state-persistence/contracts/types';

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
export const LAST_ACTIVE_DOCUMENT_SESSION_PREFERENCE_KEY = 'workspace.lastActiveDocumentSession';
export const LEGACY_WORKSPACE_REGISTRY_IMPORT_PREFERENCE_KEY = 'workspace.registryLegacyImportCompleted';

export type WorkspaceRegistryAppStateRpcClient = Pick<
  RendererRpcClient,
  | 'listAppStateWorkspaces'
  | 'upsertAppStateWorkspace'
  | 'getAppStateWorkspaceSession'
  | 'setAppStateWorkspaceSession'
  | 'listAppStateRecentDocuments'
  | 'upsertAppStateRecentDocument'
  | 'getAppStatePreference'
  | 'setAppStatePreference'
>;

export interface WorkspaceRegistryHydrationResult {
  workspaces: RegisteredWorkspace[];
  activeWorkspaceId: string | null;
  lastActiveDocuments: LastActiveDocumentMap;
  migratedFromLegacyStorage: boolean;
}

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

export function registeredWorkspaceToAppStateWorkspaceInput(
  workspace: RegisteredWorkspace,
): AppWorkspaceUpsertInput {
  return {
    id: workspace.id,
    rootPath: workspace.rootPath,
    displayName: workspace.name,
    status: workspace.status,
    lastOpenedAt: new Date(workspace.lastOpenedAt),
    lastSeenAt: workspace.lastModifiedAt === null ? null : new Date(workspace.lastModifiedAt),
  };
}

export function appStateWorkspaceToRegisteredWorkspace(
  workspace: AppWorkspaceRecord,
): RegisteredWorkspace {
  return {
    id: workspace.id,
    name: workspace.displayName,
    rootPath: workspace.rootPath,
    status: workspace.status,
    documentCount: 0,
    lastModifiedAt: workspace.lastSeenAt?.getTime() ?? null,
    lastOpenedAt: workspace.lastOpenedAt?.getTime() ?? 0,
  };
}

export function activeWorkspaceIdToAppStateSessionInput(
  activeWorkspaceId: string | null,
): AppWorkspaceSessionUpdateInput {
  return {
    activeWorkspaceId,
  };
}

export function appStateSessionToActiveWorkspaceId(
  session: AppWorkspaceSessionRecord | null,
  workspaces: RegisteredWorkspace[],
): string | null {
  const activeWorkspaceId = session?.activeWorkspaceId ?? null;
  if (activeWorkspaceId && workspaces.some((workspace) => workspace.id === activeWorkspaceId)) {
    return activeWorkspaceId;
  }

  return workspaces[0]?.id ?? null;
}

export function lastActiveDocumentMapToRecentDocumentInputs(
  lastActiveDocuments: LastActiveDocumentMap,
  workspaces: RegisteredWorkspace[],
): AppRecentDocumentUpsertInput[] {
  const knownWorkspaceIds = new Set(workspaces.map((workspace) => workspace.id));

  return Object.entries(lastActiveDocuments)
    .filter(([workspaceId, documentPath]) => knownWorkspaceIds.has(workspaceId) && !!documentPath)
    .map(([workspaceId, documentPath]) => ({
      workspaceId,
      documentPath,
      lastOpenedAt: new Date(),
    }));
}

export function recentDocumentsToLastActiveDocumentMap(
  recentDocumentsByWorkspace: Record<string, AppRecentDocumentRecord[]>,
): LastActiveDocumentMap {
  const lastActiveDocuments: LastActiveDocumentMap = {};

  for (const [workspaceId, recentDocuments] of Object.entries(recentDocumentsByWorkspace)) {
    const currentDocument = recentDocuments[0]?.documentPath;
    if (currentDocument) {
      lastActiveDocuments[workspaceId] = currentDocument;
    }
  }

  return lastActiveDocuments;
}

export function lastActiveDocumentMapToPreferenceInput(
  lastActiveDocuments: LastActiveDocumentMap,
): AppPreferenceUpsertInput {
  return {
    key: LAST_ACTIVE_DOCUMENT_SESSION_PREFERENCE_KEY,
    valueJson: lastActiveDocuments,
  };
}

export function preferenceToLastActiveDocumentMap(
  preference: AppPreferenceRecord | null,
): LastActiveDocumentMap {
  const value = preference?.valueJson;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const lastActiveDocuments: LastActiveDocumentMap = {};

  for (const [workspaceId, documentPath] of Object.entries(value)) {
    if (typeof documentPath === 'string') {
      lastActiveDocuments[workspaceId] = documentPath;
    }
  }

  return lastActiveDocuments;
}

export function isLegacyWorkspaceRegistryImportCompleted(
  preference: AppPreferenceRecord | null,
): boolean {
  return preference?.valueJson === true;
}

function sanitizeLastActiveDocumentMap(
  map: LastActiveDocumentMap,
  workspaces: RegisteredWorkspace[],
): LastActiveDocumentMap {
  const knownWorkspaceIds = new Set(workspaces.map((workspace) => workspace.id));

  return Object.fromEntries(
    Object.entries(map).filter(
      ([workspaceId, documentPath]) => knownWorkspaceIds.has(workspaceId) && typeof documentPath === 'string' && documentPath.length > 0,
    ),
  );
}

async function importLegacyWorkspaceRegistryToAppState(
  rpc: WorkspaceRegistryAppStateRpcClient,
  workspaces: RegisteredWorkspace[],
  activeWorkspaceId: string | null,
  lastActiveDocuments: LastActiveDocumentMap,
): Promise<WorkspaceRegistryHydrationResult> {
  const importedWorkspaces = sortWorkspaces(
    await Promise.all(
      workspaces.map(async (workspace) => appStateWorkspaceToRegisteredWorkspace(
        await rpc.upsertAppStateWorkspace(registeredWorkspaceToAppStateWorkspaceInput(workspace)),
      )),
    ),
  );
  const sanitizedLastActiveDocuments = sanitizeLastActiveDocumentMap(lastActiveDocuments, importedWorkspaces);

  await Promise.all(
    lastActiveDocumentMapToRecentDocumentInputs(sanitizedLastActiveDocuments, importedWorkspaces).map(
      (input) => rpc.upsertAppStateRecentDocument(input),
    ),
  );
  await rpc.setAppStatePreference(lastActiveDocumentMapToPreferenceInput(sanitizedLastActiveDocuments));
  await rpc.setAppStatePreference({
    key: LEGACY_WORKSPACE_REGISTRY_IMPORT_PREFERENCE_KEY,
    valueJson: true,
  });

  const nextActiveWorkspaceId = appStateSessionToActiveWorkspaceId(
    await rpc.setAppStateWorkspaceSession(
      activeWorkspaceIdToAppStateSessionInput(
        importedWorkspaces.some((workspace) => workspace.id === activeWorkspaceId) ? activeWorkspaceId : null,
      ),
    ),
    importedWorkspaces,
  );

  return {
    workspaces: importedWorkspaces,
    activeWorkspaceId: nextActiveWorkspaceId,
    lastActiveDocuments: sanitizedLastActiveDocuments,
    migratedFromLegacyStorage: true,
  };
}

export async function hydrateWorkspaceRegistryFromAppState(
  rpc: WorkspaceRegistryAppStateRpcClient,
): Promise<WorkspaceRegistryHydrationResult> {
  const [appStateWorkspaces, legacyImportPreference] = await Promise.all([
    rpc.listAppStateWorkspaces(),
    rpc.getAppStatePreference(LEGACY_WORKSPACE_REGISTRY_IMPORT_PREFERENCE_KEY),
  ]);

  if (appStateWorkspaces.length === 0 && !isLegacyWorkspaceRegistryImportCompleted(legacyImportPreference)) {
    const legacyWorkspaces = sortWorkspaces(readStoredWorkspaces());
    const legacyActiveWorkspaceId = readStoredActiveWorkspaceId();
    const legacyLastActiveDocuments = sanitizeLastActiveDocumentMap(
      readLastActiveDocumentMap(),
      legacyWorkspaces,
    );

    return importLegacyWorkspaceRegistryToAppState(
      rpc,
      legacyWorkspaces,
      legacyActiveWorkspaceId,
      legacyLastActiveDocuments,
    );
  }

  const workspaces = sortWorkspaces(appStateWorkspaces.map(appStateWorkspaceToRegisteredWorkspace));
  const [session, lastActivePreference, recentDocumentsByWorkspaceEntries] = await Promise.all([
    rpc.getAppStateWorkspaceSession(),
    rpc.getAppStatePreference(LAST_ACTIVE_DOCUMENT_SESSION_PREFERENCE_KEY),
    Promise.all(
      workspaces.map(async (workspace) => [
        workspace.id,
        await rpc.listAppStateRecentDocuments(workspace.id),
      ] as const),
    ),
  ]);

  const activeWorkspaceId = appStateSessionToActiveWorkspaceId(session, workspaces);
  const recentDocumentsByWorkspace = Object.fromEntries(recentDocumentsByWorkspaceEntries);
  const lastActiveDocuments = {
    ...recentDocumentsToLastActiveDocumentMap(recentDocumentsByWorkspace),
    ...sanitizeLastActiveDocumentMap(preferenceToLastActiveDocumentMap(lastActivePreference), workspaces),
  };

  return {
    workspaces,
    activeWorkspaceId,
    lastActiveDocuments,
    migratedFromLegacyStorage: false,
  };
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
