'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
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

export function AppProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const handleKeyboardEvent = (phase: 'down' | 'up') => (event: KeyboardEvent) => {
      const result = dispatchShortcut({
        event,
        isTypingTarget: isTypingTarget(event.target),
        phase,
      });

      if (result.preventDefault) {
        event.preventDefault();
      }
    };

    const handleKeyDown = handleKeyboardEvent('down');
    const handleKeyUp = handleKeyboardEvent('up');
    const handleBlur = () => {
      useEditorStore.getState().setTemporaryToolOverride(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return <>{children}</>;
}
