'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { ExplorerLibraryProvider } from '@/core/editor/explorer-library/ExplorerLibraryProvider';
import { getExplorerLibraryService } from '@/core/editor/explorer-library/library-service';
import { useEditorStore } from '@/core/editor/model/editor-store';
import { dispatchShortcut } from '@/core/editor/shortcuts/dispatchShortcut';

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable ||
    target.getAttribute('contenteditable') === 'true'
  );
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
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
