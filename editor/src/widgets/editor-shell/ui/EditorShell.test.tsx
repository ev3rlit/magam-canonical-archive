// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppProvider } from '@/app/providers/AppProvider';
import {
  resetExplorerLibraryServiceForTests,
} from '@/core/editor/explorer-library/library-service';
import { resetExplorerLibraryStoreForTests } from '@/core/editor/explorer-library/library-store';
import { useEditorStore } from '@/core/editor/model/editor-store';
import { EditorShell } from './EditorShell';

describe('EditorShell quick explorer integration', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await resetExplorerLibraryServiceForTests();
    resetExplorerLibraryStoreForTests();
    (globalThis as Record<string, unknown>)['__MAGAM_DISABLE_LIBRARY_PROVIDER__'] = true;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.ResizeObserver = class {
      observe() {}

      disconnect() {}

      unobserve() {}
    } as typeof ResizeObserver;
    window.matchMedia = window.matchMedia ?? (((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia);
    useEditorStore.getState().reset();
    useEditorStore.getState().setViewportRect(1200, 800);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    delete (globalThis as Record<string, unknown>)['__MAGAM_DISABLE_LIBRARY_PROVIDER__'];
  });

  it('renders the bottom quick explorer inside the editor shell widget family', () => {
    act(() => {
      root.render(
        <AppProvider>
          <EditorShell />
        </AppProvider>,
      );
    });

    expect(container.querySelector('[data-testid="editor-shell"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="quick-explorer"]')).toBeTruthy();
    expect(container.textContent).toContain('Library');
  });
});
