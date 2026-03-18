import { useCallback, useEffect, useRef, useState } from 'react';
import type { OverlayDismissReason } from '@/features/overlay-host';
import { useOverlayHost } from '@/features/overlay-host';
import type { ContextMenuContext, ContextMenuItem } from '@/types/contextMenu';
import { nodeMenuItems, paneMenuItems } from '@/config/contextMenuItems';
import { createContextMenuOverlayContribution } from '@/components/ContextMenu';
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

export function useContextMenu() {
    const {
        open: openOverlay,
        replace: replaceOverlay,
        close: closeOverlay,
        getActive,
    } = useOverlayHost();
    const [state, setState] = useState<ContextMenuState>({
        isOpen: false,
        context: null,
        items: [],
        instanceId: null,
    });
    const stateRef = useRef(state);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    const openMenu = useCallback((
        ctx: ContextMenuContext,
        options?: {
            triggerElement?: HTMLElement | null;
            selectionOwnerElement?: HTMLElement | null;
        },
    ) => {
        const rawItems = ctx.type === 'node' ? nodeMenuItems : paneMenuItems;
        const items = sanitizeContextMenuItems(rawItems, ctx);
        const contribution = createContextMenuOverlayContribution({
            slot: ctx.type === 'node' ? 'node-context-menu' : 'pane-context-menu',
            items,
            context: ctx,
            triggerElement: options?.triggerElement ?? null,
            selectionOwnerElement: options?.selectionOwnerElement ?? null,
            onDismiss: (reason) => {
                setState({
                    isOpen: false,
                    context: null,
                    items: [],
                    instanceId: null,
                    lastDismissReason: reason,
                });
            },
        });

        const activeInstanceId = stateRef.current.instanceId;
        const nextInstanceId = activeInstanceId
            && getActive().some((item) => item.instanceId === activeInstanceId)
            ? replaceOverlay(activeInstanceId, contribution)
            : openOverlay(contribution);

        setState({
            isOpen: true,
            context: ctx,
            items,
            instanceId: nextInstanceId,
            lastDismissReason: stateRef.current.lastDismissReason,
        });
    }, [getActive, openOverlay, replaceOverlay]);

    const closeMenu = useCallback((reason: OverlayDismissReason = 'programmatic-close') => {
        const activeInstanceId = stateRef.current.instanceId;
        if (!activeInstanceId) {
            return;
        }

        closeOverlay(activeInstanceId, reason);
    }, [closeOverlay]);

    const handleSelectionChange = useCallback((selectedNodeIds: string[]) => {
        if (!shouldDismissContextMenuForSelectionChange(stateRef.current, selectedNodeIds)) {
            return;
        }

        closeMenu('selection-change');
    }, [closeMenu]);

    return {
        ...state,
        openMenu,
        closeMenu,
        handleSelectionChange,
    };
}
