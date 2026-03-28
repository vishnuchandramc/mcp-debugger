import React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <input
      className={cn(
        'bg-secondary text-foreground border border-border rounded px-2.5 py-1.5 text-[13px] font-mono outline-none focus:border-primary',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

Input.displayName = 'Input';

export { Input };
