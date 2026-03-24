import { createHash } from 'node:crypto';
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { API_SHARED_MESSAGES } from '../../_shared/messages';

const WORKSPACE_ROOT = path.resolve(process.env.MAGAM_TARGET_DIR || process.cwd());

const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']);

function getMimeType(ext: string): string {
    const map: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
      svg: 'image/svg+xml',
    };

    return map[ext];
}

function resolveAssetPath(rawPath: string): string {
  let decoded = '';
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    throw new Error('IMG_400_INVALID_SOURCE');
  }
  const normalized = path.normalize(decoded).replace(/^([.][\\/])+/, '');
  if (path.isAbsolute(normalized)) {
    throw new Error('IMG_400_INVALID_SOURCE');
  }

  if (normalized.includes('..')) {
    throw new Error('IMG_400_INVALID_SOURCE');
  }

  const absPath = path.resolve(WORKSPACE_ROOT, normalized);
  const rel = path.relative(WORKSPACE_ROOT, absPath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('IMG_400_INVALID_SOURCE');
  }

  return absPath;
}

function createFileError(status: number, code: string, message: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPath = searchParams.get('path');

    if (!rawPath) {
      return createFileError(400, 'IMG_400_INVALID_SOURCE', API_SHARED_MESSAGES.pathRequired);
    }

    const absPath = resolveAssetPath(rawPath);
    const extension = path.extname(absPath).slice(1).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return createFileError(422, 'IMG_400_INVALID_SOURCE', API_SHARED_MESSAGES.unsupportedAssetExtension);
    }

    const info = await stat(absPath);
    if (!info.isFile()) {
      return createFileError(404, 'IMG_404_NOT_FOUND', API_SHARED_MESSAGES.assetNotFound);
    }

    const buffer = await readFile(absPath);
    const mimeType = getMimeType(extension);
    const body = new Uint8Array(buffer);

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': body.byteLength.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Hash': createHash('sha256').update(buffer).digest('hex'),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : API_SHARED_MESSAGES.unknownError;
    if (message === 'IMG_400_INVALID_SOURCE') {
      return createFileError(400, message, API_SHARED_MESSAGES.invalidAssetPath);
    }

    if (message.startsWith('ENOENT') || message.includes('no such file')) {
      return createFileError(404, 'IMG_404_NOT_FOUND', API_SHARED_MESSAGES.assetFileNotFound);
    }

    console.error(API_SHARED_MESSAGES.routeLog.assetsFile, message);
    return createFileError(500, 'IMG_500_ASSET_READ_FAILED', message);
  }
}
