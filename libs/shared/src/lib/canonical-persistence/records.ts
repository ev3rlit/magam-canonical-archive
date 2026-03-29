import type {
  CanonicalObjectAlias,
  CanonicalObjectRecord as SharedCanonicalObjectRecord,
  CanonicalValidationCode,
} from '../canonical-object-contract';
import type {
  PluginCapabilitySet,
  PluginComponentKind,
  PluginManifest,
  PluginOwnerKind,
  PluginPermissionValue,
  PluginSchema,
  PluginVersionStatus,
} from '../plugin-runtime-contract';

type CanonicalObjectRecord = SharedCanonicalObjectRecord;

export type ObjectRelationType = string;
export type CanvasNodeKind = 'native' | 'plugin' | 'binding-proxy';
export type CanvasBindingKind = 'object' | 'query' | 'relation-set' | 'field-map';

export interface ObjectRelationRecord {
  id: string;
  workspaceId: string;
  fromObjectId: string;
  toObjectId: string;
  relationType: ObjectRelationType;
  sortKey?: number | null;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

export interface CanvasNodeRecord {
  id: string;
  canvasId: string;
  surfaceId: string;
  nodeKind: CanvasNodeKind;
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

export interface CanvasBindingRecord {
  id: string;
  canvasId: string;
  nodeId: string;
  bindingKind: CanvasBindingKind;
  sourceRef: Record<string, unknown>;
  mapping: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CanvasRevisionRecord {
  id: string;
  canvasId: string;
  revisionNo: number;
  authorKind: 'user' | 'agent' | 'system';
  authorId: string;
  sessionId?: string | null;
  mutationBatch: Record<string, unknown>;
  runtimeHistory?: Record<string, unknown> | null;
  snapshotRef?: string | null;
  createdAt?: Date;
}

export type RuntimeMutationSource = 'ui' | 'cli' | 'system';

export interface WorkspaceRuntimeVersionRecord {
  workspaceId: string;
  versionToken: string;
  updatedAt?: Date;
}

export interface CanvasMetadataVersionRecord {
  workspaceId: string;
  canvasId: string;
  metadataRevisionNo: number;
  versionToken: string;
  updatedAt?: Date;
}

export interface NodeVersionRecord {
  workspaceId: string;
  canvasId: string;
  nodeId: string;
  objectId?: string | null;
  headRevisionNo: number;
  versionToken: string;
  lastMutationBatchId: string;
  lastMutationSource: RuntimeMutationSource;
  lastAppliedById: string;
  lastAppliedByKind: string;
  updatedAt?: Date;
}

export interface CanvasHistoryCursorRecord {
  canvasId: string;
  actorId: string;
  sessionId: string;
  undoRevisionNo?: number | null;
  redoRevisionNo?: number | null;
  updatedAt?: Date;
}

export interface PluginPackageRecord {
  id: string;
  workspaceId?: string | null;
  packageName: string;
  displayName: string;
  ownerKind: PluginOwnerKind;
  ownerId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PluginVersionRecord {
  id: string;
  pluginPackageId: string;
  version: string;
  manifest: PluginManifest;
  bundleRef: string;
  integrityHash: string;
  status: PluginVersionStatus;
  createdAt?: Date;
}

export interface PluginExportRecord {
  id: string;
  pluginVersionId: string;
  exportName: string;
  componentKind: PluginComponentKind;
  propSchema: PluginSchema;
  bindingSchema: PluginSchema;
  capabilities: PluginCapabilitySet;
  createdAt?: Date;
}

export interface PluginPermissionRecord {
  id: string;
  pluginVersionId: string;
  permissionKey: string;
  permissionValue: PluginPermissionValue;
  createdAt?: Date;
}

export interface PluginInstanceRecord {
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
}

export type CanonicalPersistenceFailureCode =
  | CanonicalValidationCode
  | 'CANONICAL_OBJECT_ID_CONFLICT'
  | 'CANVAS_NODE_ID_CONFLICT'
  | 'RELATION_ENDPOINT_MISSING'
  | 'CANONICAL_REFERENCE_REQUIRED'
  | 'CANONICAL_CANVAS_BOUNDARY_VIOLATION'
  | 'PERSISTENCE_SCHEMA_INIT_FAILED'
  | 'PERSISTENCE_REQUIRED_FIELD_MISSING'
  | 'PERSISTENCE_NOTE_BODY_SCHEMA_MISSING'
  | 'TOMBSTONE_PLACEHOLDER_RESOLUTION_FAILED'
  | 'EDITABLE_OBJECT_REQUIRES_CLONE'
  | 'EDITABLE_CANONICAL_SHARE_REQUIRES_CLONE'
  | 'CANONICAL_RECORD_NOT_FOUND'
  | 'CANONICAL_RECORD_TOMBSTONED'
  | 'PLUGIN_CONTRACT_VIOLATION'
  | 'PLUGIN_REFERENCE_CONFLICT'
  | 'PLUGIN_PACKAGE_NOT_FOUND'
  | 'PLUGIN_VERSION_NOT_FOUND'
  | 'PLUGIN_VERSION_DISABLED'
  | 'PLUGIN_EXPORT_NOT_FOUND'
  | 'PLUGIN_INSTANCE_NOT_FOUND';

export interface PersistenceSuccess<T> {
  ok: true;
  value: T;
}

export interface PersistenceFailure {
  ok: false;
  code: CanonicalPersistenceFailureCode;
  message: string;
  path?: string;
  details?: Record<string, unknown>;
}

export type PersistenceResult<T> = PersistenceSuccess<T> | PersistenceFailure;

export function okResult<T>(value: T): PersistenceSuccess<T> {
  return { ok: true, value };
}

export function errResult(
  code: CanonicalPersistenceFailureCode,
  message: string,
  options?: {
    path?: string;
    details?: Record<string, unknown>;
  },
): PersistenceFailure {
  return {
    ok: false,
    code,
    message,
    ...(options?.path ? { path: options.path } : {}),
    ...(options?.details ? { details: options.details } : {}),
  };
}

export interface CreateCanonicalObjectInput {
  record: CanonicalObjectRecord;
  operation?: 'create' | 'duplicate' | 'import';
}

export interface CloneEditableNoteInput {
  workspaceId: string;
  sourceId: string;
  clonedId: string;
  publicAlias?: CanonicalObjectAlias;
}
