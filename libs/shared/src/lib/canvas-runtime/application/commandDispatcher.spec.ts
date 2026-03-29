import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const FILE = path.resolve(
  process.cwd(),
  'libs/shared/src/lib/canvas-runtime/application/dispatchCanvasMutation.ts',
);

describe('canvas runtime command dispatcher source', () => {
  it('translates body block targeting before handing off to canonical-mutation', async () => {
    const source = await fs.readFile(FILE, 'utf8');

    expect(source).toContain("resolveBodyBlockTarget");
    expect(source).toContain("resolveBodyBlockPosition");
    expect(source).toContain("executeMutationBatch");
    expect(source).toContain("createMutationSuccessEnvelope");
    expect(source).not.toContain("node.group.update");
  });
});
