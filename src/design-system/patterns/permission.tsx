import { useLingui } from '@lingui/react/macro';
import { Lock } from 'lucide-react';
import { useId, type ReactNode } from 'react';

import { Button, type ButtonProps } from '@/design-system/components/button.tsx';

/** A value the person can see but not change: shown as text (a `<dl>` row), not a disabled input. */
export function ReadOnlyField({ label, value }: { label: string; value: string }) {
  const { t } = useLingui();
  return (
    <div className="flex flex-col">
      <dt className="text-small text-ink-muted">{label}</dt>
      <dd className="font-semibold">{value === '' ? t`Not set` : value}</dd>
    </div>
  );
}

/** One line saying who can change it: "Only clinic admins can change these details." */
export function PermissionNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-ink-secondary">
      <Lock aria-hidden="true" className="size-5 shrink-0" />
      {children}
    </p>
  );
}

/** What a direct URL to a page the person may not use shows: plain words and what to do. */
export function NoAccess() {
  const { t } = useLingui();
  return (
    <div className="flex flex-col gap-3">
      <h1>{t`You don't have access to this page`}</h1>
      <p className="text-body-lg">{t`Ask your clinic admin if you need it.`}</p>
    </div>
  );
}

export interface ActionWithReasonProps extends Omit<
  ButtonProps,
  'unavailable' | 'aria-describedby'
> {
  /** Why the action is unavailable right now. Shown next to it and linked to it. */
  reason?: string | undefined;
}

/** An action that is only temporarily unavailable (a rate limit, a state rule): visible, with the reason in words. */
export function ActionWithReason({ reason, children, ...button }: ActionWithReasonProps) {
  const id = useId();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        {...button}
        unavailable={reason !== undefined}
        aria-describedby={reason ? id : undefined}
      >
        {children}
      </Button>
      {reason && (
        <p id={id} className="text-ink-secondary">
          {reason}
        </p>
      )}
    </div>
  );
}
