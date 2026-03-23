import type {
  CanonicalObjectAlias,
  CapabilityBag,
  CanonicalCapabilityKey,
  ContentBlock,
  NormalizationSource,
  ObjectCoreSourceMeta,
  PrimaryContentKind,
} from '../canonical-object-contract';
import type {
  CanvasBindingKind,
  CanvasNodeKind,
  ObjectRelationType,
} from './records';
import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  integer,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type {
  PluginCapabilitySet,
  PluginComponentKind,
  PluginManifest,
  PluginOwnerKind,
  PluginPermissionValue,
  PluginSchema,
  PluginVersionStatus,
} from '../plugin-runtime-contract';

export const canonicalObjects = pgTable(
  'objects',
  {
    id: text('id').notNull(),
    workspaceId: text('workspace_id').notNull(),
    semanticRole: text('semantic_role').notNull(),
    primaryContentKind: text('primary_content_kind').$type<PrimaryContentKind>(),
    publicAlias: text('public_alias').$type<CanonicalObjectAlias>(),
    contentBlocks: jsonb('content_blocks').$type<ContentBlock[]>(),
    sourceMeta: jsonb('source_meta').$type<ObjectCoreSourceMeta>().notNull(),
    capabilities: jsonb('capabilities').$type<CapabilityBag>().notNull(),
    capabilitySources: jsonb('capability_sources').$type<Partial<Record<CanonicalCapabilityKey, NormalizationSource>>>(),
    canonicalText: text('canonical_text').notNull(),
    extensions: jsonb('extensions').$type<Record<string, unknown>>(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.workspaceId, table.id], name: 'objects_workspace_id_id_pk' }),
    workspaceRoleIdx: index('idx_objects_workspace_role').on(table.workspaceId, table.semanticRole),
    workspaceContentKindIdx: index('idx_objects_workspace_content_kind').on(table.workspaceId, table.primaryContentKind),
  }),
);

export const objectRelations = pgTable(
  'object_relations',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    fromObjectId: text('from_object_id').notNull(),
    toObjectId: text('to_object_id').notNull(),
    relationType: text('relation_type').$type<ObjectRelationType>().notNull(),
    sortKey: integer('sort_key'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    workspaceFromRelationIdx: index('idx_object_relations_workspace_from_relation').on(
      table.workspaceId,
      table.fromObjectId,
      table.relationType,
    ),
  }),
);

export const canvasNodes = pgTable(
  'canvas_nodes',
  {
    id: text('id').primaryKey(),
    canvasId: text('document_id').notNull(),
    surfaceId: text('surface_id').notNull(),
    nodeKind: text('node_kind').$type<CanvasNodeKind>().notNull(),
    nodeType: text('node_type'),
    parentNodeId: text('parent_node_id'),
    canonicalObjectId: text('canonical_object_id'),
    pluginInstanceId: text('plugin_instance_id'),
    props: jsonb('props').$type<Record<string, unknown>>(),
    layout: jsonb('layout').$type<Record<string, unknown>>().notNull(),
    style: jsonb('style').$type<Record<string, unknown>>(),
    persistedState: jsonb('persisted_state').$type<Record<string, unknown>>(),
    zIndex: integer('z_index').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    documentSurfaceZIndexIdx: index('idx_canvas_nodes_document_surface_z').on(
      table.canvasId,
      table.surfaceId,
      table.zIndex,
    ),
  }),
);

export const canvasBindings = pgTable(
  'canvas_bindings',
  {
    id: text('id').primaryKey(),
    canvasId: text('document_id').notNull(),
    nodeId: text('node_id').notNull(),
    bindingKind: text('binding_kind').$type<CanvasBindingKind>().notNull(),
    sourceRef: jsonb('source_ref').$type<Record<string, unknown>>().notNull(),
    mapping: jsonb('mapping').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    documentNodeIdx: index('idx_canvas_bindings_document_node').on(table.canvasId, table.nodeId),
  }),
);

