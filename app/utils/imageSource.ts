import { resolveHostApiPath } from '@/features/host/renderer/resolveHostApiPath';

export const IMAGE_API_PATH = '/api/assets/file';

const REMOTE_IMAGE_RE = /^(?:https?:\/\/|data:)/i;

const normalizeSegment = (segment: string): string => {
    return segment.trim();
};

function isRemoteSource(src: string): boolean {
    return REMOTE_IMAGE_RE.test(src);
}

function normalizePathSegments(segments: string[]): string[] {
    const normalized: string[] = [];

    segments.forEach((segment) => {
        if (!segment || segment === '.') {
            return;
        }

        if (segment === '..') {
            normalized.pop();
            return;
        }

        normalized.push(segment);
    });

    return normalized;
}

export function resolveWorkspaceAssetPath(currentFilePath: string | null, rawSrc: string): string {
    const src = normalizeSegment(rawSrc);

    if (!src || isRemoteSource(src)) {
        return src;
    }

    if (src.startsWith('/')) {
        return src.replace(/^\/+/, '');
    }

    const fileDir = currentFilePath ? currentFilePath.split('/').slice(0, -1).join('/') : '';
    const segments = src.startsWith('./') || src.startsWith('../')
        ? src.split('/')
        : `${fileDir ? `${fileDir}/` : ''}${src}`.split('/');

    const normalized = normalizePathSegments(segments);
    return normalized.join('/');
}

export function toAssetApiUrl(currentFilePath: string | null, rawSrc: string): string {
    const resolved = resolveWorkspaceAssetPath(currentFilePath, rawSrc);

    if (!resolved || isRemoteSource(resolved) || resolved.startsWith('blob:') || resolved.startsWith('http://localhost/')) {
        return resolved;
    }

    if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
        return resolved;
    }

    return `${resolveHostApiPath(IMAGE_API_PATH)}?path=${encodeURIComponent(resolved)}`;
}
