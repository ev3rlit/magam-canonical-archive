import { describe, expect, it } from 'bun:test';
import { getStickerJitterAngle, resolveStickerRotation } from './stickerJitter';

describe('getStickerJitterAngle', () => {
  it('returns deterministic angle for same seed', () => {
    const first = getStickerJitterAngle('sticker-text');
    const second = getStickerJitterAngle('sticker-text');

    expect(first).toBe(second);
  });

  it('never returns zero to keep visible jitter', () => {
    const sampleSeeds = [
      'a',
      'b',
      'c',
      'sticker-1',
      'sticker-2',
      'sticker-3',
      'emoji',
      'markdown',
      'image',
      '',
    ];

    sampleSeeds.forEach((seed) => {
      expect(getStickerJitterAngle(seed)).not.toBe(0);
    });
  });

  it('keeps jitter angle in +/-5 range', () => {
    const sampleSeeds = [
      'alpha',
      'beta',
      'gamma',
      'delta',
      'epsilon',
      'sticker-text',
      'sticker-emoji',
      'sticker-image',
      'sticker-markdown',
      '',
    ];

    sampleSeeds.forEach((seed) => {
      const angle = getStickerJitterAngle(seed);
      expect(angle).toBeGreaterThanOrEqual(-5);
      expect(angle).toBeLessThanOrEqual(5);
      expect(angle).not.toBe(0);
    });
  });

  it('uses explicit rotation when provided, otherwise falls back to jitter', () => {
    expect(resolveStickerRotation(12, 'sticker-text')).toBe(12);
    expect(resolveStickerRotation(-3, 'sticker-text')).toBe(-3);

    const fallback = resolveStickerRotation(undefined, 'sticker-text');
    expect(fallback).toBe(getStickerJitterAngle('sticker-text'));
  });
});
