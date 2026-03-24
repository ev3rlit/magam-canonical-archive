import type { ContextMenuContext, ContextMenuItem } from '@/types/contextMenu';

export interface ContextMenuSelectionSnapshot {
    instanceId: string | null;
    context: ContextMenuContext | null;
}

function areSameSelection(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
        return false;
    }

    return left.every((item) => right.includes(item));
}

export function sanitizeContextMenuItems(items: ContextMenuItem[], ctx: ContextMenuContext): ContextMenuItem[] {
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
}

export function shouldDismissContextMenuForSelectionChange(
    state: ContextMenuSelectionSnapshot,
    nextSelectedNodeIds: string[],
): boolean {
    if (!state.instanceId || !state.context) {
        return false;
    }

    return !areSameSelection(state.context.selectedNodeIds, nextSelectedNodeIds);
}
