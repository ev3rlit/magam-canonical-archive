import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import React from 'react';
import { act } from 'react';
import { JSDOM } from 'jsdom';
import { createRoot, type Root } from 'react-dom/client';
import { ThemeProvider, useTheme } from './provider';
import {
  THEME_STORAGE_KEY,
  getThemeBootstrapScript,
  readStoredThemeMode,
  resolveInitialThemeState,
} from './runtime';

type TestEnvironment = {
  container: HTMLDivElement;
  dom: JSDOM;
  root: Root;
};

type MediaQueryController = {
  matchMedia: (query: string) => MediaQueryList;
  setMatches: (matches: boolean) => void;
};

function installDomGlobals(dom: JSDOM) {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    value: true,
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: dom.window,
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: dom.window.document,
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: dom.window.navigator,
  });
  Object.defineProperty(globalThis, 'HTMLElement', {
    configurable: true,
    value: dom.window.HTMLElement,
  });
  Object.defineProperty(globalThis, 'Node', {
    configurable: true,
    value: dom.window.Node,
  });
  Object.defineProperty(globalThis, 'MouseEvent', {
    configurable: true,
    value: dom.window.MouseEvent,
  });
}

function createMatchMediaController(initialMatches: boolean): MediaQueryController {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  return {
    matchMedia: (query: string) => ({
      get matches() {
        return matches;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.add(listener as (event: MediaQueryListEvent) => void);
      },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.delete(listener as (event: MediaQueryListEvent) => void);
      },
      addListener: (listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      },
      removeListener: (listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      },
      dispatchEvent: () => true,
    }) as MediaQueryList,
    setMatches: (nextMatches: boolean) => {
      matches = nextMatches;
      const event = { matches } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

function createEnvironment(initialMatches: boolean): TestEnvironment & {
  mediaQueryController: MediaQueryController;
} {
  const dom = new JSDOM('<!doctype html><html data-theme="light"><body></body></html>', {
    url: 'http://localhost',
  });
  installDomGlobals(dom);

  const mediaQueryController = createMatchMediaController(initialMatches);
  Object.defineProperty(dom.window, 'matchMedia', {
    configurable: true,
    value: mediaQueryController.matchMedia,
  });

  const container = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(container);

  return {
    container,
    dom,
    mediaQueryController,
    root: createRoot(container),
  };
}

function ThemeProbe() {
  const { mode, resolvedTheme, setMode } = useTheme();

  return (
    <div data-mode={mode} data-resolved-theme={resolvedTheme}>
      <button type="button" id="theme-light" onClick={() => setMode('light')}>
        light
      </button>
      <button type="button" id="theme-system" onClick={() => setMode('system')}>
        system
      </button>
    </div>
  );
}

describe('theme runtime helpers', () => {
  it('accepts only the supported stored theme modes', () => {
    const storage = {
      getItem: () => 'dark',
    } as Pick<Storage, 'getItem'>;

    expect(readStoredThemeMode(storage)).toBe('dark');
    expect(readStoredThemeMode({
      getItem: () => 'sepia',
    } as Pick<Storage, 'getItem'>)).toBeNull();
  });

  it('defaults to system mode and resolves from system preference', () => {
    expect(resolveInitialThemeState({
      storedMode: undefined,
      systemPrefersDark: true,
    })).toEqual({
      mode: 'system',
      resolvedTheme: 'dark',
    });
  });
});

describe('theme bootstrap and provider', () => {
  let environment: ReturnType<typeof createEnvironment>;

  beforeEach(() => {
    environment = createEnvironment(false);
  });

  afterEach(async () => {
    await act(async () => {
      environment.root.unmount();
    });
    environment.container.remove();
    environment.dom.window.close();
  });

  it('applies the bootstrap script before hydration using stored system preference', () => {
    environment.dom.window.localStorage.setItem(THEME_STORAGE_KEY, 'system');
    environment.mediaQueryController.setMatches(true);
    environment.dom.window.eval(getThemeBootstrapScript());

    expect(environment.dom.window.document.documentElement.dataset.theme).toBe('dark');
    expect(environment.dom.window.document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('syncs provider state with the document theme and system changes', async () => {
    environment.dom.window.localStorage.setItem(THEME_STORAGE_KEY, 'system');
    environment.mediaQueryController.setMatches(true);

    await act(async () => {
      environment.root.render(
        <ThemeProvider>
          <ThemeProbe />
        </ThemeProvider>,
      );
    });

    const documentElement = environment.dom.window.document.documentElement;
    const probe = environment.dom.window.document.querySelector('[data-mode]') as HTMLDivElement | null;

    expect(probe?.dataset.mode).toBe('system');
    expect(probe?.dataset.resolvedTheme).toBe('dark');
    expect(documentElement.dataset.theme).toBe('dark');

    const lightButton = environment.dom.window.document.getElementById('theme-light');
    await act(async () => {
      lightButton?.dispatchEvent(new environment.dom.window.MouseEvent('click', { bubbles: true }));
    });

    expect(documentElement.dataset.theme).toBe('light');
    expect(environment.dom.window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    const systemButton = environment.dom.window.document.getElementById('theme-system');
    await act(async () => {
      systemButton?.dispatchEvent(new environment.dom.window.MouseEvent('click', { bubbles: true }));
    });

    expect(documentElement.dataset.theme).toBe('dark');

    await act(async () => {
      environment.mediaQueryController.setMatches(false);
    });

    expect(documentElement.dataset.theme).toBe('light');
  });
});
