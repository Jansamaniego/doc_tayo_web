import { useLingui } from '@lingui/react/macro';
import { ChevronDown } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';

import { Button } from '@/design-system/components/button.tsx';

import { Avatar } from './avatar.tsx';

export interface UserMenuProps {
  name: string;
  /** Leave out while there is no account page: the item is then not shown. */
  onAccount?: () => void;
  onSignOut: () => void;
  onSignOutEverywhere: () => void;
}

const ITEM =
  'flex min-h-target cursor-pointer items-center rounded-md px-3 data-[highlighted]:bg-selected';

/** The person's name (never just an avatar) opens "My account" and the two ways to sign out. */
export function UserMenu({ name, onAccount, onSignOut, onSignOutEverywhere }: UserMenuProps) {
  const { t } = useLingui();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="tertiary" icon={<Avatar name={name} />}>
          {name}
          <ChevronDown aria-hidden="true" className="size-5" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-64 rounded-lg border border-divider bg-surface p-2 shadow-2"
        >
          {onAccount && (
            <>
              <DropdownMenu.Item className={ITEM} onSelect={onAccount}>
                {t`My account`}
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-divider" />
            </>
          )}
          <DropdownMenu.Item className={ITEM} onSelect={onSignOut}>
            {t`Sign out`}
          </DropdownMenu.Item>
          <DropdownMenu.Item className={ITEM} onSelect={onSignOutEverywhere}>
            {t`Sign out on all devices`}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
