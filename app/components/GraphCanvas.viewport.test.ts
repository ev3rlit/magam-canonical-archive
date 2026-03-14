import { describe, expect, it } from 'bun:test';
import {
  resolveViewportToRestore,
  toTabViewportState,
} from './GraphCanvas.viewport';

describe('GraphCanvas viewport helpers', () => {
  it('captures the current viewport for same-file reloads', () => {
    expect(
      resolveViewportToRestore({
        hasRenderedGraph: true,
        previousFile: 'examples/a.tsx',
        currentFile: 'examples/a.tsx',
        currentViewport: { x: 120, y: -80, zoom: 1.25 },
        savedViewport: { x: 0, y: 0, zoom: 0.5 },
      }),
    ).toEqual({ x: 120, y: -80, zoom: 1.25 });
  });

  it('prefers the saved tab viewport when switching files', () => {
    expect(
      resolveViewportToRestore({
        hasRenderedGraph: true,
        previousFile: 'examples/a.tsx',
        currentFile: 'examples/b.tsx',
        currentViewport: { x: 120, y: -80, zoom: 1.25 },
        savedViewport: { x: 32, y: 48, zoom: 0.9 },
      }),
    ).toEqual({ x: 32, y: 48, zoom: 0.9 });
  });

  it('returns null when no saved viewport exists for a new file', () => {
    expect(
      resolveViewportToRestore({
        hasRenderedGraph: false,
        previousFile: null,
        currentFile: 'examples/a.tsx',
        currentViewport: { x: 120, y: -80, zoom: 1.25 },
        savedViewport: null,
      }),
    ).toBeNull();
  });

  it('normalizes a flow viewport into tab snapshot shape', () => {
    expect(toTabViewportState({ x: 10, y: 20, zoom: 0.75 })).toEqual({
      x: 10,
      y: 20,
      zoom: 0.75,
    });
  });
});
