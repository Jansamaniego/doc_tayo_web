import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { asApiError, type ApiError } from '@/api/errors.ts';
import { Button } from '@/design-system/components/button.tsx';
import { ConfirmDialog } from '@/design-system/components/confirm-dialog.tsx';
import { notify } from '@/design-system/components/toast.tsx';
import { SaveFailure, useOpenedClinic } from '@/lib/opened-clinic.tsx';

import { useUpdateService, type Service } from '../api/services.ts';

/**
 * For someone who manages services: edit, deactivate or reactivate. One primary action: Reactivate on
 * an inactive service, otherwise Edit. Services are never deleted.
 */
export function ServiceActions({ service, onEdit }: { service: Service; onEdit: () => void }) {
  const { t } = useLingui();
  const clinic = useOpenedClinic();
  const update = useUpdateService();
  const [asking, setAsking] = useState(false);
  const [failure, setFailure] = useState<ApiError | undefined>();
  const name = service.name;
  const active = service.isActive;

  function setActive(isActive: boolean): void {
    setFailure(undefined);
    update.mutate(
      { serviceId: service.id, tenantId: clinic.tenantId, changes: { isActive } },
      {
        onSuccess: () => {
          notify.success(isActive ? t`${name} is active again.` : t`${name} is deactivated.`);
        },
        onError: (error) => {
          setFailure(asApiError(error));
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {failure && <SaveFailure error={failure} openedIn={clinic} />}
      <div className="flex flex-wrap gap-3">
        {!active && (
          <Button
            loading={update.isPending}
            onClick={() => {
              setActive(true);
            }}
          >
            {t`Reactivate`}
          </Button>
        )}
        <Button variant={active ? 'primary' : 'secondary'} onClick={onEdit}>
          {t`Edit`}
        </Button>
        {active && (
          <Button
            variant="danger-secondary"
            loading={update.isPending}
            onClick={() => {
              setAsking(true);
            }}
          >
            {t`Deactivate`}
          </Button>
        )}
      </div>
      {asking && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setAsking(false);
          }}
          title={t`Deactivate ${name}?`}
          description={t`${name} will no longer be offered when booking. Nothing is deleted, and past records keep its name.`}
          confirmLabel={t`Deactivate`}
          onConfirm={() => {
            setActive(false);
          }}
        />
      )}
    </div>
  );
}
