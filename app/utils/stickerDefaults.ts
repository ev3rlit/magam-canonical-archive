export interface StickerNormalized {
  outlineWidth: number;
  outlineColor: string;
  shadow: 'none' | 'sm' | 'md' | 'lg';
  padding: number;
}

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

export function normalizeStickerData(input: Record<string, any>): StickerNormalized {
  return {
    outlineWidth: clampOutlineWidth(input?.outlineWidth),
    outlineColor: input?.outlineColor || '#ffffff',
    shadow: input?.shadow === 'none' || input?.shadow === 'sm' || input?.shadow === 'md' || input?.shadow === 'lg'
      ? input.shadow
      : 'md',
    padding: clampPadding(input?.padding),
  };
}
