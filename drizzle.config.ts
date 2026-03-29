import { defineConfig } from 'drizzle-kit';

const canonicalDbUrl = process.env.MAGAM_CANONICAL_DB_URL?.trim()
  || 'postgres://postgres:postgres@localhost:5432/magam_canonical';

export default defineConfig({
  dialect: 'postgresql',
  schema: './libs/shared/src/lib/canonical-persistence/schema.ts',
  out: './libs/shared/src/lib/canonical-persistence/drizzle',
  dbCredentials: {
    url: canonicalDbUrl,
  },
  strict: true,
  verbose: true,
});
