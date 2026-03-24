import React from 'react';
import { cn } from '@/utils/cn';

type InputTone = 'default' | 'invalid';

export function getInputClassName(input?: {
  className?: string;
  multiline?: boolean;
  tone?: InputTone;
}) {
  return cn(
    'w-full rounded-md bg-muted text-foreground placeholder:text-foreground/52',
    'shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.12)]',
    'transition-[background-color,box-shadow,color] duration-fast',
    'focus:bg-card focus:outline-none',
    'focus:shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.18),0_0_0_1px_rgb(var(--color-ring)/0.45),0_0_0_8px_rgb(var(--color-ring)/0.12)]',
    'disabled:cursor-not-allowed disabled:bg-muted/80 disabled:text-foreground/45',
    input?.multiline ? 'min-h-20 px-3 py-2.5 text-sm leading-relaxed' : 'h-10 px-3 py-2 text-sm',
    input?.tone === 'invalid'
      ? 'shadow-[inset_0_0_0_1px_rgb(var(--color-danger)/0.36)] focus:shadow-[inset_0_0_0_1px_rgb(var(--color-danger)/0.44),0_0_0_1px_rgb(var(--color-danger)/0.34),0_0_0_8px_rgb(var(--color-danger)/0.10)]'
      : undefined,
    input?.className,
  );
}

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid = false, type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={getInputClassName({
        className,
        tone: invalid ? 'invalid' : 'default',
      })}
      {...props}
    />
  );
});
