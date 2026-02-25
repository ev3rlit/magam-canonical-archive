import { describe, expect, it } from 'bun:test';
import { normalizeStickerData } from './stickerDefaults';

describe('normalizeStickerData', () => {
  it('applies sticker defaults', () => {
    const result = normalizeStickerData({});

    expect(result.outlineWidth).toBe(8);
    expect(result.outlineColor).toBe('#ffffff');
    expect(result.shadow).toBe('md');
    expect(result.padding).toBe(12);
  });

  it('keeps explicit style overrides', () => {
    const result = normalizeStickerData({
      outlineWidth: 10,
      outlineColor: '#abc123',
      shadow: 'lg',
      padding: 4,
    });

    expect(result).toMatchObject({
      outlineWidth: 10,
      outlineColor: '#abc123',
      shadow: 'lg',
      padding: 4,
    });
  });

  it('clamps outlineWidth into safe range', () => {
    const tooLarge = normalizeStickerData({ outlineWidth: 999 });
    const tooSmall = normalizeStickerData({ outlineWidth: -3 });

    expect(tooLarge.outlineWidth).toBe(14);
    expect(tooSmall.outlineWidth).toBe(8);
  });

  it('normalizes missing style values with sane fallbacks', () => {
    const result = normalizeStickerData({ outlineWidth: 'bad' as any, padding: 'bad' as any });

    expect(result.outlineWidth).toBe(8);
    expect(result.padding).toBe(12);
  });
});
