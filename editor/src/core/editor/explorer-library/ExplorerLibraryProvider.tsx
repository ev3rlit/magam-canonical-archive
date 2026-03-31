'use client';

import { useEffect } from 'react';
import { useExplorerLibraryStore } from './library-store';

export function ExplorerLibraryProvider() {
  const initialize = useExplorerLibraryStore((state) => state.initialize);

  useEffect(() => {
    if ((globalThis as Record<string, unknown>)['__MAGAM_DISABLE_LIBRARY_PROVIDER__'] === true) {
      return;
    }
    void initialize();
  }, [initialize]);

  return null;
}
