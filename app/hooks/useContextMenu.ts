import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ContextMenuContext, ContextMenuItem } from '@/types/contextMenu';
import { nodeMenuItems, paneMenuItems } from '@/config/contextMenuItems';
import {
    createEntrypointAnchor,
    createOpenSurfaceDescriptor,
    getContextMenuSurfaceKind,
} from '@/features/canvas-ui-entrypoints/ui-runtime-state';
import { useGraphStore } from '@/store/graph';

export interface ContextMenuState {
    isOpen: boolean;
    context: ContextMenuContext | null;
    items: ContextMenuItem[];
}

export const sanitizeItems = (items: ContextMenuItem[], ctx: ContextMenuContext) => {
    const visible = items.filter((item) => {
        if (item.type === 'separator') {
            return true;
        }
        if (item.when) {
            return item.when(ctx);
        }
        return true;
    });

    const ordered = visible.slice().sort((a, b) => {
        const aOrder = a.type === 'action' || a.type === 'submenu' ? a.order ?? 0 : 0;
        const bOrder = b.type === 'action' || b.type === 'submenu' ? b.order ?? 0 : 0;
        return aOrder - bOrder;
    });

    const compacted: ContextMenuItem[] = [];
    ordered.forEach((item) => {
        if (item.type === 'separator') {
            if (compacted.length === 0) {
                return;
            }
            const prev = compacted[compacted.length - 1];
            if (prev.type === 'separator') {
                return;
            }
        }
        compacted.push(item);
    });

    if (compacted.length > 0 && compacted[compacted.length - 1].type === 'separator') {
        compacted.pop();
    }

    return compacted;
};

function buildContextMenuAnchorId(ctx: ContextMenuContext): string {
    if (ctx.type === 'node') {
        return `context-menu:node:${ctx.nodeId ?? 'unknown'}`;
    }
    return 'context-menu:pane';
}

export function useContextMenu() {
    const [state, setState] = useState<ContextMenuState>({
        context: null,
        items: [],
        isOpen: false,
    });
    const openSurface = useGraphStore((store) => store.entrypointRuntime.openSurface);
    const registerEntrypointAnchor = useGraphStore((store) => store.registerEntrypointAnchor);
    const openEntrypointSurface = useGraphStore((store) => store.openEntrypointSurface);
    const clearEntrypointAnchor = useGraphStore((store) => store.clearEntrypointAnchor);
    const closeEntrypointSurface = useGraphStore((store) => store.closeEntrypointSurface);

    const isOpen = useMemo(() => {
        if (!state.context) {
            return false;
        }

        const expectedSurfaceKind = state.context.type === 'node'
            ? 'node-context-menu'
            : 'pane-context-menu';
        return openSurface?.kind === expectedSurfaceKind
            && openSurface.anchorId === state.context.anchorId;
    }, [openSurface, state.context]);

    const openMenu = useCallback((ctx: ContextMenuContext) => {
        const rawItems = ctx.type === 'node' ? nodeMenuItems : paneMenuItems;
        const items = sanitizeItems(rawItems, ctx);
        const anchorId = ctx.anchorId ?? buildContextMenuAnchorId(ctx);
        const surfaceKind = ctx.type === 'node'
            ? 'node-context-menu'
            : 'pane-context-menu';

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
        setState({
            isOpen: true,
            context: {
                ...ctx,
                anchorId,
                surfaceKind,
            },
            items,
        });
    }, [openEntrypointSurface, registerEntrypointAnchor]);

    const closeMenu = useCallback(() => {
        setState((prev) => {
            if (prev.context?.anchorId) {
                clearEntrypointAnchor(prev.context.anchorId);
            }
            closeEntrypointSurface();
            return {
                ...prev,
                isOpen: false,
                context: null,
                items: [],
            };
        });
    }, [clearEntrypointAnchor, closeEntrypointSurface]);

    useEffect(() => {
        if (!state.context) {
            return;
        }

        const hasMatchingContextSurface = state.context
            && openSurface
            && openSurface.kind === getContextMenuSurfaceKind(state.context.type)
            && openSurface.anchorId === state.context.anchorId;

        if (!openSurface || !hasMatchingContextSurface) {
            if (state.context?.anchorId && openSurface?.anchorId !== state.context.anchorId) {
                clearEntrypointAnchor(state.context.anchorId);
            }
            setState((prev) => ({
                ...prev,
                isOpen: false,
                context: null,
                items: [],
            }));
        }
    }, [clearEntrypointAnchor, openSurface, state.context]);

    return {
        ...state,
        isOpen,
        openMenu,
        closeMenu,
    };
}
