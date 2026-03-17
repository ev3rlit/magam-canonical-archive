import { and, eq } from 'drizzle-orm';
import type { CanonicalObjectRecord } from '../canonical-object-contract';
import { cloneContentBlocks, isSemanticRole, readContentBlocks } from '../canonical-object-contract';
import type {
  CanvasBindingRecord,
  CanvasNodeRecord,
  CloneEditableNoteInput,
  CreateCanonicalObjectInput,
  DocumentRevisionRecord,
  ObjectRelationRecord,
  PersistenceResult,
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
type CanvasBindingRow = typeof canvasBindings.$inferSelect;

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
