// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAGAM_CLIPBOARD_MIME_TYPE,
  serializeClipboardSnapshot,
} from '@/core/editor/clipboard/canvas-clipboard';
import { createBodyDocument, createBodyParagraphNode } from '../../core/editor/model/editor-body';
import { AppProvider } from './AppProvider';
import { resetExplorerLibraryServiceForTests } from '../../core/editor/explorer-library/library-service';
import { resetExplorerLibraryStoreForTests } from '../../core/editor/explorer-library/library-store';
import { useEditorStore } from '../../core/editor/model/editor-store';
import { FloatingToolMenu } from '../../widgets/canvas-editor/ui/FloatingToolMenu';
import { CanvasViewport } from '../../widgets/canvas-editor/ui/CanvasViewport';
import { getExplorerLibraryService } from '../../core/editor/explorer-library/library-service';

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

class ClipboardDataStub {
  files: File[];
  private readonly data = new Map<string, string>();

  constructor(input?: { files?: File[]; data?: Record<string, string> }) {
    this.files = input?.files ?? [];
    Object.entries(input?.data ?? {}).forEach(([type, value]) => {
      this.data.set(type, value);
    });
  }

  setData(type: string, value: string) {
    this.data.set(type, value);
    return true;
  }

  getData(type: string) {
    return this.data.get(type) ?? '';
  }
}

