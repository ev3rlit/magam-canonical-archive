import type {
  CanonicalObjectRecord,
  CapabilityBag,
  CanonicalValidationCode,
  ContentBlock,
  ContentCapability,
  PrimaryContentKind,
  SemanticRole,
} from '../canonical-object-contract';
import type {
  CanvasBindingRecord,
  CanvasNodeRecord,
  CreateCanonicalObjectInput,
  DocumentHeadRevisionRecord,
  DocumentRevisionRecord,
  ObjectRelationRecord,
  PersistenceResult,
} from '../canonical-persistence/records';

export const QUERY_INCLUDE_KEYS = [
  'objects',
  'relations',
  'canvasNodes',
  'bindings',
  'documentRevision',
] as const;

export type QueryIncludeKey = (typeof QUERY_INCLUDE_KEYS)[number];

export interface CanonicalQueryRequest {
  workspaceId: string;
  documentId?: string;
  surfaceId?: string;
  filters?: {
    semanticRole?: SemanticRole[];
    primaryContentKind?: PrimaryContentKind[];
    hasCapability?: Array<keyof CapabilityBag>;
    alias?: string[];
  };
  include: string[];
  limit?: number;
  cursor?: string;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface CanonicalQueryData {
  objects?: CanonicalObjectRecord[];
  relations?: ObjectRelationRecord[];
  canvasNodes?: CanvasNodeRecord[];
  bindings?: CanvasBindingRecord[];
  documentRevision?: {
    documentId: string;
    revision: string;
    revisionNo: number;
  };
}

export type CanonicalQueryFailureCode =
  | 'INVALID_QUERY_INCLUDE'
  | 'INVALID_QUERY_FILTER'
  | 'INVALID_QUERY_BOUNDS'
  | 'INVALID_QUERY_CURSOR'
  | 'QUERY_SCOPE_NOT_FOUND'
  | 'INTERNAL_QUERY_ERROR';

export interface CanonicalQueryFailure {
  code: CanonicalQueryFailureCode;
  message: string;
  path?: string;
  details?: Record<string, unknown>;
}

export type CanonicalQueryResultEnvelope =
  | {
      ok: true;
      data: CanonicalQueryData;
      page?: { cursor?: string };
    }
  | ({
      ok: false;
    } & CanonicalQueryFailure);

export type MutationFailureCode =
  | CanonicalValidationCode
  | 'INVALID_MUTATION_OPERATION'
  | 'VERSION_BASE_REQUIRED'
  | 'VERSION_CONFLICT'
  | 'INVALID_REVISION_TOKEN'
  | 'REVISION_APPEND_FAILED'
  | 'RELATION_ENDPOINT_MISSING'
  | 'CANONICAL_CANVAS_BOUNDARY_VIOLATION'
  | 'CANONICAL_RECORD_NOT_FOUND'
  | 'CANONICAL_RECORD_TOMBSTONED'
  | 'INTERNAL_MUTATION_ERROR';

export interface MutationFailure {
  code: MutationFailureCode;
  message: string;
  path?: string;
  details?: Record<string, unknown>;
}

export type MutationActorKind = 'user' | 'agent' | 'system';

export interface MutationActor {
  kind: MutationActorKind;
  id: string;
}

export interface MutationOperationMeta {
  operationId?: string;
}

export type MutationOperation =
  | ({
      op: 'object.create';
      input: CreateCanonicalObjectInput;
      sourceId?: string;
    } & MutationOperationMeta)
  | ({
      op: 'object.update-core';
      objectId: string;
      patch: Partial<Pick<CanonicalObjectRecord, 'semanticRole' | 'sourceMeta' | 'publicAlias' | 'extensions'>>;
    } & MutationOperationMeta)
  | ({
      op: 'object.update-content';
      objectId: string;
      content: ContentCapability;
    } & MutationOperationMeta)
  | ({
      op: 'object.body.replace';
      objectId: string;
      blocks: ContentBlock[];
    } & MutationOperationMeta)
  | ({
      op: 'object.body.block.insert';
      objectId: string;
      block: ContentBlock;
      at: number;
    } & MutationOperationMeta)
  | ({
      op: 'object.body.block.update';
      objectId: string;
      blockId: string;
      patch: Partial<ContentBlock>;
    } & MutationOperationMeta)
  | ({
      op: 'object.body.block.remove';
      objectId: string;
      blockId: string;
    } & MutationOperationMeta)
  | ({
      op: 'object.body.block.reorder';
      objectId: string;
      order: string[];
    } & MutationOperationMeta)
  | ({
      op: 'object.patch-capability';
      objectId: string;
      patch: Partial<CapabilityBag>;
    } & MutationOperationMeta)
  | ({
      op: 'object.relation.upsert';
      relation: ObjectRelationRecord;
    } & MutationOperationMeta)
  | ({
      op: 'object.relation.remove';
      relationId: string;
      workspaceId: string;
    } & MutationOperationMeta)
  | ({
      op: 'canvas-node.move';
      documentId: string;
      nodeId: string;
      nextLayout: Record<string, unknown>;
    } & MutationOperationMeta)
  | ({
      op: 'canvas-node.reparent';
      documentId: string;
      nodeId: string;
      parentNodeId: string | null;
    } & MutationOperationMeta)
  | ({
      op: 'canvas-node.create';
      node: CanvasNodeRecord;
    } & MutationOperationMeta)
  | ({
      op: 'canvas-node.remove';
      documentId: string;
      nodeId: string;
    } & MutationOperationMeta);

export interface CanonicalMutationEnvelope {
  workspaceId: string;
  documentId: string;
  baseRevision: string;
  actor: MutationActor;
  operations: MutationOperation[];
  requestId?: string;
}

export interface AppliedOperationSummary {
  index: number;
  op: MutationOperation['op'];
  operationId?: string;
}

export interface MutationChangedSet {
  objectIds: string[];
  relationIds: string[];
  canvasNodeIds: string[];
}

export type CanonicalMutationResultEnvelope =
  | {
      ok: true;
      appliedOperations: AppliedOperationSummary[];
      changedSet: MutationChangedSet;
      revision: {
        before: string;
        after: string;
      };
    }
  | ({
      ok: false;
    } & MutationFailure);

export interface RevisionState {
  documentId: string;
  headRevision: string;
  revisionNo: number;
}

export interface CanonicalQueryRepository {
  queryCanonicalObjects(input: {
    workspaceId: string;
    filters?: CanonicalQueryRequest['filters'];
    limit?: number;
    cursor?: string;
    bounds?: CanonicalQueryRequest['bounds'];
  }): Promise<{
    objects: CanonicalObjectRecord[];
    cursor?: string;
  }>;
  listObjectRelations?(input: {
    workspaceId: string;
    objectIds?: string[];
  }): Promise<ObjectRelationRecord[]>;
  listCanvasNodes?(input: {
    documentId: string;
    surfaceId?: string;
    bounds?: CanonicalQueryRequest['bounds'];
  }): Promise<CanvasNodeRecord[]>;
  listCanvasBindings?(input: {
    documentId: string;
    nodeIds?: string[];
  }): Promise<CanvasBindingRecord[]>;
  getRevisionState?(documentId: string): Promise<RevisionState | null>;
}

export interface CanonicalMutationRepository {
  getRevisionState(documentId: string): Promise<RevisionState | null>;
  ensureBaseRevision?(
    documentId: string,
    baseRevision: string | undefined | null,
  ): Promise<PersistenceResult<DocumentHeadRevisionRecord>>;
  getCanonicalObject(workspaceId: string, id: string): Promise<PersistenceResult<CanonicalObjectRecord>>;
  createCanonicalObject?(input: CreateCanonicalObjectInput): Promise<PersistenceResult<CanonicalObjectRecord>>;
  upsertCanonicalObject(record: CanonicalObjectRecord): Promise<PersistenceResult<CanonicalObjectRecord>>;
  createObjectRelation(record: ObjectRelationRecord): Promise<PersistenceResult<ObjectRelationRecord>>;
  removeObjectRelation?(input: {
    workspaceId: string;
    relationId: string;
  }): Promise<PersistenceResult<{ id: string }>>;
  createCanvasNode(record: CanvasNodeRecord): Promise<PersistenceResult<CanvasNodeRecord>>;
  getCanvasNode?(input: {
    documentId: string;
    nodeId: string;
  }): Promise<PersistenceResult<CanvasNodeRecord>>;
  updateCanvasNode?(record: CanvasNodeRecord): Promise<PersistenceResult<CanvasNodeRecord>>;
  removeCanvasNode?(input: {
    documentId: string;
    nodeId: string;
  }): Promise<PersistenceResult<{ id: string }>>;
  appendDocumentRevision(record: DocumentRevisionRecord): Promise<PersistenceResult<DocumentRevisionRecord>>;
}
