import { and, eq } from 'drizzle-orm';
import type { CanonicalObjectRecord } from '../canonical-object-contract';
import { cloneContentBlocks, isSemanticRole, readContentBlocks } from '../canonical-object-contract';
import type {
  CanvasBindingRecord,
  CanvasNodeRecord,
  CanonicalQueryBounds,
  CloneEditableNoteInput,
  DocumentHeadRevisionRecord,
  CreateCanonicalObjectInput,
  DocumentRevisionRecord,
  FilteredObjectQueryInput,
  FilteredObjectQueryResult,
  ObjectRelationRecord,
  PersistenceResult,
  SurfaceLoadInput,
  SurfaceLoadResult,
} from './records';
import { errResult, okResult } from './records';
import type { CanonicalDb } from './pglite-db';
import {
  canonicalObjects,
  canvasBindings,
  canvasNodes,
  documentRevisions,
  objectRelations,
} from './schema';
import {
  validateCanonicalObjectRecord,
  validateCanvasBindingRecord,
  validateCanvasNodeRecord,
  validateDocumentRevisionRecord,
  validateObjectRelationRecord,
  isEditableNoteLikeRecord,
} from './validators';

type CanonicalObjectRow = typeof canonicalObjects.$inferSelect;
type ObjectRelationRow = typeof objectRelations.$inferSelect;
type CanvasNodeRow = typeof canvasNodes.$inferSelect;
type CanvasBindingRow = typeof canvasBindings.$inferSelect;
type DocumentRevisionRow = typeof documentRevisions.$inferSelect;

const INITIAL_REVISION_ID = 'initial';
const REVISION_TOKEN_PREFIX = 'rev';

type ParsedRevisionToken = {
  documentId: string;
  revisionNo: number;
  revisionId: string;
};

function toDateOrNull(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  return new Date(value);
}

function toCanonicalObjectInsert(record: CanonicalObjectRecord): typeof canonicalObjects.$inferInsert {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    semanticRole: record.semanticRole,
    primaryContentKind: record.primaryContentKind ?? null,
    publicAlias: record.publicAlias ?? null,
    contentBlocks: readContentBlocks(record) ?? null,
    sourceMeta: record.sourceMeta,
    capabilities: record.capabilities,
    capabilitySources: record.capabilitySources ?? null,
    canonicalText: record.canonicalText,
    extensions: record.extensions ?? null,
    deletedAt: toDateOrNull(record.deletedAt ?? null),
  };
}

function fromCanonicalObjectRow(row: CanonicalObjectRow): CanonicalObjectRecord {
  if (!isSemanticRole(row.semanticRole)) {
    throw new Error(`Invalid semantic role stored for canonical object ${row.id}: ${row.semanticRole}`);
  }

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    semanticRole: row.semanticRole,
    sourceMeta: row.sourceMeta,
    capabilities: row.capabilities,
    canonicalText: row.canonicalText,
    ...(row.primaryContentKind !== null ? { primaryContentKind: row.primaryContentKind } : { primaryContentKind: null }),
    ...(row.publicAlias ? { publicAlias: row.publicAlias } : {}),
    ...(row.contentBlocks ? { contentBlocks: cloneContentBlocks(row.contentBlocks) } : {}),
    ...(row.capabilitySources ? { capabilitySources: row.capabilitySources } : {}),
    ...(row.extensions ? { extensions: row.extensions } : {}),
    ...(row.deletedAt ? { deletedAt: row.deletedAt.toISOString() } : { deletedAt: null }),
  };
}

function fromCanvasBindingRow(row: CanvasBindingRow): CanvasBindingRecord {
  return {
    id: row.id,
    documentId: row.documentId,
    nodeId: row.nodeId,
    bindingKind: row.bindingKind,
    sourceRef: row.sourceRef,
    mapping: row.mapping,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function fromObjectRelationRow(row: ObjectRelationRow): ObjectRelationRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    fromObjectId: row.fromObjectId,
    toObjectId: row.toObjectId,
    relationType: row.relationType,
    sortKey: row.sortKey ?? null,
    ...(row.metadata ? { metadata: row.metadata } : {}),
    createdAt: row.createdAt,
  };
}

