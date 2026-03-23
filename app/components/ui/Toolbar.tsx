import React from 'react';
import { cn } from '@/utils/cn';

export function Toolbar({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-pill bg-card/82 p-1.5 text-foreground',
        'backdrop-blur-glass shadow-floating shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.12)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function ToolbarDivider({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mx-1 h-4 w-px bg-foreground/10', className)}
      {...props}
    />
  );
}

export interface ToolbarButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  function ToolbarButton({ active = false, className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-md',
          'transition-[background-color,color,box-shadow,transform] duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-card',
          'disabled:pointer-events-none disabled:opacity-40',
          active
            ? 'bg-primary/12 text-primary shadow-[0_0_0_1px_rgb(var(--color-primary)/0.18)]'
            : 'text-foreground/58 hover:bg-card hover:text-foreground',
          className,
        )}
        {...props}
      />
    );
  },
);
