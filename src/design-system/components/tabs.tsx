import { Tabs as RadixTabs } from 'radix-ui';
import type { ReactNode } from 'react';

export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

export interface TabsProps {
  /** Names the group of tabs for screen readers ("Schedule view"). */
  label: string;
  tabs: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
}

/** For sibling views of the same thing (Day / Week), never for steps. */
export function Tabs({ label, tabs, value, onValueChange }: TabsProps) {
  return (
    <RadixTabs.Root value={value} onValueChange={onValueChange} className="flex flex-col gap-4">
      <RadixTabs.List aria-label={label} className="flex flex-wrap gap-1 border-b-2 border-divider">
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.value}
            value={tab.value}
            className="-mb-0.5 min-h-target border-b-4 border-transparent px-5 font-semibold text-ink-secondary hover:bg-hover data-[state=active]:border-primary data-[state=active]:text-ink"
          >
            {tab.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {tabs.map((tab) => (
        <RadixTabs.Content key={tab.value} value={tab.value}>
          {tab.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
