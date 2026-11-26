import { useLingui } from '@lingui/react/macro';
import { ArrowLeft } from 'lucide-react';

import type { ApiError } from '@/api/errors.ts';
import { AppLink } from '@/lib/app-link.tsx';

export function BackToServices() {
  const { t } = useLingui();
  return (
    <AppLink
      href="/clinic/services"
      className="inline-flex min-h-target items-center gap-2 self-start"
    >
      <ArrowLeft aria-hidden="true" className="size-5" />
      {t`All services`}
    </AppLink>
  );
}

/** An unknown id, another clinic's service (the API never says which) or a broken link. */
export function isServiceNotFound(error: ApiError): boolean {
  return error.code === 'NOT_FOUND' || error.code === 'VALIDATION_FAILED';
}

export function ServiceNotFound() {
  const { t } = useLingui();
  return (
    <div className="flex flex-col gap-4">
      <h1>{t`We could not find this service`}</h1>
      <BackToServices />
    </div>
  );
}
