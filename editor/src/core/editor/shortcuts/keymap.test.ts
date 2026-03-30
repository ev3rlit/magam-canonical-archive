import { describe, expect, it } from 'vitest';
import { resolveShortcutCommandId } from './keymap';
import { normalizeKeyEvent } from './normalizeKeyEvent';

describe('editor shortcut keymap', () => {
  it('normalizes modifier chords into command ids', () => {
    expect(resolveShortcutCommandId({
      chord: 'Mod+Z',
      phase: 'down',
      repeat: false,
    })).toBe('editor.undo');

    expect(resolveShortcutCommandId({
      chord: 'Mod+Shift+Z',
      phase: 'down',
      repeat: false,
    })).toBe('editor.redo');

    expect(resolveShortcutCommandId({
      chord: 'Mod+C',
      phase: 'down',
      repeat: false,
    })).toBe('selection.copy');

    expect(resolveShortcutCommandId({
      chord: 'Mod+V',
      phase: 'down',
      repeat: false,
    })).toBe('selection.paste');
  });

  it('normalizes keyboard events for space press and release', () => {
    expect(normalizeKeyEvent({
      key: ' ',
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      repeat: false,
    }, 'down')).toEqual({
      chord: 'Space',
      phase: 'down',
      repeat: false,
    });

    expect(normalizeKeyEvent({
      key: 'z',
      metaKey: false,
      ctrlKey: true,
      altKey: false,
      shiftKey: true,
      repeat: false,
    }, 'down')).toEqual({
      chord: 'Mod+Shift+Z',
      phase: 'down',
      repeat: false,
    });

    expect(resolveShortcutCommandId({
      chord: 'Space',
      phase: 'up',
      repeat: false,
    })).toBe('canvas.pan-temporary.end');
  });
});
