import { describe, expect, it } from 'bun:test';
import { resolvePaperPattern, resolveWashiPattern, sanitizeInlineSvgMarkup } from './washiTapePattern';
import { DEFAULT_STICKY_PRESET_ID } from './washiTapeDefaults';

const VALID_INLINE_SVG = `
  <svg viewBox="0 0 10 10" onload="alert(1)">
    <script>alert(1)</script>
    <rect width="10" height="10" fill="red" />
  </svg>
`;

describe('washiTapePattern', () => {
  it('falls back to preset when pattern is missing', () => {
    const result = resolveWashiPattern(undefined);

    expect(result.kind).toBe('preset');
    expect(result.presetId).toBe('pastel-dots');
    expect(result.fallbackApplied).toBe(false);
  });

  it('resolves solid pattern with valid color', () => {
    const result = resolveWashiPattern({ type: 'solid', color: '#ffe08a' });

    expect(result.kind).toBe('solid');
    expect(result.backgroundColor).toBe('#ffe08a');
    expect(result.fallbackApplied).toBe(false);
  });

  it('applies fallback when solid color is invalid', () => {
    const result = resolveWashiPattern({ type: 'solid', color: '' });

    expect(result.kind).toBe('preset');
    expect(result.fallbackApplied).toBe(true);
    expect(result.debugReason).toBe('invalid-solid-color');
  });

  it('applies fallback when image pattern src is invalid', () => {
    const result = resolveWashiPattern({ type: 'image', src: '' });

    expect(result.kind).toBe('preset');
    expect(result.presetId).toBe('pastel-dots');
    expect(result.fallbackApplied).toBe(true);
    expect(result.debugReason).toBe('missing-image-source');
  });

  it('clamps image scale and supports stretch repeat', () => {
    const result = resolveWashiPattern({
      type: 'image',
      src: '/paper.png',
      scale: 100,
      repeat: 'stretch',
    });

    expect(result.kind).toBe('image');
    expect(result.backgroundSize).toBe('100% 100%');
    expect(result.fallbackApplied).toBe(false);
  });

  it('applies fallback when inline svg markup is invalid', () => {
    const result = resolveWashiPattern({
      type: 'svg',
      markup: '<div>not-svg</div>',
    });

    expect(result.kind).toBe('preset');
    expect(result.fallbackApplied).toBe(true);
    expect(result.debugReason).toBe('invalid-inline-svg-markup');
  });

  it('applies fallback when svg source is missing', () => {
    const result = resolveWashiPattern({
      type: 'svg',
      src: '',
    });

    expect(result.kind).toBe('preset');
    expect(result.fallbackApplied).toBe(true);
    expect(result.debugReason).toBe('missing-svg-source');
  });

  it('falls back from unknown preset id to provided fallback preset', () => {
    const result = resolvePaperPattern(
      { type: 'preset', id: 'unknown-preset-id' as any },
      { fallbackPresetId: DEFAULT_STICKY_PRESET_ID },
    );

    expect(result.kind).toBe('preset');
    expect(result.presetId).toBe('postit');
    expect(result.fallbackApplied).toBe(true);
    expect(result.debugReason).toBe('unknown-preset-id');
  });

  it('sanitizes inline svg markup by stripping script and event handlers', () => {
    const sanitized = sanitizeInlineSvgMarkup(VALID_INLINE_SVG);

    expect(sanitized).toContain('<svg');
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('onload=');
  });
});
