import { useLingui } from '@lingui/react/macro';

import { notify } from '@/design-system/components/toast.tsx';
import { AppButtonLink } from '@/lib/app-link.tsx';
import { useOpenedClinic } from '@/lib/opened-clinic.tsx';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { useCreateService, type Service } from '../api/services.ts';
import { EMPTY_SERVICE, toNewService } from './service-form-values.ts';
import { ServiceForm } from './ServiceForm.tsx';

export function NewServicePage({ onCreated }: { onCreated: (service: Service) => void }) {
  const { t } = useLingui();
  usePageTitle(t`Add a service`);
  const clinic = useOpenedClinic();
  const create = useCreateService();

  return (
    <div className="flex max-w-reading flex-col gap-6">
      <h1>{t`Add a service`}</h1>
      <ServiceForm
        initial={EMPTY_SERVICE}
        openedIn={clinic}
        submitLabel={t`Add service`}
        cancel={
          <AppButtonLink href="/clinic/services" variant="secondary">
            {t`Cancel`}
          </AppButtonLink>
        }
        onSubmit={(values) =>
          create.mutateAsync({ body: toNewService(values), tenantId: clinic.tenantId })
        }
        onSaved={(service) => {
          const name = service.name;
          notify.success(t`${name} added.`);
          onCreated(service);
        }}
      />
    </div>
  );
}
