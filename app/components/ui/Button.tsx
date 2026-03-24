import React from 'react';
import { cn } from '@/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'icon';

const variantClassNames: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-foreground shadow-raised hover:bg-primary/92 active:bg-primary/88',
  secondary:
    'bg-card text-foreground shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.16)] hover:bg-card/92',
  ghost:
    'bg-transparent text-foreground hover:bg-card/82 active:bg-card',
  danger:
    'bg-danger text-danger-foreground shadow-raised hover:bg-danger/92 active:bg-danger/88',
  success:
    'bg-success text-success-foreground shadow-raised hover:bg-success/92 active:bg-success/88',
};

const sizeClassNames: Record<ButtonSize, string> = {
  sm: 'min-h-8 px-3 py-1.5 text-[11px]',
  md: 'min-h-9 px-3.5 py-2 text-xs',
  icon: 'h-8 w-8 p-0',
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      size = 'md',
      type = 'button',
      variant = 'secondary',
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-pill font-medium',
          'transition-[background-color,color,box-shadow,transform] duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-55',
          variantClassNames[variant],
          sizeClassNames[size],
          className,
        )}
        {...props}
      />
    );
  },
);
