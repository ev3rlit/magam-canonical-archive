import type {
  Object2DScaleEntry,
  SizeRatio,
  SizeToken,
  TypographyScaleEntry,
} from './types';

export const DEFAULT_SIZE_TOKEN: SizeToken = 'm';
export const DEFAULT_SIZE_RATIO: SizeRatio = 'landscape';

export const TYPOGRAPHY_SCALE: Record<string, TypographyScaleEntry> = {
  xs: { fontSizePx: 12, lineHeightPx: 16 },
  s: { fontSizePx: 14, lineHeightPx: 20 },
  m: { fontSizePx: 16, lineHeightPx: 24 },
  l: { fontSizePx: 18, lineHeightPx: 28 },
  xl: { fontSizePx: 20, lineHeightPx: 28 },
};

export const SPACE_SCALE: Record<string, number> = {
  xs: 8,
  s: 12,
  m: 16,
  l: 24,
  xl: 32,
};

export const OBJECT2D_SCALE: Record<string, Object2DScaleEntry> = {
  xs: {
    landscape: { widthPx: 128, heightPx: 80 },
    square: { widthPx: 80, heightPx: 80 },
  },
  s: {
    landscape: { widthPx: 160, heightPx: 96 },
    square: { widthPx: 96, heightPx: 96 },
  },
  m: {
    landscape: { widthPx: 192, heightPx: 120 },
    square: { widthPx: 120, heightPx: 120 },
  },
  l: {
    landscape: { widthPx: 256, heightPx: 160 },
    square: { widthPx: 160, heightPx: 160 },
  },
  xl: {
    landscape: { widthPx: 320, heightPx: 200 },
    square: { widthPx: 200, heightPx: 200 },
  },
};

export const LANDSCAPE_ASPECT_RATIO = 8 / 5;

export function isKnownSizeToken(value: unknown): value is SizeToken {
  return typeof value === 'string' && value in TYPOGRAPHY_SCALE;
}

export function resolveObject2DTokenSize(
  token: SizeToken,
  ratio: SizeRatio,
): { widthPx: number; heightPx: number; ratioUsed: SizeRatio } {
  const entry = OBJECT2D_SCALE[token];
  if (!entry) {
    const fallback = OBJECT2D_SCALE[DEFAULT_SIZE_TOKEN];
    return {
      widthPx: fallback.landscape.widthPx,
      heightPx: fallback.landscape.heightPx,
      ratioUsed: DEFAULT_SIZE_RATIO,
    };
  }

  if (ratio === 'square') {
    return {
      widthPx: entry.square.widthPx,
      heightPx: entry.square.heightPx,
      ratioUsed: 'square',
    };
  }

  if (ratio === 'portrait') {
    return {
      widthPx: entry.landscape.heightPx,
      heightPx: entry.landscape.widthPx,
      ratioUsed: 'portrait',
    };
  }

  return {
    widthPx: entry.landscape.widthPx,
    heightPx: entry.landscape.heightPx,
    ratioUsed: 'landscape',
  };
}

