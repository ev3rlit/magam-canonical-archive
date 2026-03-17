import { describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

const FEATURE_DIR = path.resolve(
  process.cwd(),
  'libs/shared/src/lib/canonical-persistence',
);

async function listTypeScriptFiles(dir: string): Promise<string[]> {
  let entries: string[] = [];

  try {
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
  } catch {
    return [];
  }

  return entries;
}

describe('canonical-persistence architecture', () => {
  it('does not import app feature modules from the shared persistence layer', async () => {
    const files = await listTypeScriptFiles(FEATURE_DIR);
    const implementationFiles = files.filter((file) => !file.endsWith('.spec.ts'));

    const violations: string[] = [];

    for (const file of implementationFiles) {
      const source = await fs.readFile(file, 'utf8');
      const matches = source.match(/from\s+['"]([^'"]+)['"]/g) ?? [];

      if (matches.some((entry) => /app\/features/.test(entry))) {
        violations.push(path.relative(process.cwd(), file));
      }
    }

    expect(violations).toEqual([]);
  });
});
