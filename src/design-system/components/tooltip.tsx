import { Tooltip as RadixTooltip } from 'radix-ui';
import type { ReactElement } from 'react';

export interface TooltipProps {
  /** Extra information only. Never the only place essential information lives; never on a disabled element. */
  content: string;
  children: ReactElement;
  delayDuration?: number;
}

export function Tooltip({ content, children, delayDuration = 300 }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            sideOffset={6}
            className="z-50 max-w-xs rounded-md bg-ink px-3 py-2 text-small text-surface shadow-2"
          >
            {content}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
