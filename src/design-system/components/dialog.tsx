import { useLingui } from '@lingui/react/macro';
import { X } from 'lucide-react';
import { Dialog as RadixDialog } from 'radix-ui';
import { useState, type ReactNode } from 'react';

import { Button } from './button.tsx';
import { useReturnFocus } from './use-return-focus.ts';
import { ConfirmDialog } from './confirm-dialog.tsx';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Buttons. Put the primary action last: it sits on the right on desktop and on top on mobile. */
  footer?: ReactNode;
  /** Unsaved changes: Escape and the Close button ask before closing, with "Stay" as the default. */
  dirty?: boolean;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  dirty = false,
}: DialogProps) {
  const { t } = useLingui();
  const returnFocus = useReturnFocus();
  const [asking, setAsking] = useState(false);

  function requestClose(): void {
    if (dirty) setAsking(true);
    else onOpenChange(false);
  }

  return (
    <>
      <RadixDialog.Root
        open={open}
        onOpenChange={(next) => {
          if (next) onOpenChange(true);
          else requestClose();
        }}
      >
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-50 bg-overlay" />
          <RadixDialog.Content
            {...returnFocus}
            className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg bg-surface p-6 shadow-3 max-md:inset-0 max-md:left-0 max-md:top-0 max-md:h-full max-md:max-h-none max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none"
          >
            <div className="flex items-start justify-between gap-3">
              <RadixDialog.Title className="text-h3 font-bold">{title}</RadixDialog.Title>
              <Button variant="tertiary" icon={<X className="size-5" />} onClick={requestClose}>
                {t`Close`}
              </Button>
            </div>
            {description ? (
              <RadixDialog.Description className="text-ink-secondary">
                {description}
              </RadixDialog.Description>
            ) : null}
            <div>{children}</div>
            {footer && (
              <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">{footer}</div>
            )}
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t`Leave without saving?`}
        description={t`Your changes will be lost.`}
        confirmLabel={t`Leave`}
        cancelLabel={t`Stay`}
        onConfirm={() => {
          setAsking(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}
