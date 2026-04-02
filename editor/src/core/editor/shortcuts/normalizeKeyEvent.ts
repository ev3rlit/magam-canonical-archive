import type { NormalizedShortcutInput, ShortcutKeyboardEventLike, ShortcutPhase } from './types';

function normalizeBaseKey(event: ShortcutKeyboardEventLike) {
  if (event.code === 'NumpadAdd') {
    return 'NumpadAdd';
  }

  if (event.code === 'NumpadSubtract') {
    return 'NumpadSubtract';
  }

  const { key } = event;
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

function shouldIncludeShift(baseKey: string) {
  if (baseKey.length !== 1) {
    return true;
  }

  return /[A-Z0-9]/.test(baseKey);
}

export function normalizeKeyEvent(
  event: ShortcutKeyboardEventLike,
  phase: ShortcutPhase,
): NormalizedShortcutInput | null {
  const baseKey = normalizeBaseKey(event);
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
  if (event.shiftKey && shouldIncludeShift(baseKey)) {
    parts.push('Shift');
  }
  parts.push(baseKey);

  return {
    chord: parts.join('+'),
    phase,
    repeat: event.repeat,
  };
}
