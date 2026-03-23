'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getHostRuntime } from '@/features/host/renderer/createHostRuntime';
import {
  THEME_MEDIA_QUERY,
  THEME_PREFERENCE_KEY,
  THEME_STORAGE_KEY,
  applyResolvedTheme,
  parseThemePreferenceValue,
  readStoredThemeMode,
  resolveInitialThemeState,
  resolveResolvedTheme,
  type ResolvedTheme,
  type ThemeMode,
} from './runtime';

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemThemeQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }

  return window.matchMedia(THEME_MEDIA_QUERY);
}

function getInitialClientState(): {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
} {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { mode: 'system', resolvedTheme: 'light' };
  }

  const systemQuery = getSystemThemeQuery();
  const storedMode = (() => {
    try {
      return readStoredThemeMode(window.localStorage);
    } catch (_error) {
      return null;
    }
  })();
  const initialState = resolveInitialThemeState({
    storedMode,
    systemPrefersDark: systemQuery?.matches,
  });
  const domResolvedTheme = document.documentElement.dataset.theme;

  return {
    mode: initialState.mode,
    resolvedTheme:
      domResolvedTheme === 'light' || domResolvedTheme === 'dark'
        ? domResolvedTheme
        : initialState.resolvedTheme,
  };
}

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const hostRpc = useMemo(() => getHostRuntime().rpc, []);
  const initialState = getInitialClientState();
  const [mode, setMode] = useState<ThemeMode>(initialState.mode);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(
    initialState.resolvedTheme,
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (_error) {
      console.error('[theme] failed to persist bootstrap cache');
    }
  }, [mode]);

  useEffect(() => {
    let cancelled = false;

    void hostRpc.getAppStatePreference(THEME_PREFERENCE_KEY)
      .then((preference) => {
        if (cancelled) {
          return;
        }

        const nextMode = parseThemePreferenceValue(preference?.valueJson);
        if (nextMode) {
          setMode(nextMode);
        }
      })
      .catch((error) => {
        console.error('[theme] failed to read app-state preference', error);
      });

    return () => {
      cancelled = true;
    };
  }, [hostRpc]);

  useEffect(() => {
    void hostRpc.setAppStatePreference({
      key: THEME_PREFERENCE_KEY,
      valueJson: mode,
    }).catch((error) => {
      console.error('[theme] failed to write app-state preference', error);
    });
  }, [hostRpc, mode]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const systemQuery = getSystemThemeQuery();
    const nextResolvedTheme = resolveResolvedTheme(mode, Boolean(systemQuery?.matches));

    setResolvedTheme(nextResolvedTheme);
    applyResolvedTheme(document.documentElement, nextResolvedTheme);
  }, [mode]);

  useEffect(() => {
    const systemQuery = getSystemThemeQuery();
    if (!systemQuery || mode !== 'system') {
      return;
    }

    const handleChange = () => {
      const nextResolvedTheme = resolveResolvedTheme('system', systemQuery.matches);
      setResolvedTheme(nextResolvedTheme);
      applyResolvedTheme(document.documentElement, nextResolvedTheme);
    };

    handleChange();

    if (typeof systemQuery.addEventListener === 'function') {
      systemQuery.addEventListener('change', handleChange);
      return () => {
        systemQuery.removeEventListener('change', handleChange);
      };
    }

    systemQuery.addListener(handleChange);
    return () => {
      systemQuery.removeListener(handleChange);
    };
  }, [mode]);

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    resolvedTheme,
    setMode,
  }), [mode, resolvedTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used within a ThemeProvider.');
  }

  return value;
}
