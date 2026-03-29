import type { CanonicalObjectRecord, ContentBlock } from '../../canonical-object-contract';
import type {
  PersistenceResult,
} from '../../canonical-persistence';
import type { CanvasHistoryEntryV1 } from '../contracts';

export interface RuntimeCanvasNodeRecord {
  id: string;
  canvasId: string;
  surfaceId: string;
  nodeKind: 'native' | 'plugin' | 'binding-proxy';
  nodeType?: string | null;
  parentNodeId?: string | null;
  canonicalObjectId?: string | null;
  pluginInstanceId?: string | null;
  props?: Record<string, unknown> | null;
  layout: Record<string, unknown>;
  style?: Record<string, unknown> | null;
  persistedState?: Record<string, unknown> | null;
  zIndex: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type RuntimeCanonicalObjectRecord = CanonicalObjectRecord;

export interface RuntimeCanvasRevisionRecord {
  id: string;
  canvasId: string;
  revisionNo: number;
  authorKind: 'user' | 'agent' | 'system';
  authorId: string;
  sessionId?: string | null;
  mutationBatch: Record<string, unknown>;
  runtimeHistory?: RuntimeStoredCanvasHistoryRecord | null;
  snapshotRef?: string | null;
  createdAt?: Date;
}

export interface RuntimeStoredCanvasHistoryRecord {
  kind: 'mutation' | 'undo' | 'redo';
  sourceRevisionNo?: number | null;
  sourceHistoryEntryId?: string | null;
  entry: CanvasHistoryEntryV1;
}

export interface RuntimeCanvasHistoryCursorRecord {
  canvasId: string;
  actorId: string;
  sessionId: string;
  undoRevisionNo?: number | null;
  redoRevisionNo?: number | null;
  updatedAt?: Date;
}

export interface RuntimePluginInstanceResolution {
  instance: {
    id: string;
    canvasId: string;
    surfaceId: string;
    pluginExportId: string;
    pluginVersionId: string;
    displayName: string;
    props?: Record<string, unknown> | null;
    bindingConfig?: Record<string, unknown> | null;
    persistedState?: Record<string, unknown> | null;
    createdAt?: Date;
    updatedAt?: Date;
  };
  pluginExport: {
    id: string;
    pluginVersionId: string;
    exportName: string;
    componentKind: string;
    propSchema: Record<string, unknown>;
    bindingSchema: Record<string, unknown>;
    capabilities: Record<string, unknown>;
    createdAt?: Date;
  };
  pluginVersion: {
    id: string;
    pluginPackageId: string;
    version: string;
    manifest: Record<string, unknown>;
    bundleRef: string;
    integrityHash: string;
    status: Record<string, unknown> | string;
    createdAt?: Date;
  };
  pluginPackage: {
    id: string;
    workspaceId?: string | null;
    packageName: string;
    displayName: string;
    ownerKind: Record<string, unknown> | string;
    ownerId: string;
    createdAt?: Date;
    updatedAt?: Date;
  };
  permissions: Array<{
    id: string;
    pluginVersionId: string;
    permissionKey: string;
    permissionValue: Record<string, unknown>;
    createdAt?: Date;
  }>;
}

export type RuntimeContentBlockRecord = ContentBlock;

export interface RuntimeCanvasShellRecord {
  canvasId: string;
  workspaceId: string;
  title: string | null;
  latestRevision: number | null;
}

export interface CanvasRuntimeRepositoryPort {
  getCanonicalObject(workspaceId: string, id: string): Promise<PersistenceResult<RuntimeCanonicalObjectRecord>>;
  listCanonicalObjects(workspaceId: string): Promise<RuntimeCanonicalObjectRecord[]>;
  upsertCanonicalObject(record: RuntimeCanonicalObjectRecord): Promise<PersistenceResult<RuntimeCanonicalObjectRecord>>;
  tombstoneCanonicalObject(workspaceId: string, id: string): Promise<PersistenceResult<RuntimeCanonicalObjectRecord>>;
  renameCanonicalObject(input: {
    workspaceId: string;
    objectId: string;
    nextObjectId: string;
  }): Promise<PersistenceResult<RuntimeCanonicalObjectRecord>>;
  deleteObjectRelationsByObjectId(input: {
    workspaceId: string;
    objectId: string;
  }): Promise<void>;
  createCanvasNode(record: RuntimeCanvasNodeRecord): Promise<PersistenceResult<RuntimeCanvasNodeRecord>>;
  updateCanvasNode(record: RuntimeCanvasNodeRecord): Promise<PersistenceResult<RuntimeCanvasNodeRecord>>;
  renameCanvasNode(input: {
    canvasId: string;
    nodeId: string;
    nextNodeId: string;
  }): Promise<PersistenceResult<void>>;
  deleteCanvasNode(canvasId: string, nodeId: string): Promise<PersistenceResult<void>>;
  getCanvasNode(canvasId: string, id: string): Promise<PersistenceResult<RuntimeCanvasNodeRecord>>;
  listCanvasNodes(canvasId: string, surfaceId?: string): Promise<RuntimeCanvasNodeRecord[]>;
  getNextCanvasNodeZIndex(canvasId: string, surfaceId: string): Promise<number>;
  resolvePluginInstance(id: string): Promise<PersistenceResult<RuntimePluginInstanceResolution>>;
  appendCanvasRevision(record: RuntimeCanvasRevisionRecord): Promise<PersistenceResult<RuntimeCanvasRevisionRecord>>;
  listCanvasRevisions(canvasId: string): Promise<RuntimeCanvasRevisionRecord[]>;
  getLatestCanvasRevision(canvasId: string): Promise<number>;
  getCanvasHistoryCursor(
    canvasId: string,
    actorId: string,
    sessionId: string,
  ): Promise<PersistenceResult<RuntimeCanvasHistoryCursorRecord | null>>;
  upsertCanvasHistoryCursor(
    record: RuntimeCanvasHistoryCursorRecord,
  ): Promise<PersistenceResult<RuntimeCanvasHistoryCursorRecord>>;
  getCanvasShell(canvasId: string, workspaceId: string): Promise<RuntimeCanvasShellRecord>;
}
