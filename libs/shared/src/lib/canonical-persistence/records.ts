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
export type LibraryItemType = 'template' | 'asset' | 'reference';
export type LibraryVisibility = 'imported' | 'curated';
export type ReferenceTargetKind = 'url' | 'canvas' | 'object';
export type AssetImportSource = 'clipboard' | 'file' | 'url' | 'canvas-export';

export interface LibraryActor {
  kind: 'user' | 'system';
  id: string;
}

export interface TemplateSelection {
  nodeIds: string[];
  bindingIds: string[];
}

export interface TemplatePayload {
  sourceCanvasId: string;
  sourceSelection: TemplateSelection | null;
  previewText: string | null;
  previewImageAssetId: string | null;
  snapshot: Record<string, unknown>;
}

export interface AssetPayload {
  mimeType: string;
  byteSize: number;
  binaryData: Uint8Array;
  originalFilename: string | null;
  sha256: string;
  importSource: AssetImportSource;
  previewText: string | null;
  imageMetadata?: {
    width: number;
    height: number;
  } | null;
}

export interface ReferencePayload {
  targetKind: ReferenceTargetKind;
  target: string;
  displayHint: string | null;
  metadata: Record<string, unknown> | null;
}

export interface LibraryItemRecord {
  id: string;
  workspaceId: string;
  type: LibraryItemType;
  title: string;
  summary: string | null;
  tags: string[];
  collectionIds: string[];
  isFavorite: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy: LibraryActor;
  visibility: LibraryVisibility;
  payload: unknown;
}

export type TemplateItem = Omit<LibraryItemRecord, 'type' | 'payload'> & {
  type: 'template';
  payload: TemplatePayload;
};

export type AssetItem = Omit<LibraryItemRecord, 'type' | 'payload'> & {
  type: 'asset';
  payload: AssetPayload;
};

export type ReferenceItem = Omit<LibraryItemRecord, 'type' | 'payload'> & {
  type: 'reference';
  payload: ReferencePayload;
};

export type LibraryItem = TemplateItem | AssetItem | ReferenceItem;

export interface ReferenceTarget {
  kind: ReferenceTargetKind;
  value: string;
}

export interface TemplateInstantiation {
  itemId: string;
  canvasId: string;
  actor: LibraryActor;
}

