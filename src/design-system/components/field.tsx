import { useLingui } from '@lingui/react/macro';
import { CircleAlert } from 'lucide-react';
import { useId, type ReactNode } from 'react';

import { cn } from '@/lib/cn.ts';

/** What a control must receive to be linked to its label, hint and error. */
export interface ControlProps {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
}

export interface FieldProps {
  /** Always visible, above the control. Never use a placeholder as a label. */
  label: string;
  /** Examples and rules go here ("For example: 0917 123 4567"), not in a placeholder. */
  hint?: string | undefined;
  /** Plain-language message shown under the control with an icon. */
  error?: string | undefined;
  /** We mark optional fields, not required ones. */
  optional?: boolean | undefined;
  className?: string;
  children: (control: ControlProps) => ReactNode;
}

export function Field({ label, hint, error, optional = false, className, children }: FieldProps) {
  const { t } = useLingui();
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : undefined, error ? errorId : undefined]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-label font-semibold">
        {label}
        {optional && <span className="ml-2 font-normal text-ink-muted">{t`Optional`}</span>}
      </label>
      {hint && (
        <p id={hintId} className="text-small text-ink-muted">
          {hint}
        </p>
      )}
      {children({
        id,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': error ? true : undefined,
      })}
      {error && (
        <p id={errorId} className="flex items-start gap-2 text-small font-semibold text-danger">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/** Shared look of text-like controls: 48 px high, a 3:1 border, a red border plus message when invalid. */
export function controlClass({
  invalid = false,
  readOnly = false,
}: { invalid?: boolean | undefined; readOnly?: boolean | undefined } = {}): string {
  if (readOnly)
    return 'min-h-control-md w-full rounded-md border-2 border-transparent bg-transparent px-0 text-body';
  return cn(
    'min-h-control-md w-full rounded-md border-2 bg-surface px-4 text-body',
    invalid ? 'border-danger-border' : 'border-control',
    'disabled:cursor-not-allowed disabled:border-disabled-ink disabled:bg-disabled-bg disabled:text-disabled-ink',
  );
}
