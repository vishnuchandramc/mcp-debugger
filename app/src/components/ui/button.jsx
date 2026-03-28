import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded font-mono cursor-pointer shrink-0 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground border-none hover:brightness-110',
        destructive: 'bg-destructive text-destructive-foreground border-none hover:brightness-110',
        outline: 'bg-transparent text-muted-foreground border border-border hover:text-foreground',
        ghost: 'bg-transparent border-none text-muted-foreground hover:text-foreground',
      },
      size: {
        default: 'px-5 py-1.5 text-[13px]',
        sm: 'px-2.5 py-0.5 text-[11px]',
        icon: 'p-0.5 text-lg leading-none',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const Button = React.forwardRef(({ className, variant, size, ...props }, ref) => {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
});

Button.displayName = 'Button';

export { Button, buttonVariants };
