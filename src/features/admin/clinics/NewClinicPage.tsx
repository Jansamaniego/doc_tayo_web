import { useLingui } from '@lingui/react/macro';
import { ArrowLeft } from 'lucide-react';

import { notify } from '@/design-system/components/toast.tsx';
import { AppLink } from '@/lib/app-link.tsx';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { NewClinicForm } from './NewClinicForm.tsx';

export function NewClinicPage({ onCreated }: { onCreated: (tenantId: string) => void }) {
  const { t } = useLingui();
  usePageTitle(t`New clinic`);
  return (
    <div className="flex flex-col gap-6">
      <AppLink
        href="/admin/clinics"
        className="inline-flex min-h-target items-center gap-2 self-start"
      >
        <ArrowLeft aria-hidden="true" className="size-5" />
        {t`All clinics`}
      </AppLink>
      <h1>{t`New clinic`}</h1>
      <NewClinicForm
        onCreated={({ id, ownerEmail }) => {
          // The page cannot tell which email went out (a setup link for a new owner, a notice for an
          // existing account), so it says only that one was sent.
          notify.success(t`Clinic created. We emailed ${ownerEmail} with what to do next.`);
          onCreated(id);
        }}
      />
    </div>
  );
}
