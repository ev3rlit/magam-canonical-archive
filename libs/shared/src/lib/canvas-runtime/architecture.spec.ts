import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const FEATURE_DIR = path.resolve(
  process.cwd(),
  'libs/shared/src/lib/canvas-runtime',
);

async function listTypeScriptFiles(dir: string): Promise<string[]> {
  let entries: string[] = [];
  const children = await fs.readdir(dir, { withFileTypes: true });

  for (const child of children) {
    const resolved = path.join(dir, child.name);
    if (child.isDirectory()) {
      entries = entries.concat(await listTypeScriptFiles(resolved));
      continue;
    }
    if (child.isFile() && /\.(ts|tsx)$/.test(child.name)) {
      entries.push(resolved);
    }
  }

  return entries;
}

describe('canvas-runtime architecture', () => {
  it('does not import app modules, reactflow, or websocket transport code', async () => {
    const files = (await listTypeScriptFiles(FEATURE_DIR))
      .filter((file) => !file.endsWith('.spec.ts'));

    const violations: string[] = [];

    for (const file of files) {
      const source = await fs.readFile(file, 'utf8');
      if (
        /from\s+['"][^'"]*app\//.test(source)
        || /from\s+['"]reactflow['"]/.test(source)
        || /from\s+['"][^'"]*\/ws\//.test(source)
      ) {
        violations.push(path.relative(process.cwd(), file));
      }
    }

    expect(violations).toEqual([]);
  });
});
