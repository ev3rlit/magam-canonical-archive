'use client';

import { useEffect } from 'react';
import { WorkspaceClient } from '@/components/editor/WorkspaceClient';
import { getHostRuntime } from './createHostRuntime';

export function RendererAppShell() {
  useEffect(() => {
    void getHostRuntime().bootstrap.markLoading();
  }, []);

  return <WorkspaceClient />;
}
