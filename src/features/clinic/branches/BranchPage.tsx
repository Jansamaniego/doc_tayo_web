import { useLingui } from '@lingui/react/macro';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError, type ApiError } from '@/api/errors.ts';
import { useSession } from '@/api/session/session-store.ts';
import { Button } from '@/design-system/components/button.tsx';
import { ConfirmDialog } from '@/design-system/components/confirm-dialog.tsx';
import { ErrorState, LoadingState } from '@/design-system/components/state-views.tsx';
import { notify } from '@/design-system/components/toast.tsx';
import { DetailRow } from '@/design-system/patterns/detail-row.tsx';
import { PermissionNote } from '@/design-system/patterns/permission.tsx';
import { AppLink } from '@/lib/app-link.tsx';
import { can } from '@/lib/permissions.ts';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { useBranch, useUpdateBranch, type Branch, type BranchChanges } from '../api/branches.ts';
import { useClinicProfile } from '../api/tenant.ts';
import { BranchForm, type BranchFormValues, type BranchSubmitResult } from './BranchForm.tsx';
import { BranchStatusPill } from './BranchStatusPill.tsx';

/** Only what differs from the branch is sent; an emptied optional field is sent as `null`. */
function changesFrom(branch: Branch, values: BranchFormValues): BranchChanges {
  const clearable = (typed: string, current: string | null): string | null | undefined =>
    typed === (current ?? '') ? undefined : typed === '' ? null : typed;
  const addressLine = clearable(values.addressLine, branch.addressLine);
  const city = clearable(values.city, branch.city);
  const province = clearable(values.province, branch.province);
  const timezone = clearable(values.timezone, branch.timezone);
  return {
    ...(values.name !== branch.name && { name: values.name }),
    ...(addressLine !== undefined && { addressLine }),
    ...(city !== undefined && { city }),
    ...(province !== undefined && { province }),
    ...(timezone !== undefined && { timezone }),
  };
}

export function BranchPage({
  branchId,
  onMissing,
}: {
  branchId: string;
  /** The branch is not in this clinic (404, also for another clinic's id): back to the list. */
  onMissing: () => void;
}) {
  const { t } = useLingui();
  const session = useSession();
  const branch = useBranch(branchId);
  const update = useUpdateBranch();
  const clinicTimeZone = useClinicProfile().data?.timezone;
  const [editing, setEditing] = useState(false);
  const [askingToDeactivate, setAskingToDeactivate] = useState(false);
  const [failure, setFailure] = useState<ApiError | undefined>();
  usePageTitle(branch.data ? branch.data.name : t`Branch`);

  const missing = branch.isError && asApiError(branch.error).code === 'NOT_FOUND';
  useEffect(() => {
    if (missing) onMissing();
  }, [missing, onMissing]);

  if (branch.isPending || missing) return <LoadingState label={t`Loading this branch…`} />;
  if (branch.isError) {
    const error = asApiError(branch.error);
    return (
      <ErrorState
        message={messageForError(error)}
        requestId={error.requestId}
        onRetry={() => {
          void branch.refetch();
        }}
      />
    );
  }

  const current = branch.data;
  const mayManage = session.status === 'signed-in' && can(session.permissions, 'branches.manage');
  const notSet = t`Not set`;

  function fail(error: ApiError): void {
    if (error.code === 'NOT_FOUND') {
      onMissing();
      return;
    }
    setFailure(error);
  }

  async function saveEdit(values: BranchFormValues): Promise<BranchSubmitResult> {
    const changes = changesFrom(current, values);
    if (Object.keys(changes).length === 0) return 'nothing-to-change';
    await update.mutateAsync({ branchId, changes });
    setEditing(false);
    setFailure(undefined);
    notify.success(t`Branch details saved.`);
    return 'saved';
  }

  function setActive(isActive: boolean): void {
    setFailure(undefined);
    update.mutate(
      { branchId, changes: { isActive } },
      {
        onSuccess: () => {
          notify.success(
            isActive ? t`${current.name} is active again.` : t`${current.name} was deactivated.`,
          );
        },
        onError: (error) => {
          fail(asApiError(error));
        },
      },
    );
  }

  return (
    <div className="flex max-w-reading flex-col gap-8">
      <AppLink
        href="/clinic/branches"
        className="inline-flex min-h-target items-center gap-2 self-start"
      >
        <ArrowLeft aria-hidden="true" className="size-5" />
        {t`All branches`}
      </AppLink>
      <h1>{current.name}</h1>

      {failure && <ErrorState message={messageForError(failure)} requestId={failure.requestId} />}

      <section
        aria-labelledby="branch-details"
        className="flex flex-col gap-4 rounded-lg border border-divider bg-surface p-6 shadow-1"
      >
        <h2 id="branch-details" className="text-h3">
          {t`Details`}
        </h2>
        {editing ? (
          <BranchForm
            branch={current}
            submitLabel={t`Save`}
            savingLabel={t`Saving…`}
            onSubmit={saveEdit}
            onFailed={fail}
            onCancel={() => {
              setEditing(false);
            }}
          />
        ) : (
          <>
            <dl className="flex flex-col gap-3">
              <DetailRow label={t`Address`}>{current.addressLine ?? notSet}</DetailRow>
              <DetailRow label={t`City`}>{current.city ?? notSet}</DetailRow>
              <DetailRow label={t`Province`}>{current.province ?? notSet}</DetailRow>
              <DetailRow label={t`Time zone`}>
                {current.timezone ??
                  (clinicTimeZone ? t`Clinic's (${clinicTimeZone})` : t`Clinic's time zone`)}
              </DetailRow>
              <DetailRow label={t`Status`}>
                <BranchStatusPill isActive={current.isActive} />
              </DetailRow>
            </dl>
            {mayManage ? (
              <div className="flex flex-wrap gap-3">
                {!current.isActive && (
                  <Button
                    loading={update.isPending}
                    onClick={() => {
                      setActive(true);
                    }}
                  >
                    {t`Reactivate`}
                  </Button>
                )}
                <Button
                  variant={current.isActive ? 'primary' : 'secondary'}
                  onClick={() => {
                    setFailure(undefined);
                    setEditing(true);
                  }}
                >
                  {t`Edit`}
                </Button>
                {current.isActive && (
                  <Button
                    variant="danger-secondary"
                    loading={update.isPending}
                    onClick={() => {
                      setAskingToDeactivate(true);
                    }}
                  >
                    {t`Deactivate`}
                  </Button>
                )}
              </div>
            ) : (
              <PermissionNote>{t`Only an owner or clinic admin can change branches.`}</PermissionNote>
            )}
          </>
        )}
      </section>

      {askingToDeactivate && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setAskingToDeactivate(false);
          }}
          title={t`Deactivate ${current.name}?`}
          description={t`${current.name} will no longer be offered when staff choose a branch. Its records stay, and you can reactivate it.`}
          confirmLabel={t`Deactivate`}
          onConfirm={() => {
            setActive(false);
          }}
        />
      )}
    </div>
  );
}
