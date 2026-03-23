import type { FontFamilyPreset } from '@magam/core';

export const FONT_FAMILY_PRESETS: FontFamilyPreset[] = [
  'hand-gaegu',
  'hand-caveat',
  'sans-inter',
];

export const DEFAULT_GLOBAL_FONT_FAMILY: FontFamilyPreset = 'hand-gaegu';
export const GLOBAL_FONT_STORAGE_KEY = 'magam.font.globalFamily';
export const GLOBAL_FONT_PREFERENCE_KEY = 'font.globalFamily';

const FONT_FAMILY_CSS_VAR_MAP: Record<FontFamilyPreset, string> = {
  'hand-gaegu': '--font-preset-hand-gaegu',
  'hand-caveat': '--font-preset-hand-caveat',
  'sans-inter': '--font-preset-sans-inter',
};

const EXPLICIT_FONT_CLASS_TOKENS = new Set(['font-sans', 'font-serif', 'font-mono']);

export function isFontFamilyPreset(value: unknown): value is FontFamilyPreset {
  return (
    value === 'hand-gaegu'
    || value === 'hand-caveat'
    || value === 'sans-inter'
  );
}

export function getStoredGlobalFontFamily(): FontFamilyPreset {
  if (typeof window === 'undefined') {
    return DEFAULT_GLOBAL_FONT_FAMILY;
  }

  try {
    const raw = window.localStorage.getItem(GLOBAL_FONT_STORAGE_KEY);
    return isFontFamilyPreset(raw) ? raw : DEFAULT_GLOBAL_FONT_FAMILY;
  } catch {
    return DEFAULT_GLOBAL_FONT_FAMILY;
  }
}

export function persistGlobalFontFamily(value: FontFamilyPreset): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GLOBAL_FONT_STORAGE_KEY, value);
  } catch {
    // noop: localStorage may be unavailable
  }
}

export function parseGlobalFontPreferenceValue(value: unknown): FontFamilyPreset | null {
  return isFontFamilyPreset(value) ? value : null;
}

export function hasExplicitFontFamilyClass(className?: string): boolean {
  if (!className) return false;
  return className
    .split(/\s+/)
    .map((token) => token.trim())
    .some((token) => EXPLICIT_FONT_CLASS_TOKENS.has(token));
}

export function resolveEffectiveFontFamily(input: {
  nodeFontFamily?: FontFamilyPreset | null;
  canvasFontFamily?: FontFamilyPreset | null;
  globalFontFamily?: FontFamilyPreset | null;
}): FontFamilyPreset {
  return (
    input.nodeFontFamily
    ?? input.canvasFontFamily
    ?? input.globalFontFamily
    ?? DEFAULT_GLOBAL_FONT_FAMILY
  );
}

export function toFontFamilyCssValue(preset: FontFamilyPreset): string {
  return `var(${FONT_FAMILY_CSS_VAR_MAP[preset]})`;
}

export function resolveFontFamilyCssValue(input: {
  nodeFontFamily?: FontFamilyPreset | null;
  canvasFontFamily?: FontFamilyPreset | null;
  globalFontFamily?: FontFamilyPreset | null;
}): string {
  return toFontFamilyCssValue(resolveEffectiveFontFamily(input));
}
