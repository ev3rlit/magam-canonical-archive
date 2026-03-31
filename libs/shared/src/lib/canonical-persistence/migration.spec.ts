import { describe, expect, it } from 'vitest';
import { createCanonicalPgliteDb } from './pglite-db';

describe('canonical migration smoke', () => {
  it('creates the core persistence tables on a clean database', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const result = await handle.client.query(`
      select tablename
      from pg_tables
      where schemaname = 'public'
        and tablename in (
          'objects',
          'object_relations',
          'canvas_nodes',
          'canvas_bindings',
          'document_revisions',
          'library_items',
          'library_collections',
          'library_item_collections',
          'library_item_versions'
        )
      order by tablename
    `);

    expect(result.rows.map((row) => (row as { tablename: string }).tablename)).toEqual([
      'canvas_bindings',
      'canvas_nodes',
      'document_revisions',
      'library_collections',
      'library_item_collections',
      'library_item_versions',
      'library_items',
      'object_relations',
      'objects',
    ]);

    await handle.close();
  });
});
