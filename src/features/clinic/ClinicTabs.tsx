import { useLingui } from '@lingui/react/macro';

import { AppLink } from '@/lib/app-link.tsx';
import { cn } from '@/lib/cn.ts';

/** The Profile / Branches tabs: plain links to two routes, so Back, reload and shared links work. */
export function ClinicTabs({ current }: { current: 'profile' | 'branches' }) {
  const { t } = useLingui();
  const tabs = [
    { id: 'profile' as const, label: t`Profile`, href: '/clinic' },
    { id: 'branches' as const, label: t`Branches`, href: '/clinic/branches' },
  ];
  return (
    <nav aria-label={t`Clinic sections`} className="flex flex-wrap gap-1 border-b-2 border-divider">
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
