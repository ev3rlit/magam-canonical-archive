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
} from 'drizzle-orm/pg-core';

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
    documentId: text('document_id').notNull(),
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
      table.documentId,
      table.surfaceId,
      table.zIndex,
    ),
  }),
);

export const canvasBindings = pgTable(
  'canvas_bindings',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id').notNull(),
    nodeId: text('node_id').notNull(),
    bindingKind: text('binding_kind').$type<CanvasBindingKind>().notNull(),
    sourceRef: jsonb('source_ref').$type<Record<string, unknown>>().notNull(),
    mapping: jsonb('mapping').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    documentNodeIdx: index('idx_canvas_bindings_document_node').on(table.documentId, table.nodeId),
  }),
);

export const documentRevisions = pgTable(
  'document_revisions',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id').notNull(),
    revisionNo: integer('revision_no').notNull(),
    authorKind: text('author_kind').$type<'user' | 'agent' | 'system'>().notNull(),
    authorId: text('author_id').notNull(),
    mutationBatch: jsonb('mutation_batch').$type<Record<string, unknown>>().notNull(),
    snapshotRef: text('snapshot_ref'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    documentRevisionIdx: index('idx_document_revisions_document_revision').on(table.documentId, table.revisionNo),
  }),
);
