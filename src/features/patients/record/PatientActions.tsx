import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { asApiError, type ApiError } from '@/api/errors.ts';
import { Alert } from '@/design-system/components/alert.tsx';
import { Button } from '@/design-system/components/button.tsx';
import { ConfirmDialog } from '@/design-system/components/confirm-dialog.tsx';
import { notify } from '@/design-system/components/toast.tsx';
import { AppButtonLink } from '@/lib/app-link.tsx';

import { useRestorePatient, type Patient } from '../api/patients.ts';
import { SaveFailure, useOpenedClinic } from '@/lib/opened-clinic.tsx';
import { patientFullName } from '../patient-name.ts';
import { ArchiveDialog } from './ArchiveDialog.tsx';

/**
 * Edit, and Archive or Restore, for someone who manages patients. One primary action: Restore on an
 * archived patient, otherwise Edit.
 */
export function PatientActions({ patient }: { patient: Patient }) {
  const { t } = useLingui();
  const clinic = useOpenedClinic();
  const restore = useRestorePatient();
  const [asking, setAsking] = useState<'archive' | 'restore' | undefined>();
  const [failure, setFailure] = useState<ApiError | undefined>();
  const archived = patient.archivedAt !== null;
  const name = patientFullName(patient);
  const ask = (action: 'archive' | 'restore'): void => {
    setFailure(undefined);
    setAsking(action);
  };
  const close = (): void => {
    setAsking(undefined);
  };

  function bringBack(): void {
    restore.mutate(
      { patientId: patient.id, tenantId: clinic.tenantId, version: patient.version },
      {
        onSuccess: () => {
          notify.success(t`${name} is restored.`);
        },
        onError: (error) => {
          setFailure(asApiError(error));
        },
      },
    );
  }

  /** The words for an answer that means the record changed under the person. */
  const stale =
    failure?.code === 'CONFLICT'
      ? t`This patient was already archived or restored by someone else.`
      : failure?.code === 'VERSION_CONFLICT'
        ? t`Someone else changed this patient. Check the record, then try again.`
        : undefined;

  return (
    <div className="flex flex-col gap-3">
      {failure &&
        (stale ? (
          <Alert
            variant="warning"
            onDismiss={() => {
              setFailure(undefined);
            }}
          >
            {stale}
          </Alert>
        ) : (
          <SaveFailure error={failure} openedIn={clinic} />
        ))}
      <div className="flex flex-wrap gap-3">
        {archived && (
          <Button
            loading={restore.isPending}
            loadingText={t`Restoring…`}
            onClick={() => {
              ask('restore');
            }}
          >
            {t`Restore`}
          </Button>
        )}
        <AppButtonLink
          href={`/patients/${patient.id}/edit`}
          variant={archived ? 'secondary' : 'primary'}
        >
          {t`Edit`}
        </AppButtonLink>
        {!archived && (
          <Button
            variant="danger-secondary"
            onClick={() => {
              ask('archive');
            }}
          >
            {t`Archive`}
          </Button>
        )}
      </div>

      {asking === 'archive' && (
        <ArchiveDialog
          patient={patient}
          onClose={close}
          onArchived={() => {
            close();
            notify.success(t`${name} is archived.`);
          }}
          onStale={(error) => {
            close();
            setFailure(error);
          }}
        />
      )}
      {asking === 'restore' && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) close();
          }}
          title={t`Restore ${name}?`}
          description={t`They will appear in the patient list and in search again.`}
          confirmLabel={t`Restore`}
          destructive={false}
          onConfirm={bringBack}
        />
      )}
    </div>
  );
}
