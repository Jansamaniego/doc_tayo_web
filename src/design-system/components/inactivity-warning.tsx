import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { AlertDialog } from 'radix-ui';
import { useRef } from 'react';

import { Button } from './button.tsx';

export interface InactivityWarningProps {
  open: boolean;
  secondsLeft: number;
  onStaySignedIn: () => void;
}

/**
 * Warns a person on a shared computer, 60 seconds before the automatic sign-out (plan.md §5.3.1).
 * One large button keeps the session; Escape does not dismiss it.
 */
export function InactivityWarning({ open, secondsLeft, onStaySignedIn }: InactivityWarningProps) {
  const { t } = useLingui();
  const stay = useRef<HTMLButtonElement>(null);
  const seconds = plural(secondsLeft, { one: '# second', other: '# seconds' });
  return (
    <AlertDialog.Root open={open}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-overlay" />
        <AlertDialog.Content
          onOpenAutoFocus={(event) => {
            // The one button is the only thing to do: it gets the focus.
            event.preventDefault();
            stay.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
          }}
          className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg bg-surface p-6 shadow-3"
        >
          <AlertDialog.Title className="text-h3 font-bold">{t`Are you still there?`}</AlertDialog.Title>
          <AlertDialog.Description className="flex flex-col gap-2 text-body-lg">
            <span>{t`For privacy, you will be signed out in ${seconds}.`}</span>
            <span className="text-body text-ink-secondary">
              {t`Anything you have not saved will be kept for you if you sign back in.`}
            </span>
          </AlertDialog.Description>
          <AlertDialog.Action asChild>
            <Button ref={stay} size="lg" onClick={onStaySignedIn}>
              {t`Stay signed in`}
            </Button>
          </AlertDialog.Action>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
