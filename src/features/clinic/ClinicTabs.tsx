import { useLingui } from '@lingui/react/macro';

import { useSession } from '@/api/session/session-store.ts';
import { AppLink } from '@/lib/app-link.tsx';
import { cn } from '@/lib/cn.ts';
import { can } from '@/lib/permissions.ts';

/**
 * The Profile / Branches / Services tabs: plain links to routes, so Back, reload and shared links
 * work. Services needs `services.read`.
 */
export function ClinicTabs({ current }: { current: 'profile' | 'branches' | 'services' }) {
  const { t } = useLingui();
  const session = useSession();
  const maySeeServices =
    session.status === 'signed-in' && can(session.permissions, 'services.read');
  const tabs = [
    { id: 'profile' as const, label: t`Profile`, href: '/clinic' },
    { id: 'branches' as const, label: t`Branches`, href: '/clinic/branches' },
    ...(maySeeServices
      ? [{ id: 'services' as const, label: t`Services`, href: '/clinic/services' }]
      : []),
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
