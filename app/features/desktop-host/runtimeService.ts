import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  AppStatePersistenceRepository,
  buildCanonicalRenderResponse,
  buildEditingProjection,
  buildHierarchyProjection,
  buildRenderProjection,
  CanonicalPersistenceRepository,
  createAppStatePgliteDb,
  createCanvasRuntimeServiceContext,
  createCanonicalPgliteDb,
  createCanvasSourceVersion,
  dispatchCanvasMutation,
  executeMutationBatch,
  getCurrentCanvasRevision,
  getWorkspaceCanvas,
  isCanonicalCliError,
  listCanonicalCanvases,
  readCanvasRuntimeSnapshot,
  redoCanvasMutation,
  undoCanvasMutation,
  requireWorkspaceRoot,
  type CanvasRedoRequestV1,
  type CanvasUndoRequestV1,
  type HeadlessServiceContext,
  type PluginInstanceResolution,
  type WorkspaceProbeResult,
} from '../../../libs/shared/src';
import { ApiError, ensureWorkspaceRoot, probeWorkspace } from '../../../libs/shared/src/lib/workspace-shell';
import type { CanonicalPgliteHandle, NodeVersionRecord } from '../../../libs/shared/src/lib/canonical-persistence';
import type { HostAppEvent } from '@/features/host/contracts';

type ActiveWorkspaceRuntime = {
  handle: CanonicalPgliteHandle;
  repository: CanonicalPersistenceRepository;
  rootPath: string;
  workspaceId: string;
  unsubscribe: (() => Promise<void>) | null;
};

function sanitizeWorkspaceId(targetDir: string): string {
  const base = path.basename(path.resolve(targetDir)).trim() || 'workspace';
  const sanitized = base
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized || 'workspace';
}

function createWorkspaceRuntimeChannel(workspaceId: string): string {
  return `workspace_runtime_${workspaceId.toLowerCase().replace(/[^a-z0-9_]+/g, '_')}`;
}

