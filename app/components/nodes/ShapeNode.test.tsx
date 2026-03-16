import { describe, expect, it } from 'bun:test';
import {
  normalizeObjectSizeInput,
  resolveObject2D,
  resolveShapeDefaultRatio,
} from '@/utils/sizeResolver';

describe('ShapeNode size rules', () => {
  it('uses landscape as default ratio for rectangle', () => {
    const normalized = normalizeObjectSizeInput('m', {
      component: 'ShapeNode',
      inputPath: 'size',
      defaultRatio: resolveShapeDefaultRatio('rectangle'),
    });
    const resolved = resolveObject2D(normalized, {
      component: 'ShapeNode',
      inputPath: 'size',
    });

    expect(resolved).toMatchObject({
      mode: 'fixed',
      widthPx: 192,
      heightPx: 120,
      ratioUsed: 'landscape',
    });
  });

  it('uses square as default ratio for circle and triangle', () => {
    const circleResolved = resolveObject2D(
      normalizeObjectSizeInput('m', {
        component: 'ShapeNode',
        inputPath: 'size',
        defaultRatio: resolveShapeDefaultRatio('circle'),
      }),
      { component: 'ShapeNode', inputPath: 'size' },
    );
    const triangleResolved = resolveObject2D(
      normalizeObjectSizeInput('l', {
        component: 'ShapeNode',
        inputPath: 'size',
        defaultRatio: resolveShapeDefaultRatio('triangle'),
      }),
      { component: 'ShapeNode', inputPath: 'size' },
    );

    expect(circleResolved).toMatchObject({
      mode: 'fixed',
      widthPx: 120,
      heightPx: 120,
      ratioUsed: 'square',
    });
    expect(triangleResolved).toMatchObject({
      mode: 'fixed',
      widthPx: 160,
      heightPx: 160,
      ratioUsed: 'square',
    });
  });

  it('supports explicit width/height with mixed token + number', () => {
    const resolved = resolveObject2D(
      normalizeObjectSizeInput({ width: 'l', height: 160 }, {
        component: 'ShapeNode',
        inputPath: 'size',
        defaultRatio: 'landscape',
      }),
      { component: 'ShapeNode', inputPath: 'size' },
    );

    expect(resolved).toMatchObject({
      mode: 'fixed',
      widthPx: 160,
      heightPx: 160,
      ratioUsed: 'square',
    });
  });

  it('supports auto token for content-driven shape sizing', () => {
    const resolved = resolveObject2D(
      normalizeObjectSizeInput({ token: 'auto' }, {
        component: 'ShapeNode',
        inputPath: 'size',
        defaultRatio: 'landscape',
      }),
      { component: 'ShapeNode', inputPath: 'size' },
    );

    expect(resolved).toMatchObject({
      mode: 'auto',
      tokenUsed: 'auto',
    });
  });

  it('reuses shared object2d ratio override path for shape aliases', () => {
    const resolved = resolveObject2D(
      normalizeObjectSizeInput({ token: 'm', ratio: 'portrait' }, {
        component: 'ShapeNode',
        inputPath: 'size',
        defaultRatio: resolveShapeDefaultRatio('rectangle'),
      }),
      {
        component: 'ShapeNode',
        inputPath: 'size',
      },
    );

    expect(resolved).toMatchObject({
      mode: 'fixed',
      widthPx: 120,
      heightPx: 192,
      ratioUsed: 'portrait',
      tokenUsed: 'm',
    });
  });

  it('uses shared square handling for widthHeight token on non-sticky aliases', () => {
    const normalized = normalizeObjectSizeInput({ widthHeight: 'm', ratio: 'landscape' }, {
      component: 'ShapeNode',
      inputPath: 'size',
      defaultRatio: resolveShapeDefaultRatio('rectangle'),
    });
    const resolved = resolveObject2D(normalized, {
      component: 'ShapeNode',
      inputPath: 'size',
    });

    expect(resolved).toMatchObject({
      mode: 'fixed',
      widthPx: 120,
      heightPx: 120,
      ratioUsed: 'square',
      tokenUsed: 'm',
    });
  });
});
