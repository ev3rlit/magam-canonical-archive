import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { comparePdfWithGolden, hashNormalizedPdf } from './pdfGolden';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'magam-pdf-golden-'));
  tempDirs.push(dir);
  return dir;
}

function samplePdfWithDate(date: string): Buffer {
  return Buffer.from(`%PDF-1.7\n1 0 obj\n<< /CreationDate (${date}) /ModDate (${date}) /ID [<ABC><DEF>] >>\nendobj\n%%EOF`, 'latin1');
}

function sampleWashiPdf(date: string, presetId: string): Buffer {
  return Buffer.from(
    `%PDF-1.7\n1 0 obj\n<< /CreationDate (${date}) /ModDate (${date}) /ID [<ABC><DEF>] /Title (washi:${presetId}) >>\nendobj\n%%EOF`,
    'latin1',
  );
}

describe('pdf golden comparison pipeline', () => {
  it('normalizes volatile PDF metadata fields before hashing', () => {
    const a = samplePdfWithDate('D:20260218093000+09\'00\'');
    const b = samplePdfWithDate('D:20260219093000+09\'00\'');

    expect(hashNormalizedPdf(a)).toBe(hashNormalizedPdf(b));
  });

  it('creates golden file when missing and reports updated=true', async () => {
    const dir = await makeTempDir();
    const actualPath = join(dir, 'actual.pdf');
    const goldenPath = join(dir, '__golden__', 'sample.pdf');

    await writeFile(actualPath, samplePdfWithDate('D:20260218093000+09\'00\''));

    const result = await comparePdfWithGolden(actualPath, goldenPath);

    expect(result.matched).toBe(true);
    expect(result.updated).toBe(true);

    const golden = await readFile(goldenPath);
    expect(golden.length).toBeGreaterThan(0);
  });

  it('detects content regressions when normalized hash differs', async () => {
    const dir = await makeTempDir();
    const actualPath = join(dir, 'actual.pdf');
    const goldenPath = join(dir, 'golden.pdf');

    await writeFile(goldenPath, Buffer.from('%PDF-1.7\n1 0 obj\n<< /Title (A) >>\nendobj\n%%EOF', 'latin1'));
    await writeFile(actualPath, Buffer.from('%PDF-1.7\n1 0 obj\n<< /Title (B) >>\nendobj\n%%EOF', 'latin1'));

    const result = await comparePdfWithGolden(actualPath, goldenPath);

    expect(result.matched).toBe(false);
    expect(result.updated).toBe(false);
    expect(result.actualHash).not.toBe(result.goldenHash);
  });

  it('keeps washi export payload hash stable across volatile metadata changes', () => {
    const a = sampleWashiPdf('D:20260218093000+09\'00\'', 'pastel-dots');
    const b = sampleWashiPdf('D:20260228093000+09\'00\'', 'pastel-dots');

    expect(hashNormalizedPdf(a)).toBe(hashNormalizedPdf(b));
  });
});
