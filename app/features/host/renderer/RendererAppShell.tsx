'use client';

import { useState, useEffect } from 'react';
import { WorkspaceDashboardPage } from '@/features/workspace/pages/WorkspaceDashboardPage';
import { WorkspaceDetailPage } from '@/features/workspace/pages/WorkspaceDetailPage';
import { CanvasEditorPage } from '@/features/editor/pages/CanvasEditorPage';
import { getHostRuntime } from './createHostRuntime';

export function RendererAppShell() {
  const [hash, setHash] = useState(
    typeof window !== 'undefined' ? window.location.hash : ''
  );

  useEffect(() => {
    void getHostRuntime().bootstrap.markLoading();
    
    const handleHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (hash.startsWith('#/canvas/')) {
    const canvasId = decodeURIComponent(hash.replace('#/canvas/', ''));
    return <CanvasEditorPage canvasId={canvasId} />;
  }

  if (hash.startsWith('#/workspace/')) {
    const workspaceId = hash.replace('#/workspace/', '');
    return <WorkspaceDetailPage workspaceId={workspaceId} />;
  }

  return <WorkspaceDashboardPage />;
}
