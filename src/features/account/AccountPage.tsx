import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import { usePageTitle } from '@/lib/use-page-title.ts';

import { ChangePasswordForm } from './change-password-form.tsx';

export interface AccountPageProps {
  fullName: string;
  email: string;
  clinicName: string;
  roleNames: string[];
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-6">
      <dt className="font-semibold text-ink-secondary sm:w-40 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/** The person's own details (read-only: the API has no way to edit a profile yet) and their password. */
export function AccountPage({ fullName, email, clinicName, roleNames }: AccountPageProps) {
  const { t } = useLingui();
  usePageTitle(t`My account`);
  return (
    <div className="mx-auto flex max-w-reading flex-col gap-8">
      <h1>{t`My account`}</h1>

      <section
        aria-labelledby="details-heading"
        className="flex flex-col gap-4 rounded-lg border border-divider bg-surface p-6 shadow-1"
      >
        <h2 id="details-heading" className="text-h3">
          {t`Your details`}
        </h2>
        <dl className="flex flex-col gap-3">
          <Detail label={t`Name`}>{fullName}</Detail>
          <Detail label={t`Email`}>{email}</Detail>
          <Detail label={t`Clinic`}>{clinicName}</Detail>
          <Detail label={t`Role`}>{roleNames.join(', ')}</Detail>
        </dl>
        <p className="text-ink-muted">{t`To change your name or email, ask your clinic admin.`}</p>
      </section>

      <section
        aria-labelledby="password-heading"
        className="flex flex-col gap-4 rounded-lg border border-divider bg-surface p-6 shadow-1"
      >
        <h2 id="password-heading" className="text-h3">
          {t`Change password`}
        </h2>
        <ChangePasswordForm email={email} />
      </section>
    </div>
  );
}
