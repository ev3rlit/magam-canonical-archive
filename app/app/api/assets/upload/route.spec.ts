import { createHash } from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import { POST } from './route';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  stat: vi.fn(),
  unlink: vi.fn(),
  rename: vi.fn(),
}));

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);
const EXPECTED_HASH = createHash('sha256').update(PNG_BYTES).digest('hex').slice(0, 8);

function createFormDataForLocalFile(fileName: string, content: Buffer, mime: string): FormData {
  const form = new FormData();
  form.set('source', '/tmp/source.png');
  const file = new File([Uint8Array.from(content)], fileName, { type: mime });
  form.set('file', file);
  return form;
}

function toRequest(formData: FormData) {
  return new Request('http://localhost/api/assets/upload', {
    method: 'POST',
    body: formData,
  });
}

describe('assets/upload POST', () => {
  let writeFileMock: ReturnType<typeof vi.fn>;
  let mkdirMock: ReturnType<typeof vi.fn>;
  let statMock: ReturnType<typeof vi.fn>;
  let renameMock: ReturnType<typeof vi.fn>;
  let unlinkMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    writeFileMock = fs.writeFile as unknown as ReturnType<typeof vi.fn>;
    mkdirMock = fs.mkdir as unknown as ReturnType<typeof vi.fn>;
    statMock = fs.stat as unknown as ReturnType<typeof vi.fn>;
    renameMock = fs.rename as unknown as ReturnType<typeof vi.fn>;
    unlinkMock = fs.unlink as unknown as ReturnType<typeof vi.fn>;

    mkdirMock.mockResolvedValue(undefined as never);
    writeFileMock.mockResolvedValue(undefined as never);
    renameMock.mockResolvedValue(undefined as never);
    unlinkMock.mockResolvedValue(undefined as never);

    statMock.mockRejectedValue(new Error('not found'));
  });

  it('returns 422 when sourceType is url', async () => {
    const form = new FormData();
    form.set('source', 'https://example.com/image.png');
    form.set('sourceType', 'url');

    const response = await POST(toRequest(form));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.code).toBe('IMG_422_FETCH_FAILED');
  });

  it('returns 400 on unsupported extension', async () => {
    const form = new FormData();
    form.set('source', '/tmp/source.txt');
    form.set('file', new File([PNG_BYTES], 'logo.txt', { type: 'text/plain' }));

    const response = await POST(toRequest(form));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('IMG_400_UNSUPPORTED_TYPE');
  });

  it('returns 413 when file is too large', async () => {
    const tooBig = Buffer.alloc(10 * 1024 * 1024 + 1);
    const form = createFormDataForLocalFile('logo.png', tooBig, 'image/png');

    const response = await POST(toRequest(form));
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.code).toBe('IMG_413_TOO_LARGE');
  });

  it('returns 400 when mime mismatch signature', async () => {
    const badMimeBytes = Buffer.from('not-an-image');
    const form = createFormDataForLocalFile('logo.png', badMimeBytes, 'image/png');

    const response = await POST(toRequest(form));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('IMG_400_UNSUPPORTED_TYPE');
  });

  it('writes file and returns uploaded info', async () => {
    const form = createFormDataForLocalFile('logo.png', PNG_BYTES, 'image/png');

    const response = await POST(toRequest(form));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe('IMG_201_UPLOADED');
    expect(body.filename).toMatch(new RegExp(`^logo-${EXPECTED_HASH}\\.png$`));
    expect(body.path).toContain('assets/images');
    expect(mkdirMock).toHaveBeenCalled();
    expect(writeFileMock).toHaveBeenCalled();
    expect(renameMock).toHaveBeenCalled();
  });

  it('reuses existing file when same asset already exists', async () => {
    statMock.mockResolvedValue({
      isFile: () => true,
    } as any);

    const form = createFormDataForLocalFile('logo.png', PNG_BYTES, 'image/png');
    const response = await POST(toRequest(form));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(writeFileMock).not.toHaveBeenCalled();
    expect(body.code).toBe('IMG_201_UPLOADED');
  });
});
