import {
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type {
  AppPreferenceKey,
  AppPreferenceValue,
  AppWorkspaceStatus,
} from './types';

export const appWorkspaces = pgTable(
  'app_workspaces',
  {
    id: text('id').primaryKey(),
    rootPath: text('root_path').notNull(),
    displayName: text('display_name').notNull(),
    status: text('status').$type<AppWorkspaceStatus>().notNull(),
    isPinned: boolean('is_pinned').default(false).notNull(),
    lastOpenedAt: timestamp('last_opened_at', { withTimezone: true, mode: 'date' }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    rootPathUnique: uniqueIndex('idx_app_workspaces_root_path').on(table.rootPath),
    statusIdx: index('idx_app_workspaces_status').on(table.status),
    lastOpenedIdx: index('idx_app_workspaces_last_opened').on(table.lastOpenedAt),
  }),
);

export const appWorkspaceSession = pgTable('app_workspace_session', {
  singletonKey: text('singleton_key').primaryKey(),
  activeWorkspaceId: text('active_workspace_id'),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

export const appRecentCanvases = pgTable(
  'app_recent_canvases',
  {
    workspaceId: text('workspace_id').notNull(),
    documentPath: text('document_path').notNull(),
    lastOpenedAt: timestamp('last_opened_at', { withTimezone: true, mode: 'date' }),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.workspaceId, table.documentPath],
      name: 'app_recent_canvases_workspace_id_document_path_pk',
    }),
    workspaceIdx: index('idx_app_recent_canvases_workspace').on(table.workspaceId, table.lastOpenedAt),
  }),
);

export const appPreferences = pgTable('app_preferences', {
  key: text('key').$type<AppPreferenceKey | string>().primaryKey(),
  valueJson: jsonb('value_json').$type<AppPreferenceValue>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});
