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
