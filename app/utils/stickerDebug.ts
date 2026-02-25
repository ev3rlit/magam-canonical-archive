const STICKER_DEBUG_STORAGE_KEY = 'magam:debug:sticker';

declare global {
  interface Window {
    __MAGAM_DEBUG_STICKER__?: boolean;
  }
}

function getDebugOverride(): boolean | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (window.__MAGAM_DEBUG_STICKER__ === true) {
    return true;
  }

  try {
    const value = window.localStorage.getItem(STICKER_DEBUG_STORAGE_KEY);
    if (value === '1') return true;
    if (value === '0') return false;
  } catch {
    // Ignore storage access errors.
  }

  return null;
}

export function isStickerDebugEnabled(): boolean {
  const override = getDebugOverride();
  if (override !== null) {
    return override;
  }

  if (process.env.NEXT_PUBLIC_MAGAM_DEBUG_STICKER === '1') {
    return true;
  }

  return process.env.NODE_ENV !== 'production';
}

export function stickerDebugLog(scope: string, payload: Record<string, unknown>): void {
  if (!isStickerDebugEnabled()) return;
  console.debug(`[StickerDebug:${scope}]`, payload);
}