function dispatchClipboardEvent(
  target: EventTarget,
  type: 'copy' | 'paste',
  clipboardData: ClipboardDataStub,
) {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  }) as ClipboardEvent;

  Object.defineProperty(event, 'clipboardData', {
    configurable: true,
    value: clipboardData,
  });

  target.dispatchEvent(event);
  return event;
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

  it('exits temporary pan mode on keyup after holding space', () => {
    renderInProvider(
      <>
        <FloatingToolMenu />
        <CanvasViewport />
      </>,
      root,
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    });
    expect(useEditorStore.getState().temporaryToolOverride).toBe('pan');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));
    });

    expect(useEditorStore.getState().temporaryToolOverride).toBe(null);
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
      typingInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', metaKey: true, bubbles: true }));
    });

    expect(useEditorStore.getState().temporaryToolOverride).toBe(null);
    expect(useEditorStore.getState().scene.objects.find((object) => object.id === shapeId)?.x).toBe(180);
    expect(useEditorStore.getState().clipboard.rootIds).toEqual([]);
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
      editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    });

    expect(useEditorStore.getState().temporaryToolOverride).toBe(null);
    expect(useEditorStore.getState().scene.objects.find((object) => object.id === stickyId)).toBeTruthy();
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

  it('copies the current selection into the internal clipboard with Mod+C', () => {
    renderInProvider(<div />, root);

    act(() => {
      useEditorStore.getState().createObjectAtViewportCenter('shape');
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', metaKey: true }));
    });

    expect(useEditorStore.getState().clipboard.rootIds).toEqual([useEditorStore.getState().selection.primaryId]);
  });

  it('deletes the current selection with Delete and Backspace outside typing targets', () => {
    renderInProvider(<div />, root);

    let shapeId = '';
    act(() => {
      useEditorStore.getState().createObjectAtViewportCenter('shape');
      shapeId = useEditorStore.getState().selection.primaryId!;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    });
    expect(useEditorStore.getState().scene.objects.find((object) => object.id === shapeId)).toBeUndefined();

    act(() => {
      useEditorStore.getState().createObjectAtViewportCenter('sticky');
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    });
    expect(useEditorStore.getState().scene.objects).toHaveLength(0);
  });

  it('adjusts zoom with Mod plus and minus aliases', () => {
    renderInProvider(<div />, root);

    expect(useEditorStore.getState().viewport.zoom).toBe(1);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '=', metaKey: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '+', metaKey: true, shiftKey: true, code: 'Equal' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Add', metaKey: true, code: 'NumpadAdd' }));
    });

    expect(useEditorStore.getState().viewport.zoom).toBeCloseTo(1.3);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '-', metaKey: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Subtract', metaKey: true, code: 'NumpadSubtract' }));
    });

    expect(useEditorStore.getState().viewport.zoom).toBeCloseTo(1.1);
  });

  it('writes Magam clipboard payload and plain text on copy', () => {
    renderInProvider(<div />, root);

    act(() => {
      useEditorStore.getState().createObjectAtViewportCenter('shape');
    });

    const clipboardData = new ClipboardDataStub();
    const event = dispatchClipboardEvent(window, 'copy', clipboardData);

    expect(event.defaultPrevented).toBe(true);
    expect(clipboardData.getData(MAGAM_CLIPBOARD_MIME_TYPE)).toContain('"kind":"magam.canvas.clipboard"');
    expect(clipboardData.getData('text/plain')).toContain('Magam canvas selection');
  });

  it('prefers the internal clipboard over the system Magam payload on paste', () => {
    renderInProvider(<div />, root);

    let shapeSnapshot = '';
    act(() => {
      useEditorStore.getState().createObjectAtViewportCenter('shape');
      useEditorStore.getState().copySelection();
      shapeSnapshot = serializeClipboardSnapshot(useEditorStore.getState().clipboard);
      useEditorStore.getState().createObjectAtViewportCenter('sticky');
      useEditorStore.getState().copySelection();
    });

    const stickyClipboard = useEditorStore.getState().clipboard;
    act(() => {
      useEditorStore.setState((state) => ({
        ...state,
        clipboard: stickyClipboard,
      }));
    });

    const clipboardData = new ClipboardDataStub({
      data: {
        [MAGAM_CLIPBOARD_MIME_TYPE]: shapeSnapshot,
      },
    });

    act(() => {
      dispatchClipboardEvent(window, 'paste', clipboardData);
    });

    const objects = useEditorStore.getState().scene.objects;
    expect(objects.filter((object) => object.kind === 'sticky')).toHaveLength(2);
    expect(objects.filter((object) => object.kind === 'shape')).toHaveLength(1);
  });

  it('pastes the system Magam payload when the internal clipboard is empty', () => {
    renderInProvider(<div />, root);

    let serializedClipboard = '';
    act(() => {
      useEditorStore.getState().createObjectAtViewportCenter('shape');
      useEditorStore.getState().copySelection();
      serializedClipboard = serializeClipboardSnapshot(useEditorStore.getState().clipboard);
      useEditorStore.setState((state) => ({
        ...state,
        clipboard: {
          objects: [],
          rootIds: [],
          pasteCount: 0,
        },
      }));
    });

    act(() => {
      dispatchClipboardEvent(window, 'paste', new ClipboardDataStub({
        data: {
          [MAGAM_CLIPBOARD_MIME_TYPE]: serializedClipboard,
        },
      }));
    });

    expect(useEditorStore.getState().scene.objects).toHaveLength(2);
  });

  it('ignores unknown clipboard text during paste', () => {
    renderInProvider(<div />, root);

    act(() => {
      dispatchClipboardEvent(window, 'paste', new ClipboardDataStub({
        data: {
          'text/plain': 'not a magam clipboard payload',
        },
      }));
    });

    expect(useEditorStore.getState().scene.objects).toHaveLength(0);
  });

  it('does not paste canvas objects while inline body editor text is focused', () => {
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
      useEditorStore.getState().updateObjectBody(stickyId, createBodyDocument([
        createBodyParagraphNode('Editable body'),
      ]));
      useEditorStore.getState().copySelection();
      useEditorStore.getState().openBodyEditor(stickyId);
    });

    const textNode = container.querySelector('.canvas-object__wysiwyg-surface p')?.firstChild;
    expect(textNode).toBeTruthy();

    act(() => {
      dispatchClipboardEvent(textNode!, 'paste', new ClipboardDataStub({
        data: {
          [MAGAM_CLIPBOARD_MIME_TYPE]: serializeClipboardSnapshot(useEditorStore.getState().clipboard),
          'text/plain': 'pasted text',
        },
      }));
    });

    expect(useEditorStore.getState().scene.objects).toHaveLength(1);
  });

  it('does not override text copy while inline body editor text is focused', () => {
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
      useEditorStore.getState().updateObjectBody(stickyId, createBodyDocument([
        createBodyParagraphNode('Editable body'),
      ]));
      useEditorStore.getState().openBodyEditor(stickyId);
    });

    const textNode = container.querySelector('.canvas-object__wysiwyg-surface p')?.firstChild;
    expect(textNode).toBeTruthy();

    const clipboardData = new ClipboardDataStub();
    const event = dispatchClipboardEvent(textNode!, 'copy', clipboardData);

    expect(event.defaultPrevented).toBe(false);
    expect(clipboardData.getData(MAGAM_CLIPBOARD_MIME_TYPE)).toBe('');
  });

  it('prioritizes clipboard image import over canvas object paste', async () => {
    renderInProvider(<div />, root);

    act(() => {
      useEditorStore.getState().createObjectAtViewportCenter('shape');
      useEditorStore.getState().copySelection();
    });

    const service = await getExplorerLibraryService();
    const importSpy = vi.spyOn(service, 'importClipboardImageAndPlace').mockResolvedValue({
      ok: true,
      value: undefined,
    });

    await act(async () => {
      dispatchClipboardEvent(window, 'paste', new ClipboardDataStub({
        files: [new File([Uint8Array.from([1, 2, 3])], 'clipboard.png', { type: 'image/png' })],
        data: {
          [MAGAM_CLIPBOARD_MIME_TYPE]: serializeClipboardSnapshot(useEditorStore.getState().clipboard),
        },
      }));
      await Promise.resolve();
    });

    expect(importSpy).toHaveBeenCalledTimes(1);
    expect(useEditorStore.getState().scene.objects).toHaveLength(1);
  });
});
