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
});
