import { useLingui } from '@lingui/react/macro';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError, type ApiError } from '@/api/errors.ts';
import { useSession } from '@/api/session/session-store.ts';
import { Alert } from '@/design-system/components/alert.tsx';
import { Button } from '@/design-system/components/button.tsx';
import { ConfirmDialog } from '@/design-system/components/confirm-dialog.tsx';
import { ErrorState, LoadingState } from '@/design-system/components/state-views.tsx';
import { notify } from '@/design-system/components/toast.tsx';
import { DetailRow } from '@/design-system/patterns/detail-row.tsx';
import { AppLink } from '@/lib/app-link.tsx';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { useAdminUser, useSetUserStatus } from '../api/admin-users.ts';
import { userAction, type UserAction } from './user-status.ts';
import { UserStatusPill } from './UserStatusPill.tsx';

export function UserDetailPage({
  userId,
  onMissing,
}: {
  userId: string;
  /** The account does not exist (404): the page goes back to the list. */
  onMissing: () => void;
}) {
  const { t } = useLingui();
  const session = useSession();
  const account = useAdminUser(userId);
  const setStatus = useSetUserStatus();
  const [asking, setAsking] = useState<UserAction | undefined>();
  const [failure, setFailure] = useState<ApiError | undefined>();
  usePageTitle(account.data ? account.data.fullName : t`User`);

  const missing = account.isError && asApiError(account.error).code === 'NOT_FOUND';
  useEffect(() => {
    if (missing) onMissing();
  }, [missing, onMissing]);

  if (account.isPending || missing) return <LoadingState label={t`Loading the account…`} />;
  if (account.isError) {
    const error = asApiError(account.error);
    return (
      <ErrorState
        message={messageForError(error)}
        requestId={error.requestId}
        onRetry={() => {
          void account.refetch();
        }}
      />
    );
  }

  const { fullName, email, status, platformRole, membershipCount } = account.data;
  const isSelf = session.status === 'signed-in' && session.user.id === account.data.id;
  const action = userAction({ status, isSelf });
  const selfMessage = t`You cannot change the status of your own account.`;

  const wording = {
    deactivate: {
      title: t`Deactivate ${fullName}?`,
      description: t`${fullName} is signed out on every device and cannot sign in until you reactivate the account.`,
      confirm: t`Deactivate`,
      done: t`${fullName} is deactivated.`,
    },
    reactivate: {
      title: t`Reactivate ${fullName}?`,
      description: t`${fullName} can sign in again.`,
      confirm: t`Reactivate`,
      done: t`${fullName} is active again.`,
    },
  };

  function apply(chosen: UserAction): void {
    setFailure(undefined);
    setStatus.mutate(
      { userId, status: chosen.target },
      {
        onSuccess: () => {
          notify.success(wording[chosen.id].done);
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
        href="/admin/users"
        className="inline-flex min-h-target items-center gap-2 self-start"
      >
        <ArrowLeft aria-hidden="true" className="size-5" />
        {t`All users`}
      </AppLink>
      <h1>{fullName}</h1>

      {failure &&
        (failure.code === 'CONFLICT' ? (
          <Alert variant="warning">
            {t`This account was changed by someone else. Check its status and try again.`}
          </Alert>
        ) : failure.code === 'SELF_ACTION_FORBIDDEN' ? (
          <Alert variant="warning">{selfMessage}</Alert>
        ) : (
          <ErrorState message={messageForError(failure)} requestId={failure.requestId} />
        ))}

      <section
        aria-labelledby="user-details"
        className="flex flex-col gap-4 rounded-lg border border-divider bg-surface p-6 shadow-1"
      >
        <h2 id="user-details" className="text-h3">
          {t`Details`}
        </h2>
        <dl className="flex flex-col gap-3">
          <DetailRow label={t`Email`}>{email}</DetailRow>
          <DetailRow label={t`Status`}>
            <UserStatusPill status={status} />
          </DetailRow>
          <DetailRow label={t`Platform role`}>
            {platformRole === 'platform_admin' ? t`Platform admin` : t`None`}
          </DetailRow>
          <DetailRow label={t`Clinics`}>{membershipCount}</DetailRow>
        </dl>
      </section>

      <section
        aria-labelledby="user-access"
        className="flex flex-col gap-4 rounded-lg border border-divider bg-surface p-6 shadow-1"
      >
        <h2 id="user-access" className="text-h3">
          {t`Access`}
        </h2>
        {action ? (
          <div>
            <Button
              variant={action.id === 'reactivate' ? 'primary' : 'danger-secondary'}
              loading={setStatus.isPending}
              onClick={() => {
                setAsking(action);
              }}
            >
              {wording[action.id].confirm}
            </Button>
          </div>
        ) : isSelf ? (
          <p>{selfMessage}</p>
        ) : (
          <p>
            {t`This person has not set a password yet. They activate their account from the link we emailed them.`}
          </p>
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
          destructive={asking.id === 'deactivate'}
          onConfirm={() => {
            apply(asking);
          }}
        />
      )}
    </div>
  );
}