function createVersionToken(input: Record<string, unknown>): string {
  return createCanvasSourceVersion(JSON.stringify({
    ...input,
    nonce: randomUUID(),
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ApiError(400, 'DESKTOP_RUNTIME_INVALID_ARGUMENT', `${fieldName} is required`);
  }
  return value.trim();
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function toAppStateValue<T>(value: T): T {
  return value;
}

function toWorkspaceProbeResponse(workspace: WorkspaceProbeResult) {
  return {
    code: workspace.health.status === 'ok' ? 'WS_200_HEALTHY' : 'WS_200_PROBED',
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

function toCanvasesResponse(input: {
  workspace: WorkspaceProbeResult;
  canvases: Awaited<ReturnType<typeof listCanonicalCanvases>>;
}) {
  return {
    code: 'DOC_200_LISTED',
    rootPath: input.workspace.rootPath,
    root: input.workspace.rootPath,
    workspaceName: input.workspace.workspaceName,
    name: input.workspace.workspaceName,
    health: {
      state: input.workspace.health.status,
      message: input.workspace.health.message,
      canvasCount: input.canvases.length,
    },
    canvasCount: input.canvases.length,
    canvases: input.canvases.map((canvas) => ({
      canvasId: canvas.canvasId,
      workspaceId: canvas.workspaceId,
      title: canvas.title,
      modifiedAt: canvas.updatedAt?.getTime() ?? canvas.createdAt?.getTime() ?? null,
      latestRevision: canvas.latestRevision,
    })),
    lastModifiedAt: input.canvases.reduce<number | null>((latest, canvas) => {
      const timestamp = canvas.updatedAt?.getTime() ?? canvas.createdAt?.getTime() ?? null;
      if (timestamp === null) {
        return latest;
      }
      return latest === null ? timestamp : Math.max(latest, timestamp);
    }, null),
  };
}

async function resolvePluginByNodeId(input: {
  repository: CanonicalPersistenceRepository;
  nodes: Awaited<ReturnType<CanonicalPersistenceRepository['listCanvasNodes']>>;
}): Promise<Map<string, PluginInstanceResolution>> {
  const pluginByNodeId = new Map<string, PluginInstanceResolution>();
  await Promise.all(
    input.nodes
      .filter((node) => node.nodeKind === 'plugin' && typeof node.pluginInstanceId === 'string')
      .map(async (node) => {
        const resolved = await input.repository.resolvePluginInstance(node.pluginInstanceId as string);
        if (resolved.ok) {
          pluginByNodeId.set(node.id, resolved.value);
        }
      }),
  );
  return pluginByNodeId;
}

export interface DesktopRuntimeServiceConfig {
  appStateDbPath: string;
  eventSink?: (event: HostAppEvent) => void;
  repoRoot: string;
}

export class DesktopRuntimeService {
  private readonly appStateRepository: AppStatePersistenceRepository;

  private readonly appStateHandlePromise: Promise<Awaited<ReturnType<typeof createAppStatePgliteDb>>>;

  private activeWorkspace: ActiveWorkspaceRuntime | null = null;

  private readonly eventSink?: (event: HostAppEvent) => void;

  constructor(
    private readonly config: DesktopRuntimeServiceConfig,
    appStateRepository: AppStatePersistenceRepository,
    appStateHandlePromise: Promise<Awaited<ReturnType<typeof createAppStatePgliteDb>>>,
  ) {
    this.appStateRepository = appStateRepository;
    this.appStateHandlePromise = appStateHandlePromise;
    this.eventSink = config.eventSink;
  }

  static async create(config: DesktopRuntimeServiceConfig): Promise<DesktopRuntimeService> {
    const handlePromise = createAppStatePgliteDb(config.repoRoot, {
      dataDir: config.appStateDbPath,
      runMigrations: true,
    });
    const handle = await handlePromise;
    return new DesktopRuntimeService(
      config,
      new AppStatePersistenceRepository(handle.db),
      Promise.resolve(handle),
    );
  }

  async close(): Promise<void> {
    await this.closeActiveWorkspace();
    const appStateHandle = await this.appStateHandlePromise;
    await appStateHandle.close();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.appStateRepository.getWorkspaceSession();
      return true;
    } catch {
      return false;
    }
  }

  async setActiveWorkspace(rootPath: string | null): Promise<void> {
    const nextRootPath = rootPath ? path.resolve(rootPath) : null;
    if (this.activeWorkspace?.rootPath === nextRootPath) {
      return;
    }

    await this.closeActiveWorkspace();
    if (!nextRootPath) {
      return;
    }

    const workspace = await requireWorkspaceRoot(nextRootPath);
    const handle = await createCanonicalPgliteDb(workspace.rootPath, { runMigrations: true });
    const repository = new CanonicalPersistenceRepository(handle.db);
    const workspaceId = sanitizeWorkspaceId(workspace.rootPath);
    const channel = createWorkspaceRuntimeChannel(workspaceId);
    const unsubscribe = await handle.client.listen(channel, (payload) => {
      let canvasId: string | null | undefined;
      try {
        const parsed = JSON.parse(payload);
        canvasId = typeof parsed.canvasId === 'string' ? parsed.canvasId : null;
      } catch {
        canvasId = null;
      }
      this.eventSink?.({
        type: 'workspace-runtime-invalidated',
        workspaceId,
        ...(canvasId !== undefined ? { canvasId } : {}),
      });
    });

    this.activeWorkspace = {
      handle,
      repository,
      rootPath: workspace.rootPath,
      workspaceId,
      unsubscribe,
    };

    await this.ensureWorkspaceRuntimeVersion(this.activeWorkspace);
  }

  async invoke(method: string, payload?: unknown): Promise<unknown> {
    switch (method) {
      case 'appState.workspaces.list':
        return this.appStateRepository.listWorkspaces();
      case 'appState.workspaces.upsert':
        return this.appStateRepository.upsertWorkspace(toAppStateValue(payload as Parameters<AppStatePersistenceRepository['upsertWorkspace']>[0]));
      case 'appState.workspaces.remove':
        return this.appStateRepository.removeWorkspace(readString((payload as { workspaceId?: unknown } | undefined)?.workspaceId, 'workspaceId'));
      case 'appState.session.get':
        return this.appStateRepository.getWorkspaceSession();
      case 'appState.session.set':
        return this.appStateRepository.setWorkspaceSession(toAppStateValue(payload as Parameters<AppStatePersistenceRepository['setWorkspaceSession']>[0]));
      case 'appState.recentCanvases.list':
        return this.appStateRepository.listRecentCanvases(readString((payload as { workspaceId?: unknown } | undefined)?.workspaceId, 'workspaceId'));
      case 'appState.recentCanvases.upsert':
        return this.appStateRepository.upsertRecentCanvas(toAppStateValue(payload as Parameters<AppStatePersistenceRepository['upsertRecentCanvas']>[0]));
      case 'appState.recentCanvases.clear':
        return this.appStateRepository.clearRecentCanvases(readString((payload as { workspaceId?: unknown } | undefined)?.workspaceId, 'workspaceId'));
      case 'appState.preferences.get':
        return this.appStateRepository.getPreference(readString((payload as { key?: unknown } | undefined)?.key, 'key'));
      case 'appState.preferences.set':
        return this.appStateRepository.setPreference(toAppStateValue(payload as Parameters<AppStatePersistenceRepository['setPreference']>[0]));
      case 'workspace.probe':
        return this.workspaceProbe(payload);
      case 'workspace.ensure':
        return this.workspaceEnsure(payload);
      case 'workspace.canvases.list':
        return this.workspaceCanvasesList(payload);
      case 'workspace.canvas.create':
        return this.workspaceCanvasCreate(payload);
      case 'render.generate':
        return this.renderGenerate(payload);
      case 'sync.watch':
        return this.syncWatch(payload);
      case 'canvas.runtime.projections':
        return this.runtimeProjections(payload);
      case 'canvas.runtime.mutate':
        return this.runtimeMutate(payload);
      case 'canvas.runtime.undo':
        return this.runtimeUndo(payload);
      case 'canvas.runtime.redo':
        return this.runtimeRedo(payload);
      case 'node.update':
        return this.nodeUpdate(payload);
      default:
        throw new ApiError(404, 'DESKTOP_RUNTIME_METHOD_NOT_FOUND', `Unsupported desktop runtime method: ${method}`);
    }
  }

  private async workspaceProbe(payload: unknown) {
    const rootPath = readOptionalString((payload as { rootPath?: unknown; root?: unknown } | undefined)?.rootPath)
      ?? readOptionalString((payload as { rootPath?: unknown; root?: unknown } | undefined)?.root)
      ?? this.activeWorkspace?.rootPath
      ?? process.cwd();
    return toWorkspaceProbeResponse(await probeWorkspace(rootPath));
  }

  private async workspaceEnsure(payload: unknown) {
    const rootPath = readString((payload as { rootPath?: unknown } | undefined)?.rootPath, 'rootPath');
    const ensured = await ensureWorkspaceRoot(rootPath);
    await this.setActiveWorkspace(ensured.rootPath);
    return toWorkspaceProbeResponse(ensured);
  }

  private async workspaceCanvasesList(payload: unknown) {
    const rootPath = readString((payload as { rootPath?: unknown } | undefined)?.rootPath, 'rootPath');
    const runtime = await this.ensureWorkspaceRuntime(rootPath);
    const workspace = await requireWorkspaceRoot(runtime.rootPath);
    const canvases = await listCanonicalCanvases({
      targetDir: runtime.rootPath,
      workspaceId: runtime.workspaceId,
    });
    return toCanvasesResponse({ workspace, canvases });
  }

  private async workspaceCanvasCreate(payload: unknown) {
    const input = isRecord(payload) ? payload : {};
    const rootPath = readString(input.rootPath, 'rootPath');
    const runtime = await this.ensureWorkspaceRuntime(rootPath);
    const canvasId = readOptionalString(input.canvasId) ?? `doc-${randomUUID()}`;
    const title = readOptionalString(input.title) ?? null;
    const revisionNo = (await getCurrentCanvasRevision(this.toHeadlessContext(runtime), canvasId)) + 1;
    const createdAt = new Date();

    const appended = await runtime.repository.appendCanvasRevision({
      id: `docrev-${randomUUID()}`,
      canvasId,
      revisionNo,
      authorKind: 'system',
      authorId: 'desktop-main-runtime',
      mutationBatch: {
        op: 'canvas.create',
        canvasShell: {
          workspaceId: runtime.workspaceId,
          title,
          createdAt: createdAt.toISOString(),
        },
      },
      createdAt,
    });
    if (!appended.ok) {
      throw new Error(appended.message);
    }

    await runtime.repository.upsertCanvasMetadataVersion({
      workspaceId: runtime.workspaceId,
      canvasId,
      metadataRevisionNo: 1,
      versionToken: createVersionToken({ workspaceId: runtime.workspaceId, canvasId, target: 'canvas-metadata' }),
    });
    await this.touchWorkspaceInvalidation(runtime, { canvasId });

    const created = await getWorkspaceCanvas(this.toHeadlessContext(runtime), canvasId, runtime.workspaceId);
    return {
      code: 'DOC_201_CREATED',
      rootPath: runtime.rootPath,
      root: runtime.rootPath,
      workspaceName: path.basename(runtime.rootPath),
      created: true,
      canvasId: created.canvasId,
      workspaceId: created.workspaceId,
      title: created.title,
      modifiedAt: created.updatedAt?.getTime() ?? created.createdAt?.getTime() ?? null,
      latestRevision: created.latestRevision,
      sourceVersion: createVersionToken({
        canvasId: created.canvasId,
        workspaceId: created.workspaceId,
        latestRevision: created.latestRevision,
      }),
    };
  }

  private async renderGenerate(payload: unknown) {
    const input = isRecord(payload) ? payload : {};
    const rootPath = readOptionalString(input.rootPath) ?? this.activeWorkspace?.rootPath ?? process.cwd();
    const canvasId = readString(input.canvasId, 'canvasId');
    const runtime = await this.ensureWorkspaceRuntime(rootPath);
    await this.ensureCanvasRuntimeRecords(runtime, canvasId);

    const headless = this.toHeadlessContext(runtime);
    const canvas = await getWorkspaceCanvas(headless, canvasId, runtime.workspaceId);
    const nodes = await runtime.repository.listCanvasNodes(canvasId);
    const objectIds = nodes
      .map((node) => node.canonicalObjectId)
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
    const objects = await runtime.repository.listCanonicalObjects(canvas.workspaceId);
    const objectsById = new Map(
      objects
        .filter((record) => objectIds.includes(record.id))
        .map((record) => [record.id, record]),
    );
    const pluginByNodeId = await resolvePluginByNodeId({
      repository: runtime.repository,
      nodes,
    });
    const response = buildCanonicalRenderResponse({
      canvasId,
      title: canvas.title,
      latestRevision: canvas.latestRevision,
      nodes,
      objectsById,
      pluginByNodeId,
    });
    const runtimeSnapshot = await readCanvasRuntimeSnapshot({
      runtimeContext: createCanvasRuntimeServiceContext(headless),
      canvasId,
      workspaceId: canvas.workspaceId,
      title: canvas.title,
      latestRevision: canvas.latestRevision,
    });

    return {
      ...response,
      renderProjection: runtimeSnapshot.renderProjection,
      editingProjection: runtimeSnapshot.editingProjection,
    };
  }

  private async syncWatch(payload: unknown) {
    const input = isRecord(payload) ? payload : {};
    const rootPath = readOptionalString(input.rootPath) ?? this.activeWorkspace?.rootPath;
    const canvasId = readString(input.canvasId, 'canvasId');
    const runtime = await this.ensureWorkspaceRuntime(rootPath ?? undefined);
    await this.ensureCanvasRuntimeRecords(runtime, canvasId);

    return {
      workspaceId: runtime.workspaceId,
      canvasId,
      workspaceRuntimeVersion: await runtime.repository.getWorkspaceRuntimeVersion(runtime.workspaceId),
      canvasMetadataVersion: await runtime.repository.getCanvasMetadataVersion(runtime.workspaceId, canvasId),
      nodeVersions: await runtime.repository.listNodeVersions(runtime.workspaceId, canvasId),
    };
  }

  private async runtimeProjections(payload: unknown) {
    const input = isRecord(payload) ? payload : {};
    const rootPath = readOptionalString(input.rootPath) ?? this.activeWorkspace?.rootPath;
    const canvasId = readString(input.canvasId, 'canvasId');
    const runtime = await this.ensureWorkspaceRuntime(rootPath ?? undefined);
    await this.ensureCanvasRuntimeRecords(runtime, canvasId);
    const runtimeContext = createCanvasRuntimeServiceContext(this.toHeadlessContext(runtime));
    const workspaceId = readOptionalString(input.workspaceId) ?? runtime.workspaceId;
    const surfaceId = readOptionalString(input.surfaceId);
    const nodeIds = Array.isArray(input.nodeIds)
      ? input.nodeIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : undefined;

    const [hierarchyProjection, renderProjection, editingProjection] = await Promise.all([
      buildHierarchyProjection(runtimeContext, {
        canvasId,
        workspaceId,
        ...(surfaceId ? { surfaceId } : {}),
      }),
      buildRenderProjection(runtimeContext, {
        canvasId,
        workspaceId,
        ...(surfaceId ? { surfaceId } : {}),
      }),
      buildEditingProjection(runtimeContext, {
        canvasId,
        workspaceId,
        ...(surfaceId ? { surfaceId } : {}),
        ...(nodeIds && nodeIds.length > 0 ? { nodeIds } : {}),
      }),
    ]);

    return {
      canvasId,
      hierarchyProjection,
      renderProjection,
      editingProjection,
    };
  }

  private async runtimeMutate(payload: unknown) {
    const input = isRecord(payload) ? payload : {};
    const runtime = await this.ensureWorkspaceRuntime(readOptionalString(input.rootPath) ?? this.activeWorkspace?.rootPath ?? undefined);
    const batchRecord = isRecord(input.batch) ? input.batch : {};
    const canvasId = readString(input.canvasId ?? batchRecord.canvasId, 'canvasId');
    await this.ensureCanvasRuntimeRecords(runtime, canvasId);
    const runtimeContext = createCanvasRuntimeServiceContext(this.toHeadlessContext(runtime));
    const batch = {
      workspaceId: readOptionalString(batchRecord.workspaceId) ?? runtime.workspaceId,
      canvasId,
      actor: isRecord(batchRecord.actor)
        ? {
            kind: readString(batchRecord.actor.kind, 'batch.actor.kind') as 'user' | 'agent' | 'system',
            id: readString(batchRecord.actor.id, 'batch.actor.id'),
          }
        : undefined,
      sessionId: readOptionalString(batchRecord.sessionId),
      reason: readOptionalString(batchRecord.reason),
      dryRun: batchRecord.dryRun === true,
      preconditions: isRecord(batchRecord.preconditions) && typeof batchRecord.preconditions.canvasRevision === 'number'
        ? { canvasRevision: batchRecord.preconditions.canvasRevision }
        : undefined,
      commands: Array.isArray(batchRecord.commands) ? batchRecord.commands as Parameters<typeof dispatchCanvasMutation>[1]['commands'] : [],
    };

    const mutation = await dispatchCanvasMutation(runtimeContext, batch);
    if (mutation.envelope.ok && !mutation.envelope.data.dryRun) {
      await this.afterCommittedMutation(runtime, {
        canvasId,
        mutationId: mutation.envelope.data.mutationId,
        changedNodeIds: mutation.envelope.data.changed.nodes,
        mutationSource: this.resolveMutationSource(batch.actor?.kind),
        appliedById: batch.actor?.id ?? 'desktop-main-runtime',
        appliedByKind: batch.actor?.kind ?? 'system',
      });
    }

    return {
      success: mutation.envelope.ok,
      canvasId,
      commandId: readOptionalString(input.commandId) ?? randomUUID(),
      runtimeResult: mutation.envelope,
    };
  }

  private async runtimeUndo(payload: unknown) {
    const input = isRecord(payload) ? payload : {};
    const runtime = await this.ensureWorkspaceRuntime(readOptionalString(input.rootPath) ?? this.activeWorkspace?.rootPath ?? undefined);
    const request: CanvasUndoRequestV1 = {
      canvasId: readString(input.canvasId, 'canvasId'),
      actorId: readString(input.actorId, 'actorId'),
      sessionId: readString(input.sessionId, 'sessionId'),
    };
    const runtimeContext = createCanvasRuntimeServiceContext(this.toHeadlessContext(runtime));
    const mutation = await undoCanvasMutation(runtimeContext, request);
    if (mutation.envelope.ok) {
      await this.afterCommittedMutation(runtime, {
        canvasId: request.canvasId,
        mutationId: mutation.envelope.data.mutationId,
        changedNodeIds: mutation.envelope.data.changed.nodes,
        mutationSource: 'ui',
        appliedById: request.actorId,
        appliedByKind: 'user',
      });
    }
    return {
      success: mutation.envelope.ok,
      canvasId: request.canvasId,
      commandId: readOptionalString(input.commandId) ?? randomUUID(),
      runtimeResult: mutation.envelope,
    };
  }

  private async runtimeRedo(payload: unknown) {
    const input = isRecord(payload) ? payload : {};
    const runtime = await this.ensureWorkspaceRuntime(readOptionalString(input.rootPath) ?? this.activeWorkspace?.rootPath ?? undefined);
    const request: CanvasRedoRequestV1 = {
      canvasId: readString(input.canvasId, 'canvasId'),
      actorId: readString(input.actorId, 'actorId'),
      sessionId: readString(input.sessionId, 'sessionId'),
    };
    const runtimeContext = createCanvasRuntimeServiceContext(this.toHeadlessContext(runtime));
    const mutation = await redoCanvasMutation(runtimeContext, request);
    if (mutation.envelope.ok) {
      await this.afterCommittedMutation(runtime, {
        canvasId: request.canvasId,
        mutationId: mutation.envelope.data.mutationId,
        changedNodeIds: mutation.envelope.data.changed.nodes,
        mutationSource: 'ui',
        appliedById: request.actorId,
        appliedByKind: 'user',
      });
    }
    return {
      success: mutation.envelope.ok,
      canvasId: request.canvasId,
      commandId: readOptionalString(input.commandId) ?? randomUUID(),
      runtimeResult: mutation.envelope,
    };
  }

  private async nodeUpdate(payload: unknown) {
    const input = isRecord(payload) ? payload : {};
    const runtime = await this.ensureWorkspaceRuntime(readOptionalString(input.rootPath) ?? this.activeWorkspace?.rootPath ?? undefined);
    const canvasId = readString(input.canvasId, 'canvasId');
    const nodeId = readString(input.nodeId, 'nodeId');
    const props = isRecord(input.props) ? input.props : {};
    const commandType = readOptionalString(input.commandType);
    const originId = readOptionalString(input.originId) ?? 'desktop-main-runtime';
    const commandId = readOptionalString(input.commandId) ?? randomUUID();

    const operations = await this.buildNodeUpdateOperations(runtime, {
      canvasId,
      nodeId,
      props,
      commandType,
    });
    const result = await executeMutationBatch({
      context: this.toHeadlessContext(runtime),
      batch: {
        workspaceRef: runtime.workspaceId,
        canvasRef: canvasId,
        actor: {
          kind: 'user',
          id: originId,
        },
        operations,
      },
    });
    await this.afterCommittedMutation(runtime, {
      canvasId,
      mutationId: result.mutationId,
      changedNodeIds: result.changed.nodes,
      mutationSource: 'ui',
      appliedById: originId,
      appliedByKind: 'user',
    });

    return {
      success: true,
      newVersion: createVersionToken({
        canvasId,
        workspaceId: runtime.workspaceId,
        latestRevision: result.canvasRevisionAfter,
      }),
      commandId,
      canvasId,
    };
  }

  private async closeActiveWorkspace(): Promise<void> {
    if (!this.activeWorkspace) {
      return;
    }

    await this.activeWorkspace.unsubscribe?.();
    await this.activeWorkspace.handle.close();
    this.activeWorkspace = null;
  }

  private async ensureWorkspaceRuntime(rootPath?: string): Promise<ActiveWorkspaceRuntime> {
    const nextRootPath = rootPath ? path.resolve(rootPath) : this.activeWorkspace?.rootPath ?? null;
    if (!nextRootPath) {
      throw new ApiError(400, 'DESKTOP_RUNTIME_NO_WORKSPACE', 'Workspace root is not selected.');
    }

    if (!this.activeWorkspace || this.activeWorkspace.rootPath !== nextRootPath) {
      await this.setActiveWorkspace(nextRootPath);
    }

    return this.activeWorkspace!;
  }

  private toHeadlessContext(runtime: ActiveWorkspaceRuntime): HeadlessServiceContext {
    return {
      db: runtime.handle.db,
      repository: runtime.repository,
      targetDir: runtime.rootPath,
      dataDir: runtime.handle.dataDir,
      defaultWorkspaceId: runtime.workspaceId,
    };
  }

  private async ensureWorkspaceRuntimeVersion(runtime: ActiveWorkspaceRuntime) {
    const existing = await runtime.repository.getWorkspaceRuntimeVersion(runtime.workspaceId);
    if (!existing) {
      await runtime.repository.upsertWorkspaceRuntimeVersion({
        workspaceId: runtime.workspaceId,
        versionToken: createVersionToken({ workspaceId: runtime.workspaceId, target: 'workspace-runtime' }),
      });
    }
  }

  private async ensureCanvasRuntimeRecords(runtime: ActiveWorkspaceRuntime, canvasId: string) {
    await this.ensureWorkspaceRuntimeVersion(runtime);
    const metadata = await runtime.repository.getCanvasMetadataVersion(runtime.workspaceId, canvasId);
    if (!metadata) {
      await runtime.repository.upsertCanvasMetadataVersion({
        workspaceId: runtime.workspaceId,
        canvasId,
        metadataRevisionNo: 0,
        versionToken: createVersionToken({ workspaceId: runtime.workspaceId, canvasId, target: 'canvas-metadata' }),
      });
    }

    const nodes = await runtime.repository.listCanvasNodes(canvasId);
    await Promise.all(nodes.map(async (node) => {
      const existing = await runtime.repository.getNodeVersion(runtime.workspaceId, canvasId, node.id);
      if (existing) {
        return;
      }
      await runtime.repository.upsertNodeVersion({
        workspaceId: runtime.workspaceId,
        canvasId,
        nodeId: node.id,
        objectId: node.canonicalObjectId ?? null,
        headRevisionNo: 0,
        versionToken: createVersionToken({ workspaceId: runtime.workspaceId, canvasId, nodeId: node.id }),
        lastMutationBatchId: 'bootstrap',
        lastMutationSource: 'system',
        lastAppliedById: 'desktop-main-runtime',
        lastAppliedByKind: 'system',
      });
    }));
  }

  private resolveMutationSource(actorKind: string | undefined): 'ui' | 'cli' | 'system' {
    if (actorKind === 'agent') {
      return 'cli';
    }
    if (actorKind === 'system') {
      return 'system';
    }
    return 'ui';
  }

  private async buildNodeUpdateOperations(
    runtime: ActiveWorkspaceRuntime,
    input: {
      canvasId: string;
      commandType?: string;
      nodeId: string;
      props: Record<string, unknown>;
    },
  ) {
    if (input.commandType === 'node.rename') {
      return [{
        op: 'canvas.node.rename' as const,
        nodeId: input.nodeId,
        nextNodeId: readString(input.props.id, 'props.id'),
      }];
    }

    if (input.commandType === 'node.z-order.update') {
      if (typeof input.props.zIndex !== 'number') {
        throw new ApiError(400, 'DESKTOP_RUNTIME_INVALID_ARGUMENT', 'props.zIndex must be a number');
      }
      return [{
        op: 'canvas.node.z-order.update' as const,
        nodeId: input.nodeId,
        zIndex: input.props.zIndex,
      }];
    }

    return [{
      op: 'canvas.node.update' as const,
      nodeId: input.nodeId,
      propsPatch: input.props,
    }];
  }

  private async afterCommittedMutation(
    runtime: ActiveWorkspaceRuntime,
    input: {
      appliedById: string;
      appliedByKind: string;
      canvasId: string;
      changedNodeIds: string[];
      mutationId: string;
      mutationSource: 'ui' | 'cli' | 'system';
    },
  ) {
    for (const nodeId of new Set(input.changedNodeIds)) {
      const node = await runtime.repository.getCanvasNode(input.canvasId, nodeId);
      if (!node.ok) {
        await runtime.repository.deleteNodeVersion(runtime.workspaceId, input.canvasId, nodeId);
        continue;
      }
      const previous = await runtime.repository.getNodeVersion(runtime.workspaceId, input.canvasId, nodeId);
      await runtime.repository.upsertNodeVersion({
        workspaceId: runtime.workspaceId,
        canvasId: input.canvasId,
        nodeId,
        objectId: node.value.canonicalObjectId ?? null,
        headRevisionNo: (previous?.headRevisionNo ?? 0) + 1,
        versionToken: createVersionToken({
          workspaceId: runtime.workspaceId,
          canvasId: input.canvasId,
          nodeId,
          mutationId: input.mutationId,
        }),
        lastMutationBatchId: input.mutationId,
        lastMutationSource: input.mutationSource,
        lastAppliedById: input.appliedById,
        lastAppliedByKind: input.appliedByKind,
      });
    }

    await this.touchWorkspaceInvalidation(runtime, { canvasId: input.canvasId });
  }

  private async touchWorkspaceInvalidation(
    runtime: ActiveWorkspaceRuntime,
    input?: { canvasId?: string | null },
  ) {
    const record = await runtime.repository.upsertWorkspaceRuntimeVersion({
      workspaceId: runtime.workspaceId,
      versionToken: createVersionToken({
        workspaceId: runtime.workspaceId,
        canvasId: input?.canvasId ?? null,
        target: 'workspace-runtime',
      }),
    });
    const channel = createWorkspaceRuntimeChannel(runtime.workspaceId);
    await runtime.handle.client.query(
      'select pg_notify($1, $2) as notified',
      [
        channel,
        JSON.stringify({
          workspaceId: runtime.workspaceId,
          canvasId: input?.canvasId ?? null,
          versionToken: record.versionToken,
        }),
      ],
    );
  }
}

export function serializeDesktopRpcError(error: unknown): {
  code?: number | string;
  data?: unknown;
  message: string;
} {
  if (error instanceof ApiError) {
    return {
      code: error.code,
      message: error.message,
      data: error.details,
    };
  }

  if (isCanonicalCliError(error)) {
    return {
      code: error.code,
      message: error.message,
      data: error.details,
    };
  }

  const typed = error as { code?: number | string; data?: unknown; message?: unknown };
  return {
    ...(typed.code !== undefined ? { code: typed.code } : {}),
    ...(typed.data !== undefined ? { data: typed.data } : {}),
    message: typeof typed.message === 'string'
      ? typed.message
      : error instanceof Error
        ? error.message
        : 'Unknown desktop runtime error',
  };
}
