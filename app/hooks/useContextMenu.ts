import { useCallback, useEffect, useRef, useState } from 'react';
import type { OverlayDismissReason } from '@/features/overlay-host';
import { useOverlayHost } from '@/features/overlay-host';
import type { ContextMenuContext, ContextMenuItem } from '@/types/contextMenu';
import { createContextMenuOverlayContribution } from '@/components/ContextMenu';
import {
  resolveCanvasContextMenuSession,
  resolveContextMenuSurfaceKind,
} from '@/processes/canvas-runtime/bindings/contextMenu';
import { canvasRuntime } from '@/processes/canvas-runtime/createCanvasRuntime';
import { useGraphStore } from '@/store/graph';
import {
  shouldDismissContextMenuForSelectionChange,
} from './useContextMenu.helpers';

export interface ContextMenuState {
  isOpen: boolean;
  context: ContextMenuContext | null;
  items: ContextMenuItem[];
  instanceId: string | null;
  lastDismissReason?: OverlayDismissReason;
}

export function useContextMenu() {
  const {
    open: openOverlay,
    replace: replaceOverlay,
    close: closeOverlay,
    getActive,
  } = useOverlayHost();
  const [state, setState] = useState<ContextMenuState>({
    context: null,
    items: [],
    isOpen: false,
    instanceId: null,
  });
  const stateRef = useRef(state);
  const openSurface = useGraphStore((store) => store.entrypointRuntime.openSurface);
  const registerEntrypointAnchor = useGraphStore((store) => store.registerEntrypointAnchor);
  const openEntrypointSurface = useGraphStore((store) => store.openEntrypointSurface);
  const clearEntrypointAnchor = useGraphStore((store) => store.clearEntrypointAnchor);
  const closeEntrypointSurface = useGraphStore((store) => store.closeEntrypointSurface);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const closeMenu = useCallback((reason: OverlayDismissReason = 'programmatic-close') => {
    const activeInstanceId = stateRef.current.instanceId;
    if (activeInstanceId && getActive().some((item) => item.instanceId === activeInstanceId)) {
      closeOverlay(activeInstanceId, reason);
      return;
    }

    const currentContext = stateRef.current.context;
    if (currentContext?.anchorId) {
      clearEntrypointAnchor(currentContext.anchorId);
    }
    closeEntrypointSurface();
    setState((prev) => ({
      ...prev,
      isOpen: false,
      context: null,
      items: [],
      instanceId: null,
      lastDismissReason: reason,
    }));
  }, [clearEntrypointAnchor, closeEntrypointSurface, closeOverlay, getActive]);

  const openMenu = useCallback((
    ctx: ContextMenuContext,
    options?: {
      triggerElement?: HTMLElement | null;
      selectionOwnerElement?: HTMLElement | null;
    },
  ) => {
    const resolved = resolveCanvasContextMenuSession({
      context: ctx,
      runtime: canvasRuntime,
    });

    registerEntrypointAnchor(resolved.anchor);
    openEntrypointSurface(resolved.openSurface);

    const contribution = createContextMenuOverlayContribution({
      slot: resolved.surfaceKind,
      items: resolved.items,
      context: resolved.context,
      triggerElement: options?.triggerElement ?? null,
      selectionOwnerElement: options?.selectionOwnerElement ?? null,
      onDismiss: (reason) => {
        const runtimeOpenSurface = useGraphStore.getState().entrypointRuntime.openSurface;
        if (
          runtimeOpenSurface?.kind === resolved.surfaceKind
          && runtimeOpenSurface.anchorId === resolved.anchorId
        ) {
          clearEntrypointAnchor(resolved.anchorId);
          closeEntrypointSurface();
        }

        setState((prev) => (
          prev.context?.anchorId === resolved.anchorId
            ? {
                ...prev,
                isOpen: false,
                context: null,
                items: [],
                instanceId: null,
                lastDismissReason: reason,
              }
            : prev
        ));
      },
    });

    const activeInstanceId = stateRef.current.instanceId;
    const nextInstanceId = activeInstanceId
      && getActive().some((item) => item.instanceId === activeInstanceId)
      ? replaceOverlay(activeInstanceId, contribution)
      : openOverlay(contribution);

    setState({
      isOpen: true,
      context: resolved.context,
      items: resolved.items,
      instanceId: nextInstanceId,
      lastDismissReason: stateRef.current.lastDismissReason,
    });
  }, [
    clearEntrypointAnchor,
    closeEntrypointSurface,
    getActive,
    openEntrypointSurface,
    openOverlay,
    registerEntrypointAnchor,
    replaceOverlay,
  ]);

  const handleSelectionChange = useCallback((selectedNodeIds: string[]) => {
    if (!shouldDismissContextMenuForSelectionChange(stateRef.current, selectedNodeIds)) {
      return;
    }

    closeMenu('selection-change');
  }, [closeMenu]);

  useEffect(() => {
    const currentContext = stateRef.current.context;
    if (!currentContext) {
      return;
    }

    const expectedSurfaceKind = resolveContextMenuSurfaceKind(currentContext);
    const openSurfaceMatches = openSurface?.kind === expectedSurfaceKind
      && openSurface.anchorId === currentContext.anchorId;
    const activeInstanceExists = stateRef.current.instanceId
      ? getActive().some((item) => item.instanceId === stateRef.current.instanceId)
      : false;

    if (!openSurfaceMatches && activeInstanceExists && stateRef.current.instanceId) {
      closeOverlay(stateRef.current.instanceId, 'programmatic-close');
      return;
    }

    if (!openSurfaceMatches && !activeInstanceExists) {
      setState((prev) => ({
        ...prev,
        isOpen: false,
        context: null,
        items: [],
        instanceId: null,
      }));
    }
  }, [closeOverlay, getActive, openSurface]);

  return {
    ...state,
    openMenu,
    closeMenu,
    handleSelectionChange,
  };
}
