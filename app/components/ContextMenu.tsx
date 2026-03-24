import React from 'react';
import { createSlotContribution } from '@/features/overlay-host';
import type { OverlayDismissReason } from '@/features/overlay-host';
import { cn } from '@/utils/cn';
import type { ContextMenuItem, ContextMenuContext } from '@/types/contextMenu';
import { Menu, MenuItem, MenuSeparator } from './ui/Menu';

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
    <Menu
      role="menu"
      data-context-menu-root
      className={cn(
        'animate-in fade-in zoom-in-95 duration-100',
      )}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item, idx) => {
        if (item.type === 'separator') {
          return (
            <MenuSeparator key={`sep-${idx}`} className="bg-transparent" />
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
            <MenuItem
              key={item.id}
              role="menuitem"
              data-overlay-actionable={disabled ? undefined : 'true'}
              data-context-menu-action={disabled ? undefined : 'true'}
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
              {item.icon ? <item.icon className="w-4 h-4 text-foreground/40" /> : null}
              <span className="flex-1">{item.label}</span>
              {item.shortcut ? (
                <span className="ml-4 text-xs text-foreground/40">{item.shortcut}</span>
              ) : null}
            </MenuItem>
          );
        }

        return null;
      })}
    </Menu>
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
