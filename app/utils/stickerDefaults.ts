export interface StickerNormalized {
  outlineWidth: number;
  outlineColor: string;
  shadow: 'none' | 'sm' | 'md' | 'lg';
  padding: number;
}

export type StickerCreateDefaults = StickerNormalized;
type StickerNormalizationInput = {
  outlineWidth?: unknown;
  outlineColor?: unknown;
  shadow?: unknown;
  padding?: unknown;
};

const OUTLINE_WIDTH_MIN = 8;
const OUTLINE_WIDTH_MAX = 14;

function clampOutlineWidth(value: unknown): number {
  const base = typeof value === 'number' && Number.isFinite(value) ? value : OUTLINE_WIDTH_MIN;
  return Math.max(OUTLINE_WIDTH_MIN, Math.min(OUTLINE_WIDTH_MAX, Math.round(base)));
}

function clampPadding(value: unknown): number {
  const base = typeof value === 'number' && Number.isFinite(value) ? value : 12;
  return Math.max(0, Math.round(base));
}

export function normalizeStickerData(input: StickerNormalizationInput): StickerNormalized {
  return {
    outlineWidth: clampOutlineWidth(input?.outlineWidth),
    outlineColor: typeof input?.outlineColor === 'string' ? input.outlineColor : '#ffffff',
    shadow: input?.shadow === 'none' || input?.shadow === 'sm' || input?.shadow === 'md' || input?.shadow === 'lg'
      ? input.shadow
      : 'md',
    padding: clampPadding(input?.padding),
  };
}

export function getDefaultStickerCreateProps(): StickerCreateDefaults {
  return normalizeStickerData({});
}
