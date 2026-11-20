import { useLingui } from '@lingui/react/macro';
import { Ellipsis } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import type { ReactNode } from 'react';

import { Button } from '@/design-system/components/button.tsx';

export interface Breadcrumb {
  label: string;
  /** Leave out for the current page. */
  href?: string;
}

export interface PageHeaderProps {
  /** The one level-1 heading of the page. */
  title: string;
  /** Shown from the md breakpoint up. */
  breadcrumbs?: Breadcrumb[];
  /** One primary action per screen. */
  primaryAction?: ReactNode;
  /** Everything else goes in a labelled "More actions" menu. */
  moreActions?: { label: string; onSelect: () => void }[];
}

export function PageHeader({ title, breadcrumbs, primaryAction, moreActions }: PageHeaderProps) {
  const { t } = useLingui();
  return (
    <div className="flex flex-col gap-3">
      {breadcrumbs && (
        <nav aria-label={t`Breadcrumb`} className="hidden md:block">
          <ol className="flex flex-wrap items-center gap-2 text-small">
            {breadcrumbs.map((crumb, index) => (
              <li key={crumb.label} className="flex items-center gap-2">
                {index > 0 && <span aria-hidden="true">/</span>}
                {crumb.href ? (
                  <a href={crumb.href} className="text-link underline underline-offset-4">
                    {crumb.label}
                  </a>
                ) : (
                  <span aria-current="page" className="font-semibold">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>{title}</h1>
        <div className="flex flex-wrap items-center gap-3">
          {moreActions && moreActions.length > 0 && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="secondary" icon={<Ellipsis className="size-5" />}>
                  {t`More actions`}
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={4}
                  className="z-50 min-w-56 rounded-lg border border-divider bg-surface p-2 shadow-2"
                >
                  {moreActions.map((action) => (
                    <DropdownMenu.Item
                      key={action.label}
                      onSelect={action.onSelect}
                      className="flex min-h-target cursor-pointer items-center rounded-md px-3 data-[highlighted]:bg-selected"
                    >
                      {action.label}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
          {primaryAction}
        </div>
      </div>
    </div>
  );
}
