import type { NormalizedShortcutInput, ShortcutKeyboardEventLike, ShortcutPhase } from './types';

function normalizeBaseKey(key: string) {
  if (key === ' ') {
    return 'Space';
  }

  if (key.length === 1) {
    return key.toUpperCase();
  }

  if (key === 'Esc') {
    return 'Escape';
  }

  return key;
}

export function normalizeKeyEvent(
  event: ShortcutKeyboardEventLike,
  phase: ShortcutPhase,
): NormalizedShortcutInput | null {
  const baseKey = normalizeBaseKey(event.key);
  if (baseKey === 'Meta' || baseKey === 'Control' || baseKey === 'Shift' || baseKey === 'Alt') {
    return null;
  }

  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) {
    parts.push('Mod');
  }
  if (event.altKey) {
    parts.push('Alt');
  }
  if (event.shiftKey && baseKey !== 'Shift') {
    parts.push('Shift');
  }
  parts.push(baseKey);

  return {
    chord: parts.join('+'),
    phase,
    repeat: event.repeat,
  };
}
