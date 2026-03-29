'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useEditorStore } from '@/core/editor/model/editor-store';

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

export function AppProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const state = useEditorStore.getState();

      if (event.key === 'Escape') {
        state.setContextMenu(null);
        state.setMarquee(null);
        state.openMobilePanel(null);
        state.clearFocusRequest();
        state.clearSelection();
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      const isMeta = event.metaKey || event.ctrlKey;
      const lowered = event.key.toLowerCase();

      if ((event.key === 'Delete' || event.key === 'Backspace') && state.selection.ids.length > 0) {
        event.preventDefault();
        state.deleteSelection();
        return;
      }

      if (isMeta && lowered === 'd' && state.selection.ids.length > 0) {
        event.preventDefault();
        state.duplicateSelection();
        return;
      }

      if (isMeta && lowered === 'g' && state.selection.ids.length > 0) {
        event.preventDefault();
        if (event.shiftKey) {
          state.ungroupSelection();
          return;
        }
        state.groupSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return <>{children}</>;
}
