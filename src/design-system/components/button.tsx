import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, Ref } from 'react';

import { cn } from '@/lib/cn.ts';

// shadcn/ui Button, copied in and changed for this audience (plans/02-design-system.md §6):
// 48 px tall (never below the 44 px touch target), 18 px text, and NO icon-only size: a button
// always has a visible text label. Phase 2 moves the values to design tokens.
const buttonVariants = cva(
  'inline-flex min-h-12 min-w-11 items-center justify-center gap-2 rounded-lg px-5 text-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-primary hover:bg-primary-hover',
        secondary: 'border-2 border-primary bg-surface text-primary hover:bg-page',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({ className, variant, asChild = false, ref, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  return <Component ref={ref} className={cn(buttonVariants({ variant }), className)} {...props} />;
}
