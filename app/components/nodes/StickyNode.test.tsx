import { describe, expect, it } from 'bun:test';
import { normalizeStickyDefaults } from '@/utils/washiTapeDefaults';
import { resolveStickyPattern } from '@/utils/washiTapePattern';
import { resolveStickySizing } from './StickyNode';
import { normalizeObjectSizeInput, resolveObject2D } from '@/utils/sizeResolver';

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

  it('normalizes missing standardized size input to auto mode', () => {
    const normalized = normalizeObjectSizeInput(undefined, {
      component: 'StickyNode',
      inputPath: 'size',
      defaultRatio: 'landscape',
    });
    const resolved = resolveObject2D(normalized, {
      component: 'StickyNode',
      inputPath: 'size',
    });

    expect(normalized.mode).toBe('auto');
    expect(resolved).toMatchObject({
      mode: 'auto',
      tokenUsed: 'auto',
    });
  });

  it('resolves token + ratio size input for sticky sizing', () => {
    const normalized = normalizeObjectSizeInput({ token: 's', ratio: 'portrait' }, {
      component: 'StickyNode',
      inputPath: 'size',
      defaultRatio: 'landscape',
    });
    const resolved = resolveObject2D(normalized, {
      component: 'StickyNode',
      inputPath: 'size',
    });

    expect(resolved).toMatchObject({
      mode: 'fixed',
      widthPx: 96,
      heightPx: 160,
      ratioUsed: 'portrait',
      tokenUsed: 's',
    });
  });

  it('supports primitive number and widthHeight token paths in sticky size resolver', () => {
    const numericResolved = resolveObject2D(
      normalizeObjectSizeInput(120, {
        component: 'StickyNode',
        inputPath: 'size',
        defaultRatio: 'landscape',
      }),
      { component: 'StickyNode', inputPath: 'size' },
    );
    const uniformResolved = resolveObject2D(
      normalizeObjectSizeInput({ widthHeight: 'l' }, {
        component: 'StickyNode',
        inputPath: 'size',
        defaultRatio: 'landscape',
      }),
      { component: 'StickyNode', inputPath: 'size' },
    );

    expect(numericResolved).toMatchObject({
      mode: 'fixed',
      widthPx: 192,
      heightPx: 120,
      ratioUsed: 'landscape',
    });
    expect(uniformResolved).toMatchObject({
      mode: 'fixed',
      widthPx: 160,
      heightPx: 160,
      ratioUsed: 'square',
    });
  });

  it('supports explicit auto token in sticky size', () => {
    const resolved = resolveObject2D(
      normalizeObjectSizeInput('auto', {
        component: 'StickyNode',
        inputPath: 'size',
        defaultRatio: 'landscape',
      }),
      { component: 'StickyNode', inputPath: 'size' },
    );

    expect(resolved).toMatchObject({
      mode: 'auto',
      tokenUsed: 'auto',
    });
  });
});
