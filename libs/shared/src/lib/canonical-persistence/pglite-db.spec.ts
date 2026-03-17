import { describe, expect, it } from 'vitest';
import { createCanonicalPgliteDb, resolveCanonicalDbLocation } from './pglite-db';
import { CanonicalPersistenceRepository } from './repository';

describe('canonical pglite bootstrap', () => {
  it('resolves a default canonical data directory path', () => {
    expect(resolveCanonicalDbLocation('/tmp/magam')).toContain('.magam/canonical-pgdata');
  });

  it('resolves tombstoned objects through placeholder metadata', async () => {
    const handle = await createCanonicalPgliteDb(process.cwd(), { dataDir: null });
    const repository = new CanonicalPersistenceRepository(handle.db);

    await repository.createCanonicalObject({
      record: {
        id: 'note-1',
        workspaceId: 'ws-1',
        semanticRole: 'sticky-note',
        publicAlias: 'Sticky',
        sourceMeta: { sourceId: 'note-1', kind: 'canvas' },
        capabilities: {},
        contentBlocks: [{ id: 'body-1', blockType: 'text', text: 'hello' }],
        primaryContentKind: 'text',
        canonicalText: 'hello',
      },
      operation: 'create',
    });

    await repository.tombstoneCanonicalObject('ws-1', 'note-1');
    const resolved = await repository.resolveCanonicalObject('ws-1', 'note-1');

    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.value.placeholder).toBe(true);
    }

    await handle.close();
  });
});
