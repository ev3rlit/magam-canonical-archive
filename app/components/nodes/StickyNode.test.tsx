import { describe, expect, it } from 'bun:test';
import { normalizeStickyDefaults } from '@/utils/washiTapeDefaults';
import { resolveStickyPattern } from '@/utils/washiTapePattern';
import { resolveStickySizing } from './StickyNode';

describe('StickyNode helpers', () => {
  it('uses postit preset when pattern is omitted', () => {
    const normalized = normalizeStickyDefaults({});
    const resolved = resolveStickyPattern(normalized.pattern);

    expect(resolved.kind).toBe('preset');
    expect(resolved.presetId).toBe('postit');
    expect(resolved.fallbackApplied).toBe(false);
  });

  it('normalizes fixed frame sizing for width + height', () => {
    const sizing = resolveStickySizing(220, 140);
    expect(sizing.hasWidth).toBe(true);
    expect(sizing.hasHeight).toBe(true);
    expect(sizing.hasFixedFrame).toBe(true);
    expect(sizing.width).toBe(220);
    expect(sizing.height).toBe(140);
  });

  it('keeps auto height when only width is specified', () => {
    const sizing = resolveStickySizing(260, undefined);
    expect(sizing.hasWidth).toBe(true);
    expect(sizing.hasHeight).toBe(false);
    expect(sizing.hasFixedFrame).toBe(false);
  });

  it('keeps full auto sizing when width/height are omitted', () => {
    const sizing = resolveStickySizing(undefined, undefined);
    expect(sizing.hasWidth).toBe(false);
    expect(sizing.hasHeight).toBe(false);
    expect(sizing.hasFixedFrame).toBe(false);
  });
});
