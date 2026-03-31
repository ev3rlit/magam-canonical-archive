// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppProvider } from './AppProvider';
import { resetExplorerLibraryServiceForTests } from '../../core/editor/explorer-library/library-service';
import { resetExplorerLibraryStoreForTests } from '../../core/editor/explorer-library/library-store';
import { useEditorStore } from '../../core/editor/model/editor-store';
import { FloatingToolMenu } from '../../widgets/canvas-editor/ui/FloatingToolMenu';
import { CanvasViewport } from '../../widgets/canvas-editor/ui/CanvasViewport';

class ResizeObserverStub {
  observe() {}

  disconnect() {}

  unobserve() {}
}

function renderInProvider(children: ReactNode, root: Root) {
  act(() => {
    root.render(
      <AppProvider>
        {children}
      </AppProvider>,
    );
  });
}

describe('AppProvider keyboard shortcuts', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await resetExplorerLibraryServiceForTests();
    resetExplorerLibraryStoreForTests();
    (globalThis as Record<string, unknown>)['__MAGAM_DISABLE_LIBRARY_PROVIDER__'] = true;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.ResizeObserver = ResizeObserverStub as typeof ResizeObserver;
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

  it('holds space to enter temporary pan mode and clears it on blur', () => {
    renderInProvider(
      <>
        <FloatingToolMenu />
        <CanvasViewport />
      </>,
      root,
    );

    const world = container.querySelector('.canvas-viewport__world');
    const panButton = container.querySelector('[aria-label="Pan tool"]');

    expect(world?.classList.contains('canvas-viewport__world--pan')).toBe(false);
    expect(panButton?.className.includes('floating-tool-menu__button--active')).toBe(false);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: true }));
    });

    expect(world?.classList.contains('canvas-viewport__world--pan')).toBe(true);
    expect(panButton?.className.includes('floating-tool-menu__button--active')).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('blur'));
    });

    expect(useEditorStore.getState().temporaryToolOverride).toBe(null);
    expect(world?.classList.contains('canvas-viewport__world--pan')).toBe(false);
  });

  it('ignores canvas shortcuts while typing into an input', () => {
    renderInProvider(
      <>
        <input data-testid="typing-input" />
        <FloatingToolMenu />
        <CanvasViewport />
      </>,
      root,
    );

    const typingInput = container.querySelector('[data-testid="typing-input"]') as HTMLInputElement;
    let shapeId = '';
    act(() => {
      useEditorStore.getState().createObjectAtViewportCenter('shape');
      shapeId = useEditorStore.getState().selection.primaryId!;
      useEditorStore.getState().updateObjectPatch(shapeId, { x: 120 });
      useEditorStore.getState().updateObjectPatch(shapeId, { x: 180 });
    });

    act(() => {
      typingInput.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      typingInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }));
    });

    expect(useEditorStore.getState().temporaryToolOverride).toBe(null);
    expect(useEditorStore.getState().scene.objects.find((object) => object.id === shapeId)?.x).toBe(180);
  });

  it('ignores canvas shortcuts while typing into an inline block editor', () => {
    renderInProvider(
      <>
        <FloatingToolMenu />
        <CanvasViewport />
      </>,
      root,
    );

    let stickyId = '';
    act(() => {
      useEditorStore.getState().createObjectAtViewportCenter('sticky');
      stickyId = useEditorStore.getState().selection.primaryId!;
      useEditorStore.getState().openBodyEditor(stickyId);
    });

    const editor = container.querySelector('.canvas-object__wysiwyg-surface') as HTMLDivElement;
    expect(editor).toBeTruthy();

    act(() => {
      editor.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }));
    });

    expect(useEditorStore.getState().temporaryToolOverride).toBe(null);
    expect(useEditorStore.getState().scene.objects.find((object) => object.id === stickyId)?.body.content).toHaveLength(1);
  });

  it('routes undo and redo through the keyboard dispatcher', () => {
    renderInProvider(<div />, root);

    useEditorStore.getState().createObjectAtViewportCenter('shape');
    const shapeId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().updateObjectPatch(shapeId, { x: 120 });
    useEditorStore.getState().updateObjectPatch(shapeId, { x: 180 });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true }));
    });

    expect(useEditorStore.getState().scene.objects.find((object) => object.id === shapeId)?.x).toBe(120);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true }));
    });

    expect(useEditorStore.getState().scene.objects.find((object) => object.id === shapeId)?.x).toBe(180);
  });
});