export const canvasRevisions = pgTable(
  'document_revisions',
  {
    id: text('id').primaryKey(),
    canvasId: text('document_id').notNull(),
    revisionNo: integer('revision_no').notNull(),
    authorKind: text('author_kind').$type<'user' | 'agent' | 'system'>().notNull(),
    authorId: text('author_id').notNull(),
    mutationBatch: jsonb('mutation_batch').$type<Record<string, unknown>>().notNull(),
    snapshotRef: text('snapshot_ref'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    canvasRevisionIdx: index('idx_document_revisions_document_revision').on(table.canvasId, table.revisionNo),
  }),
);

export const pluginPackages = pgTable(
  'plugin_packages',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id'),
    packageName: text('package_name').notNull(),
    displayName: text('display_name').notNull(),
    ownerKind: text('owner_kind').$type<PluginOwnerKind>().notNull(),
    ownerId: text('owner_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    workspaceNameIdx: index('idx_plugin_packages_workspace_name').on(table.workspaceId, table.packageName),
    ownerIdx: index('idx_plugin_packages_owner').on(table.ownerKind, table.ownerId),
  }),
);

export const pluginVersions = pgTable(
  'plugin_versions',
  {
    id: text('id').primaryKey(),
    pluginPackageId: text('plugin_package_id').notNull(),
    version: text('version').notNull(),
    manifest: jsonb('manifest').$type<PluginManifest>().notNull(),
    bundleRef: text('bundle_ref').notNull(),
    integrityHash: text('integrity_hash').notNull(),
    status: text('status').$type<PluginVersionStatus>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    packageVersionUnique: uniqueIndex('idx_plugin_versions_package_version').on(table.pluginPackageId, table.version),
    packageStatusIdx: index('idx_plugin_versions_package_status').on(table.pluginPackageId, table.status),
  }),
);

export const pluginExports = pgTable(
  'plugin_exports',
  {
    id: text('id').primaryKey(),
    pluginVersionId: text('plugin_version_id').notNull(),
    exportName: text('export_name').notNull(),
    componentKind: text('component_kind').$type<PluginComponentKind>().notNull(),
    propSchema: jsonb('prop_schema').$type<PluginSchema>().notNull(),
    bindingSchema: jsonb('binding_schema').$type<PluginSchema>().notNull(),
    capabilities: jsonb('capabilities').$type<PluginCapabilitySet>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    versionExportUnique: uniqueIndex('idx_plugin_exports_version_export').on(table.pluginVersionId, table.exportName),
    versionComponentIdx: index('idx_plugin_exports_version_component').on(table.pluginVersionId, table.componentKind),
  }),
);

export const pluginPermissions = pgTable(
  'plugin_permissions',
  {
    id: text('id').primaryKey(),
    pluginVersionId: text('plugin_version_id').notNull(),
    permissionKey: text('permission_key').notNull(),
    permissionValue: jsonb('permission_value').$type<PluginPermissionValue>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    versionPermissionUnique: uniqueIndex('idx_plugin_permissions_version_key').on(table.pluginVersionId, table.permissionKey),
  }),
);

export const pluginInstances = pgTable(
  'plugin_instances',
  {
    id: text('id').primaryKey(),
    canvasId: text('document_id').notNull(),
    surfaceId: text('surface_id').notNull(),
    pluginExportId: text('plugin_export_id').notNull(),
    pluginVersionId: text('plugin_version_id').notNull(),
    displayName: text('display_name').notNull(),
    props: jsonb('props').$type<Record<string, unknown>>(),
    bindingConfig: jsonb('binding_config').$type<Record<string, unknown>>(),
    persistedState: jsonb('persisted_state').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    documentSurfaceIdx: index('idx_plugin_instances_document_surface').on(table.canvasId, table.surfaceId),
    versionIdx: index('idx_plugin_instances_version').on(table.pluginVersionId),
    exportIdx: index('idx_plugin_instances_export').on(table.pluginExportId),
  }),
);
