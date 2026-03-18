import { describe, expect, it } from 'bun:test';
import {
  CANVAS_TOOLBAR_CONTRIBUTION_PATH,
  createCanvasToolbarSlot,
} from '@/processes/canvas-runtime/builtin-slots/canvasToolbar';
import canvasToolbarContribution, { canvasToolbarContribution as namedContribution } from './contribution';
import { canvasToolbarSectionContributions } from './toolbarSections';

describe('canvasToolbarContribution', () => {
  it('exports the fixed toolbar section inventory', () => {
    expect(canvasToolbarContribution).toBe(namedContribution);
    expect(canvasToolbarContribution.toolbarSections).toEqual(
      canvasToolbarSectionContributions,
    );
  });

  it('stays compatible with the canvas runtime fixed-slot contract', () => {
    expect(createCanvasToolbarSlot(canvasToolbarContribution)).toEqual({
      slotId: 'canvas-toolbar',
      overlaySlot: 'toolbar',
      surfaceId: 'toolbar',
      contributionPath: CANVAS_TOOLBAR_CONTRIBUTION_PATH,
      items: canvasToolbarSectionContributions,
    });
  });
});
