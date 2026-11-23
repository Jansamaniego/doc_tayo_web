import { useLingui } from '@lingui/react/macro';

import { AppLink } from '@/lib/app-link.tsx';
import { cn } from '@/lib/cn.ts';

/** The Staff / Invitations tabs: plain links to two routes, so Back, reload and shared links work. */
export function StaffTabs({ current }: { current: 'staff' | 'invitations' }) {
  const { t } = useLingui();
  const tabs = [
    { id: 'staff' as const, label: t`Staff`, href: '/staff' },
    { id: 'invitations' as const, label: t`Invitations`, href: '/staff/invitations' },
  ];
  return (
    <nav aria-label={t`Staff sections`} className="flex flex-wrap gap-1 border-b-2 border-divider">
      {tabs.map((tab) => (
        <AppLink
          key={tab.id}
          href={tab.href}
          aria-current={tab.id === current ? 'page' : undefined}
          className={cn(
            '-mb-0.5 inline-flex min-h-target items-center border-b-4 px-5 font-semibold no-underline hover:bg-hover',
            tab.id === current
              ? 'border-primary text-ink'
              : 'border-transparent text-ink-secondary',
          )}
        >
          {tab.label}
        </AppLink>
      ))}
    </nav>
  );
}
