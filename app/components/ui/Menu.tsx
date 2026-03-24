import React from 'react';
import { cn } from '@/utils/cn';

export interface MenuProps extends React.HTMLAttributes<HTMLDivElement> {
  floating?: boolean;
}

export const Menu = React.forwardRef<HTMLDivElement, MenuProps>(function Menu(
  {
    children,
    className,
    floating = true,
    ...props
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'min-w-[200px] rounded-lg p-1 text-foreground',
        floating
          ? 'bg-card/92 backdrop-blur-glass shadow-floating shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.12)]'
          : 'bg-card shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.12)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});

export function MenuLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-foreground/54',
        className,
      )}
      {...props}
    />
  );
}

export function MenuSeparator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'my-1.5 h-px bg-foreground/6',
        className,
      )}
      {...props}
    />
  );
}

export interface MenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  dangerous?: boolean;
}

export const MenuItem = React.forwardRef<HTMLButtonElement, MenuItemProps>(
  function MenuItem(
    { active = false, children, className, dangerous = false, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm',
          'transition-[background-color,color,box-shadow] duration-fast',
          'focus-visible:outline-none focus-visible:bg-card',
          'disabled:cursor-not-allowed disabled:opacity-45',
          active
            ? 'bg-primary/12 text-primary'
            : dangerous
              ? 'text-danger hover:bg-danger/10'
              : 'text-foreground/86 hover:bg-card',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
