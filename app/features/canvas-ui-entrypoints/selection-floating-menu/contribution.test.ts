import { describe, expect, it } from 'bun:test';
import { selectionFloatingMenuIntents, selectionFloatingMenuItems } from './contribution';

describe('selection floating menu contribution', () => {
  it('exports the fixed-slot inventory in v1 control order', () => {
    expect(selectionFloatingMenuItems.map((item) => item.itemId)).toEqual([
      'selection-menu-object-type',
      'selection-menu-font-family',
      'selection-menu-font-size',
      'selection-menu-bold',
      'selection-menu-align',
      'selection-menu-color',
      'selection-menu-more',
      'selection-menu-content',
      'selection-menu-washi-preset',
    ]);
  });

  it('exports bridge-backed intents for selection style and content updates', () => {
    expect(selectionFloatingMenuIntents.map((intent) => intent.intentId)).toEqual([
      'selection.style.update',
      'selection.content.update',
    ]);
    expect(selectionFloatingMenuIntents.every(
      (intent) => intent.supportedSurfaces.includes('selection-floating-menu'),
    )).toBe(true);
  });
});
