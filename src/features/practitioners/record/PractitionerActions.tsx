import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { asApiError, type ApiError } from '@/api/errors.ts';
import { Button } from '@/design-system/components/button.tsx';
import { ConfirmDialog } from '@/design-system/components/confirm-dialog.tsx';
import { notify } from '@/design-system/components/toast.tsx';
import { useSessionController } from '@/features/auth/session-context.tsx';
import { AppButtonLink } from '@/lib/app-link.tsx';
import { SaveFailure, useOpenedClinic } from '@/lib/opened-clinic.tsx';

import { useUpdatePractitioner, type Practitioner } from '../api/practitioners.ts';

/**
 * For someone who manages practitioners: edit the profile, deactivate or reactivate it. One primary
 * action: Reactivate on an inactive practitioner, otherwise Edit profile.
 */
export function PractitionerActions({ practitioner }: { practitioner: Practitioner }) {
  const { t } = useLingui();
  const clinic = useOpenedClinic();
  const controller = useSessionController();
  const update = useUpdatePractitioner();
  const [asking, setAsking] = useState(false);
  const [failure, setFailure] = useState<ApiError | undefined>();
  const name = practitioner.displayName;
  const active = practitioner.isActive;

  function setActive(isActive: boolean): void {
    setFailure(undefined);
    update.mutate(
      { profileId: practitioner.id, tenantId: clinic.tenantId, changes: { isActive } },
      {
        onSuccess: () => {
          notify.success(isActive ? t`${name} is active again.` : t`${name} is deactivated.`);
          // This may be the person's own profile: "My schedule" follows.
          void controller.refreshPermissions();
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
        <AppButtonLink
          href={`/practitioners/${practitioner.id}/edit`}
          variant={active ? 'primary' : 'secondary'}
        >
          {t`Edit profile`}
        </AppButtonLink>
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
          description={t`${name} will no longer be offered when booking. Nothing is deleted.`}
          confirmLabel={t`Deactivate`}
          onConfirm={() => {
            setActive(false);
          }}
        />
      )}
    </div>
  );
}
