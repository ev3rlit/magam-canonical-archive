import type { CanvasKeyboardModifier, CanvasKeyboardModifierState, NormalizedKeyChord } from './types';

export interface KeyboardEventLike {
  altKey?: boolean;
  code?: string;
  ctrlKey?: boolean;
  key: string;
  metaKey?: boolean;
  shiftKey?: boolean;
}

const MODIFIER_ORDER: readonly CanvasKeyboardModifier[] = ['primary', 'shift', 'alt'];

const MODIFIER_KEYS = new Set([
  'alt',
  'control',
  'ctrl',
  'meta',
  'shift',
]);

const KEY_ALIASES: Record<string, string> = {
  ' ': 'space',
  esc: 'escape',
  left: 'arrowleft',
  right: 'arrowright',
  up: 'arrowup',
  down: 'arrowdown',
  return: 'enter',
  spacebar: 'space',
};

function normalizeKeyName(key: string): string {
  const normalized = key === ' '
    ? ' '
    : key.trim().toLowerCase();
  return KEY_ALIASES[normalized] ?? normalized;
}

function buildModifierState(input: KeyboardEventLike): CanvasKeyboardModifierState {
  return {
    altKey: input.altKey === true,
    ctrlKey: input.ctrlKey === true,
    metaKey: input.metaKey === true,
    shiftKey: input.shiftKey === true,
  };
}

function resolveModifiers(state: CanvasKeyboardModifierState): CanvasKeyboardModifier[] {
  const modifiers: CanvasKeyboardModifier[] = [];

  if (state.ctrlKey || state.metaKey) {
    modifiers.push('primary');
  }
  if (state.shiftKey) {
    modifiers.push('shift');
  }
  if (state.altKey) {
    modifiers.push('alt');
  }

  return MODIFIER_ORDER.filter((modifier) => modifiers.includes(modifier));
}

export function createNormalizedKeyChord(input: {
  key: string;
  code?: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}): NormalizedKeyChord {
  const modifierState = buildModifierState(input);
  const modifiers = resolveModifiers(modifierState);
  const normalizedKey = normalizeKeyName(input.key);

  return {
    key: normalizedKey,
    code: input.code,
    modifiers,
    modifierState,
    signature: [...modifiers, normalizedKey].join('+'),
  };
}

export function normalizeKeyEvent(input: KeyboardEventLike): NormalizedKeyChord | null {
  const normalizedKey = normalizeKeyName(input.key);
  if (!normalizedKey || MODIFIER_KEYS.has(normalizedKey)) {
    return null;
  }

  return createNormalizedKeyChord({
    key: normalizedKey,
    code: input.code,
    altKey: input.altKey,
    ctrlKey: input.ctrlKey,
    metaKey: input.metaKey,
    shiftKey: input.shiftKey,
  });
}
