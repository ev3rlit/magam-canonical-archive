import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createCanonicalCanvas,
  getCanonicalCanvas,
  listCanonicalCanvases,
} from './service';

describe('canonical document shell service', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((targetDir) => rm(targetDir, { recursive: true, force: true })));
  });

  it('creates and lists canonical documents using revision-backed shell metadata', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'magam-canonical-canvas-shell-'));
    tempDirs.push(targetDir);

    const created = await createCanonicalCanvas({
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

    await expect(listCanonicalCanvases({ targetDir, workspaceId: 'ws-shell' })).resolves.toEqual([
      expect.objectContaining({
        canvasId: created.canvasId,
        filePath: 'docs/alpha.graph.tsx',
      }),
    ]);
    await expect(getCanonicalCanvas({
      targetDir,
      workspaceId: 'ws-shell',
      canvasId: created.canvasId,
    })).resolves.toMatchObject({
      canvasId: created.canvasId,
      filePath: 'docs/alpha.graph.tsx',
    });
  });

  it('falls back to a generated compatibility file path and rejects path escape attempts', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'magam-canonical-canvas-shell-'));
    tempDirs.push(targetDir);

    const created = await createCanonicalCanvas({
      targetDir,
      workspaceId: 'ws-shell',
    });
    expect(created.filePath).toBe(`documents/${created.canvasId}.graph.tsx`);

    await expect(createCanonicalCanvas({
      targetDir,
      workspaceId: 'ws-shell',
      filePath: '../escape.graph.tsx',
    })).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
  });
});
