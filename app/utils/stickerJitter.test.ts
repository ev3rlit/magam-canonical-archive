import { describe, expect, it } from 'bun:test';
import {
  getStickerJitterAngle,
  getWashiJitterAngle,
  getWashiShapeSkewAngle,
  resolveStickerRotation,
  resolveWashiAngle,
} from './stickerJitter';

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

describe('getWashiJitterAngle', () => {
  it('returns deterministic angle for same seed', () => {
    const first = getWashiJitterAngle('washi-text');
    const second = getWashiJitterAngle('washi-text');

    expect(first).toBe(second);
  });

  it('keeps rotation jitter angle in +/-5 range', () => {
    const sampleSeeds = [
      'alpha',
      'beta',
      'gamma',
      'delta',
      'epsilon',
      'washi-1',
      'washi-2',
      '',
    ];

    sampleSeeds.forEach((seed) => {
      const angle = getWashiJitterAngle(seed);
      expect(angle).toBeGreaterThanOrEqual(-5);
      expect(angle).toBeLessThanOrEqual(5);
      expect(angle).not.toBe(0);
    });
  });

  it('uses explicit angle when provided, otherwise falls back to washi jitter', () => {
    expect(resolveWashiAngle(12, 'washi-text')).toBe(12);
    expect(resolveWashiAngle(-3, 'washi-text')).toBe(-3);

    const fallback = resolveWashiAngle(undefined, 'washi-text');
    expect(fallback).toBe(getWashiJitterAngle('washi-text'));
  });
});

describe('getWashiShapeSkewAngle', () => {
  it('returns deterministic skew for same seed', () => {
    const first = getWashiShapeSkewAngle('washi-shape');
    const second = getWashiShapeSkewAngle('washi-shape');
    expect(first).toBe(second);
  });

  it('keeps shape skew around 2 degrees', () => {
    const sampleSeeds = [
      'alpha',
      'beta',
      'gamma',
      'delta',
      'epsilon',
      'washi-shape-1',
      'washi-shape-2',
      '',
    ];

    sampleSeeds.forEach((seed) => {
      const angle = getWashiShapeSkewAngle(seed);
      expect(Math.abs(angle)).toBeGreaterThanOrEqual(2.0);
      expect(Math.abs(angle)).toBeLessThanOrEqual(2.4);
    });
  });
});
