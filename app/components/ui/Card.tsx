import React from 'react';
import { cn } from '@/utils/cn';

type CardVariant = 'base' | 'muted' | 'floating';

const variantClassNames: Record<CardVariant, string> = {
  base: 'bg-card shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.12)]',
  muted: 'bg-muted shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.10)]',
  floating:
    'bg-card/82 backdrop-blur-glass shadow-floating shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.12)]',
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

export function Card({
  children,
  className,
  variant = 'base',
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg text-foreground',
        variantClassNames[variant],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'font-semibold text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        'text-sm text-foreground/62',
        className,
      )}
      {...props}
    />
  );
}
