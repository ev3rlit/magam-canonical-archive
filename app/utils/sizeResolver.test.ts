import { describe, expect, it } from 'bun:test';
import {
  normalizeObjectSizeInput,
  resolveMarkdownSize,
  resolveObject2D,
  resolveShapeDefaultRatio,
  resolveTypography,
} from './sizeResolver';

describe('sizeResolver foundations', () => {
  it('resolves typography token baseline', () => {
    const resolved = resolveTypography('m', {
      component: 'TextNode',
      inputPath: 'fontSize',
    });
    expect(resolved).toEqual({
      fontSizePx: 16,
      lineHeightPx: 24,
      tokenUsed: 'm',
    });
  });

  it('falls back to typography default token on unsupported token', () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = ((message: string) => warnings.push(String(message))) as typeof console.warn;

    const resolved = resolveTypography('xxl' as any, {
      component: 'TextNode',
      inputPath: 'fontSize',
    });

    console.warn = originalWarn;

    expect(resolved.tokenUsed).toBe('m');
    expect(warnings.some((line) => line.includes('UNSUPPORTED_TOKEN'))).toBe(true);
  });

  it('treats conflicting object modes as invalid and falls back', () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = ((message: string) => warnings.push(String(message))) as typeof console.warn;

    const normalized = normalizeObjectSizeInput(
      { token: 'm', widthHeight: 's' } as any,
      { component: 'StickyNode', inputPath: 'size' },
    );

    console.warn = originalWarn;

    expect(normalized.mode).toBe('auto');
    expect(normalized.primitive).toBe('auto');
    expect(warnings.some((line) => line.includes('CONFLICTING_SIZE_INPUT'))).toBe(true);
  });

  it('defaults missing object size input to auto mode', () => {
    const normalized = normalizeObjectSizeInput(undefined, {
      component: 'StickyNode',
      inputPath: 'size',
    });
    expect(normalized).toMatchObject({
      mode: 'auto',
      primitive: 'auto',
    });
  });

  it('resolves object token in landscape dimensions', () => {
    const normalized = normalizeObjectSizeInput('s', {
      component: 'StickyNode',
      inputPath: 'size',
      defaultRatio: 'landscape',
    });
    const resolved = resolveObject2D(normalized, {
      component: 'StickyNode',
      inputPath: 'size',
    });
    if (resolved.mode !== 'fixed') {
      throw new Error('Expected fixed object2d size');
    }
    expect(resolved.widthPx).toBe(160);
    expect(resolved.heightPx).toBe(96);
    expect(resolved.ratioUsed).toBe('landscape');
  });

  it('resolves primitive numeric object size on the same modular path', () => {
    const normalized = normalizeObjectSizeInput(120, {
      component: 'ShapeNode',
      inputPath: 'size',
      defaultRatio: 'landscape',
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

  it('falls back unsupported ratio to landscape', () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = ((message: string) => warnings.push(String(message))) as typeof console.warn;

    const normalized = normalizeObjectSizeInput(
      { token: 'm', ratio: 'diagonal' as any },
      { component: 'ShapeNode', inputPath: 'size' },
    );
    const resolved = resolveObject2D(normalized, {
      component: 'ShapeNode',
      inputPath: 'size',
    });

    console.warn = originalWarn;

    expect(resolved.ratioUsed).toBe('landscape');
    expect(warnings.some((line) => line.includes('UNSUPPORTED_RATIO'))).toBe(true);
  });

  it('treats invalid object token payload as unsupported token and falls back', () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = ((message: string) => warnings.push(String(message))) as typeof console.warn;

    const normalized = normalizeObjectSizeInput(
      { token: 120 } as any,
      { component: 'ShapeNode', inputPath: 'size' },
    );
    const resolved = resolveObject2D(normalized, {
      component: 'ShapeNode',
      inputPath: 'size',
    });

    console.warn = originalWarn;

    expect(resolved).toMatchObject({
      mode: 'auto',
      ratioUsed: 'landscape',
      tokenUsed: 'auto',
    });
    expect(warnings.some((line) => line.includes('UNSUPPORTED_TOKEN'))).toBe(true);
  });

  it('treats explicit auto object token as content-driven size', () => {
    const normalized = normalizeObjectSizeInput(
      { token: 'auto' },
      { component: 'ShapeNode', inputPath: 'size' },
    );
    const resolved = resolveObject2D(normalized, {
      component: 'ShapeNode',
      inputPath: 'size',
    });
    expect(normalized.mode).toBe('auto');
    expect(resolved).toMatchObject({
      mode: 'auto',
      tokenUsed: 'auto',
    });
  });

  it('resolves markdown primitive as typography mode', () => {
    const resolved = resolveMarkdownSize('s', {
      component: 'MarkdownNode',
      inputPath: 'size',
    });
    expect(resolved.mode).toBe('typography');
    if (resolved.mode === 'typography') {
      expect(resolved.typography.fontSizePx).toBe(14);
    }
  });

  it('resolves markdown object as object2d mode', () => {
    const resolved = resolveMarkdownSize({ widthHeight: 'l' }, {
      component: 'MarkdownNode',
      inputPath: 'size',
    });
    expect(resolved.mode).toBe('object2d');
    if (resolved.mode === 'object2d') {
      expect(resolved.object2d).toMatchObject({
        mode: 'fixed',
        widthPx: 160,
        heightPx: 160,
        ratioUsed: 'square',
      });
    }
  });

  it('keeps deterministic output for repeated identical inputs', () => {
    const snapshots = Array.from({ length: 10 }, () => {
      const normalized = normalizeObjectSizeInput({ token: 'm', ratio: 'portrait' }, {
        component: 'ShapeNode',
        inputPath: 'size',
      });
      return resolveObject2D(normalized, {
        component: 'ShapeNode',
        inputPath: 'size',
      });
    });

    for (let index = 1; index < snapshots.length; index += 1) {
      expect(snapshots[index]).toEqual(snapshots[0]);
    }
  });

  it('provides square default ratio for circle and triangle shapes', () => {
    expect(resolveShapeDefaultRatio('circle')).toBe('square');
    expect(resolveShapeDefaultRatio('triangle')).toBe('square');
    expect(resolveShapeDefaultRatio('rectangle')).toBe('landscape');
  });
});
