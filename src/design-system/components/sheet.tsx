import { useLingui } from '@lingui/react/macro';
import { X } from 'lucide-react';
import { Dialog as RadixDialog } from 'radix-ui';
import type { ReactNode } from 'react';

import { Button } from './button.tsx';
import { useReturnFocus } from './use-return-focus.ts';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}

/** A side panel on desktop and a bottom sheet on mobile, for quick edits. */
export function Sheet({ open, onOpenChange, title, description, children }: SheetProps) {
  const { t } = useLingui();
  const returnFocus = useReturnFocus();
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-overlay" />
        <RadixDialog.Content
          {...returnFocus}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col gap-4 overflow-y-auto rounded-t-lg bg-surface p-6 shadow-3 md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[28rem] md:rounded-l-lg md:rounded-tr-none"
        >
          <div className="flex items-start justify-between gap-3">
            <RadixDialog.Title className="text-h3 font-bold">{title}</RadixDialog.Title>
            <RadixDialog.Close asChild>
              <Button variant="tertiary" icon={<X className="size-5" />}>
                {t`Close`}
              </Button>
            </RadixDialog.Close>
          </div>
          {description ? (
            <RadixDialog.Description className="text-ink-secondary">
              {description}
            </RadixDialog.Description>
          ) : null}
          <div>{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
