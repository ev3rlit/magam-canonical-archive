import { existsSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from './contracts/schema';

export type AppStateDb = ReturnType<typeof drizzle<typeof schema>>;

export interface AppStatePgliteHandle {
  db: AppStateDb;
  client: PGlite;
  dataDir: string | null;
  close: () => Promise<void>;
}

export interface CreateAppStatePgliteOptions {
  dataDir?: string | null;
  migrationsFolder?: string;
  runMigrations?: boolean;
}

export function resolveAppStateDbLocation(targetDir: string): string {
  const explicit = process.env['MAGAM_APP_STATE_DB_PATH']?.trim();
  if (explicit) {
    return explicit;
  }

  return join(targetDir, '.magam', 'app-state-pgdata');
}

export function resolveAppStateMigrationsFolder(_targetDir: string): string {
  return join(process.cwd(), 'libs', 'shared', 'src', 'lib', 'app-state-persistence', 'drizzle');
}

function isDirectCliInvocation(): boolean {
  const invokedPath = process.argv[1] ?? '';
  return /(?:^|\/)pglite-db\.(?:ts|js|mjs|cjs)$/.test(invokedPath);
}

async function applySqlMigrationsWithoutJournal(
  client: PGlite,
  migrationsFolder: string,
): Promise<void> {
  await client.exec(`
    create table if not exists magam_app_state_migrations (
      migration_name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const sqlFiles = readdirSync(migrationsFolder)
    .filter((fileName) => /^\d+.*\.sql$/.test(fileName))
    .sort((left, right) => left.localeCompare(right));

  for (const fileName of sqlFiles) {
    const existing = await client.query(
      'select migration_name from magam_app_state_migrations where migration_name = $1 limit 1',
      [fileName],
    );
    if (existing.rows.length > 0) {
      continue;
    }

    if (await shouldBackfillLegacyMigrationRecord(client, fileName)) {
      await client.query(
        'insert into magam_app_state_migrations (migration_name) values ($1)',
        [fileName],
      );
      continue;
    }

    const sql = readFileSync(join(migrationsFolder, fileName), 'utf8');
    const statements = sql
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await client.exec(statement);
    }

    await client.query(
      'insert into magam_app_state_migrations (migration_name) values ($1)',
      [fileName],
    );
  }
}

async function shouldBackfillLegacyMigrationRecord(
  client: PGlite,
  fileName: string,
): Promise<boolean> {
  if (fileName !== '0000_app_global_state.sql') {
    return false;
  }

  const existingTables = await client.query(`
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename in (
        'app_workspaces',
        'app_workspace_session',
        'app_recent_canvases',
        'app_preferences'
      )
    order by tablename
  `);

  return existingTables.rows.length === 4;
}

export async function createAppStatePgliteDb(
  targetDir: string,
  options?: CreateAppStatePgliteOptions,
): Promise<AppStatePgliteHandle> {
  const dataDir = options?.dataDir === undefined
    ? resolveAppStateDbLocation(targetDir)
    : options.dataDir;
  const migrationsFolder = options?.migrationsFolder ?? resolveAppStateMigrationsFolder(targetDir);

  if (dataDir) {
    mkdirSync(dirname(dataDir), { recursive: true });
  }

  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  const db = drizzle(client, { schema });

  if (options?.runMigrations !== false) {
    const journalPath = join(migrationsFolder, 'meta', '_journal.json');
    if (existsSync(journalPath)) {
      await migrate(db, {
        migrationsFolder,
      });
    } else {
      await applySqlMigrationsWithoutJournal(client, migrationsFolder);
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
    const handle = await createAppStatePgliteDb(targetDir, { runMigrations: true });
    console.log(`App-state PGlite migrations applied at ${handle.dataDir ?? 'memory://app-state'}`);
    await handle.close();
  };

  void runCli().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
