import { describe, expect, it } from 'bun:test';
import { resolveOverlayPosition } from './positioning';

describe('overlay positioning', () => {
  it('clamps pointer anchored menus away from the viewport edge', () => {
    expect(resolveOverlayPosition({
      anchor: { type: 'pointer', x: 290, y: 190 },
      overlaySize: { width: 100, height: 80 },
      placement: 'top-start',
      viewport: { width: 300, height: 200 },
    })).toEqual({ x: 190, y: 110 });
  });

  it('flips selection bounds overlays below when there is no space above', () => {
    expect(resolveOverlayPosition({
      anchor: { type: 'selection-bounds', x: 20, y: 4, width: 80, height: 24 },
      overlaySize: { width: 120, height: 40 },
      placement: 'top-center',
      viewport: { width: 360, height: 240 },
    })).toEqual({ x: 8, y: 40 });
  });

  it('positions viewport-fixed toolbar anchors relative to bottom center', () => {
    expect(resolveOverlayPosition({
      anchor: { type: 'viewport-fixed', x: 200, y: 180 },
      overlaySize: { width: 120, height: 40 },
      placement: 'bottom-center',
      viewport: { width: 360, height: 240 },
    })).toEqual({ x: 140, y: 140 });
  });
});
