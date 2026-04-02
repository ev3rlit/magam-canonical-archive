'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import {
  describeClipboardSnapshot,
  deserializeClipboardSnapshot,
  MAGAM_CLIPBOARD_MIME_TYPE,
  serializeClipboardSnapshot,
} from '@/core/editor/clipboard/canvas-clipboard';
import { ExplorerLibraryProvider } from '@/core/editor/explorer-library/ExplorerLibraryProvider';
import { getExplorerLibraryService } from '@/core/editor/explorer-library/library-service';
import { useEditorStore } from '@/core/editor/model/editor-store';
import { dispatchShortcut } from '@/core/editor/shortcuts/dispatchShortcut';

function isTypingElement(element: HTMLElement | null) {
  if (!element) {
    return false;
  }

  return (
    element.closest('input, textarea, select') !== null ||
    element.isContentEditable ||
    element.closest('[contenteditable="true"], [contenteditable="plaintext-only"]') !== null
  );
}

function resolveTypingElement(target: EventTarget | null) {
  if (target instanceof HTMLElement) {
    return target;
  }

  if (target instanceof Node) {
    return target.parentElement;
  }

  return null;
}

function isTypingTarget(target: EventTarget | null) {
  if (isTypingElement(resolveTypingElement(target))) {
    return true;
  }

  return document.activeElement instanceof HTMLElement
    ? isTypingElement(document.activeElement)
    : false;
}

function isPrintableCanvasKey(event: KeyboardEvent) {
  return event.key.length === 1
    && !event.metaKey
    && !event.ctrlKey
    && !event.altKey
    && event.key !== ' ';
}

export function AppProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const handleKeyboardEvent = (phase: 'down' | 'up') => (event: KeyboardEvent) => {
      const isTyping = isTypingTarget(event.target);
      if (phase === 'down' && !isTyping) {
        const state = useEditorStore.getState();
        const primaryId = state.selection.primaryId;
        const primaryObject = primaryId
          ? state.scene.objects.find((object) => object.id === primaryId) ?? null
          : null;

        if (
          primaryObject
          && primaryObject.kind !== 'group'
          && state.selection.ids.length === 1
          && !state.overlays.isBodyEditorOpen
        ) {
          if (event.key === 'Enter') {
            event.preventDefault();
            state.openBodyEditor(primaryObject.id, '\n');
            return;
          }

          if (event.key === '/' || isPrintableCanvasKey(event)) {
            event.preventDefault();
            state.openBodyEditor(primaryObject.id, event.key);
            return;
          }
        }
      }

      const result = dispatchShortcut({
        event,
        isTypingTarget: isTyping,
        phase,
      });

      if (result.preventDefault) {
        event.preventDefault();
      }
    };

    const handleKeyDown = handleKeyboardEvent('down');
    const handleKeyUp = handleKeyboardEvent('up');
    const handleBlur = () => {
      const state = useEditorStore.getState();
      if (state.overlays.isBodyEditorOpen) {
        state.commitActiveBodyEditor();
      }
      state.setTemporaryToolOverride(null);
    };

    const handleCopy = (event: ClipboardEvent) => {
      const isTyping = isTypingTarget(event.target);
      if (isTyping) {
        return;
      }

      const state = useEditorStore.getState();
      if (state.selection.ids.length === 0) {
        return;
      }

      state.copySelection();
      const clipboard = useEditorStore.getState().clipboard;
      if (clipboard.rootIds.length === 0) {
        return;
      }

      event.preventDefault();
      event.clipboardData?.setData(MAGAM_CLIPBOARD_MIME_TYPE, serializeClipboardSnapshot(clipboard));
      event.clipboardData?.setData('text/plain', describeClipboardSnapshot(clipboard));
    };

    const handlePaste = (event: ClipboardEvent) => {
      const isTyping = isTypingTarget(event.target);
      if (isTyping) {
        return;
      }

      const files = Array.from(event.clipboardData?.files ?? []);
      const imageFile = files.find((file) => file.type.startsWith('image/'));
      if (imageFile) {
        event.preventDefault();
        void getExplorerLibraryService().then((service) => service.importClipboardImageAndPlace(imageFile));
        return;
      }

      const state = useEditorStore.getState();
      if (state.clipboard.rootIds.length > 0) {
        event.preventDefault();
        state.pasteClipboard();
        return;
      }

      const serializedClipboard = event.clipboardData?.getData(MAGAM_CLIPBOARD_MIME_TYPE) ?? '';
      const clipboardSnapshot = deserializeClipboardSnapshot(serializedClipboard);
      if (clipboardSnapshot && clipboardSnapshot.rootIds.length > 0) {
        event.preventDefault();
        state.pasteClipboardSnapshot(clipboardSnapshot);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('copy', handleCopy);
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('copy', handleCopy);
      window.removeEventListener('paste', handlePaste);
    };
  }, []);

  return (
    <>
      <ExplorerLibraryProvider />
      {children}
    </>
  );
}
