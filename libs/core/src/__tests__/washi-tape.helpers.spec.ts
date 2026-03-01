import { describe, expect, it } from 'bun:test';
import { definePattern, image, preset, solid, svg } from '../material/helpers';
import {
  kraftgrid,
  linedwarm,
  pasteldots,
  postit,
} from '../material/presets';
import {
  attach,
  anchor,
  polar,
  segment,
  smooth,
  texture,
  torn,
} from '../components/WashiTape.helpers';

describe('WashiTape helpers', () => {
  it('creates AtDef objects', () => {
    expect(segment({ x: 0, y: 0 }, { x: 100, y: 20 }, { thickness: 24 })).toEqual({
      type: 'segment',
      from: { x: 0, y: 0 },
      to: { x: 100, y: 20 },
      thickness: 24,
    });

    expect(polar(10, 20, 180, -6, { thickness: 22 })).toEqual({
      type: 'polar',
      x: 10,
      y: 20,
      length: 180,
      angle: -6,
      thickness: 22,
    });

    expect(attach({ target: 'card-1', placement: 'top', span: 0.5, align: 0 })).toEqual({
      type: 'attach',
      target: 'card-1',
      placement: 'top',
      span: 0.5,
      align: 0,
    });

    expect(anchor('card-1', { position: 'bottom', gap: 20 })).toEqual({
      type: 'anchor',
      target: 'card-1',
      position: 'bottom',
      gap: 20,
    });
  });

  it('creates PatternDef objects', () => {
    expect(preset(pasteldots)).toEqual({ type: 'preset', id: 'pastel-dots' });
    expect(preset(postit, { color: '#ff6b6b' })).toEqual({ type: 'preset', id: 'postit', color: '#ff6b6b' });
    expect(solid('#fed7aa')).toEqual({ type: 'solid', color: '#fed7aa' });
    expect(svg({ markup: '<svg></svg>' })).toEqual({ type: 'svg', src: undefined, markup: '<svg></svg>' });
    expect(image('/pattern.png', { repeat: 'repeat-x', scale: 1.2 })).toEqual({
      type: 'image',
      src: '/pattern.png',
      repeat: 'repeat-x',
      scale: 1.2,
    });
  });

  it('creates edge and texture helpers', () => {
    expect(smooth()).toEqual({ variant: 'smooth' });
    expect(torn()).toEqual({ variant: 'torn' });
    expect(torn(1.3)).toEqual({ variant: 'torn', roughness: 1.3 });
    expect(texture({ opacity: 0.2, blendMode: 'multiply' })).toEqual({ opacity: 0.2, blendMode: 'multiply' });
  });

  it('keeps definePattern identity', () => {
    const pattern = definePattern({ type: 'solid', color: '#111111' });
    expect(pattern).toEqual({ type: 'solid', color: '#111111' });
  });

  it('enforces preset id type at compile time', () => {
    // @ts-expect-error invalid preset id should fail compile-time
    preset('kraft-grid-typo');
    expect(preset(kraftgrid).id).toBe('kraft-grid');
    expect(preset(linedwarm).id).toBe('lined-warm');
  });
});
