import React from 'react';
import { cn } from '@/lib/utils';

const Select = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <select
      className={cn(
        'bg-secondary text-muted-foreground border border-border rounded px-2 py-1.5 text-xs font-bold font-mono cursor-pointer outline-none shrink-0',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

Select.displayName = 'Select';

export { Select };
