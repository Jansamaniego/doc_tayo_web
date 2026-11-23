import { useLingui } from '@lingui/react/macro';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError, type ApiError } from '@/api/errors.ts';
import { Alert } from '@/design-system/components/alert.tsx';
import { Button } from '@/design-system/components/button.tsx';
import { ConfirmDialog } from '@/design-system/components/confirm-dialog.tsx';
import { ErrorState, LoadingState } from '@/design-system/components/state-views.tsx';
import { notify } from '@/design-system/components/toast.tsx';
import { DetailRow } from '@/design-system/patterns/detail-row.tsx';
import { AppLink } from '@/lib/app-link.tsx';
import { formatDate } from '@/lib/datetime/index.ts';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { useAdminTenant, useSetTenantStatus } from '../api/admin-tenants.ts';
import { clinicActions, type ClinicAction, type ClinicActionId } from './clinic-status.ts';
import { ClinicStatusPill } from './ClinicStatusPill.tsx';

export function ClinicDetailPage({
  tenantId,
  onMissing,
}: {
  tenantId: string;
  /** The clinic does not exist (404): the page goes back to the list. */
  onMissing: () => void;
}) {
  const { t } = useLingui();
  const clinic = useAdminTenant(tenantId);
  const setStatus = useSetTenantStatus();
  const [asking, setAsking] = useState<ClinicAction | undefined>();
  const [failure, setFailure] = useState<ApiError | undefined>();
  usePageTitle(clinic.data ? clinic.data.name : t`Clinic`);

  const missing = clinic.isError && asApiError(clinic.error).code === 'NOT_FOUND';
  useEffect(() => {
    if (missing) onMissing();
  }, [missing, onMissing]);

  if (clinic.isPending || missing) return <LoadingState label={t`Loading the clinic…`} />;
  if (clinic.isError) {
    const error = asApiError(clinic.error);
    return (
      <ErrorState
        message={messageForError(error)}
        requestId={error.requestId}
        onRetry={() => {
          void clinic.refetch();
        }}
      />
    );
  }

  const { name, slug, status, timezone, createdAt, memberCount, owners } = clinic.data;
  const actions = clinicActions(status);

  const wording: Record<
    ClinicActionId,
    { title: string; description: string; confirm: string; done: string }
  > = {
    suspend: {
      title: t`Suspend ${name}?`,
      description: t`Everyone at ${name} loses access until you reactivate it.`,
      confirm: t`Suspend`,
      done: t`${name} is suspended.`,
    },
    reactivate: {
      title: t`Reactivate ${name}?`,
      description: t`Everyone at ${name} can use DocTayo again.`,
      confirm: t`Reactivate`,
      done: t`${name} is active again.`,
    },
    deactivate: {
      title: t`Deactivate ${name}?`,
      description: t`Everyone at ${name} loses access permanently.`,
      confirm: t`Deactivate`,
      done: t`${name} is deactivated.`,
    },
  };

  function apply(action: ClinicAction): void {
    setFailure(undefined);
    setStatus.mutate(
      { tenantId, status: action.target },
      {
        onSuccess: () => {
          notify.success(wording[action.id].done);
        },
        onError: (error) => {
          setFailure(asApiError(error));
        },
      },
    );
  }

  return (
    <div className="flex max-w-reading flex-col gap-8">
      <AppLink
        href="/admin/clinics"
        className="inline-flex min-h-target items-center gap-2 self-start"
      >
        <ArrowLeft aria-hidden="true" className="size-5" />
        {t`All clinics`}
      </AppLink>
      <h1>{name}</h1>

      {failure &&
        (failure.code === 'CONFLICT' ? (
          <Alert variant="warning">
            {t`This clinic was changed by someone else. Check its status and try again.`}
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
        <dl className="flex flex-col gap-3">
          <DetailRow label={t`Status`}>
            <ClinicStatusPill status={status} />
          </DetailRow>
          <DetailRow label={t`Web address name`}>{slug}</DetailRow>
          <DetailRow label={t`Time zone`}>{timezone}</DetailRow>
          <DetailRow label={t`Created`}>
            {formatDate({ iso: createdAt, timeZone: timezone, style: 'medium' })}
          </DetailRow>
          <DetailRow label={t`Active members`}>{memberCount}</DetailRow>
          <DetailRow label={t`Owners`}>
            <ul className="flex flex-col gap-1">
              {owners.map((owner) => (
                <li key={owner.userId}>
                  {owner.fullName} <span className="text-ink-secondary">({owner.email})</span>
                </li>
              ))}
            </ul>
          </DetailRow>
        </dl>
        <p className="text-ink-muted">
          {t`To change these details, the clinic's owner signs in and edits them.`}
        </p>
      </section>

      <section
        aria-labelledby="clinic-status"
        className="flex flex-col gap-4 rounded-lg border border-divider bg-surface p-6 shadow-1"
      >
        <h2 id="clinic-status" className="text-h3">
          {t`Access`}
        </h2>
        {actions.length === 0 ? (
          <p>{t`This clinic is deactivated. Deactivation is permanent, so there is nothing more to do here.`}</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {actions.map((action) => (
              <Button
                key={action.id}
                variant={
                  action.id === 'reactivate'
                    ? 'primary'
                    : action.id === 'deactivate'
                      ? 'danger-secondary'
                      : 'secondary'
                }
                loading={setStatus.isPending && setStatus.variables.status === action.target}
                onClick={() => {
                  setAsking(action);
                }}
              >
                {wording[action.id].confirm}
              </Button>
            ))}
          </div>
        )}
      </section>

      {asking && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setAsking(undefined);
          }}
          title={wording[asking.id].title}
          description={wording[asking.id].description}
          confirmLabel={wording[asking.id].confirm}
          destructive={asking.id !== 'reactivate'}
          irreversible={asking.permanent}
          {...(asking.permanent && { typeToConfirm: slug })}
          onConfirm={() => {
            apply(asking);
          }}
        />
      )}
    </div>
  );
}
