import { useLingui } from '@lingui/react/macro';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

import { cn } from '@/lib/cn.ts';

import { Button } from './button.tsx';

export type AlertVariant = 'success' | 'info' | 'warning' | 'danger';

const STYLES: Record<
  AlertVariant,
  { box: string; head: string; Icon: ComponentType<{ 'aria-hidden': 'true'; className?: string }> }
> = {
  success: { box: 'border-success-border bg-success-bg', head: 'text-success', Icon: CircleCheck },
  info: { box: 'border-info-border bg-info-bg', head: 'text-info', Icon: Info },
  warning: {
    box: 'border-warning-border bg-warning-bg',
    head: 'text-warning',
    Icon: TriangleAlert,
  },
  danger: { box: 'border-danger-border bg-danger-bg', head: 'text-danger', Icon: CircleAlert },
};

export interface AlertProps {
  variant: AlertVariant;
  title?: string;
  children: ReactNode;
  /** Shows a labelled Close button. An error never dismisses itself: only the person (or a fix) does. */
  onDismiss?: () => void;
  /** For example a "Try again" button. */
  action?: ReactNode;
  className?: string;
}

/**
 * In-page message for page-level states and every error that is not tied to one field.
 * Never colour alone: each variant has an icon AND a word.
 */
export function Alert({ variant, title, children, onDismiss, action, className }: AlertProps) {
  const { t } = useLingui();
  const { box, head, Icon } = STYLES[variant];
  const word = { success: t`Success`, info: t`Information`, warning: t`Warning`, danger: t`Error` }[
    variant
  ];
  return (
    <div
      role={variant === 'danger' ? 'alert' : 'status'}
      className={cn('flex flex-col gap-3 rounded-lg border-2 p-4', box, className)}
    >
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className={cn('mt-0.5 size-6 shrink-0', head)} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="flex flex-wrap gap-x-2 font-bold">
            <span className={head}>{word}</span>
            {title && <span className="text-ink">{title}</span>}
          </p>
          <div className="text-ink">{children}</div>
        </div>
      </div>
      {(action ?? onDismiss) && (
        <div className="flex flex-wrap gap-3">
          {action}
          {onDismiss && (
            <Button variant="tertiary" icon={<X className="size-5" />} onClick={onDismiss}>
              {t`Close`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
