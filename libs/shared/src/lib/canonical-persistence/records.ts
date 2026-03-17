import type {
  CanonicalObjectAlias,
  CanonicalObjectRecord as SharedCanonicalObjectRecord,
  CanonicalValidationCode,
} from '../canonical-object-contract';

type CanonicalObjectRecord = SharedCanonicalObjectRecord;

export type ObjectRelationType = string;
export type CanvasNodeKind = 'native' | 'plugin' | 'binding-proxy';
export type CanvasBindingKind = 'object' | 'query' | 'relation-set' | 'field-map';
export type CanonicalQueryInclude =
  | 'objects'
  | 'relations'
  | 'canvasNodes'
  | 'bindings'
  | 'documentRevision';

export interface CanonicalQueryFilters {
  semanticRole?: string[];
  primaryContentKind?: Array<string | null>;
  hasCapability?: string[];
  alias?: string[];
}

export interface CanonicalQueryBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface FilteredObjectQueryInput {
  workspaceId: string;
  filters?: CanonicalQueryFilters;
  limit?: number;
  cursor?: string;
}

export interface FilteredObjectQueryResult {
  objects: CanonicalObjectRecord[];
  cursor?: string;
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
  documentId: string;
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
  documentId: string;
  nodeId: string;
  bindingKind: CanvasBindingKind;
  sourceRef: Record<string, unknown>;
  mapping: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DocumentRevisionRecord {
  id: string;
  documentId: string;
  revisionNo: number;
  authorKind: 'user' | 'agent' | 'system';
  authorId: string;
  mutationBatch: Record<string, unknown>;
  snapshotRef?: string | null;
  createdAt?: Date;
}

export interface DocumentHeadRevisionRecord {
  documentId: string;
  revisionNo: number;
  revisionId: string;
  headRevision: string;
  createdAt?: Date;
}

export interface SurfaceLoadInput {
  workspaceId: string;
  documentId: string;
  surfaceId: string;
  bounds?: CanonicalQueryBounds;
  limit?: number;
  cursor?: string;
}

export interface SurfaceLoadResult {
  canvasNodes: CanvasNodeRecord[];
  bindings: CanvasBindingRecord[];
  objects: CanonicalObjectRecord[];
  documentRevision: DocumentHeadRevisionRecord;
  cursor?: string;
}

export type CanonicalPersistenceFailureCode =
  | CanonicalValidationCode
  | 'RELATION_ENDPOINT_MISSING'
  | 'CANONICAL_REFERENCE_REQUIRED'
  | 'CANONICAL_CANVAS_BOUNDARY_VIOLATION'
  | 'PERSISTENCE_SCHEMA_INIT_FAILED'
  | 'PERSISTENCE_REQUIRED_FIELD_MISSING'
  | 'PERSISTENCE_NOTE_BODY_SCHEMA_MISSING'
  | 'TOMBSTONE_PLACEHOLDER_RESOLUTION_FAILED'
  | 'EDITABLE_CANONICAL_SHARE_REQUIRES_CLONE'
  | 'CANONICAL_RECORD_NOT_FOUND'
  | 'CANONICAL_RECORD_TOMBSTONED'
  | 'INVALID_QUERY_INCLUDE'
  | 'INVALID_QUERY_FILTER'
  | 'INVALID_QUERY_CURSOR'
  | 'INVALID_QUERY_BOUNDS'
  | 'QUERY_SCOPE_NOT_FOUND'
  | 'VERSION_BASE_REQUIRED'
  | 'VERSION_CONFLICT'
  | 'INVALID_REVISION_TOKEN'
  | 'REVISION_APPEND_FAILED';

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
