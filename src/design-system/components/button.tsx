import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, MouseEvent, ReactNode, Ref } from 'react';

import { cn } from '@/lib/cn.ts';

import { Spinner } from './spinner.tsx';

// shadcn/ui Button, changed for this audience (plans/02-design-system.md §6): 48 px tall (never
// below the 44 px target), 18 px text, no icon-only size (a visible label is required), a loading
// state, and an `unavailable` state that stays focusable so its reason can be read.
const buttonVariants = cva(
  'inline-flex min-w-target items-center justify-center gap-2 rounded-md border-2 px-5 text-body font-semibold transition-colors',
  {
    variants: {
      variant: {
        primary:
          'border-transparent bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-pressed',
        secondary: 'border-primary bg-surface text-primary hover:bg-hover active:bg-selected',
        tertiary:
          'border-transparent bg-transparent text-link hover:bg-hover hover:underline active:bg-selected',
        danger:
          'border-transparent bg-danger text-on-primary hover:bg-danger-hover active:bg-danger-hover',
        'danger-secondary':
          'border-danger bg-surface text-danger hover:bg-danger-bg active:bg-danger-bg',
      },
      size: {
        md: 'min-h-control-md',
        lg: 'min-h-control-lg text-body-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

const INERT = 'cursor-not-allowed border-disabled-ink bg-disabled-bg text-disabled-ink';

export interface ButtonProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    VariantProps<typeof buttonVariants> {
  /** The visible label. Required: there are no icon-only buttons. */
  children: ReactNode;
  /** Optional icon beside the label; hidden from screen readers. */
  icon?: ReactNode;
  loading?: boolean;
  /** Text shown while loading, for example "Saving…". Defaults to the label. */
  loadingText?: string;
  /**
   * Looks disabled but stays focusable and announces `aria-disabled`, so a reason placed next to
   * it (and linked with `aria-describedby`) can be read.
   */
  unavailable?: boolean;
  asChild?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  children,
  icon,
  loading = false,
  loadingText,
  unavailable = false,
  asChild = false,
  variant,
  size,
  className,
  disabled,
  onClick,
  type = 'button',
  ref,
  ...props
}: ButtonProps) {
  const blocked = loading || unavailable;
  const greyed = disabled === true || unavailable;

  function handleClick(event: MouseEvent<HTMLButtonElement>): void {
    if (blocked) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  const classes = cn(buttonVariants({ variant, size }), greyed && INERT, className);

  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      data-variant={variant ?? 'primary'}
      disabled={disabled}
      aria-disabled={blocked || undefined}
      aria-busy={loading || undefined}
      onClick={handleClick}
      {...props}
    >
      {loading ? (
        <Spinner />
      ) : (
        icon && (
          <span aria-hidden="true" className="inline-flex">
            {icon}
          </span>
        )
      )}
      <span>{loading && loadingText ? loadingText : children}</span>
    </button>
  );
}
