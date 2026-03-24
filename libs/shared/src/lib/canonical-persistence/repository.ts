import { and, eq, isNull } from 'drizzle-orm';
import type { CanonicalObjectRecord } from '../canonical-object-contract';
import { cloneContentBlocks, isSemanticRole, readContentBlocks } from '../canonical-object-contract';
import type {
  CanvasBindingRecord,
  CanvasNodeRecord,
  CloneEditableNoteInput,
  CreateCanonicalObjectInput,
  CanvasRevisionRecord,
  ObjectRelationRecord,
  PersistenceResult,
  PluginExportRecord,
  PluginInstanceRecord,
  PluginPackageRecord,
  PluginPermissionRecord,
  PluginVersionRecord,
} from './records';
import { errResult, okResult } from './records';
import type { CanonicalDb } from './pglite-db';
import {
  canonicalObjects,
  canvasBindings,
  canvasNodes,
  canvasRevisions,
  objectRelations,
  pluginExports,
  pluginInstances,
  pluginPackages,
  pluginPermissions,
  pluginVersions,
} from './schema';
import {
  validateCanonicalObjectRecord,
  validateCanvasBindingRecord,
  validateCanvasNodeRecord,
  validateCanvasRevisionRecord,
  validateObjectRelationRecord,
  validatePluginExportRecord,
  validatePluginInstanceRecord,
  validatePluginPackageRecord,
  validatePluginPermissionRecord,
  validatePluginVersionRecord,
  isEditableNoteLikeRecord,
} from './validators';

type CanonicalObjectRow = typeof canonicalObjects.$inferSelect;
type CanvasBindingRow = typeof canvasBindings.$inferSelect;
type PluginPackageRow = typeof pluginPackages.$inferSelect;
type PluginVersionRow = typeof pluginVersions.$inferSelect;
type PluginExportRow = typeof pluginExports.$inferSelect;
type PluginPermissionRow = typeof pluginPermissions.$inferSelect;
type PluginInstanceRow = typeof pluginInstances.$inferSelect;

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
    canvasId: row.canvasId,
    nodeId: row.nodeId,
    bindingKind: row.bindingKind,
    sourceRef: row.sourceRef,
    mapping: row.mapping,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function fromPluginPackageRow(row: PluginPackageRow): PluginPackageRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    packageName: row.packageName,
    displayName: row.displayName,
    ownerKind: row.ownerKind,
    ownerId: row.ownerId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function fromPluginVersionRow(row: PluginVersionRow): PluginVersionRecord {
  return {
    id: row.id,
    pluginPackageId: row.pluginPackageId,
    version: row.version,
    manifest: row.manifest,
    bundleRef: row.bundleRef,
    integrityHash: row.integrityHash,
    status: row.status,
    createdAt: row.createdAt,
  };
}

function fromPluginExportRow(row: PluginExportRow): PluginExportRecord {
  return {
    id: row.id,
    pluginVersionId: row.pluginVersionId,
    exportName: row.exportName,
    componentKind: row.componentKind,
    propSchema: row.propSchema,
    bindingSchema: row.bindingSchema,
    capabilities: row.capabilities,
    createdAt: row.createdAt,
  };
}

function fromPluginPermissionRow(row: PluginPermissionRow): PluginPermissionRecord {
  return {
    id: row.id,
    pluginVersionId: row.pluginVersionId,
    permissionKey: row.permissionKey,
    permissionValue: row.permissionValue,
    createdAt: row.createdAt,
  };
}

