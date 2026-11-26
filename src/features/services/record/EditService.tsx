import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError } from '@/api/errors.ts';
import { Button } from '@/design-system/components/button.tsx';
import { ErrorState, LoadingState } from '@/design-system/components/state-views.tsx';
import { notify } from '@/design-system/components/toast.tsx';
import { useOpenedClinic } from '@/lib/opened-clinic.tsx';

import { useFreshService, useUpdateService, type Service } from '../api/services.ts';
import { toChanges, toFormValues } from '../form/service-form-values.ts';
import { ServiceForm } from '../form/ServiceForm.tsx';
import { isServiceNotFound, ServiceNotFound } from './ServiceNotFound.tsx';

/**
 * The edit form of a service page. With no `version`, the last save wins, so it starts from a fresh
 * read; it then keeps that read, so a clinic switched in another tab takes nothing away.
 */
export function EditService({ serviceId, onDone }: { serviceId: string; onDone: () => void }) {
  const { t } = useLingui();
  const clinic = useOpenedClinic();
  const fresh = useFreshService(serviceId);
  const update = useUpdateService();
  const [opened, setOpened] = useState<Service | undefined>();
  const [missing, setMissing] = useState(false);
  if (opened === undefined && fresh.data && fresh.isFetchedAfterMount && !fresh.isError) {
    setOpened(fresh.data);
  }
  const cancel = (
    <Button variant="secondary" onClick={onDone}>
      {t`Cancel`}
    </Button>
  );

  if (missing) return <ServiceNotFound />;
  if (!opened) {
    if (!fresh.isError || fresh.isFetching) return <LoadingState label={t`Loading the service…`} />;
    const error = asApiError(fresh.error);
    if (isServiceNotFound(error)) return <ServiceNotFound />;
    return (
      <div className="flex max-w-reading flex-col items-start gap-4">
        <ErrorState
          message={messageForError(error)}
          requestId={error.requestId}
          onRetry={() => {
            void fresh.refetch();
          }}
        />
        {cancel}
      </div>
    );
  }

  return (
    <div className="flex max-w-reading flex-col gap-6">
      <h1>{t`Edit service`}</h1>
      <p className="text-body-lg font-semibold break-words">{opened.name}</p>
      <ServiceForm
        initial={toFormValues(opened)}
        openedIn={clinic}
        submitLabel={t`Save changes`}
        cancel={cancel}
        onSubmit={async (values) => {
          const changes = toChanges({ base: toFormValues(opened), values });
          if (Object.keys(changes).length === 0) return 'nothing-to-change';
          return update.mutateAsync({ serviceId, tenantId: clinic.tenantId, changes });
        }}
        onSaved={() => {
          notify.success(t`Changes saved.`);
          onDone();
        }}
        onMissing={() => {
          setMissing(true);
        }}
      />
    </div>
  );
}
