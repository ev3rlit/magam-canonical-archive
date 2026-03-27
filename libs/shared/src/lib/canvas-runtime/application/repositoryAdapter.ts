import type { HeadlessServiceContext } from '../../canonical-cli';
import type {
  CanvasNodeRecord,
  CanvasRevisionRecord,
  PluginInstanceResolution,
} from '../../canonical-persistence';
import type { RuntimeWorkspaceCanvasShell } from '../../canonical-query/workspace-canvas';
import { getRuntimeWorkspaceCanvasShell } from '../../canonical-query/workspace-canvas';
import type {
  CanvasRuntimeRepositoryPort,
  RuntimeCanvasNodeRecord,
  RuntimeCanvasRevisionRecord,
  RuntimeCanvasShellRecord,
  RuntimePluginInstanceResolution,
} from './repositoryPorts';

function toRevisionRecord(record: CanvasRevisionRecord): RuntimeCanvasRevisionRecord {
  return {
    ...record,
  };
}

function toCanvasNodeRecord(record: CanvasNodeRecord): RuntimeCanvasNodeRecord {
  return {
    ...record,
  };
}

function toCanvasShellRecord(record: RuntimeWorkspaceCanvasShell): RuntimeCanvasShellRecord {
  return {
    canvasId: record.canvasId,
    workspaceId: record.workspaceId,
    title: record.title,
    latestRevision: record.latestRevision,
  };
}

function toPluginResolution(record: PluginInstanceResolution): RuntimePluginInstanceResolution {
  return {
    instance: {
      ...record.instance,
    },
    pluginExport: {
      ...record.pluginExport,
      propSchema: record.pluginExport.propSchema as unknown as Record<string, unknown>,
      bindingSchema: record.pluginExport.bindingSchema as unknown as Record<string, unknown>,
      capabilities: { ...record.pluginExport.capabilities },
    },
    pluginVersion: {
      ...record.pluginVersion,
      manifest: record.pluginVersion.manifest as unknown as Record<string, unknown>,
      status: record.pluginVersion.status,
    },
    pluginPackage: {
      ...record.pluginPackage,
      ownerKind: record.pluginPackage.ownerKind,
    },
    permissions: record.permissions.map((permission) => ({
      ...permission,
      permissionValue: permission.permissionValue,
    })),
  };
}

export function createCanvasRuntimeRepositoryAdapter(
  headless: HeadlessServiceContext,
): CanvasRuntimeRepositoryPort {
  return {
    getCanonicalObject: (workspaceId, id) => headless.repository.getCanonicalObject(workspaceId, id),
    listCanonicalObjects: (workspaceId) => headless.repository.listCanonicalObjects(workspaceId),
    upsertCanonicalObject: (record) => headless.repository.upsertCanonicalObject(record),
    tombstoneCanonicalObject: (workspaceId, id) => headless.repository.tombstoneCanonicalObject(workspaceId, id),
    renameCanonicalObject: (input) => headless.repository.renameCanonicalObject(input),
    deleteObjectRelationsByObjectId: (input) => headless.repository.deleteObjectRelationsByObjectId(input),
    createCanvasNode: async (record) => headless.repository.createCanvasNode(record),
    updateCanvasNode: async (record) => headless.repository.updateCanvasNode(record),
    renameCanvasNode: (input) => headless.repository.renameCanvasNode(input),
    deleteCanvasNode: (canvasId, nodeId) => headless.repository.deleteCanvasNode(canvasId, nodeId),
    async getCanvasNode(canvasId, id) {
      const result = await headless.repository.getCanvasNode(canvasId, id);
      return result.ok
        ? { ok: true, value: toCanvasNodeRecord(result.value) }
        : result;
    },
    async listCanvasNodes(canvasId, surfaceId) {
      const rows = await headless.repository.listCanvasNodes(canvasId, surfaceId);
      return rows.map(toCanvasNodeRecord);
    },
    getNextCanvasNodeZIndex: (canvasId, surfaceId) => headless.repository.getNextCanvasNodeZIndex(canvasId, surfaceId),
    async resolvePluginInstance(id) {
      const result = await headless.repository.resolvePluginInstance(id);
      return result.ok
        ? { ok: true, value: toPluginResolution(result.value) }
        : result;
    },
    async appendCanvasRevision(record) {
      const result = await headless.repository.appendCanvasRevision(record);
      return result.ok
        ? { ok: true, value: toRevisionRecord(result.value) }
        : result;
    },
    async listCanvasRevisions(canvasId) {
      const rows = await headless.repository.listCanvasRevisions(canvasId);
      return rows.map(toRevisionRecord);
    },
    getLatestCanvasRevision: (canvasId) => headless.repository.getLatestCanvasRevision(canvasId),
    async getCanvasShell(canvasId, workspaceId) {
      const canvas = await getRuntimeWorkspaceCanvasShell(headless, canvasId, workspaceId);
      return toCanvasShellRecord(canvas);
    },
  };
}