function fromPluginInstanceRow(row: PluginInstanceRow): PluginInstanceRecord {
  return {
    id: row.id,
    canvasId: row.canvasId,
    surfaceId: row.surfaceId,
    pluginExportId: row.pluginExportId,
    pluginVersionId: row.pluginVersionId,
    displayName: row.displayName,
    props: row.props,
    bindingConfig: row.bindingConfig,
    persistedState: row.persistedState,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mergeJsonObject(
  existing: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    ...patch,
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

export interface PluginInstanceResolution {
  instance: PluginInstanceRecord;
  pluginExport: PluginExportRecord;
  pluginVersion: PluginVersionRecord;
  pluginPackage: PluginPackageRecord;
  permissions: PluginPermissionRecord[];
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
      canvasId: record.canvasId,
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
      canvasId: record.canvasId,
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
    canvasId: string,
    id: string,
  ): Promise<PersistenceResult<CanvasBindingResolution>> {
    const row = await this.db.query.canvasBindings.findFirst({
      where: and(
        eq(canvasBindings.canvasId, canvasId),
        eq(canvasBindings.id, id),
      ),
    });

    if (!row) {
      return errResult(
        'TOMBSTONE_PLACEHOLDER_RESOLUTION_FAILED',
        `Canvas binding ${id} was not found for document ${canvasId}.`,
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

  async createPluginPackage(record: PluginPackageRecord): Promise<PersistenceResult<PluginPackageRecord>> {
    const validation = validatePluginPackageRecord(record);
    if (!validation.ok) {
      return validation;
    }

    const existing = await this.db.query.pluginPackages.findFirst({
      where: validation.value.workspaceId
        ? and(
          eq(pluginPackages.workspaceId, validation.value.workspaceId),
          eq(pluginPackages.packageName, validation.value.packageName),
        )
        : and(
          isNull(pluginPackages.workspaceId),
          eq(pluginPackages.packageName, validation.value.packageName),
        ),
    });
    if (existing) {
      return errResult(
        'PLUGIN_REFERENCE_CONFLICT',
        `Plugin package ${validation.value.packageName} is already registered for this workspace scope.`,
        { path: 'packageName' },
      );
    }

    const inserted = await this.db
      .insert(pluginPackages)
      .values({
        id: validation.value.id,
        workspaceId: validation.value.workspaceId ?? null,
        packageName: validation.value.packageName,
        displayName: validation.value.displayName,
        ownerKind: validation.value.ownerKind,
        ownerId: validation.value.ownerId,
        createdAt: validation.value.createdAt ?? new Date(),
        updatedAt: validation.value.updatedAt ?? new Date(),
      })
      .returning();

    return okResult(fromPluginPackageRow(inserted[0]));
  }

  async getPluginPackage(id: string): Promise<PersistenceResult<PluginPackageRecord>> {
    const row = await this.db.query.pluginPackages.findFirst({
      where: eq(pluginPackages.id, id),
    });
    if (!row) {
      return errResult('PLUGIN_PACKAGE_NOT_FOUND', `Plugin package ${id} was not found.`, { path: 'id' });
    }

    return okResult(fromPluginPackageRow(row));
  }

  async listPluginPackages(workspaceId?: string | null): Promise<PluginPackageRecord[]> {
    const rows = workspaceId === undefined
      ? await this.db.query.pluginPackages.findMany()
      : workspaceId === null
        ? await this.db.query.pluginPackages.findMany({
          where: isNull(pluginPackages.workspaceId),
        })
        : await this.db.query.pluginPackages.findMany({
          where: eq(pluginPackages.workspaceId, workspaceId),
        });

    return rows.map(fromPluginPackageRow);
  }

  async createPluginVersion(record: PluginVersionRecord): Promise<PersistenceResult<PluginVersionRecord>> {
    const validation = validatePluginVersionRecord(record);
    if (!validation.ok) {
      return validation;
    }

    const pluginPackage = await this.getPluginPackage(validation.value.pluginPackageId);
    if (!pluginPackage.ok) {
      return pluginPackage;
    }

    const duplicate = await this.db.query.pluginVersions.findFirst({
      where: and(
        eq(pluginVersions.pluginPackageId, validation.value.pluginPackageId),
        eq(pluginVersions.version, validation.value.version),
      ),
    });
    if (duplicate) {
      return errResult(
        'PLUGIN_REFERENCE_CONFLICT',
        `Plugin version ${validation.value.version} already exists for package ${validation.value.pluginPackageId}.`,
        { path: 'version' },
      );
    }

    const inserted = await this.db
      .insert(pluginVersions)
      .values({
        id: validation.value.id,
        pluginPackageId: validation.value.pluginPackageId,
        version: validation.value.version,
        manifest: validation.value.manifest,
        bundleRef: validation.value.bundleRef,
        integrityHash: validation.value.integrityHash,
        status: validation.value.status,
        createdAt: validation.value.createdAt ?? new Date(),
      })
      .returning();

    return okResult(fromPluginVersionRow(inserted[0]));
  }

  async getPluginVersion(id: string): Promise<PersistenceResult<PluginVersionRecord>> {
    const row = await this.db.query.pluginVersions.findFirst({
      where: eq(pluginVersions.id, id),
    });
    if (!row) {
      return errResult('PLUGIN_VERSION_NOT_FOUND', `Plugin version ${id} was not found.`, { path: 'id' });
    }

    return okResult(fromPluginVersionRow(row));
  }

  async listPluginVersions(pluginPackageId: string): Promise<PluginVersionRecord[]> {
    const rows = await this.db.query.pluginVersions.findMany({
      where: eq(pluginVersions.pluginPackageId, pluginPackageId),
    });
    return rows.map(fromPluginVersionRow);
  }

  async createPluginExport(record: PluginExportRecord): Promise<PersistenceResult<PluginExportRecord>> {
    const validation = validatePluginExportRecord(record);
    if (!validation.ok) {
      return validation;
    }

    const pluginVersion = await this.getPluginVersion(validation.value.pluginVersionId);
    if (!pluginVersion.ok) {
      return pluginVersion;
    }

    if (!pluginVersion.value.manifest.exports.includes(validation.value.exportName)) {
      return errResult(
        'PLUGIN_CONTRACT_VIOLATION',
        `Export ${validation.value.exportName} is not declared in plugin manifest exports.`,
        { path: 'exportName' },
      );
    }

    const duplicate = await this.db.query.pluginExports.findFirst({
      where: and(
        eq(pluginExports.pluginVersionId, validation.value.pluginVersionId),
        eq(pluginExports.exportName, validation.value.exportName),
      ),
    });
    if (duplicate) {
      return errResult(
        'PLUGIN_REFERENCE_CONFLICT',
        `Plugin export ${validation.value.exportName} already exists for version ${validation.value.pluginVersionId}.`,
        { path: 'exportName' },
      );
    }

    const inserted = await this.db
      .insert(pluginExports)
      .values({
        id: validation.value.id,
        pluginVersionId: validation.value.pluginVersionId,
        exportName: validation.value.exportName,
        componentKind: validation.value.componentKind,
        propSchema: validation.value.propSchema,
        bindingSchema: validation.value.bindingSchema,
        capabilities: validation.value.capabilities,
        createdAt: validation.value.createdAt ?? new Date(),
      })
      .returning();

    return okResult(fromPluginExportRow(inserted[0]));
  }

  async getPluginExport(id: string): Promise<PersistenceResult<PluginExportRecord>> {
    const row = await this.db.query.pluginExports.findFirst({
      where: eq(pluginExports.id, id),
    });
    if (!row) {
      return errResult('PLUGIN_EXPORT_NOT_FOUND', `Plugin export ${id} was not found.`, { path: 'id' });
    }

    return okResult(fromPluginExportRow(row));
  }

  async listPluginExports(pluginVersionId: string): Promise<PluginExportRecord[]> {
    const rows = await this.db.query.pluginExports.findMany({
      where: eq(pluginExports.pluginVersionId, pluginVersionId),
    });
    return rows.map(fromPluginExportRow);
  }

  async createPluginPermission(record: PluginPermissionRecord): Promise<PersistenceResult<PluginPermissionRecord>> {
    const validation = validatePluginPermissionRecord(record);
    if (!validation.ok) {
      return validation;
    }

    const pluginVersion = await this.getPluginVersion(validation.value.pluginVersionId);
    if (!pluginVersion.ok) {
      return pluginVersion;
    }

    const duplicate = await this.db.query.pluginPermissions.findFirst({
      where: and(
        eq(pluginPermissions.pluginVersionId, validation.value.pluginVersionId),
        eq(pluginPermissions.permissionKey, validation.value.permissionKey),
      ),
    });
    if (duplicate) {
      return errResult(
        'PLUGIN_REFERENCE_CONFLICT',
        `Permission ${validation.value.permissionKey} already exists for version ${validation.value.pluginVersionId}.`,
        { path: 'permissionKey' },
      );
    }

    const inserted = await this.db
      .insert(pluginPermissions)
      .values({
        id: validation.value.id,
        pluginVersionId: validation.value.pluginVersionId,
        permissionKey: validation.value.permissionKey,
        permissionValue: validation.value.permissionValue,
        createdAt: validation.value.createdAt ?? new Date(),
      })
      .returning();

    return okResult(fromPluginPermissionRow(inserted[0]));
  }

  async listPluginPermissions(pluginVersionId: string): Promise<PluginPermissionRecord[]> {
    const rows = await this.db.query.pluginPermissions.findMany({
      where: eq(pluginPermissions.pluginVersionId, pluginVersionId),
    });
    return rows.map(fromPluginPermissionRow);
  }

  async createPluginInstance(record: PluginInstanceRecord): Promise<PersistenceResult<PluginInstanceRecord>> {
    const validation = validatePluginInstanceRecord(record);
    if (!validation.ok) {
      return validation;
    }

    const duplicate = await this.db.query.pluginInstances.findFirst({
      where: eq(pluginInstances.id, validation.value.id),
    });
    if (duplicate) {
      return errResult('PLUGIN_REFERENCE_CONFLICT', `Plugin instance ${validation.value.id} already exists.`, {
        path: 'id',
      });
    }

    const pluginVersion = await this.getPluginVersion(validation.value.pluginVersionId);
    if (!pluginVersion.ok) {
      return pluginVersion;
    }
    if (pluginVersion.value.status === 'disabled') {
      return errResult(
        'PLUGIN_VERSION_DISABLED',
        `Plugin version ${validation.value.pluginVersionId} is disabled and cannot be instantiated.`,
        { path: 'pluginVersionId' },
      );
    }

    const pluginExport = await this.getPluginExport(validation.value.pluginExportId);
    if (!pluginExport.ok) {
      return pluginExport;
    }
    if (pluginExport.value.pluginVersionId !== validation.value.pluginVersionId) {
      return errResult(
        'PLUGIN_REFERENCE_CONFLICT',
        `Plugin export ${validation.value.pluginExportId} does not belong to version ${validation.value.pluginVersionId}.`,
        { path: 'pluginExportId' },
      );
    }

    const inserted = await this.db
      .insert(pluginInstances)
      .values({
        id: validation.value.id,
        canvasId: validation.value.canvasId,
        surfaceId: validation.value.surfaceId,
        pluginExportId: validation.value.pluginExportId,
        pluginVersionId: validation.value.pluginVersionId,
        displayName: validation.value.displayName,
        props: validation.value.props ?? null,
        bindingConfig: validation.value.bindingConfig ?? null,
        persistedState: validation.value.persistedState ?? null,
        createdAt: validation.value.createdAt ?? new Date(),
        updatedAt: validation.value.updatedAt ?? new Date(),
      })
      .returning();

    return okResult(fromPluginInstanceRow(inserted[0]));
  }

  async getPluginInstance(id: string): Promise<PersistenceResult<PluginInstanceRecord>> {
    const row = await this.db.query.pluginInstances.findFirst({
      where: eq(pluginInstances.id, id),
    });
    if (!row) {
      return errResult('PLUGIN_INSTANCE_NOT_FOUND', `Plugin instance ${id} was not found.`, {
        path: 'id',
      });
    }

    return okResult(fromPluginInstanceRow(row));
  }

  async listPluginInstances(canvasId: string, surfaceId?: string): Promise<PluginInstanceRecord[]> {
    const rows = surfaceId
      ? await this.db.query.pluginInstances.findMany({
        where: and(
          eq(pluginInstances.canvasId, canvasId),
          eq(pluginInstances.surfaceId, surfaceId),
        ),
      })
      : await this.db.query.pluginInstances.findMany({
        where: eq(pluginInstances.canvasId, canvasId),
      });
    return rows.map(fromPluginInstanceRow);
  }

  async updatePluginInstanceProps(
    id: string,
    patch: Record<string, unknown>,
  ): Promise<PersistenceResult<PluginInstanceRecord>> {
    const existing = await this.getPluginInstance(id);
    if (!existing.ok) {
      return existing;
    }

    const nextRecord: PluginInstanceRecord = {
      ...existing.value,
      props: mergeJsonObject(existing.value.props ?? null, patch),
      updatedAt: new Date(),
    };
    const validated = validatePluginInstanceRecord(nextRecord);
    if (!validated.ok) {
      return validated;
    }

    const updated = await this.db
      .update(pluginInstances)
      .set({
        props: validated.value.props ?? null,
        updatedAt: validated.value.updatedAt ?? new Date(),
      })
      .where(eq(pluginInstances.id, id))
      .returning();

    return okResult(fromPluginInstanceRow(updated[0]));
  }

  async updatePluginInstanceBinding(
    id: string,
    bindingConfig: Record<string, unknown>,
  ): Promise<PersistenceResult<PluginInstanceRecord>> {
    const existing = await this.getPluginInstance(id);
    if (!existing.ok) {
      return existing;
    }

    const nextRecord: PluginInstanceRecord = {
      ...existing.value,
      bindingConfig,
      updatedAt: new Date(),
    };
    const validated = validatePluginInstanceRecord(nextRecord);
    if (!validated.ok) {
      return validated;
    }

    const updated = await this.db
      .update(pluginInstances)
      .set({
        bindingConfig: validated.value.bindingConfig ?? null,
        updatedAt: validated.value.updatedAt ?? new Date(),
      })
      .where(eq(pluginInstances.id, id))
      .returning();

    return okResult(fromPluginInstanceRow(updated[0]));
  }

  async removePluginInstance(id: string): Promise<PersistenceResult<PluginInstanceRecord>> {
    const existing = await this.getPluginInstance(id);
    if (!existing.ok) {
      return existing;
    }

    await this.db.delete(pluginInstances).where(eq(pluginInstances.id, id));
    return okResult(existing.value);
  }

  async resolvePluginInstance(id: string): Promise<PersistenceResult<PluginInstanceResolution>> {
    const instance = await this.getPluginInstance(id);
    if (!instance.ok) {
      return instance;
    }

    const pluginExport = await this.getPluginExport(instance.value.pluginExportId);
    if (!pluginExport.ok) {
      return pluginExport;
    }
    if (pluginExport.value.pluginVersionId !== instance.value.pluginVersionId) {
      return errResult(
        'PLUGIN_REFERENCE_CONFLICT',
        `Plugin instance ${id} references export/version that do not match.`,
        { path: 'pluginVersionId' },
      );
    }

    const pluginVersion = await this.getPluginVersion(instance.value.pluginVersionId);
    if (!pluginVersion.ok) {
      return pluginVersion;
    }
    if (pluginVersion.value.status === 'disabled') {
      return errResult(
        'PLUGIN_VERSION_DISABLED',
        `Plugin version ${pluginVersion.value.id} is disabled for plugin instance ${id}.`,
        { path: 'pluginVersionId' },
      );
    }

    const pluginPackage = await this.getPluginPackage(pluginVersion.value.pluginPackageId);
    if (!pluginPackage.ok) {
      return pluginPackage;
    }

    const permissions = await this.listPluginPermissions(pluginVersion.value.id);

    return okResult({
      instance: instance.value,
      pluginExport: pluginExport.value,
      pluginVersion: pluginVersion.value,
      pluginPackage: pluginPackage.value,
      permissions,
    });
  }

  async appendCanvasRevision(record: CanvasRevisionRecord): Promise<PersistenceResult<CanvasRevisionRecord>> {
    const validation = validateCanvasRevisionRecord(record);
    if (!validation.ok) {
      return validation;
    }

    await this.db.insert(canvasRevisions).values({
      id: record.id,
      canvasId: record.canvasId,
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
