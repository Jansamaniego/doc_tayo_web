import { Circle, CircleAlert, CircleCheck, Clock, Info } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

import { cn } from '@/lib/cn.ts';

export type Status = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const STYLES: Record<
  Status,
  { box: string; Icon: ComponentType<{ 'aria-hidden': 'true'; className?: string }> }
> = {
  success: { box: 'border-success-border bg-success-bg text-success', Icon: CircleCheck },
  warning: { box: 'border-warning-border bg-warning-bg text-warning', Icon: Clock },
  danger: { box: 'border-danger-border bg-danger-bg text-danger', Icon: CircleAlert },
  info: { box: 'border-info-border bg-info-bg text-info', Icon: Info },
  neutral: { box: 'border-control bg-subtle text-ink-secondary', Icon: Circle },
};

/** A status as an icon AND a word ("Checked in", "Cancelled"): never colour alone. */
export function StatusPill({ status, children }: { status: Status; children: ReactNode }) {
  const { box, Icon } = STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-small font-semibold',
        box,
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {children}
    </span>
  );
}
