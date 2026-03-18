import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from './schema';

export type CanonicalDb = ReturnType<typeof drizzle<typeof schema>>;

export interface CanonicalPgliteHandle {
  db: CanonicalDb;
  client: PGlite;
  dataDir: string | null;
  close: () => Promise<void>;
}

export function resolveCanonicalDbLocation(targetDir: string): string {
  const explicit = process.env['MAGAM_CANONICAL_DB_PATH']?.trim();
  if (explicit) {
    return explicit;
  }

  return join(targetDir, '.magam', 'canonical-pgdata');
}

export function resolveCanonicalMigrationsFolder(targetDir: string): string {
  return join(targetDir, 'libs', 'shared', 'src', 'lib', 'canonical-persistence', 'drizzle');
}

function isDirectCliInvocation(): boolean {
  const invokedPath = process.argv[1] ?? '';
  return /(?:^|\/)pglite-db\.(?:ts|js|mjs|cjs)$/.test(invokedPath);
}

async function hasPluginRuntimeSchema(client: PGlite): Promise<boolean> {
  const requiredTables = new Set([
    'plugin_packages',
    'plugin_versions',
    'plugin_exports',
    'plugin_permissions',
    'plugin_instances',
  ]);

  const result = await client.query(`
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename in ('plugin_packages', 'plugin_versions', 'plugin_exports', 'plugin_permissions', 'plugin_instances')
  `);

  for (const row of result.rows as Array<Record<string, unknown>>) {
    const tablename = typeof row['tablename'] === 'string' ? row['tablename'] : null;
    if (tablename) {
      requiredTables.delete(tablename);
    }
  }

  return requiredTables.size === 0;
}

async function ensurePluginRuntimeSchema(client: PGlite): Promise<void> {
  await client.query(`
    create table if not exists plugin_packages (
      id text primary key not null,
      workspace_id text,
      package_name text not null,
      display_name text not null,
      owner_kind text not null,
      owner_id text not null,
      created_at timestamp with time zone default now() not null,
      updated_at timestamp with time zone default now() not null
    );
  `);
  await client.query(`
    create index if not exists idx_plugin_packages_workspace_name
    on plugin_packages (workspace_id, package_name);
  `);
  await client.query(`
    create index if not exists idx_plugin_packages_owner
    on plugin_packages (owner_kind, owner_id);
  `);

  await client.query(`
    create table if not exists plugin_versions (
      id text primary key not null,
      plugin_package_id text not null,
      version text not null,
      manifest jsonb not null,
      bundle_ref text not null,
      integrity_hash text not null,
      status text not null,
      created_at timestamp with time zone default now() not null
    );
  `);
  await client.query(`
    create unique index if not exists idx_plugin_versions_package_version
    on plugin_versions (plugin_package_id, version);
  `);
  await client.query(`
    create index if not exists idx_plugin_versions_package_status
    on plugin_versions (plugin_package_id, status);
  `);

  await client.query(`
    create table if not exists plugin_exports (
      id text primary key not null,
      plugin_version_id text not null,
      export_name text not null,
      component_kind text not null,
      prop_schema jsonb not null,
      binding_schema jsonb not null,
      capabilities jsonb not null,
      created_at timestamp with time zone default now() not null
    );
  `);
  await client.query(`
    create unique index if not exists idx_plugin_exports_version_export
    on plugin_exports (plugin_version_id, export_name);
  `);
  await client.query(`
    create index if not exists idx_plugin_exports_version_component
    on plugin_exports (plugin_version_id, component_kind);
  `);

  await client.query(`
    create table if not exists plugin_permissions (
      id text primary key not null,
      plugin_version_id text not null,
      permission_key text not null,
      permission_value jsonb not null,
      created_at timestamp with time zone default now() not null
    );
  `);
  await client.query(`
    create unique index if not exists idx_plugin_permissions_version_key
    on plugin_permissions (plugin_version_id, permission_key);
  `);

  await client.query(`
    create table if not exists plugin_instances (
      id text primary key not null,
      document_id text not null,
      surface_id text not null,
      plugin_export_id text not null,
      plugin_version_id text not null,
      display_name text not null,
      props jsonb,
      binding_config jsonb,
      persisted_state jsonb,
      created_at timestamp with time zone default now() not null,
      updated_at timestamp with time zone default now() not null
    );
  `);
  await client.query(`
    create index if not exists idx_plugin_instances_document_surface
    on plugin_instances (document_id, surface_id);
  `);
  await client.query(`
    create index if not exists idx_plugin_instances_version
    on plugin_instances (plugin_version_id);
  `);
  await client.query(`
    create index if not exists idx_plugin_instances_export
    on plugin_instances (plugin_export_id);
  `);
}

export async function createCanonicalPgliteDb(
  targetDir: string,
  options?: {
    dataDir?: string | null;
    migrationsFolder?: string;
    runMigrations?: boolean;
  },
): Promise<CanonicalPgliteHandle> {
  const dataDir = options?.dataDir === undefined
    ? resolveCanonicalDbLocation(targetDir)
    : options.dataDir;
  const migrationsFolder = options?.migrationsFolder ?? resolveCanonicalMigrationsFolder(targetDir);

  if (dataDir) {
    mkdirSync(dirname(dataDir), { recursive: true });
  }

  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  const db = drizzle(client, { schema });

  if (options?.runMigrations !== false) {
    await migrate(db, {
      migrationsFolder,
    });
    // Compatibility guard: when migration journal metadata lags behind the new SQL file,
    // plugin runtime tables can be absent even after migrate(). Bootstrap only if missing.
    if (!(await hasPluginRuntimeSchema(client))) {
      await ensurePluginRuntimeSchema(client);
    }
  }

  return {
    db,
    client,
    dataDir,
    close: async () => {
      await client.close();
    },
  };
}

if (isDirectCliInvocation()) {
  const runCli = async (): Promise<void> => {
    const targetDir = process.argv[2] ?? process.cwd();
    const handle = await createCanonicalPgliteDb(targetDir, { runMigrations: true });
    console.log(`Canonical PGlite migrations applied at ${handle.dataDir ?? 'memory://canonical'}`);
    await handle.close();
  };

  void runCli().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
