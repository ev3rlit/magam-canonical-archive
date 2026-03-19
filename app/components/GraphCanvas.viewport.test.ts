import { describe, expect, it } from 'bun:test';
import { resolveToolbarAnchor } from '@/features/overlay-host/slots';
import { resolveOverlayPosition } from '@/features/overlay-host/positioning';
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

  it('restores the current viewport snapshot when the same file re-renders without a saved tab snapshot', () => {
    expect(
      resolveViewportToRestore({
        hasRenderedGraph: true,
        previousFile: 'examples/a.tsx',
        currentFile: 'examples/a.tsx',
        currentViewport: { x: -64, y: 96, zoom: 1.4 },
        savedViewport: null,
      }),
    ).toEqual({ x: -64, y: 96, zoom: 1.4 });
  });

  it('normalizes a flow viewport into tab snapshot shape', () => {
    expect(toTabViewportState({ x: 10, y: 20, zoom: 0.75 })).toEqual({
      x: 10,
      y: 20,
      zoom: 0.75,
    });
  });

  it('keeps toolbar anchors and viewport-fixed overlays inside the viewport budget', () => {
    const anchor = resolveToolbarAnchor({ width: 320, height: 200 });

    expect(resolveOverlayPosition({
      anchor,
      overlaySize: { width: 180, height: 48 },
      placement: 'bottom-center',
      viewport: { width: 320, height: 200 },
    })).toEqual({ x: 70, y: 120 });
  });
});
