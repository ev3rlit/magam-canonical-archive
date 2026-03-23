import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile, stat, unlink, rename } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { API_SHARED_MESSAGES } from '../../_shared/messages';

const WORKSPACE_ROOT = path.resolve(process.env.MAGAM_TARGET_DIR || process.cwd());
const MAX_BYTES = 10 * 1024 * 1024;
const ASSET_DIR = path.join(WORKSPACE_ROOT, 'assets', 'images');

const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']);
const ALLOWED_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

function hashPreview(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 8);
}

function sanitizeBaseName(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'image';
}

function detectExtensionByContent(buffer: Buffer, fallbackExt: string): string | null {
  const bytes = Uint8Array.from(buffer.slice(0, 12));

  // PNG
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'png';
  }

  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }

  // GIF
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'gif';
  }

  // WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'webp';
  }

  // SVG signature check fallback
  const ascii = buffer.slice(0, 256).toString('utf8').trim();
  if (/^<\?xml/i.test(ascii) || /^<svg/i.test(ascii)) {
    return fallbackExt === 'svg' ? 'svg' : null;
  }

  return null;
}

function buildError(status: number, code: string, error: string) {
  return NextResponse.json({ error, code }, { status });
}

function isUrlAllowed(source: string) {
  try {
    const url = new URL(source);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function validateTargetDir() {
  await mkdir(ASSET_DIR, { recursive: true });
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const source = String(formData.get('source') || '');
    const sourceType = String(formData.get('sourceType') || 'local');

    if (sourceType === 'url') {
      if (!isUrlAllowed(source)) {
        return buildError(400, 'IMG_400_INVALID_SOURCE', API_SHARED_MESSAGES.uploadUrlSourceInvalid);
      }
      // URL mode intentionally not implemented in v1: enforce explicit local upload path
      return buildError(422, 'IMG_422_FETCH_FAILED', API_SHARED_MESSAGES.uploadUrlSourceUnsupported);
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      return buildError(400, 'IMG_400_INVALID_SOURCE', API_SHARED_MESSAGES.uploadFileRequired);
    }

    if (file.size <= 0) {
      return buildError(400, 'IMG_400_INVALID_SOURCE', API_SHARED_MESSAGES.uploadEmptyFile);
    }

    if (file.size > MAX_BYTES) {
      return buildError(413, 'IMG_413_TOO_LARGE', API_SHARED_MESSAGES.uploadFileTooLarge);
    }

    const mime = (file.type || '').toLowerCase();
    const originalName = file.name || `image-${randomUUID()}`;
    const originalExt = path.extname(originalName).replace(/^\./, '').toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(originalExt)) {
      return buildError(400, 'IMG_400_UNSUPPORTED_TYPE', API_SHARED_MESSAGES.uploadUnsupportedExtension(originalExt));
    }

    if (!ALLOWED_MIMES.has(mime)) {
      return buildError(400, 'IMG_400_UNSUPPORTED_TYPE', API_SHARED_MESSAGES.uploadUnsupportedMime(mime));
    }

    const data = Buffer.from(await file.arrayBuffer());
    const detectedExt = detectExtensionByContent(data, originalExt);
    if (!detectedExt) {
      return buildError(400, 'IMG_400_UNSUPPORTED_TYPE', API_SHARED_MESSAGES.uploadUnsupportedImageSignature);
    }

    if (detectedExt !== originalExt && !(detectedExt === 'jpeg' && originalExt === 'jpg')) {
      return buildError(400, 'IMG_400_UNSUPPORTED_TYPE', API_SHARED_MESSAGES.uploadMimeExtensionMismatch);
    }

    await validateTargetDir();

    const hash = hashPreview(data);
    const baseName = sanitizeBaseName(path.parse(originalName).name);
    const ext = detectedExt === 'jpeg' ? 'jpg' : detectedExt;
    const fileName = `${baseName}-${hash}.${ext}`;
    const absPath = path.join(ASSET_DIR, fileName);

    try {
      // If same hash+name already exists, we treat it as already uploaded.
      const existing = await stat(absPath);
      if (!existing.isFile()) {
        return buildError(500, 'IMG_500_UPLOAD_FAILED', API_SHARED_MESSAGES.uploadTargetPathNotFile);
      }
    } catch {
      const tmpPath = `${absPath}.${randomUUID()}.tmp`;
      try {
        await writeFile(tmpPath, data);
        await rename(tmpPath, absPath);
      } catch (err) {
        await unlink(tmpPath).catch(() => {});
        throw err;
      }
    }

    const relativePath = path.relative(WORKSPACE_ROOT, absPath).replace(/\\/g, '/');

    return NextResponse.json({
      path: relativePath,
      filename: fileName,
      size: data.length,
      source: '/api/assets/file',
      code: 'IMG_201_UPLOADED',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : API_SHARED_MESSAGES.unknownError;
    console.error(API_SHARED_MESSAGES.routeLog.assetsUpload, message);
    return buildError(500, 'IMG_500_UPLOAD_FAILED', message);
  }
}
