import { useLingui } from '@lingui/react/macro';
import { CircleCheck, Info, X } from 'lucide-react';
import { Toast as RadixToast } from 'radix-ui';
import { useSyncExternalStore } from 'react';

import { Button } from './button.tsx';

// Toasts are for CONFIRMATIONS only ("Branch saved"). There is no error kind and no action: an error,
// or anything the person must read or act on (even "Undo"), lives on the page until dismissed
// (plans/02-design-system.md §6, §7.2). Built on Radix Toast, not Sonner: Sonner injects an inline
// <style> element, which the Content-Security-Policy must not allow.
type Kind = 'success' | 'info';
interface Item {
  id: number;
  kind: Kind;
  message: string;
}

let items: Item[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function publish(next: Item[]): void {
  items = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const notify = {
  success(message: string): void {
    publish([...items, { id: nextId++, kind: 'success', message }]);
  },
  info(message: string): void {
    publish([...items, { id: nextId++, kind: 'info', message }]);
  },
  /** Removes every toast (used when signing out, and by tests). */
  clear(): void {
    publish([]);
  },
};

const DURATION_MS = 10_000; // at least 8 s; pauses on hover and on keyboard focus

/** Mount once, near the root of the app. */
export function ToastRegion() {
  const { t } = useLingui();
  const toasts = useSyncExternalStore(subscribe, () => items);
  return (
    <RadixToast.Provider duration={DURATION_MS} label={t`Notifications`} swipeDirection="right">
      {toasts.map((toast) => {
        const Icon = toast.kind === 'success' ? CircleCheck : Info;
        return (
          <RadixToast.Root
            key={toast.id}
            type="background"
            onOpenChange={(open) => {
              if (!open) publish(items.filter((item) => item.id !== toast.id));
            }}
            className="flex flex-col gap-2 rounded-lg border-2 border-divider bg-surface p-4 shadow-2"
          >
            <RadixToast.Title className="flex items-center gap-2 font-bold">
              <Icon
                aria-hidden="true"
                className={toast.kind === 'success' ? 'size-6 text-success' : 'size-6 text-info'}
              />
              {toast.kind === 'success' ? t`Success` : t`Information`}
            </RadixToast.Title>
            <RadixToast.Description>{toast.message}</RadixToast.Description>
            <RadixToast.Close asChild>
              <Button variant="tertiary" icon={<X className="size-5" />} className="self-start">
                {t`Close`}
              </Button>
            </RadixToast.Close>
          </RadixToast.Root>
        );
      })}
      <RadixToast.Viewport className="fixed bottom-4 right-4 z-[100] flex w-96 max-w-[calc(100vw-2rem)] list-none flex-col gap-3 outline-none" />
    </RadixToast.Provider>
  );
}
