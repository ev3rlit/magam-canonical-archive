import { describe, expect, it } from 'bun:test';
import { createNormalizedKeyChord, normalizeKeyEvent } from './normalizeKeyEvent';

describe('normalizeKeyEvent', () => {
  it('normalizes cmd and ctrl shortcuts into the same primary signature', () => {
    expect(normalizeKeyEvent({
      key: 'z',
      metaKey: true,
    })?.signature).toBe('primary+z');

    expect(normalizeKeyEvent({
      key: 'Z',
      ctrlKey: true,
    })?.signature).toBe('primary+z');
  });

  it('keeps modifier order stable for shifted primary shortcuts', () => {
    expect(normalizeKeyEvent({
      key: 'Z',
      metaKey: true,
      shiftKey: true,
    })).toMatchObject({
      key: 'z',
      modifiers: ['primary', 'shift'],
      signature: 'primary+shift+z',
    });
  });

  it('normalizes space and arrow aliases into canonical key names', () => {
    expect(normalizeKeyEvent({
      key: ' ',
    })?.key).toBe('space');

    expect(normalizeKeyEvent({
      key: 'Up',
      altKey: true,
    })?.signature).toBe('alt+arrowup');
  });

  it('returns null for modifier-only keys', () => {
    expect(normalizeKeyEvent({ key: 'Meta', metaKey: true })).toBeNull();
    expect(normalizeKeyEvent({ key: 'Shift', shiftKey: true })).toBeNull();
  });

  it('can build reusable chords without depending on DOM events', () => {
    expect(createNormalizedKeyChord({
      key: 'v',
      ctrlKey: true,
      altKey: true,
    })).toMatchObject({
      modifiers: ['primary', 'alt'],
      signature: 'primary+alt+v',
      modifierState: {
        ctrlKey: true,
        metaKey: false,
      },
    });
  });
});
