import { describe, expect, it } from 'bun:test';
import { resolveWashiPattern, sanitizeInlineSvgMarkup } from './washiTapePattern';

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

  it('applies fallback when image pattern src is invalid', () => {
    const result = resolveWashiPattern({ type: 'image', src: '' });

    expect(result.kind).toBe('preset');
    expect(result.presetId).toBe('pastel-dots');
    expect(result.fallbackApplied).toBe(true);
    expect(result.debugReason).toBe('missing-image-source');
  });

  it('sanitizes inline svg markup by stripping script and event handlers', () => {
    const sanitized = sanitizeInlineSvgMarkup(`
      <svg viewBox="0 0 10 10" onload="alert(1)">
        <script>alert(1)</script>
        <rect width="10" height="10" fill="red" />
      </svg>
    `);

    expect(sanitized).toContain('<svg');
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('onload=');
  });
});
