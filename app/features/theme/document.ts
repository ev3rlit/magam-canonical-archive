import {
  applyResolvedTheme,
  readStoredThemeMode,
  resolveInitialThemeState,
} from './runtime';

const KR_FALLBACKS =
  '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "Segoe UI", system-ui, sans-serif';
const HANDWRITING_FALLBACKS =
  '"Comic Sans MS", "Segoe Print", "Marker Felt", "Bradley Hand", cursive';
const SANS_FALLBACKS =
  '"Helvetica Neue", Arial, "Liberation Sans", sans-serif';

export const FONT_PRESET_STYLE_ID = 'magam-font-presets';

export const fontPresetCSS = `:root {
  --font-preset-hand-gaegu: ${HANDWRITING_FALLBACKS}, ${KR_FALLBACKS};
  --font-preset-hand-caveat: ${HANDWRITING_FALLBACKS}, ${KR_FALLBACKS};
  --font-preset-sans-inter: ${SANS_FALLBACKS}, ${KR_FALLBACKS};
}`;

export function ensureFontPresetStyle(doc: Document): void {
  if (doc.getElementById(FONT_PRESET_STYLE_ID)) {
    return;
  }

  const style = doc.createElement('style');
  style.id = FONT_PRESET_STYLE_ID;
  style.textContent = fontPresetCSS;
  doc.head.appendChild(style);
}

export function initializeThemeDocument(win: Window, doc: Document): void {
  // Theme bootstrap still uses localStorage as a synchronous cache so the first paint
  // does not wait on async app-state RPC.
  const initialState = resolveInitialThemeState({
    storedMode: readStoredThemeMode(win.localStorage),
    systemPrefersDark: typeof win.matchMedia === 'function'
      ? win.matchMedia('(prefers-color-scheme: dark)').matches
      : false,
  });

  applyResolvedTheme(doc.documentElement, initialState.resolvedTheme);
}
