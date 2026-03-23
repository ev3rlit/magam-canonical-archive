export const THEME_STORAGE_KEY = 'theme';

export const THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export const THEME_MODES = ['light', 'dark', 'system'] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

export type ResolvedTheme = Exclude<ThemeMode, 'system'>;

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && THEME_MODES.includes(value as ThemeMode);
}

export function readStoredThemeMode(
  storage: Pick<Storage, 'getItem'> | null | undefined,
): ThemeMode | null {
  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(THEME_STORAGE_KEY);
  return isThemeMode(rawValue) ? rawValue : null;
}

export function resolveSystemTheme(
  mediaQuery: Pick<MediaQueryList, 'matches'> | null | undefined,
): ResolvedTheme {
  return mediaQuery?.matches ? 'dark' : 'light';
}

export function resolveResolvedTheme(
  mode: ThemeMode,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (mode === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }

  return mode;
}

export function resolveInitialThemeState(input: {
  storedMode?: unknown;
  systemPrefersDark?: boolean | null;
}): {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
} {
  const mode = isThemeMode(input.storedMode) ? input.storedMode : 'system';

  return {
    mode,
    resolvedTheme: resolveResolvedTheme(mode, Boolean(input.systemPrefersDark)),
  };
}

export function applyResolvedTheme(
  target: HTMLElement,
  resolvedTheme: ResolvedTheme,
): void {
  target.dataset.theme = resolvedTheme;
  target.style.colorScheme = resolvedTheme;
  target.classList.toggle('dark', resolvedTheme === 'dark');
}

export function getThemeBootstrapScript(): string {
  return `(() => {
    try {
      const root = document.documentElement;
      const rawMode = window.localStorage.getItem('${THEME_STORAGE_KEY}');
      const mode = rawMode === 'light' || rawMode === 'dark' || rawMode === 'system'
        ? rawMode
        : 'system';
      const prefersDark = typeof window.matchMedia === 'function'
        && window.matchMedia('${THEME_MEDIA_QUERY}').matches;
      const resolvedTheme = mode === 'system'
        ? (prefersDark ? 'dark' : 'light')
        : mode;

      root.dataset.theme = resolvedTheme;
      root.style.colorScheme = resolvedTheme;
      root.classList.toggle('dark', resolvedTheme === 'dark');
    } catch (_error) {
      document.documentElement.dataset.theme = 'light';
      document.documentElement.style.colorScheme = 'light';
      document.documentElement.classList.remove('dark');
    }
  })();`;
}
