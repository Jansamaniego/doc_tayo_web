import { useLingui } from '@lingui/react/macro';
import { ArrowLeft } from 'lucide-react';

import type { ApiError } from '@/api/errors.ts';
import { AppLink } from '@/lib/app-link.tsx';

export function BackToAppointments({ href = '/appointments' }: { href?: string }) {
  const { t } = useLingui();
  return (
    <AppLink href={href} className="inline-flex min-h-target items-center gap-2 self-start">
      <ArrowLeft aria-hidden="true" className="size-5" />
      {t`All appointments`}
    </AppLink>
  );
}

/** An unknown id, another clinic's appointment (the API never says which) or a broken link. */
export function isAppointmentNotFound(error: ApiError): boolean {
  return error.code === 'NOT_FOUND' || error.code === 'VALIDATION_FAILED';
}

export function AppointmentNotFound() {
  const { t } = useLingui();
  return (
    <div className="flex flex-col gap-4">
      <h1>{t`We could not find this appointment`}</h1>
      <BackToAppointments />
    </div>
  );
}
