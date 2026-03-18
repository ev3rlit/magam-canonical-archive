import { useCallback, useEffect, useRef, useState } from 'react';
import type { OverlayDismissReason } from '@/features/overlay-host';
import { useOverlayHost } from '@/features/overlay-host';
import type { ContextMenuContext, ContextMenuItem } from '@/types/contextMenu';
import { nodeMenuItems, paneMenuItems } from '@/config/contextMenuItems';
import { createContextMenuOverlayContribution } from '@/components/ContextMenu';
import {
  createEntrypointAnchor,
  createOpenSurfaceDescriptor,
} from '@/features/canvas-ui-entrypoints/ui-runtime-state';
import { useGraphStore } from '@/store/graph';
import {
  sanitizeContextMenuItems,
  shouldDismissContextMenuForSelectionChange,
} from './useContextMenu.helpers';

export interface ContextMenuState {
  isOpen: boolean;
  context: ContextMenuContext | null;
  items: ContextMenuItem[];
  instanceId: string | null;
  lastDismissReason?: OverlayDismissReason;
}

function buildContextMenuAnchorId(ctx: ContextMenuContext): string {
  if (ctx.type === 'node') {
    return `context-menu:node:${ctx.nodeId ?? 'unknown'}`;
  }

  return 'context-menu:pane';
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
    const rawItems = ctx.type === 'node' ? nodeMenuItems : paneMenuItems;
    const items = sanitizeContextMenuItems(rawItems, ctx);
    const anchorId = ctx.anchorId ?? buildContextMenuAnchorId(ctx);
    const surfaceKind: NonNullable<ContextMenuContext['surfaceKind']> = ctx.type === 'node'
      ? 'node-context-menu'
      : 'pane-context-menu';
    const nextContext: ContextMenuContext = {
      ...ctx,
      anchorId,
      surfaceKind,
    };

    registerEntrypointAnchor(createEntrypointAnchor({
      anchorId,
      kind: 'pointer',
      ownerId: ctx.nodeId,
      nodeIds: ctx.selectedNodeIds,
      screen: { x: ctx.position.x, y: ctx.position.y },
    }));
    openEntrypointSurface(createOpenSurfaceDescriptor({
      kind: surfaceKind,
      anchorId,
      ownerId: ctx.nodeId,
      dismissOnSelectionChange: ctx.type === 'node',
      dismissOnViewportChange: true,
    }));

    const contribution = createContextMenuOverlayContribution({
      slot: surfaceKind,
      items,
      context: nextContext,
      triggerElement: options?.triggerElement ?? null,
      selectionOwnerElement: options?.selectionOwnerElement ?? null,
      onDismiss: (reason) => {
        const runtimeOpenSurface = useGraphStore.getState().entrypointRuntime.openSurface;
        if (
          runtimeOpenSurface?.kind === surfaceKind
          && runtimeOpenSurface.anchorId === anchorId
        ) {
          clearEntrypointAnchor(anchorId);
          closeEntrypointSurface();
        }

        setState((prev) => (
          prev.context?.anchorId === anchorId
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
      context: nextContext,
      items,
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

    const expectedSurfaceKind: NonNullable<ContextMenuContext['surfaceKind']> = currentContext.type === 'node'
      ? 'node-context-menu'
      : 'pane-context-menu';
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
