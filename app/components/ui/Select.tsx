import React from 'react';
import { cn } from '@/utils/cn';
import { getInputClassName } from './Input';

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, invalid = false, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          getInputClassName({
            className: 'appearance-none pr-9 text-sm',
            tone: invalid ? 'invalid' : 'default',
          }),
          className,
        )}
        {...props}
      />
    );
  },
);
