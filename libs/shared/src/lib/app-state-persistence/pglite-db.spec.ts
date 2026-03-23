import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createAppStatePgliteDb,
  resolveAppStateDbLocation,
  resolveAppStateMigrationsFolder,
} from './pglite-db';

describe('app-state pglite bootstrap', () => {
  it('resolves the default app-state data directory and environment override', () => {
    const previous = process.env['MAGAM_APP_STATE_DB_PATH'];

    process.env['MAGAM_APP_STATE_DB_PATH'] = '/tmp/custom-app-state-db';
    expect(resolveAppStateDbLocation('/tmp/magam')).toBe('/tmp/custom-app-state-db');

    if (previous === undefined) {
      delete process.env['MAGAM_APP_STATE_DB_PATH'];
    } else {
      process.env['MAGAM_APP_STATE_DB_PATH'] = previous;
    }

    expect(resolveAppStateDbLocation('/tmp/magam')).toContain('.magam/app-state-pgdata');
  });

  it('applies app-state migrations and exposes the expected tables', async () => {
    const handle = await createAppStatePgliteDb(process.cwd(), { dataDir: null, runMigrations: true });

    const tables = await handle.client.query(`
      select tablename
      from pg_tables
      where schemaname = 'public'
        and tablename in (
          'app_workspaces',
          'app_workspace_session',
          'app_recent_documents',
          'app_preferences'
        )
      order by tablename
    `);

    expect(resolveAppStateMigrationsFolder(process.cwd())).toContain('/app-state-persistence/drizzle');
    expect(tables.rows).toEqual([
      { tablename: 'app_preferences' },
      { tablename: 'app_recent_documents' },
      { tablename: 'app_workspace_session' },
      { tablename: 'app_workspaces' },
    ]);

    await handle.close();
  }, 15_000);

  it('backfills migration tracking for legacy app-state DBs that already have the initial schema', async () => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'magam-app-state-legacy-'));
    const legacyHandle = await createAppStatePgliteDb(process.cwd(), {
      dataDir,
      runMigrations: false,
    });

    await legacyHandle.client.exec(`
      create table "app_workspaces" (
        "id" text primary key not null,
        "root_path" text not null,
        "display_name" text not null,
        "status" text not null,
        "is_pinned" boolean default false not null,
        "last_opened_at" timestamp with time zone,
        "last_seen_at" timestamp with time zone,
        "created_at" timestamp with time zone default now() not null,
        "updated_at" timestamp with time zone default now() not null
      )
    `);
    await legacyHandle.client.exec(`
      create table "app_workspace_session" (
        "singleton_key" text primary key not null,
        "active_workspace_id" text,
        "updated_at" timestamp with time zone default now() not null
      )
    `);
    await legacyHandle.client.exec(`
      create table "app_recent_documents" (
        "workspace_id" text not null,
        "document_path" text not null,
        "last_opened_at" timestamp with time zone,
        "updated_at" timestamp with time zone default now() not null,
        constraint "app_recent_documents_workspace_id_document_path_pk" primary key("workspace_id","document_path")
      )
    `);
    await legacyHandle.client.exec(`
      create table "app_preferences" (
        "key" text primary key not null,
        "value_json" jsonb not null,
        "updated_at" timestamp with time zone default now() not null
      )
    `);
    await legacyHandle.close();

    const upgradedHandle = await createAppStatePgliteDb(process.cwd(), {
      dataDir,
      runMigrations: true,
    });
    const migrationRows = await upgradedHandle.client.query(`
      select migration_name
      from magam_app_state_migrations
      order by migration_name
    `);

    expect(migrationRows.rows).toEqual([
      { migration_name: '0000_app_global_state.sql' },
    ]);

    await upgradedHandle.close();
    await rm(dataDir, { recursive: true, force: true });
  }, 15_000);
});
