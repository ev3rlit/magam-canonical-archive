import React from 'react';
import { cn } from '@/utils/cn';

type BadgeVariant = 'neutral' | 'primary' | 'success' | 'danger';

const variantClassNames: Record<BadgeVariant, string> = {
  neutral:
    'bg-muted text-foreground/78 shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.12)]',
  primary:
    'bg-primary/12 text-primary shadow-[inset_0_0_0_1px_rgb(var(--color-primary)/0.18)]',
  success:
    'bg-success/12 text-success shadow-[inset_0_0_0_1px_rgb(var(--color-success)/0.18)]',
  danger:
    'bg-danger/12 text-danger shadow-[inset_0_0_0_1px_rgb(var(--color-danger)/0.18)]',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({
  className,
  variant = 'neutral',
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-[11px] font-medium tracking-[0.02em]',
        variantClassNames[variant],
        className,
      )}
      {...props}
    />
  );
}
