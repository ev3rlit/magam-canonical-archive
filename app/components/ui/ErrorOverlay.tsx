import { useGraphStore } from '@/store/graph';
import { useEffect } from 'react';

export function ErrorOverlay() {
  const { error } = useGraphStore();

  useEffect(() => {
    if (!error) {
      return;
    }

    console.error('[CanvasEditorError]', {
      type: error.type ?? 'Error',
      message: error.message,
      location: error.location ?? null,
      details: error.details ?? null,
    });
  }, [error]);

  return null;
}
