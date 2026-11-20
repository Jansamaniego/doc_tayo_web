import { useRef } from 'react';

/**
 * Radix Dialog and AlertDialog hand focus back only to their own `Trigger` part. Ours open from
 * ordinary buttons (state-controlled), so without this focus would fall to the page body when a
 * dialog closes, which strands keyboard and screen-reader users. Spread the result on `Content`.
 */
export function useReturnFocus() {
  const opener = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus(): void {
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    },
    onCloseAutoFocus(event: Event): void {
      event.preventDefault();
      opener.current?.focus();
    },
  };
}
