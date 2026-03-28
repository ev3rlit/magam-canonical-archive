import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  createCanonicalCanvas,
  getCanonicalCanvas,
  listCanonicalCanvases,
  resolveCanonicalCanvasCompatibilityFilePath,
} from './service';

describe('canonical canvas shell service', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((targetDir) => rm(targetDir, { recursive: true, force: true })));
  });

  it('creates and lists canonical canvases using revision-backed shell metadata', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'magam-canonical-canvas-shell-'));
    tempDirs.push(targetDir);

    const created = await createCanonicalCanvas({
      targetDir,
      workspaceId: 'ws-shell',
      actor: {
        kind: 'user',
        id: 'tester',
      },
    });
    const createdCanvasId = created.canvasId;

    expect(created).toMatchObject({
      canvasId: expect.any(String),
      workspaceId: 'ws-shell',
      latestRevision: 1,
      nodeCount: 0,
      bindingCount: 0,
    });

    const compatibilityFilePath = await resolveCanonicalCanvasCompatibilityFilePath({
      targetDir,
      workspaceId: 'ws-shell',
      canvasId: createdCanvasId,
    });
    expect(compatibilityFilePath).toBe(`canvases/${createdCanvasId}.graph.tsx`);

    await expect(listCanonicalCanvases({ targetDir, workspaceId: 'ws-shell' })).resolves.toEqual([
      expect.objectContaining({
        canvasId: createdCanvasId,
      }),
    ]);
    await expect(getCanonicalCanvas({
      targetDir,
      workspaceId: 'ws-shell',
      canvasId: createdCanvasId,
    })).resolves.toMatchObject({
      canvasId: createdCanvasId,
    });
  });

  it('falls back to a generated compatibility file path', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'magam-canonical-canvas-shell-'));
    tempDirs.push(targetDir);

    const created = await createCanonicalCanvas({
      targetDir,
      workspaceId: 'ws-shell',
    });
    const createdCanvasId = created.canvasId;
    const compatibilityFilePath = await resolveCanonicalCanvasCompatibilityFilePath({
      targetDir,
      workspaceId: 'ws-shell',
      canvasId: createdCanvasId,
    });
    expect(compatibilityFilePath).toBe(`canvases/${createdCanvasId}.graph.tsx`);
  });
});
