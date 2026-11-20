import type { ReactNode } from 'react';

import { cn } from '@/lib/cn.ts';

export interface PrintPageProps {
  /** Paper size per template. The real sizes and required fields wait for a clinic's doctor and accountant (plan.md Q15). */
  paper: 'a4' | 'half-letter';
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * A printable page: header, body, footer. The app chrome (AppShell) hides itself when printing.
 * Printed documents are templates and are never labelled as official receipts.
 */
export function PrintPage({ paper, header, footer, children }: PrintPageProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-6 bg-surface p-8',
        paper === 'a4' ? 'print-a4' : 'print-half-letter',
      )}
    >
      {header && <header className="border-b border-divider pb-4">{header}</header>}
      <div className="flex-1">{children}</div>
      {footer && <footer className="border-t border-divider pt-4 text-small">{footer}</footer>}
    </div>
  );
}
