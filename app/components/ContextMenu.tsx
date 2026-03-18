import React from 'react';
import { createSlotContribution } from '@/features/overlay-host';
import type { OverlayDismissReason } from '@/features/overlay-host';
import { cn } from '@/utils/cn';
import type { ContextMenuItem, ContextMenuContext } from '@/types/contextMenu';

interface ContextMenuProps {
    items: ContextMenuItem[];
    context: ContextMenuContext;
    onClose: (reason?: OverlayDismissReason) => void;
}

export function ContextMenu({ items, context, onClose }: ContextMenuProps) {
    return (
        <div
            role="menu"
            className={cn(
                'min-w-[200px] py-1',
                'bg-white dark:bg-slate-900',
                'border border-slate-200 dark:border-slate-700',
                'rounded-lg shadow-xl',
                'animate-in fade-in zoom-in-95 duration-100',
            )}
            onContextMenu={(event) => event.preventDefault()}
        >
            {items.map((item, idx) => {
                if (item.type === 'separator') {
                    return (
                        <div
                            key={`sep-${idx}`}
                            className="h-px mx-2 my-1 bg-slate-200 dark:bg-slate-700"
                        />
                    );
                }

                if (item.type === 'action') {
                    return (
                        <button
                            key={item.id}
                            type="button"
                            role="menuitem"
                            data-overlay-actionable="true"
                            data-context-menu-action
                            className={cn(
                                'w-full px-3 py-2 text-left text-sm flex items-center gap-2',
                                'hover:bg-slate-100 dark:hover:bg-slate-800',
                                'text-slate-700 dark:text-slate-300',
                                'focus-visible:outline-none focus-visible:bg-slate-100 dark:focus-visible:bg-slate-800',
                            )}
                            onClick={async () => {
                                await item.handler(context);
                                onClose('programmatic-close');
                            }}
                        >
                            {item.icon ? <item.icon className="w-4 h-4 text-slate-400" /> : null}
                            <span className="flex-1">{item.label}</span>
                            {item.shortcut ? (
                                <span className="text-xs text-slate-400 ml-4">{item.shortcut}</span>
                            ) : null}
                        </button>
                    );
                }

                // submenu support can be added in a follow-up step
                return null;
            })}
        </div>
    );
}

export function createContextMenuOverlayContribution(input: {
    slot: 'pane-context-menu' | 'node-context-menu';
    items: ContextMenuItem[];
    context: ContextMenuContext;
    triggerElement?: HTMLElement | null;
    selectionOwnerElement?: HTMLElement | null;
    onDismiss?: (reason: OverlayDismissReason) => void;
}) {
    return createSlotContribution(input.slot, {
        anchor: {
            type: 'pointer',
            x: input.context.position.x,
            y: input.context.position.y,
        },
        focusPolicy: {
            openTarget: 'first-actionable',
            restoreTarget: 'trigger',
        },
        triggerElement: input.triggerElement ?? null,
        selectionOwnerElement: input.selectionOwnerElement ?? null,
        onDismiss: input.onDismiss,
        render: ({ close }) => (
            <ContextMenu
                items={input.items}
                context={input.context}
                onClose={close}
            />
        ),
    });
}
