import type { RendererRpcClient } from '../../features/host/renderer/rpcClient';
import type {
  AppPreferenceRecord,
  AppPreferenceUpsertInput,
  AppRecentCanvasRecord,
  AppRecentCanvasUpsertInput,
  AppWorkspaceRecord,
  AppWorkspaceSessionRecord,
  AppWorkspaceSessionUpdateInput,
  AppWorkspaceUpsertInput,
} from '../../../libs/shared/src/lib/app-state-persistence/contracts/types';

export type WorkspaceHealthState = 'ok' | 'missing' | 'not-directory' | 'unreadable';

export interface WorkspaceCanvasSummary {
  title?: string | null;
  canvasId?: string;
  workspaceId?: string;
  latestRevision?: number | null;
  size?: number;
  modifiedAt?: number;
}

export interface WorkspaceProbeResponse {
  rootPath: string;
  workspaceName: string;
  health: {
    state: WorkspaceHealthState;
    message?: string;
    canvasCount?: number;
  };
  canvasCount: number;
  canvases: WorkspaceCanvasSummary[];
  lastModifiedAt: number | null;
}

export interface RegisteredWorkspace {
  id: string;
  name: string;
  rootPath: string;
  status: WorkspaceHealthState;
  canvasCount: number;
  lastModifiedAt: number | null;
  lastOpenedAt: number;
}

export interface WorkspaceSidebarCanvas {
  canvasId: string;
  workspaceId?: string;
  latestRevision?: number | null;
  title: string;
}

export interface LastActiveCanvasMap {
  [workspaceId: string]: string;
}

const WORKSPACE_REGISTRY_STORAGE_KEY = 'magam:workspaceRegistry:v1';
const ACTIVE_WORKSPACE_STORAGE_KEY = 'magam:activeWorkspaceId:v1';
const LAST_ACTIVE_CANVASES_STORAGE_KEY = 'magam:lastActiveCanvases:v1';
export const LAST_ACTIVE_CANVAS_SESSION_PREFERENCE_KEY = 'workspace.lastActiveCanvasSession';
export const LAST_ACTIVE_CANVAS_ID_SESSION_PREFERENCE_KEY = 'workspace.lastActiveCanvasIdSession';
export const LEGACY_WORKSPACE_REGISTRY_IMPORT_PREFERENCE_KEY = 'workspace.registryLegacyImportCompleted';

export type WorkspaceRegistryAppStateRpcClient = Pick<
  RendererRpcClient,
  | 'listAppStateWorkspaces'
  | 'upsertAppStateWorkspace'
  | 'getAppStateWorkspaceSession'
  | 'setAppStateWorkspaceSession'
  | 'listAppStateRecentCanvases'
  | 'upsertAppStateRecentCanvas'
  | 'getAppStatePreference'
  | 'setAppStatePreference'
>;

export interface WorkspaceRegistryHydrationResult {
  workspaces: RegisteredWorkspace[];
  activeWorkspaceId: string | null;
  lastActiveCanvases: LastActiveCanvasMap;
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

export function readLastActiveCanvasMap(): LastActiveCanvasMap {
  return safeReadJson<LastActiveCanvasMap>(LAST_ACTIVE_CANVASES_STORAGE_KEY, {});
}

export function writeLastActiveCanvasMap(map: LastActiveCanvasMap): void {
  safeWriteJson(LAST_ACTIVE_CANVASES_STORAGE_KEY, map);
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

function toEpochMillis(value: Date | string | number | null | undefined): number | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    const time = parsed.getTime();
    return Number.isNaN(time) ? null : time;
  }

  return null;
}

