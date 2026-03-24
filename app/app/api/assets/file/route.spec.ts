import type { Stats } from 'node:fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs/promises';
import { GET } from './route';

let mockStat: ReturnType<typeof vi.fn>;
let mockReadFile: ReturnType<typeof vi.fn>;

vi.mock('node:fs/promises', () => ({
  stat: vi.fn(),
  readFile: vi.fn(),
}));

describe('assets/file GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStat = vi.mocked(fs.stat);
    mockReadFile = vi.mocked(fs.readFile);
  });

  it('returns 400 when path is missing', async () => {
    const response = await GET(new Request('http://localhost/api/assets/file'));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('IMG_400_INVALID_SOURCE');
  });

  it('blocks path traversal with ../', async () => {
    const response = await GET(new Request('http://localhost/api/assets/file?path=../secret.txt'));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('IMG_400_INVALID_SOURCE');
  });

  it('returns 400 when uri decode fails', async () => {
    const response = await GET(new Request('http://localhost/api/assets/file?path=%E0%A4%A'));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('IMG_400_INVALID_SOURCE');
  });

  it('returns 422 when extension is not allowed', async () => {
    const response = await GET(new Request('http://localhost/api/assets/file?path=assets/images/logo.txt'));
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe('IMG_400_INVALID_SOURCE');
  });

  it('returns 404 when file is not found', async () => {
    mockStat.mockRejectedValue(new Error('ENOENT'));
    const response = await GET(new Request('http://localhost/api/assets/file?path=assets/images/missing.png'));
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.code).toBe('IMG_404_NOT_FOUND');
  });

  it('returns file stream with correct content type', async () => {
    const existingFileStat = { isFile: () => true } satisfies Pick<Stats, 'isFile'>;
    mockStat.mockResolvedValue(existingFileStat as Stats);
    const content = Buffer.from('89504e470d0a1a0a0000000000000000', 'hex');
    mockReadFile.mockResolvedValue(content);

    const response = await GET(new Request('http://localhost/api/assets/file?path=assets/images/logo.png'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    const body = Buffer.from(await response.arrayBuffer());
    expect(body.equals(content)).toBe(true);
  });
});
