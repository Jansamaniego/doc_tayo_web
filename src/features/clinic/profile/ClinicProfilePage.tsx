import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError, type ApiError } from '@/api/errors.ts';
import { useSession } from '@/api/session/session-store.ts';
import { Alert } from '@/design-system/components/alert.tsx';
import { Button } from '@/design-system/components/button.tsx';
import { ErrorState, LoadingState } from '@/design-system/components/state-views.tsx';
import { notify } from '@/design-system/components/toast.tsx';
import { DetailRow } from '@/design-system/patterns/detail-row.tsx';
import { PermissionNote } from '@/design-system/patterns/permission.tsx';
import { useSessionController } from '@/features/auth/session-context.tsx';
import { ClinicStatusPill } from '@/features/admin/clinics/ClinicStatusPill.tsx';
import { can } from '@/lib/permissions.ts';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { useClinicProfile } from '../api/tenant.ts';
import { ClinicTabs } from '../ClinicTabs.tsx';
import { ClinicProfileForm } from './ClinicProfileForm.tsx';

/** The clinic's own details. Everyone in the clinic reads them; owners and clinic admins change them. */
export function ClinicProfilePage() {
  const { t } = useLingui();
  usePageTitle(t`Clinic`);
  const session = useSession();
  const controller = useSessionController();
  const clinic = useClinicProfile();
  const [editing, setEditing] = useState(false);
  const [failure, setFailure] = useState<ApiError | undefined>();
  const mayChange =
    session.status === 'signed-in' && can(session.permissions, 'tenant.settings.manage');
  const notSet = t`Not set`;

  function fail(error: ApiError): void {
    setFailure(error);
    // The permission was taken away: the session is read again (globally), and the form closes
    // with the message instead of staying open for something the person may no longer do.
    if (error.code === 'FORBIDDEN') setEditing(false);
  }

  return (
    <div className="flex max-w-reading flex-col gap-6">
      <h1>{t`Clinic`}</h1>
      <ClinicTabs current="profile" />

      {clinic.isPending ? (
        <LoadingState label={t`Loading the clinic…`} />
      ) : clinic.isError ? (
        <ErrorState
          message={messageForError(asApiError(clinic.error))}
          requestId={asApiError(clinic.error).requestId}
          onRetry={() => {
            void clinic.refetch();
          }}
        />
      ) : (
        <>
          {failure &&
            (failure.code === 'FORBIDDEN' ? (
              <Alert
                variant="danger"
                onDismiss={() => {
                  setFailure(undefined);
                }}
              >
                {messageForError(failure)}
              </Alert>
            ) : (
              <ErrorState message={messageForError(failure)} requestId={failure.requestId} />
            ))}
          <section
            aria-labelledby="clinic-details"
            className="flex flex-col gap-4 rounded-lg border border-divider bg-surface p-6 shadow-1"
          >
            <h2 id="clinic-details" className="text-h3">
              {t`Details`}
            </h2>
            {editing ? (
              <ClinicProfileForm
                clinic={clinic.data}
                onSaved={(sent) => {
                  setEditing(false);
                  setFailure(undefined);
                  notify.success(t`Clinic details saved.`);
                  // The clinic switcher and the picker read the name from the session.
                  if (sent.name !== undefined) void controller.refreshPermissions();
                }}
                onFailed={fail}
                onCancel={() => {
                  setEditing(false);
                }}
              />
            ) : (
              <>
                <dl className="flex flex-col gap-3">
                  <DetailRow label={t`Clinic name`}>{clinic.data.name}</DetailRow>
                  <DetailRow label={t`Web address name`}>
                    <span className="flex flex-col">
                      <span>{clinic.data.slug}</span>
                      <span className="text-small text-ink-secondary">
                        {t`Set when the clinic was created; it cannot be changed.`}
                      </span>
                    </span>
                  </DetailRow>
                  <DetailRow label={t`Time zone`}>{clinic.data.timezone}</DetailRow>
                  <DetailRow label={t`Contact email`}>
                    {clinic.data.contactEmail ?? notSet}
                  </DetailRow>
                  <DetailRow label={t`Contact phone`}>
                    {clinic.data.contactPhone ?? notSet}
                  </DetailRow>
                  <DetailRow label={t`Status`}>
                    <ClinicStatusPill status={clinic.data.status} />
                  </DetailRow>
                </dl>
                {mayChange ? (
                  <div>
                    <Button
                      onClick={() => {
                        setFailure(undefined);
                        setEditing(true);
                      }}
                    >
                      {t`Edit details`}
                    </Button>
                  </div>
                ) : (
                  <PermissionNote>
                    {t`Only an owner or clinic admin can change the clinic's details.`}
                  </PermissionNote>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