function fromCanvasNodeRow(row: CanvasNodeRow): CanvasNodeRecord {
  return {
    id: row.id,
    documentId: row.documentId,
    surfaceId: row.surfaceId,
    nodeKind: row.nodeKind,
    ...(row.nodeType !== null ? { nodeType: row.nodeType } : {}),
    ...(row.parentNodeId !== null ? { parentNodeId: row.parentNodeId } : {}),
    ...(row.canonicalObjectId !== null ? { canonicalObjectId: row.canonicalObjectId } : {}),
    ...(row.pluginInstanceId !== null ? { pluginInstanceId: row.pluginInstanceId } : {}),
    ...(row.props !== null ? { props: row.props } : {}),
    layout: row.layout,
    ...(row.style !== null ? { style: row.style } : {}),
    ...(row.persistedState !== null ? { persistedState: row.persistedState } : {}),
    zIndex: row.zIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createDocumentRevisionToken(input: {
  documentId: string;
  revisionNo: number;
  revisionId: string;
}): string {
  return `${REVISION_TOKEN_PREFIX}:${input.documentId}:${input.revisionNo}:${input.revisionId}`;
}

export function parseDocumentRevisionToken(token: string): PersistenceResult<ParsedRevisionToken> {
  const parts = token.split(':');
  if (parts.length !== 4 || parts[0] !== REVISION_TOKEN_PREFIX) {
    return errResult('INVALID_REVISION_TOKEN', 'Revision token format is invalid.', { path: 'baseRevision' });
  }

  const [, documentId, revisionNoRaw, revisionId] = parts;
  const revisionNo = Number.parseInt(revisionNoRaw, 10);

  if (!documentId || !Number.isInteger(revisionNo) || revisionNo < 0 || !revisionId) {
    return errResult('INVALID_REVISION_TOKEN', 'Revision token format is invalid.', { path: 'baseRevision' });
  }

  return okResult({
    documentId,
    revisionNo,
    revisionId,
  });
}

function mapDocumentRevisionHead(row: DocumentRevisionRow): DocumentHeadRevisionRecord {
  return {
    documentId: row.documentId,
    revisionNo: row.revisionNo,
    revisionId: row.id,
    headRevision: createDocumentRevisionToken({
      documentId: row.documentId,
      revisionNo: row.revisionNo,
      revisionId: row.id,
    }),
    createdAt: row.createdAt,
  };
}

function validateBounds(bounds: CanonicalQueryBounds | undefined): PersistenceResult<CanonicalQueryBounds | undefined> {
  if (!bounds) {
    return okResult(undefined);
  }

  const values = [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY];
  if (values.some((value) => typeof value !== 'number' || Number.isNaN(value))) {
    return errResult('INVALID_QUERY_BOUNDS', 'Bounds must contain numeric coordinates.', { path: 'bounds' });
  }
  if (bounds.minX > bounds.maxX || bounds.minY > bounds.maxY) {
    return errResult('INVALID_QUERY_BOUNDS', 'Bounds min values must be less than or equal to max values.', { path: 'bounds' });
  }

  return okResult(bounds);
}

function readCanvasNodePosition(node: CanvasNodeRecord): { x: number; y: number } | null {
  const x = node.layout['x'];
  const y = node.layout['y'];
  if (typeof x !== 'number' || typeof y !== 'number') {
    return null;
  }
  return { x, y };
}

function isNodeWithinBounds(node: CanvasNodeRecord, bounds: CanonicalQueryBounds | undefined): boolean {
  if (!bounds) {
    return true;
  }
  const position = readCanvasNodePosition(node);
  if (!position) {
    return true;
  }
  return position.x >= bounds.minX
    && position.x <= bounds.maxX
    && position.y >= bounds.minY
    && position.y <= bounds.maxY;
}

function applyCursorLimit<T>(input: {
  rows: T[];
  cursor?: string;
  limit?: number;
  getId: (row: T) => string;
}): PersistenceResult<{ rows: T[]; cursor?: string }> {
  const { rows, cursor, limit, getId } = input;
  if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
    return errResult('INVALID_QUERY_FILTER', 'limit must be a positive integer.', { path: 'limit' });
  }
  const resolvedLimit = limit ?? rows.length;

  if (cursor !== undefined && (typeof cursor !== 'string' || cursor.length === 0)) {
    return errResult('INVALID_QUERY_CURSOR', 'cursor must be a non-empty string.', { path: 'cursor' });
  }

  let startIndex = 0;
  if (cursor) {
    const foundIndex = rows.findIndex((row) => getId(row) === cursor);
    if (foundIndex < 0) {
      return errResult('INVALID_QUERY_CURSOR', 'cursor could not be resolved from current result set.', { path: 'cursor' });
    }
    startIndex = foundIndex + 1;
  }

  const pagedRows = rows.slice(startIndex, startIndex + resolvedLimit);
  const hasMore = startIndex + resolvedLimit < rows.length;
  return okResult({
    rows: pagedRows,
    ...(hasMore && pagedRows.length > 0 ? { cursor: getId(pagedRows[pagedRows.length - 1]) } : {}),
  });
}

function readBindingCanonicalRef(binding: Pick<CanvasBindingRecord, 'bindingKind' | 'sourceRef'>): (
  | { kind: 'none' }
  | { kind: 'invalid' }
  | { kind: 'canonical'; workspaceId: string; objectId: string }
) {
  const { sourceRef } = binding;
  const workspaceId = typeof sourceRef['workspaceId'] === 'string' ? sourceRef['workspaceId'] : null;
  const objectId = typeof sourceRef['objectId'] === 'string'
    ? sourceRef['objectId']
    : typeof sourceRef['canonicalObjectId'] === 'string'
      ? sourceRef['canonicalObjectId']
      : null;
  const sourceKind = typeof sourceRef['kind'] === 'string'
    ? sourceRef['kind']
    : typeof sourceRef['type'] === 'string'
      ? sourceRef['type']
      : null;
  const refersCanonicalObject = binding.bindingKind === 'object'
    || sourceKind === 'object'
    || sourceKind === 'canonical-object';

  if (!refersCanonicalObject) {
    return { kind: 'none' };
  }

  if (!workspaceId || !objectId) {
    return { kind: 'invalid' };
  }

  return {
    kind: 'canonical',
    workspaceId,
    objectId,
  };
}

export interface CanonicalObjectResolution {
  record: CanonicalObjectRecord;
  placeholder: boolean;
}

export interface CanvasBindingPlaceholderDiagnostic {
  code: 'TOMBSTONED_CANONICAL_OBJECT';
  message: string;
  bindingId: string;
  nodeId: string;
  canonicalObjectId: string;
}

export interface CanvasBindingResolution {
  record: CanvasBindingRecord;
  placeholder: boolean;
  canonicalObjectId?: string;
  diagnostics: CanvasBindingPlaceholderDiagnostic[];
}

export class CanonicalPersistenceRepository {
  constructor(private readonly db: CanonicalDb) {}

  async createCanonicalObject(input: CreateCanonicalObjectInput): Promise<PersistenceResult<CanonicalObjectRecord>> {
    const validation = validateCanonicalObjectRecord(input.record);
    if (!validation.ok) {
      return validation;
    }

    const existing = await this.getCanonicalObject(input.record.workspaceId, input.record.id);
    if (existing.ok) {
      return errResult(
        isEditableNoteLikeRecord(validation.value)
          ? 'EDITABLE_OBJECT_REQUIRES_CLONE'
          : 'CANONICAL_OBJECT_ID_CONFLICT',
        `Canonical object ${input.record.id} already exists in workspace ${input.record.workspaceId}.`,
        { path: 'id' },
      );
    }

    const inserted = await this.db
      .insert(canonicalObjects)
      .values(toCanonicalObjectInsert(validation.value))
      .returning();

    return okResult(fromCanonicalObjectRow(inserted[0]));
  }

  async upsertCanonicalObject(record: CanonicalObjectRecord): Promise<PersistenceResult<CanonicalObjectRecord>> {
    const validation = validateCanonicalObjectRecord(record);
    if (!validation.ok) {
      return validation;
    }

    const inserted = await this.db
      .insert(canonicalObjects)
      .values(toCanonicalObjectInsert(validation.value))
      .onConflictDoUpdate({
        target: [canonicalObjects.workspaceId, canonicalObjects.id],
        set: {
          semanticRole: validation.value.semanticRole,
          primaryContentKind: validation.value.primaryContentKind ?? null,
          publicAlias: validation.value.publicAlias ?? null,
          contentBlocks: readContentBlocks(validation.value) ?? null,
          sourceMeta: validation.value.sourceMeta,
          capabilities: validation.value.capabilities,
          capabilitySources: validation.value.capabilitySources ?? null,
          canonicalText: validation.value.canonicalText,
          extensions: validation.value.extensions ?? null,
          deletedAt: toDateOrNull(validation.value.deletedAt ?? null),
          updatedAt: new Date(),
        },
      })
      .returning();

    return okResult(fromCanonicalObjectRow(inserted[0]));
  }

  async getCanonicalObject(workspaceId: string, id: string): Promise<PersistenceResult<CanonicalObjectRecord>> {
    const row = await this.db.query.canonicalObjects.findFirst({
      where: and(
        eq(canonicalObjects.workspaceId, workspaceId),
        eq(canonicalObjects.id, id),
      ),
    });

    if (!row) {
      return errResult('CANONICAL_RECORD_NOT_FOUND', `Canonical object ${id} was not found.`, {
        path: 'id',
      });
    }

    return okResult(fromCanonicalObjectRow(row));
  }

  async listCanonicalObjects(workspaceId: string): Promise<CanonicalObjectRecord[]> {
    const rows = await this.db.query.canonicalObjects.findMany({
      where: eq(canonicalObjects.workspaceId, workspaceId),
    });

    return rows.map(fromCanonicalObjectRow);
  }

  async queryCanonicalObjects(input: {
    workspaceId: string;
    filters?: FilteredObjectQueryInput['filters'];
    limit?: number;
    cursor?: string;
    bounds?: { x: number; y: number; width: number; height: number };
  }): Promise<FilteredObjectQueryResult> {
    void input.bounds;
    const result = await this.listCanonicalObjectsByFilters({
      workspaceId: input.workspaceId,
      filters: input.filters,
      limit: input.limit,
      cursor: input.cursor,
    });

    if (!result.ok) {
      throw new Error(result.message);
    }

    return result.value;
  }

  async listCanonicalObjectsByFilters(input: FilteredObjectQueryInput): Promise<PersistenceResult<FilteredObjectQueryResult>> {
    if (typeof input.workspaceId !== 'string' || input.workspaceId.length === 0) {
      return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'workspaceId is required.', {
        path: 'workspaceId',
      });
    }
    if (input.filters?.semanticRole && !Array.isArray(input.filters.semanticRole)) {
      return errResult('INVALID_QUERY_FILTER', 'filters.semanticRole must be an array.', { path: 'filters.semanticRole' });
    }
    if (input.filters?.semanticRole?.some((value) => typeof value !== 'string' || value.length === 0)) {
      return errResult('INVALID_QUERY_FILTER', 'filters.semanticRole must contain non-empty strings.', { path: 'filters.semanticRole' });
    }
    if (input.filters?.primaryContentKind && !Array.isArray(input.filters.primaryContentKind)) {
      return errResult('INVALID_QUERY_FILTER', 'filters.primaryContentKind must be an array.', { path: 'filters.primaryContentKind' });
    }
    if (input.filters?.primaryContentKind?.some((value) => value !== null && (typeof value !== 'string' || value.length === 0))) {
      return errResult('INVALID_QUERY_FILTER', 'filters.primaryContentKind must contain non-empty strings or null.', { path: 'filters.primaryContentKind' });
    }
    if (input.filters?.hasCapability && !Array.isArray(input.filters.hasCapability)) {
      return errResult('INVALID_QUERY_FILTER', 'filters.hasCapability must be an array.', { path: 'filters.hasCapability' });
    }
    if (input.filters?.hasCapability?.some((value) => typeof value !== 'string' || value.length === 0)) {
      return errResult('INVALID_QUERY_FILTER', 'filters.hasCapability must contain non-empty strings.', { path: 'filters.hasCapability' });
    }
    if (input.filters?.alias && !Array.isArray(input.filters.alias)) {
      return errResult('INVALID_QUERY_FILTER', 'filters.alias must be an array.', { path: 'filters.alias' });
    }
    if (input.filters?.alias?.some((value) => typeof value !== 'string' || value.length === 0)) {
      return errResult('INVALID_QUERY_FILTER', 'filters.alias must contain non-empty strings.', { path: 'filters.alias' });
    }

    const rows = await this.db.query.canonicalObjects.findMany({
      where: eq(canonicalObjects.workspaceId, input.workspaceId),
    });

    const filtered = rows
      .map(fromCanonicalObjectRow)
      .filter((record: CanonicalObjectRecord) => {
        if (input.filters?.semanticRole && input.filters.semanticRole.length > 0 && !input.filters.semanticRole.includes(record.semanticRole)) {
          return false;
        }
        if (input.filters?.primaryContentKind && input.filters.primaryContentKind.length > 0) {
          const kind = record.primaryContentKind ?? null;
          if (!input.filters.primaryContentKind.includes(kind)) {
            return false;
          }
        }
        if (input.filters?.alias && input.filters.alias.length > 0) {
          const alias = record.publicAlias ?? null;
          if (!alias || !input.filters.alias.includes(alias)) {
            return false;
          }
        }
        if (input.filters?.hasCapability && input.filters.hasCapability.length > 0) {
          const capabilityKeys = new Set(Object.keys(record.capabilities ?? {}));
          const hasAll = input.filters.hasCapability.every((requiredKey) => capabilityKeys.has(requiredKey));
          if (!hasAll) {
            return false;
          }
        }
        return true;
      })
      .sort((a: CanonicalObjectRecord, b: CanonicalObjectRecord) => a.id.localeCompare(b.id));

    const paged = applyCursorLimit({
      rows: filtered,
      cursor: input.cursor,
      limit: input.limit,
      getId: (row: CanonicalObjectRecord) => row.id,
    });
    if (!paged.ok) {
      return paged;
    }

    return okResult({
      objects: paged.value.rows,
      ...(paged.value.cursor ? { cursor: paged.value.cursor } : {}),
    });
  }

  async listObjectRelationsByWorkspace(workspaceId: string): Promise<PersistenceResult<ObjectRelationRecord[]>> {
    if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
      return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'workspaceId is required.', {
        path: 'workspaceId',
      });
    }

    const rows = await this.db.query.objectRelations.findMany({
      where: eq(objectRelations.workspaceId, workspaceId),
    });

    const relations = rows
      .map(fromObjectRelationRow)
      .sort((a: ObjectRelationRecord, b: ObjectRelationRecord) => {
        const fromCompare = a.fromObjectId.localeCompare(b.fromObjectId);
        if (fromCompare !== 0) {
          return fromCompare;
        }
        const relationCompare = a.relationType.localeCompare(b.relationType);
        if (relationCompare !== 0) {
          return relationCompare;
        }
        return a.id.localeCompare(b.id);
      });

    return okResult(relations);
  }

  async listObjectRelations(input: {
    workspaceId: string;
    objectIds?: string[];
  }): Promise<ObjectRelationRecord[]> {
    const relations = await this.listObjectRelationsByWorkspace(input.workspaceId);
    if (!relations.ok) {
      throw new Error(relations.message);
    }

    if (!input.objectIds || input.objectIds.length === 0) {
      return relations.value;
    }

    const objectIdSet = new Set(input.objectIds);
    return relations.value.filter((relation) => (
      objectIdSet.has(relation.fromObjectId) || objectIdSet.has(relation.toObjectId)
    ));
  }

  async resolveCanonicalObject(
    workspaceId: string,
    id: string,
  ): Promise<PersistenceResult<CanonicalObjectResolution>> {
    const objectResult = await this.getCanonicalObject(workspaceId, id);
    if (!objectResult.ok) {
      return objectResult;
    }

    return okResult({
      record: objectResult.value,
      placeholder: Boolean(objectResult.value.deletedAt),
    });
  }

  async tombstoneCanonicalObject(
    workspaceId: string,
    id: string,
    deletedAt = new Date(),
  ): Promise<PersistenceResult<CanonicalObjectRecord>> {
    const existing = await this.getCanonicalObject(workspaceId, id);
    if (!existing.ok) {
      return existing;
    }

    const updated = await this.db
      .update(canonicalObjects)
      .set({
        deletedAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(canonicalObjects.workspaceId, workspaceId),
          eq(canonicalObjects.id, id),
        ),
      )
      .returning();

    return okResult(fromCanonicalObjectRow(updated[0]));
  }

  async cloneEditableNote(input: CloneEditableNoteInput): Promise<PersistenceResult<CanonicalObjectRecord>> {
    const source = await this.getCanonicalObject(input.workspaceId, input.sourceId);
    if (!source.ok) {
      return source;
    }

    if (!isEditableNoteLikeRecord(source.value)) {
      return errResult('EDITABLE_OBJECT_REQUIRES_CLONE', 'Only editable note-like canonical objects can be cloned with this path.', {
        path: 'publicAlias',
      });
    }

    const cloned: CanonicalObjectRecord = {
      ...source.value,
      id: input.clonedId,
      publicAlias: input.publicAlias ?? source.value.publicAlias,
      contentBlocks: cloneContentBlocks(readContentBlocks(source.value)) ?? undefined,
      deletedAt: null,
    };

    return this.createCanonicalObject({
      record: cloned,
      operation: 'duplicate',
    });
  }

  async createObjectRelation(record: ObjectRelationRecord): Promise<PersistenceResult<ObjectRelationRecord>> {
    const validation = validateObjectRelationRecord(record);
    if (!validation.ok) {
      return validation;
    }

    const from = await this.getCanonicalObject(record.workspaceId, record.fromObjectId);
    if (!from.ok) {
      return errResult('RELATION_ENDPOINT_MISSING', `Missing relation source object ${record.fromObjectId}.`, {
        path: 'fromObjectId',
      });
    }
    if (from.value.deletedAt) {
      return errResult('RELATION_ENDPOINT_MISSING', `Source object ${record.fromObjectId} is tombstoned.`, {
        path: 'fromObjectId',
      });
    }

    const to = await this.getCanonicalObject(record.workspaceId, record.toObjectId);
    if (!to.ok) {
      return errResult('RELATION_ENDPOINT_MISSING', `Missing relation target object ${record.toObjectId}.`, {
        path: 'toObjectId',
      });
    }
    if (to.value.deletedAt) {
      return errResult('RELATION_ENDPOINT_MISSING', `Target object ${record.toObjectId} is tombstoned.`, {
        path: 'toObjectId',
      });
    }

    await this.db.insert(objectRelations).values({
      id: record.id,
      workspaceId: record.workspaceId,
      fromObjectId: record.fromObjectId,
      toObjectId: record.toObjectId,
      relationType: record.relationType,
      sortKey: record.sortKey ?? null,
      metadata: record.metadata ?? null,
      createdAt: record.createdAt ?? new Date(),
    });

    return okResult(record);
  }

  async removeObjectRelation(input: {
    workspaceId: string;
    relationId: string;
  }): Promise<PersistenceResult<{ id: string }>> {
    if (typeof input.workspaceId !== 'string' || input.workspaceId.length === 0) {
      return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'workspaceId is required.', { path: 'workspaceId' });
    }
    if (typeof input.relationId !== 'string' || input.relationId.length === 0) {
      return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'relationId is required.', { path: 'relationId' });
    }

    const existing = await this.db.query.objectRelations.findFirst({
      where: and(
        eq(objectRelations.workspaceId, input.workspaceId),
        eq(objectRelations.id, input.relationId),
      ),
    });

    if (!existing) {
      return errResult('RELATION_ENDPOINT_MISSING', `Relation ${input.relationId} was not found.`, {
        path: 'relationId',
      });
    }

    await this.db
      .delete(objectRelations)
      .where(
        and(
          eq(objectRelations.workspaceId, input.workspaceId),
          eq(objectRelations.id, input.relationId),
        ),
      );

    return okResult({ id: input.relationId });
  }

  async createCanvasNode(record: CanvasNodeRecord): Promise<PersistenceResult<CanvasNodeRecord>> {
    const validation = validateCanvasNodeRecord(record);
    if (!validation.ok) {
      return validation;
    }

    await this.db.insert(canvasNodes).values({
      id: record.id,
      documentId: record.documentId,
      surfaceId: record.surfaceId,
      nodeKind: record.nodeKind,
      nodeType: record.nodeType ?? null,
      parentNodeId: record.parentNodeId ?? null,
      canonicalObjectId: record.canonicalObjectId ?? null,
      pluginInstanceId: record.pluginInstanceId ?? null,
      props: record.props ?? null,
      layout: record.layout,
      style: record.style ?? null,
      persistedState: record.persistedState ?? null,
      zIndex: record.zIndex,
      createdAt: record.createdAt ?? new Date(),
      updatedAt: record.updatedAt ?? new Date(),
    });

    return okResult(record);
  }

  async getCanvasNode(input: {
    documentId: string;
    nodeId: string;
  }): Promise<PersistenceResult<CanvasNodeRecord>> {
    const row = await this.db.query.canvasNodes.findFirst({
      where: and(
        eq(canvasNodes.documentId, input.documentId),
        eq(canvasNodes.id, input.nodeId),
      ),
    });

    if (!row) {
      return errResult('CANONICAL_RECORD_NOT_FOUND', `Canvas node ${input.nodeId} was not found.`, {
        path: 'nodeId',
      });
    }

    return okResult(fromCanvasNodeRow(row));
  }

  async updateCanvasNode(record: CanvasNodeRecord): Promise<PersistenceResult<CanvasNodeRecord>> {
    const validation = validateCanvasNodeRecord(record);
    if (!validation.ok) {
      return validation;
    }

    const existing = await this.getCanvasNode({
      documentId: record.documentId,
      nodeId: record.id,
    });
    if (!existing.ok) {
      return existing;
    }

    await this.db
      .update(canvasNodes)
      .set({
        surfaceId: record.surfaceId,
        nodeKind: record.nodeKind,
        nodeType: record.nodeType ?? null,
        parentNodeId: record.parentNodeId ?? null,
        canonicalObjectId: record.canonicalObjectId ?? null,
        pluginInstanceId: record.pluginInstanceId ?? null,
        props: record.props ?? null,
        layout: record.layout,
        style: record.style ?? null,
        persistedState: record.persistedState ?? null,
        zIndex: record.zIndex,
        updatedAt: record.updatedAt ?? new Date(),
      })
      .where(
        and(
          eq(canvasNodes.documentId, record.documentId),
          eq(canvasNodes.id, record.id),
        ),
      );

    return okResult(record);
  }

  async removeCanvasNode(input: {
    documentId: string;
    nodeId: string;
  }): Promise<PersistenceResult<{ id: string }>> {
    const existing = await this.getCanvasNode(input);
    if (!existing.ok) {
      return existing;
    }

    await this.db
      .delete(canvasNodes)
      .where(
        and(
          eq(canvasNodes.documentId, input.documentId),
          eq(canvasNodes.id, input.nodeId),
        ),
      );

    return okResult({ id: input.nodeId });
  }

  async createCanvasBinding(record: CanvasBindingRecord): Promise<PersistenceResult<CanvasBindingRecord>> {
    const validation = validateCanvasBindingRecord(record);
    if (!validation.ok) {
      return validation;
    }

    await this.db.insert(canvasBindings).values({
      id: record.id,
      documentId: record.documentId,
      nodeId: record.nodeId,
      bindingKind: record.bindingKind,
      sourceRef: record.sourceRef,
      mapping: record.mapping,
      createdAt: record.createdAt ?? new Date(),
      updatedAt: record.updatedAt ?? new Date(),
    });

    return okResult(record);
  }

  async listCanvasNodes(input: {
    documentId: string;
    surfaceId?: string;
    bounds?: { x: number; y: number; width: number; height: number };
  }): Promise<CanvasNodeRecord[]> {
    const bounds = input.bounds
      ? {
          minX: input.bounds.x,
          minY: input.bounds.y,
          maxX: input.bounds.x + input.bounds.width,
          maxY: input.bounds.y + input.bounds.height,
        }
      : undefined;

    const validatedBounds = validateBounds(bounds);
    if (!validatedBounds.ok) {
      throw new Error(validatedBounds.message);
    }

    const rows = await this.db.query.canvasNodes.findMany({
      where: input.surfaceId
        ? and(
          eq(canvasNodes.documentId, input.documentId),
          eq(canvasNodes.surfaceId, input.surfaceId),
        )
        : eq(canvasNodes.documentId, input.documentId),
    });

    return rows
      .map(fromCanvasNodeRow)
      .filter((node: CanvasNodeRecord) => isNodeWithinBounds(node, validatedBounds.value))
      .sort((a: CanvasNodeRecord, b: CanvasNodeRecord) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));
  }

  async listCanvasBindings(input: {
    documentId: string;
    nodeIds?: string[];
  }): Promise<CanvasBindingRecord[]> {
    const rows = await this.db.query.canvasBindings.findMany({
      where: eq(canvasBindings.documentId, input.documentId),
    });

    const nodeIdSet = input.nodeIds ? new Set(input.nodeIds) : null;
    return rows
      .map(fromCanvasBindingRow)
      .filter((binding: CanvasBindingRecord) => !nodeIdSet || nodeIdSet.has(binding.nodeId));
  }

  async resolveCanvasBinding(
    documentId: string,
    id: string,
  ): Promise<PersistenceResult<CanvasBindingResolution>> {
    const row = await this.db.query.canvasBindings.findFirst({
      where: and(
        eq(canvasBindings.documentId, documentId),
        eq(canvasBindings.id, id),
      ),
    });

    if (!row) {
      return errResult(
        'TOMBSTONE_PLACEHOLDER_RESOLUTION_FAILED',
        `Canvas binding ${id} was not found for document ${documentId}.`,
        { path: 'id' },
      );
    }

    const binding = fromCanvasBindingRow(row);
    const canonicalRef = readBindingCanonicalRef(binding);
    if (canonicalRef.kind === 'none') {
      return okResult({
        record: binding,
        placeholder: false,
        diagnostics: [],
      });
    }

    if (canonicalRef.kind === 'invalid') {
      return errResult(
        'TOMBSTONE_PLACEHOLDER_RESOLUTION_FAILED',
        `Canvas binding ${id} references a canonical object but sourceRef is missing workspaceId/objectId.`,
        { path: 'sourceRef' },
      );
    }

    const resolved = await this.resolveCanonicalObject(canonicalRef.workspaceId, canonicalRef.objectId);
    if (!resolved.ok) {
      return errResult(
        'TOMBSTONE_PLACEHOLDER_RESOLUTION_FAILED',
        `Canvas binding ${id} could not resolve canonical object ${canonicalRef.objectId}.`,
        {
          path: 'sourceRef',
          details: {
            workspaceId: canonicalRef.workspaceId,
            objectId: canonicalRef.objectId,
          },
        },
      );
    }

    const diagnostics = resolved.value.placeholder
      ? [{
        code: 'TOMBSTONED_CANONICAL_OBJECT' as const,
        message: `Canonical object ${canonicalRef.objectId} is tombstoned; binding resolves through placeholder mode.`,
        bindingId: binding.id,
        nodeId: binding.nodeId,
        canonicalObjectId: canonicalRef.objectId,
      }]
      : [];

    return okResult({
      record: binding,
      placeholder: resolved.value.placeholder,
      canonicalObjectId: canonicalRef.objectId,
      diagnostics,
    });
  }

  async getDocumentHeadRevision(documentId: string): Promise<PersistenceResult<DocumentHeadRevisionRecord>> {
    if (typeof documentId !== 'string' || documentId.length === 0) {
      return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'documentId is required.', { path: 'documentId' });
    }

    const rows = await this.db.query.documentRevisions.findMany({
      where: eq(documentRevisions.documentId, documentId),
    });
    if (rows.length === 0) {
      return okResult({
        documentId,
        revisionNo: 0,
        revisionId: INITIAL_REVISION_ID,
        headRevision: createDocumentRevisionToken({
          documentId,
          revisionNo: 0,
          revisionId: INITIAL_REVISION_ID,
        }),
      });
    }

    const latest = rows.reduce((current: DocumentRevisionRow, candidate: DocumentRevisionRow) => {
      if (candidate.revisionNo > current.revisionNo) {
        return candidate;
      }
      if (candidate.revisionNo === current.revisionNo && candidate.createdAt > current.createdAt) {
        return candidate;
      }
      return current;
    });

    return okResult(mapDocumentRevisionHead(latest));
  }

  async getRevisionState(documentId: string): Promise<DocumentHeadRevisionRecord | null> {
    const head = await this.getDocumentHeadRevision(documentId);
    if (!head.ok) {
      return null;
    }
    return head.value;
  }

  async getNextDocumentRevisionNo(documentId: string): Promise<PersistenceResult<number>> {
    const head = await this.getDocumentHeadRevision(documentId);
    if (!head.ok) {
      return head;
    }
    return okResult(head.value.revisionNo + 1);
  }

  async ensureBaseRevision(
    documentId: string,
    baseRevision: string | undefined | null,
  ): Promise<PersistenceResult<DocumentHeadRevisionRecord>> {
    if (typeof baseRevision !== 'string' || baseRevision.length === 0) {
      return errResult('VERSION_BASE_REQUIRED', 'baseRevision is required.', { path: 'baseRevision' });
    }

    const parsed = parseDocumentRevisionToken(baseRevision);
    if (!parsed.ok) {
      return parsed;
    }
    if (parsed.value.documentId !== documentId) {
      return errResult('INVALID_REVISION_TOKEN', 'Revision token documentId does not match mutation target document.', {
        path: 'baseRevision',
      });
    }

    const head = await this.getDocumentHeadRevision(documentId);
    if (!head.ok) {
      return head;
    }
    if (head.value.headRevision !== baseRevision) {
      return errResult('VERSION_CONFLICT', 'baseRevision does not match current head revision.', {
        path: 'baseRevision',
        details: {
          expected: baseRevision,
          actual: head.value.headRevision,
        },
      });
    }

    return okResult(head.value);
  }

  async loadDocumentSurface(input: SurfaceLoadInput): Promise<PersistenceResult<SurfaceLoadResult>> {
    if (typeof input.workspaceId !== 'string' || input.workspaceId.length === 0) {
      return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'workspaceId is required.', { path: 'workspaceId' });
    }
    if (typeof input.documentId !== 'string' || input.documentId.length === 0) {
      return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'documentId is required.', { path: 'documentId' });
    }
    if (typeof input.surfaceId !== 'string' || input.surfaceId.length === 0) {
      return errResult('QUERY_SCOPE_NOT_FOUND', 'surfaceId is required.', { path: 'surfaceId' });
    }

    const validatedBounds = validateBounds(input.bounds);
    if (!validatedBounds.ok) {
      return validatedBounds;
    }

    const nodeRows = await this.db.query.canvasNodes.findMany({
      where: and(
        eq(canvasNodes.documentId, input.documentId),
        eq(canvasNodes.surfaceId, input.surfaceId),
      ),
    });
    const scopedNodes = nodeRows
      .map(fromCanvasNodeRow)
      .filter((node: CanvasNodeRecord) => isNodeWithinBounds(node, validatedBounds.value))
      .sort((a: CanvasNodeRecord, b: CanvasNodeRecord) => {
        const zCompare = a.zIndex - b.zIndex;
        if (zCompare !== 0) {
          return zCompare;
        }
        return a.id.localeCompare(b.id);
      });

    const pagedNodes = applyCursorLimit({
      rows: scopedNodes,
      cursor: input.cursor,
      limit: input.limit,
      getId: (row: CanvasNodeRecord) => row.id,
    });
    if (!pagedNodes.ok) {
      return pagedNodes;
    }

    const nodeIds = new Set(pagedNodes.value.rows.map((node) => node.id));
    const bindingRows = await this.db.query.canvasBindings.findMany({
      where: eq(canvasBindings.documentId, input.documentId),
    });
    const bindings = bindingRows
      .map(fromCanvasBindingRow)
      .filter((binding: CanvasBindingRecord) => nodeIds.has(binding.nodeId));

    const canonicalObjectIds = Array.from(new Set(
      pagedNodes.value.rows
        .map((node) => node.canonicalObjectId)
        .filter((value): value is string => typeof value === 'string' && value.length > 0),
    ));
    const objectRows = canonicalObjectIds.length > 0
      ? await this.db.query.canonicalObjects.findMany({
        where: eq(canonicalObjects.workspaceId, input.workspaceId),
      })
      : [];
    const objectLookup = new Map(objectRows.map((row: CanonicalObjectRow) => [row.id, row]));
    const missingObjectIds = canonicalObjectIds.filter((id) => !objectLookup.has(id));
    if (missingObjectIds.length > 0) {
      return errResult(
        'QUERY_SCOPE_NOT_FOUND',
        `Document surface references canonical objects outside current workspace scope: ${missingObjectIds.join(', ')}`,
        {
          path: 'canvasNodes.canonicalObjectId',
          details: {
            missingObjectIds,
          },
        },
      );
    }
    const objects = canonicalObjectIds.map((id) => fromCanonicalObjectRow(objectLookup.get(id)!));

    const documentRevision = await this.getDocumentHeadRevision(input.documentId);
    if (!documentRevision.ok) {
      return documentRevision;
    }

    return okResult({
      canvasNodes: pagedNodes.value.rows,
      bindings,
      objects,
      documentRevision: documentRevision.value,
      ...(pagedNodes.value.cursor ? { cursor: pagedNodes.value.cursor } : {}),
    });
  }

  async appendDocumentRevision(record: DocumentRevisionRecord): Promise<PersistenceResult<DocumentRevisionRecord>> {
    const validation = validateDocumentRevisionRecord(record);
    if (!validation.ok) {
      return validation;
    }

    await this.db.insert(documentRevisions).values({
      id: record.id,
      documentId: record.documentId,
      revisionNo: record.revisionNo,
      authorKind: record.authorKind,
      authorId: record.authorId,
      mutationBatch: record.mutationBatch,
      snapshotRef: record.snapshotRef ?? null,
      createdAt: record.createdAt ?? new Date(),
    });

    return okResult(record);
  }
}
