import { useLingui } from '@lingui/react/macro';
import { Inbox, TriangleAlert } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { cn } from '@/lib/cn.ts';

import { Button } from './button.tsx';
import { Spinner } from './spinner.tsx';

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Only pass an action the person is allowed to take. */
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-control px-6 py-10 text-center">
      <Inbox aria-hidden="true" className="size-12 text-ink-muted" />
      <p className="text-h3 font-bold">{title}</p>
      {description && <p className="max-w-reading text-ink-secondary">{description}</p>}
      {action}
    </div>
  );
}

export interface LoadingStateProps {
  /** For example "Loading branches…". Always read out; shown after 1 second to avoid flicker. */
  label: string;
  variant?: 'spinner' | 'skeleton';
  rows?: number;
}

export function LoadingState({ label, variant = 'spinner', rows = 3 }: LoadingStateProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(true);
    }, 1000);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-ink-secondary">
        <Spinner />
        <span className={cn(!visible && 'sr-only')}>{label}</span>
      </div>
      {variant === 'skeleton' &&
        Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            data-testid="skeleton-row"
            aria-hidden="true"
            className="h-12 animate-pulse rounded-md bg-subtle"
          />
        ))}
    </div>
  );
}

export interface ErrorStateProps {
  message: string;
  onRetry?: (() => void) | undefined;
  /** The API's request id: lets support find the failure in the logs. */
  requestId?: string | undefined;
}

export function ErrorState({ message, onRetry, requestId }: ErrorStateProps) {
  const { t } = useLingui();
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    if (!requestId) return;
    await navigator.clipboard.writeText(requestId);
    setCopied(true);
  }

  return (
    <div
      role="alert"
      className="flex flex-col gap-4 rounded-lg border-2 border-danger-border bg-danger-bg p-5"
    >
      <p className="flex items-start gap-3 font-semibold">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-danger" />
        <span>{message}</span>
      </p>
      {requestId && (
        <details>
          <summary className="min-h-target cursor-pointer py-2 font-semibold text-link">{t`Details for support`}</summary>
          <div className="flex flex-wrap items-center gap-3 py-2">
            <p className="[overflow-wrap:anywhere]">{t`Reference: ${requestId}`}</p>
            <Button variant="secondary" onClick={() => void copy()}>
              {t`Copy`}
            </Button>
            <span aria-live="polite">{copied && t`Copied`}</span>
          </div>
        </details>
      )}
      {onRetry && (
        <div>
          <Button onClick={onRetry}>{t`Try again`}</Button>
        </div>
      )}
    </div>
  );
}
