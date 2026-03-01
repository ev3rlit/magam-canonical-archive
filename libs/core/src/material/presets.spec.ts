import { describe, expect, it } from 'bun:test';
import {
  MATERIAL_PRESET_IDS,
  MATERIAL_PRESET_REGISTRY,
} from './presets';

describe('material preset registry', () => {
  it('contains the full paper material preset catalog', () => {
    expect(MATERIAL_PRESET_IDS).toEqual([
      'postit',
      'pastel-dots',
      'kraft-grid',
      'masking-solid',
      'neon-stripe',
      'vintage-paper',
      'lined-warm',
      'grid-standard',
      'grid-fine',
      'dot-grid',
      'kraft-natural',
    ]);
  });

  it('has required metadata for each preset', () => {
    for (const presetId of MATERIAL_PRESET_IDS) {
      const preset = MATERIAL_PRESET_REGISTRY[presetId];
      expect(typeof preset.label).toBe('string');
      expect(preset.label.length).toBeGreaterThan(0);
      expect(typeof preset.backgroundColor).toBe('string');
      expect(preset.backgroundColor.length).toBeGreaterThan(0);
      expect(typeof preset.textColor).toBe('string');
      expect(preset.textColor.length).toBeGreaterThan(0);
    }
  });

  it('exposes backgroundSize on lined/grid presets', () => {
    expect(MATERIAL_PRESET_REGISTRY['lined-warm'].backgroundSize).toBe('100% 28px');
    expect(MATERIAL_PRESET_REGISTRY['grid-standard'].backgroundSize).toBe('20px 20px');
    expect(MATERIAL_PRESET_REGISTRY['grid-fine'].backgroundSize).toBe('10px 10px');
    expect(MATERIAL_PRESET_REGISTRY['dot-grid'].backgroundSize).toBe('20px 20px');
  });
});