export interface LibraryCollection {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LibraryItemVersion {
  id: string;
  workspaceId: string;
  itemId: string;
  versionNo: number;
  snapshot: LibraryItemRecord;
  changeSummary: string | null;
  createdAt?: Date;
  createdBy: LibraryActor;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLibraryActor(value: unknown): value is LibraryActor {
  if (!isRecord(value)) {
    return false;
  }
  return (value['kind'] === 'user' || value['kind'] === 'system') && typeof value['id'] === 'string';
}

function isTemplateSelection(value: unknown): value is TemplateSelection {
  if (!isRecord(value)) {
    return false;
  }
  return Array.isArray(value['nodeIds'])
    && value['nodeIds'].every((nodeId) => typeof nodeId === 'string')
    && Array.isArray(value['bindingIds'])
    && value['bindingIds'].every((bindingId) => typeof bindingId === 'string');
}

function isTemplatePayload(value: unknown): value is TemplatePayload {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value['sourceCanvasId'] === 'string'
    && (value['sourceSelection'] === null || value['sourceSelection'] === undefined || isTemplateSelection(value['sourceSelection']))
    && (value['previewText'] === null || value['previewText'] === undefined || typeof value['previewText'] === 'string')
    && (value['previewImageAssetId'] === null || value['previewImageAssetId'] === undefined || typeof value['previewImageAssetId'] === 'string')
    && isRecord(value['snapshot']);
}

function isUint8Array(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

function isAssetPayload(value: unknown): value is AssetPayload {
  if (!isRecord(value)) {
    return false;
  }
  const imageMetadata = value['imageMetadata'];
  const hasValidImageMetadata = imageMetadata === null
    || imageMetadata === undefined
    || (isRecord(imageMetadata)
      && typeof imageMetadata['width'] === 'number'
      && typeof imageMetadata['height'] === 'number');
  return typeof value['mimeType'] === 'string'
    && typeof value['byteSize'] === 'number'
    && isUint8Array(value['binaryData'])
    && (value['originalFilename'] === null || value['originalFilename'] === undefined || typeof value['originalFilename'] === 'string')
    && typeof value['sha256'] === 'string'
    && (value['importSource'] === 'clipboard'
      || value['importSource'] === 'file'
      || value['importSource'] === 'url'
      || value['importSource'] === 'canvas-export')
    && (value['previewText'] === null || value['previewText'] === undefined || typeof value['previewText'] === 'string')
    && hasValidImageMetadata;
}

function isReferencePayload(value: unknown): value is ReferencePayload {
  if (!isRecord(value)) {
    return false;
  }
  return (value['targetKind'] === 'url' || value['targetKind'] === 'canvas' || value['targetKind'] === 'object')
    && typeof value['target'] === 'string'
    && (value['displayHint'] === null || value['displayHint'] === undefined || typeof value['displayHint'] === 'string')
    && (value['metadata'] === null || value['metadata'] === undefined || isRecord(value['metadata']));
}

export function decodeLibraryItemRecord(record: LibraryItemRecord): PersistenceResult<LibraryItem> {
  if (record.type === 'template' && isTemplatePayload(record.payload)) {
    return okResult({
      ...record,
      type: 'template',
      payload: record.payload,
    });
  }
  if (record.type === 'asset' && isAssetPayload(record.payload)) {
    return okResult({
      ...record,
      type: 'asset',
      payload: record.payload,
    });
  }
  if (record.type === 'reference' && isReferencePayload(record.payload)) {
    return okResult({
      ...record,
      type: 'reference',
      payload: record.payload,
    });
  }

  return errResult('LIBRARY_INVALID_PAYLOAD', `Invalid payload for library item ${record.id}.`, {
    path: 'payload',
    details: {
      itemId: record.id,
      itemType: record.type,
    },
  });
}

export function toTemplateItem(record: LibraryItemRecord): PersistenceResult<TemplateItem> {
  const decoded = decodeLibraryItemRecord(record);
  if (!decoded.ok) {
    return decoded;
  }
  if (decoded.value.type !== 'template') {
    return errResult('LIBRARY_INVALID_ITEM_TYPE', `Library item ${record.id} is not a template item.`, {
      path: 'type',
      details: {
        itemId: record.id,
        itemType: record.type,
      },
    });
  }
  return okResult(decoded.value);
}

export function toAssetItem(record: LibraryItemRecord): PersistenceResult<AssetItem> {
  const decoded = decodeLibraryItemRecord(record);
  if (!decoded.ok) {
    return decoded;
  }
  if (decoded.value.type !== 'asset') {
    return errResult('LIBRARY_INVALID_ITEM_TYPE', `Library item ${record.id} is not an asset item.`, {
      path: 'type',
      details: {
        itemId: record.id,
        itemType: record.type,
      },
    });
  }
  return okResult(decoded.value);
}

export function toReferenceItem(record: LibraryItemRecord): PersistenceResult<ReferenceItem> {
  const decoded = decodeLibraryItemRecord(record);
  if (!decoded.ok) {
    return decoded;
  }
  if (decoded.value.type !== 'reference') {
    return errResult('LIBRARY_INVALID_ITEM_TYPE', `Library item ${record.id} is not a reference item.`, {
      path: 'type',
      details: {
        itemId: record.id,
        itemType: record.type,
      },
    });
  }
  return okResult(decoded.value);
}

export function isLibraryCollection(value: unknown): value is LibraryCollection {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value['id'] === 'string'
    && typeof value['workspaceId'] === 'string'
    && typeof value['name'] === 'string'
    && (value['description'] === null || value['description'] === undefined || typeof value['description'] === 'string')
    && typeof value['sortOrder'] === 'number';
}

export function isLibraryItemRecord(value: unknown): value is LibraryItemRecord {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value['id'] === 'string'
    && typeof value['workspaceId'] === 'string'
    && (value['type'] === 'template' || value['type'] === 'asset' || value['type'] === 'reference')
    && typeof value['title'] === 'string'
    && (value['summary'] === null || value['summary'] === undefined || typeof value['summary'] === 'string')
    && Array.isArray(value['tags'])
    && value['tags'].every((tag) => typeof tag === 'string')
    && Array.isArray(value['collectionIds'])
    && value['collectionIds'].every((collectionId) => typeof collectionId === 'string')
    && typeof value['isFavorite'] === 'boolean'
    && isLibraryActor(value['createdBy'])
    && (value['visibility'] === 'imported' || value['visibility'] === 'curated');
}

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
  | 'PLUGIN_INSTANCE_NOT_FOUND'
  | 'LIBRARY_INVALID_ITEM_TYPE'
  | 'LIBRARY_INVALID_PAYLOAD'
  | 'LIBRARY_BINARY_TOO_LARGE'
  | 'LIBRARY_UNSUPPORTED_MIME'
  | 'LIBRARY_REFERENCE_TARGET_MISSING'
  | 'LIBRARY_WORKSPACE_SCOPE_VIOLATION'
  | 'LIBRARY_ITEM_NOT_FOUND'
  | 'LIBRARY_ITEM_CONFLICT'
  | 'LIBRARY_COLLECTION_NOT_FOUND'
  | 'LIBRARY_COLLECTION_CONFLICT';

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
