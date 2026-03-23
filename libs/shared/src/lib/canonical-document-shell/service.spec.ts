import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createCanonicalDocument,
  getCanonicalDocument,
  listCanonicalDocuments,
} from './service';

describe('canonical document shell service', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((targetDir) => rm(targetDir, { recursive: true, force: true })));
  });

  it('creates and lists canonical documents using revision-backed shell metadata', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'magam-canonical-document-shell-'));
    tempDirs.push(targetDir);

    const created = await createCanonicalDocument({
      targetDir,
      workspaceId: 'ws-shell',
      filePath: 'docs/alpha.graph.tsx',
      actor: {
        kind: 'user',
        id: 'tester',
      },
    });

    expect(created).toMatchObject({
      workspaceId: 'ws-shell',
      filePath: 'docs/alpha.graph.tsx',
      latestRevision: 1,
      nodeCount: 0,
      bindingCount: 0,
    });

    await expect(listCanonicalDocuments({ targetDir, workspaceId: 'ws-shell' })).resolves.toEqual([
      expect.objectContaining({
        documentId: created.documentId,
        filePath: 'docs/alpha.graph.tsx',
      }),
    ]);
    await expect(getCanonicalDocument({
      targetDir,
      workspaceId: 'ws-shell',
      documentId: created.documentId,
    })).resolves.toMatchObject({
      documentId: created.documentId,
      filePath: 'docs/alpha.graph.tsx',
    });
  });

  it('falls back to a generated compatibility file path and rejects path escape attempts', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'magam-canonical-document-shell-'));
    tempDirs.push(targetDir);

    const created = await createCanonicalDocument({
      targetDir,
      workspaceId: 'ws-shell',
    });
    expect(created.filePath).toBe(`documents/${created.documentId}.graph.tsx`);

    await expect(createCanonicalDocument({
      targetDir,
      workspaceId: 'ws-shell',
      filePath: '../escape.graph.tsx',
    })).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
  });
});