export function appStateWorkspaceToRegisteredWorkspace(
  workspace: AppWorkspaceRecord,
): RegisteredWorkspace {
  return {
    id: workspace.id,
    name: workspace.displayName,
    rootPath: workspace.rootPath,
    status: workspace.status,
    canvasCount: 0,
    lastModifiedAt: toEpochMillis(workspace.lastSeenAt),
    lastOpenedAt: toEpochMillis(workspace.lastOpenedAt) ?? 0,
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

export function lastActiveCanvasMapToRecentCanvasInputs(
  lastActiveCanvases: LastActiveCanvasMap,
  workspaces: RegisteredWorkspace[],
): AppRecentCanvasUpsertInput[] {
  const knownWorkspaceIds = new Set(workspaces.map((workspace) => workspace.id));

  return Object.entries(lastActiveCanvases)
    .filter(([workspaceId, canvasId]) => knownWorkspaceIds.has(workspaceId) && !!canvasId)
    .map(([workspaceId, canvasId]) => ({
      workspaceId,
      canvasId,
      lastOpenedAt: new Date(),
    }));
}

export function recentCanvasesToLastActiveCanvasMap(
  recentCanvasesByWorkspace: Record<string, AppRecentCanvasRecord[]>,
): LastActiveCanvasMap {
  const lastActiveCanvases: LastActiveCanvasMap = {};

  for (const [workspaceId, recentCanvases] of Object.entries(recentCanvasesByWorkspace)) {
    const currentCanvas = recentCanvases[0]?.canvasId;
    if (currentCanvas) {
      lastActiveCanvases[workspaceId] = currentCanvas;
    }
  }

  return lastActiveCanvases;
}

export function lastActiveCanvasMapToPreferenceInput(
  lastActiveCanvases: LastActiveCanvasMap,
): AppPreferenceUpsertInput {
  return {
    key: LAST_ACTIVE_CANVAS_SESSION_PREFERENCE_KEY,
    valueJson: lastActiveCanvases,
  };
}

export function preferenceToLastActiveCanvasMap(
  preference: AppPreferenceRecord | null,
): LastActiveCanvasMap {
  const value = preference?.valueJson;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const lastActiveCanvases: LastActiveCanvasMap = {};

  for (const [workspaceId, canvasId] of Object.entries(value)) {
    if (typeof canvasId === 'string') {
      lastActiveCanvases[workspaceId] = canvasId;
    }
  }

  return lastActiveCanvases;
}

export function isLegacyWorkspaceRegistryImportCompleted(
  preference: AppPreferenceRecord | null,
): boolean {
  return preference?.valueJson === true;
}

function sanitizeLastActiveCanvasMap(
  map: LastActiveCanvasMap,
  workspaces: RegisteredWorkspace[],
): LastActiveCanvasMap {
  const knownWorkspaceIds = new Set(workspaces.map((workspace) => workspace.id));

  return Object.fromEntries(
    Object.entries(map).filter(
      ([workspaceId, canvasId]) => knownWorkspaceIds.has(workspaceId) && typeof canvasId === 'string' && canvasId.length > 0,
    ),
  );
}

async function importLegacyWorkspaceRegistryToAppState(
  rpc: WorkspaceRegistryAppStateRpcClient,
  workspaces: RegisteredWorkspace[],
  activeWorkspaceId: string | null,
  lastActiveCanvases: LastActiveCanvasMap,
): Promise<WorkspaceRegistryHydrationResult> {
  const importedWorkspaces = sortWorkspaces(
    await Promise.all(
      workspaces.map(async (workspace) => appStateWorkspaceToRegisteredWorkspace(
        await rpc.upsertAppStateWorkspace(registeredWorkspaceToAppStateWorkspaceInput(workspace)),
      )),
    ),
  );
  const sanitizedLastActiveCanvases = sanitizeLastActiveCanvasMap(lastActiveCanvases, importedWorkspaces);

  await Promise.all(
    lastActiveCanvasMapToRecentCanvasInputs(sanitizedLastActiveCanvases, importedWorkspaces).map(
      (input) => rpc.upsertAppStateRecentCanvas(input),
    ),
  );
  await rpc.setAppStatePreference(lastActiveCanvasMapToPreferenceInput(sanitizedLastActiveCanvases));
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
    lastActiveCanvases: sanitizedLastActiveCanvases,
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
    const legacyLastActiveCanvases = sanitizeLastActiveCanvasMap(
      readLastActiveCanvasMap(),
      legacyWorkspaces,
    );

    return importLegacyWorkspaceRegistryToAppState(
      rpc,
      legacyWorkspaces,
      legacyActiveWorkspaceId,
      legacyLastActiveCanvases,
    );
  }

  const workspaces = sortWorkspaces(appStateWorkspaces.map(appStateWorkspaceToRegisteredWorkspace));
  const [session, lastActivePreference, recentCanvasesByWorkspaceEntries] = await Promise.all([
    rpc.getAppStateWorkspaceSession(),
    rpc.getAppStatePreference(LAST_ACTIVE_CANVAS_SESSION_PREFERENCE_KEY),
    Promise.all(
      workspaces.map(async (workspace) => [
        workspace.id,
        await rpc.listAppStateRecentCanvases(workspace.id),
      ] as const),
    ),
  ]);

  const activeWorkspaceId = appStateSessionToActiveWorkspaceId(session, workspaces);
  const recentCanvasesByWorkspace = Object.fromEntries(recentCanvasesByWorkspaceEntries);
  const lastActiveCanvases = {
    ...recentCanvasesToLastActiveCanvasMap(recentCanvasesByWorkspace),
    ...sanitizeLastActiveCanvasMap(preferenceToLastActiveCanvasMap(lastActivePreference), workspaces),
  };

  return {
    workspaces,
    activeWorkspaceId,
    lastActiveCanvases,
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
    canvasCount: input.canvasCount,
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

export function updateWorkspaceFromProbe(
  current: RegisteredWorkspace,
  probe: WorkspaceProbeResponse,
): RegisteredWorkspace {
  return {
    ...current,
    name: probe.workspaceName,
    rootPath: probe.rootPath,
    status: probe.health.state,
    canvasCount: probe.canvasCount,
    lastModifiedAt: probe.lastModifiedAt,
  };
}

export function buildSidebarCanvases(
  _rootPath: string,
  canvases: WorkspaceCanvasSummary[],
): WorkspaceSidebarCanvas[] {
  return canvases
    .filter((canvas): canvas is WorkspaceCanvasSummary & { canvasId: string } => (
      typeof canvas.canvasId === 'string' && canvas.canvasId.length > 0
    ))
    .map((canvas) => ({
      canvasId: canvas.canvasId,
      ...(typeof canvas.workspaceId === 'string' ? { workspaceId: canvas.workspaceId } : {}),
      ...(canvas.latestRevision !== undefined ? { latestRevision: canvas.latestRevision } : {}),
      title: typeof canvas.title === 'string' ? canvas.title : '',
    }));
}

export function normalizeWorkspaceCanvasPath(
  _rootPath: string | null | undefined,
  canvasId: string,
): string {
  return canvasId.trim();
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
