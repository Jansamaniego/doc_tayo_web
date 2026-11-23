import { useLingui } from '@lingui/react/macro';
import { AlertDialog } from 'radix-ui';
import { useId, useState } from 'react';

import { Button } from './button.tsx';
import { TextField } from './text-fields.tsx';
import { useReturnFocus } from './use-return-focus.ts';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Names the thing: "Remove Dr. Santos from Sunrise Clinic?" */
  title: string;
  /** Says the consequence: "They will lose access immediately." */
  description: string;
  /** Repeats the verb: "Remove". */
  confirmLabel: string;
  /** Default "Cancel". */
  cancelLabel?: string;
  onConfirm: () => void;
  /** Adds "This cannot be undone." for irreversible actions. */
  irreversible?: boolean;
  /** Danger style by default; false for a confirmation that is not destructive. */
  destructive?: boolean;
  /** For a permanent action: the person must type this exact text before the action runs. */
  typeToConfirm?: string;
}

/** Confirmation for destructive actions. "Cancel" gets the initial focus; Escape cancels. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  irreversible = false,
  destructive = true,
  typeToConfirm,
}: ConfirmDialogProps) {
  const { t } = useLingui();
  const returnFocus = useReturnFocus();
  const [typed, setTyped] = useState('');
  const hintId = useId();
  const matches = typeToConfirm === undefined || typed.trim() === typeToConfirm;
  const close = (next: boolean): void => {
    if (!next) setTyped('');
    onOpenChange(next);
  };
  return (
    <AlertDialog.Root open={open} onOpenChange={close}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-overlay" />
        <AlertDialog.Content
          {...returnFocus}
          className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg bg-surface p-6 shadow-3"
        >
          <AlertDialog.Title className="text-h3 font-bold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-ink-secondary">
            {description}
            {irreversible && (
              <span className="mt-2 block font-semibold text-ink">{t`This cannot be undone.`}</span>
            )}
          </AlertDialog.Description>
          {typeToConfirm !== undefined && (
            <TextField
              label={t`Type ${typeToConfirm} to confirm`}
              value={typed}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(event) => {
                setTyped(event.target.value);
              }}
            />
          )}
          <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">{cancelLabel ?? t`Cancel`}</Button>
            </AlertDialog.Cancel>
            {typeToConfirm === undefined ? (
              <AlertDialog.Action asChild>
                <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm}>
                  {confirmLabel}
                </Button>
              </AlertDialog.Action>
            ) : (
              <div className="flex flex-col gap-2 md:items-end">
                <Button
                  variant={destructive ? 'danger' : 'primary'}
                  unavailable={!matches}
                  aria-describedby={matches ? undefined : hintId}
                  onClick={() => {
                    onConfirm();
                    close(false);
                  }}
                >
                  {confirmLabel}
                </Button>
                {!matches && (
                  <p id={hintId} className="text-small text-ink-secondary">
                    {t`Type ${typeToConfirm} exactly to continue.`}
                  </p>
                )}
              </div>
            )}
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
