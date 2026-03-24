import { describe, expect, it } from 'bun:test';
import { createNormalizedKeyChord, normalizeKeyEvent } from './normalizeKeyEvent';
import { DEFAULT_CANVAS_KEY_BINDINGS, resolveCanvasKeyBinding } from './keymap';
import { CANVAS_KEYBOARD_COMMAND_IDS, type CanvasKeyBinding } from './types';

describe('resolveCanvasKeyBinding', () => {
  it('maps platform-safe history shortcuts to command ids', () => {
    expect(resolveCanvasKeyBinding({
      chord: normalizeKeyEvent({ key: 'z', metaKey: true }),
    })?.commandId).toBe(CANVAS_KEYBOARD_COMMAND_IDS.HISTORY_UNDO);

    expect(resolveCanvasKeyBinding({
      chord: normalizeKeyEvent({ key: 'z', ctrlKey: true, shiftKey: true }),
    })?.commandId).toBe(CANVAS_KEYBOARD_COMMAND_IDS.HISTORY_REDO);

    expect(resolveCanvasKeyBinding({
      chord: normalizeKeyEvent({ key: 'y', ctrlKey: true }),
    })?.commandId).toBe(CANVAS_KEYBOARD_COMMAND_IDS.HISTORY_REDO);
  });

  it('maps clipboard and Washi navigation shortcuts through the default keymap', () => {
    expect(resolveCanvasKeyBinding({
      chord: normalizeKeyEvent({ key: 'backspace' }),
    })?.commandId).toBe(CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_DELETE);

    expect(resolveCanvasKeyBinding({
      chord: normalizeKeyEvent({ key: 'd', ctrlKey: true }),
    })?.commandId).toBe(CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_DUPLICATE);

    expect(resolveCanvasKeyBinding({
      chord: normalizeKeyEvent({ key: 'g', metaKey: true }),
    })?.commandId).toBe(CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_GROUP);

    expect(resolveCanvasKeyBinding({
      chord: normalizeKeyEvent({ key: 'a', metaKey: true }),
    })?.commandId).toBe(CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_SELECT_ALL);

    expect(resolveCanvasKeyBinding({
      chord: normalizeKeyEvent({ key: 'c', metaKey: true }),
    })?.commandId).toBe(CANVAS_KEYBOARD_COMMAND_IDS.CLIPBOARD_COPY_SELECTION);

    expect(resolveCanvasKeyBinding({
      chord: normalizeKeyEvent({ key: 'v', ctrlKey: true }),
    })?.commandId).toBe(CANVAS_KEYBOARD_COMMAND_IDS.CLIPBOARD_PASTE_SELECTION);

    expect(resolveCanvasKeyBinding({
      chord: normalizeKeyEvent({ key: 'f', metaKey: true, shiftKey: true }),
    })?.commandId).toBe(CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_FOCUS_NEXT_WASHI);

    expect(resolveCanvasKeyBinding({
      chord: normalizeKeyEvent({ key: '=', ctrlKey: true }),
    })?.commandId).toBe(CANVAS_KEYBOARD_COMMAND_IDS.VIEWPORT_ZOOM_IN);

    expect(resolveCanvasKeyBinding({
      chord: normalizeKeyEvent({ key: '-', metaKey: true }),
    })?.commandId).toBe(CANVAS_KEYBOARD_COMMAND_IDS.VIEWPORT_ZOOM_OUT);

    expect(resolveCanvasKeyBinding({
      chord: normalizeKeyEvent({ key: 'g', ctrlKey: true, shiftKey: true }),
    })?.commandId).toBe(CANVAS_KEYBOARD_COMMAND_IDS.SELECTION_UNGROUP);
  });

  it('returns null when no key binding matches the normalized chord', () => {
    expect(resolveCanvasKeyBinding({
      chord: normalizeKeyEvent({ key: 'q', metaKey: true }),
    })).toBeNull();
  });

  it('lets later bindings override earlier ones for future customization', () => {
    const customBindings: readonly CanvasKeyBinding[] = [
      ...DEFAULT_CANVAS_KEY_BINDINGS,
      {
        bindingId: 'custom.primary-z',
        chord: createNormalizedKeyChord({ key: 'z', metaKey: true }),
        commandId: 'custom.command',
      },
    ];

    expect(resolveCanvasKeyBinding({
      chord: normalizeKeyEvent({ key: 'z', ctrlKey: true }),
      bindings: customBindings,
    })).toMatchObject({
      commandId: 'custom.command',
      binding: {
        bindingId: 'custom.primary-z',
      },
    });
  });
});
