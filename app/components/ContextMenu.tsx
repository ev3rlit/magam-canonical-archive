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

export function ContextMenu({ items, context, onClose }: ContextMenuProps) {
  return (
    <div
      role="menu"
      data-context-menu-root
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
          const disabled = typeof item.disabled === 'function'
            ? item.disabled(context)
            : Boolean(item.disabled);
          const disabledReason = typeof item.disabledReason === 'function'
            ? item.disabledReason(context)
            : item.disabledReason;

          return (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              data-overlay-actionable={disabled ? undefined : 'true'}
              data-context-menu-action={disabled ? undefined : 'true'}
              className={cn(
                'w-full px-3 py-2 text-left text-sm flex items-center gap-2',
                'text-slate-700 dark:text-slate-300',
                disabled
                  ? 'cursor-not-allowed opacity-50'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800',
                disabled
                  ? ''
                  : 'focus-visible:outline-none focus-visible:bg-slate-100 dark:focus-visible:bg-slate-800',
              )}
              disabled={disabled}
              aria-disabled={disabled}
              title={disabled ? disabledReason ?? item.label : undefined}
              onClick={async () => {
                if (disabled) {
                  return;
                }
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
