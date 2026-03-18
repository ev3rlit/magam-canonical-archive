import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';
import type { ContextMenuItem, ContextMenuContext } from '@/types/contextMenu';
import { useGraphStore } from '@/store/graph';

interface ContextMenuProps {
    isOpen: boolean;
    position: { x: number; y: number };
    items: ContextMenuItem[];
    context: ContextMenuContext;
    onClose: () => void;
}

export function clampContextMenuPosition(input: {
    position: { x: number; y: number };
    menuSize: { width: number; height: number };
    viewport: { width: number; height: number };
}): { x: number; y: number } {
    return {
        x: Math.min(
            Math.max(8, input.position.x),
            Math.max(8, input.viewport.width - input.menuSize.width - 8),
        ),
        y: Math.min(
            Math.max(8, input.position.y),
            Math.max(8, input.viewport.height - input.menuSize.height - 8),
        ),
    };
}

export function ContextMenu({ isOpen, position, items, context, onClose }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const anchorSnapshot = useGraphStore((store) => (
        context.anchorId ? store.entrypointRuntime.anchorsById[context.anchorId] ?? null : null
    ));
    const resolvedPosition = anchorSnapshot?.screen
        ? { x: anchorSnapshot.screen.x, y: anchorSnapshot.screen.y }
        : position;
    const [anchoredPosition, setAnchoredPosition] = useState(resolvedPosition);

    useEffect(() => {
        setAnchoredPosition(resolvedPosition);
    }, [resolvedPosition]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handlePointer = (event: Event) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handlePointer);
        document.addEventListener('touchstart', handlePointer);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handlePointer);
            document.removeEventListener('touchstart', handlePointer);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen || !menuRef.current) {
            return;
        }
        const rect = menuRef.current.getBoundingClientRect();
        const nextPosition = clampContextMenuPosition({
            position: resolvedPosition,
            menuSize: {
                width: rect.width,
                height: rect.height,
            },
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
            },
        });

        if (nextPosition.x !== anchoredPosition.x || nextPosition.y !== anchoredPosition.y) {
            setAnchoredPosition(nextPosition);
        }
    }, [anchoredPosition, isOpen, resolvedPosition]);

    useEffect(() => {
        if (!isOpen || !menuRef.current) {
            return;
        }

        const firstAction = menuRef.current.querySelector<HTMLButtonElement>('[data-context-menu-action]');
        firstAction?.focus();
    }, [isOpen, items]);

    if (!isOpen) {
        return null;
    }

    return createPortal(
        <div
            ref={menuRef}
            role="menu"
            data-context-menu-root
            className={cn(
                'fixed z-[200] min-w-[200px] py-1',
                'bg-white dark:bg-slate-900',
                'border border-slate-200 dark:border-slate-700',
                'rounded-lg shadow-xl',
                'animate-in fade-in zoom-in-95 duration-100',
            )}
            style={{ top: anchoredPosition.y, left: anchoredPosition.x }}
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
                            data-context-menu-action
                            className={cn(
                                'w-full px-3 py-2 text-left text-sm flex items-center gap-2',
                                'hover:bg-slate-100 dark:hover:bg-slate-800',
                                'text-slate-700 dark:text-slate-300',
                                'focus-visible:outline-none focus-visible:bg-slate-100 dark:focus-visible:bg-slate-800',
                            )}
                            onClick={async () => {
                                await item.handler(context);
                                onClose();
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

                return null;
            })}
        </div>,
        document.body,
    );
}
