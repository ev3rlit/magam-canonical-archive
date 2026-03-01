import { describe, expect, it } from 'bun:test';
import { normalizeStickyDefaults } from '@/utils/washiTapeDefaults';

describe('page sticky parsing contracts', () => {
  it('preserves explicit preset pattern and shape inputs', () => {
    const normalized = normalizeStickyDefaults({
      pattern: { type: 'preset', id: 'lined-warm' },
      shape: 'cloud',
      width: 280,
      height: 180,
    });

    expect(normalized.pattern).toMatchObject({
      type: 'preset',
      id: 'lined-warm',
    });
    expect(normalized.shape).toBe('cloud');
    expect(normalized.width).toBe(280);
    expect(normalized.height).toBe(180);
  });

  it('maps legacy color and anchor fields into pattern/at defaults', () => {
    const normalized = normalizeStickyDefaults({
      color: '#ffd54f',
      anchor: 'node-1',
      position: 'bottom',
      gap: 24,
      align: 'center',
    });

    expect(normalized.pattern).toMatchObject({
      type: 'solid',
      color: '#ffd54f',
    });
    expect(normalized.at).toMatchObject({
      type: 'anchor',
      target: 'node-1',
      position: 'bottom',
      gap: 24,
      align: 'center',
    });
  });
});
