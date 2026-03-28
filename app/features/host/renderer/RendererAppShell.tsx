'use client';

import { useState, useEffect } from 'react';
import { CanvasEditorPage } from '@/features/editor/pages/CanvasEditorPage';
import { getHostRuntime } from './createHostRuntime';
import { LAST_ACTIVE_CANVAS_ID_SESSION_PREFERENCE_KEY } from '@/components/editor/workspaceRegistry';

function readCanvasIdMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      ([, canvasId]) => typeof canvasId === 'string' && canvasId.length > 0,
    ),
  );
}

export function RendererAppShell() {
  const runtime = getHostRuntime();
  const [hash, setHash] = useState(
    typeof window !== 'undefined' ? window.location.hash : ''
  );
  const [resolvedCanvasId, setResolvedCanvasId] = useState<string | null>(null);
  const [initialRouteResolved, setInitialRouteResolved] = useState(
    typeof window === 'undefined',
  );

  useEffect(() => {
    void runtime.bootstrap.markLoading();

    const handleHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [runtime]);

  useEffect(() => {
    if (typeof window === 'undefined' || window.location.hash.length > 0) {
      setInitialRouteResolved(true);
      return;
    }

    if (runtime.mode !== 'desktop-primary') {
      setInitialRouteResolved(true);
      return;
    }

    let cancelled = false;

    const resolveInitialRoute = async () => {
      let session = await runtime.bootstrap.getSession().catch(() => null);
      try {
        const [appStateSession, workspaces, lastCanvasIdPreference] = await Promise.all([
          runtime.rpc.getAppStateWorkspaceSession().catch(() => null),
          runtime.rpc.listAppStateWorkspaces().catch(() => []),
          runtime.rpc.getAppStatePreference(LAST_ACTIVE_CANVAS_ID_SESSION_PREFERENCE_KEY).catch(() => null),
        ]);
        if (cancelled) {
          return;
        }

        const lastCanvasIds = readCanvasIdMap(lastCanvasIdPreference?.valueJson);
        const activeWorkspaceId = appStateSession?.activeWorkspaceId ?? null;
        const activeWorkspace = activeWorkspaceId
          ? workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null
          : null;
        const lastCanvasId = activeWorkspaceId ? lastCanvasIds[activeWorkspaceId] : null;
        const applyHashRoute = (nextHash: string) => {
          window.location.hash = nextHash;
          setHash(window.location.hash);
        };

        if (activeWorkspaceId && lastCanvasId) {
          setResolvedCanvasId(lastCanvasId);
          applyHashRoute(`/canvas/${encodeURIComponent(lastCanvasId)}`);
          return;
        }

        if (activeWorkspace) {
          const canvases = await runtime.rpc.listWorkspaceCanvases(activeWorkspace.rootPath).catch(() => null);
          const firstCanvasId = canvases?.canvases.find(
            (canvas): canvas is { canvasId: string } =>
              typeof canvas.canvasId === 'string' && canvas.canvasId.length > 0,
          )?.canvasId ?? null;
          if (firstCanvasId) {
            setResolvedCanvasId(firstCanvasId);
            applyHashRoute(`/canvas/${encodeURIComponent(firstCanvasId)}`);
            return;
          }
        }

        if (session?.transientCanvasId) {
          setResolvedCanvasId(session.transientCanvasId);
          applyHashRoute(`/canvas/${encodeURIComponent(session.transientCanvasId)}`);
          return;
        }

        setResolvedCanvasId(runtime.runtimeConfig?.transientCanvasId ?? null);
        setInitialRouteResolved(true);
      } catch {
        if (cancelled) {
          return;
        }
        session = session ?? await runtime.bootstrap.getSession().catch(() => null);
        const fallbackCanvasId = session?.transientCanvasId ?? runtime.runtimeConfig?.transientCanvasId ?? null;
        if (fallbackCanvasId) {
          setResolvedCanvasId(fallbackCanvasId);
          window.location.hash = `/canvas/${encodeURIComponent(fallbackCanvasId)}`;
          setHash(window.location.hash);
        }
      } finally {
        if (!cancelled) {
          setInitialRouteResolved(true);
        }
      }
    };

    void resolveInitialRoute();

    return () => {
      cancelled = true;
    };
  }, [runtime]);

  if (!initialRouteResolved) {
    return null;
  }

  if (hash.startsWith('#/canvas/')) {
    const canvasId = decodeURIComponent(hash.replace('#/canvas/', ''));
    return <CanvasEditorPage canvasId={canvasId} />;
  }

  if (resolvedCanvasId) {
    return <CanvasEditorPage canvasId={resolvedCanvasId} />;
  }

  if (runtime.runtimeConfig?.transientCanvasId) {
    return <CanvasEditorPage canvasId={runtime.runtimeConfig.transientCanvasId} />;
  }

  return null;
}
