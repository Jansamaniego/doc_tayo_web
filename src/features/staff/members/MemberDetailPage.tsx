import { useLingui } from '@lingui/react/macro';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError, type ApiError } from '@/api/errors.ts';
import { activeMembership, useSession } from '@/api/session/session-store.ts';
import { Alert } from '@/design-system/components/alert.tsx';
import { Button } from '@/design-system/components/button.tsx';
import { ConfirmDialog } from '@/design-system/components/confirm-dialog.tsx';
import { ErrorState, LoadingState } from '@/design-system/components/state-views.tsx';
import { notify } from '@/design-system/components/toast.tsx';
import { DetailRow } from '@/design-system/patterns/detail-row.tsx';
import { PermissionNote } from '@/design-system/patterns/permission.tsx';
import { AppLink } from '@/lib/app-link.tsx';
import { formatDate } from '@/lib/datetime/index.ts';
import { can } from '@/lib/permissions.ts';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { useClinicTimeZone } from '../api/clinic-time-zone.ts';
import { useMember, useSetMemberStatus, type MemberStatusAction } from '../api/members.ts';
import { useRoles } from '../api/roles.ts';
import { EditMemberForm } from './EditMemberForm.tsx';
import { memberActions } from './member-actions.ts';
import { isMemberRuleError, memberErrorMessage } from './member-errors.ts';
import { MemberStatusPill } from './MemberStatusPill.tsx';

export function MemberDetailPage({
  membershipId,
  onMissing,
}: {
  membershipId: string;
  /** The person is not on this clinic's staff (404, also for another clinic's id): back to the list. */
  onMissing: () => void;
}) {
  const { t } = useLingui();
  const session = useSession();
  const member = useMember(membershipId);
  const roles = useRoles();
  const timeZone = useClinicTimeZone();
  const setStatus = useSetMemberStatus();
  const [editing, setEditing] = useState(false);
  const [asking, setAsking] = useState<MemberStatusAction | undefined>();
  const [failure, setFailure] = useState<ApiError | undefined>();
  usePageTitle(member.data ? member.data.fullName : t`Staff member`);

  const missing = member.isError && asApiError(member.error).code === 'NOT_FOUND';
  useEffect(() => {
    if (missing) onMissing();
  }, [missing, onMissing]);

  if (member.isPending || roles.isPending || missing) {
    return <LoadingState label={t`Loading this person…`} />;
  }
  const loadFailure = member.isError ? member.error : roles.isError ? roles.error : undefined;
  if (member.isError || roles.isError) {
    const error = asApiError(loadFailure);
    return (
      <ErrorState
        message={messageForError(error)}
        requestId={error.requestId}
        onRetry={() => {
          void member.refetch();
          void roles.refetch();
        }}
      />
    );
  }

  const { fullName, email, status, jobTitle, joinedAt } = member.data;
  const clinicName = activeMembership(session)?.tenantName ?? '';
  const isSelf = session.status === 'signed-in' && session.user.id === member.data.userId;
  const viewerIsOwner = roles.data.some((role) => role.key === 'owner' && role.assignable);
  const mayManage = session.status === 'signed-in' && can(session.permissions, 'members.manage');
  const actions = memberActions({ member: member.data, isSelf, viewerIsOwner });
  const canEdit = mayManage && (actions.editRoles || actions.editJobTitle);
  const notSet = t`Not set`;

  const wording: Record<
    MemberStatusAction,
    { title: string; description: string; confirm: string; done: string }
  > = {
    suspend: {
      title: t`Suspend ${fullName}?`,
      description: t`${fullName} will lose access to ${clinicName} on their next request. Their account, sign-in and other clinics are not affected. You can reactivate them later.`,
      confirm: t`Suspend`,
      done: t`${fullName} is suspended.`,
    },
    reactivate: {
      title: t`Reactivate ${fullName}?`,
      description: t`${fullName} can use ${clinicName} again on their next request.`,
      confirm: t`Reactivate`,
      done: t`${fullName} can use the clinic again.`,
    },
    remove: {
      title: t`Remove ${fullName} from ${clinicName}?`,
      description: t`${fullName} will lose access to ${clinicName} on their next request. You cannot undo this here: to bring them back, invite them again.`,
      confirm: t`Remove`,
      done: t`${fullName} was removed.`,
    },
  };
  const notes = {
    self: t`Another admin must change your roles or status.`,
    removed: t`To bring them back, invite them again.`,
    owner: t`Only an owner can change an owner's roles or status.`,
  };

  function fail(error: ApiError): void {
    if (error.code === 'NOT_FOUND') {
      onMissing();
      return;
    }
    setFailure(error);
  }

  function apply(action: MemberStatusAction): void {
    setFailure(undefined);
    setStatus.mutate(
      { membershipId, action },
      {
        onSuccess: () => {
          notify.success(wording[action].done);
        },
        onError: (error) => {
          fail(asApiError(error));
        },
      },
    );
  }

  return (
    <div className="flex max-w-reading flex-col gap-8">
      <AppLink href="/staff" className="inline-flex min-h-target items-center gap-2 self-start">
        <ArrowLeft aria-hidden="true" className="size-5" />
        {t`All staff`}
      </AppLink>
      <h1>{fullName}</h1>

      {failure &&
        (isMemberRuleError(failure) ? (
          <Alert
            variant="warning"
            onDismiss={() => {
              setFailure(undefined);
            }}
          >
            {memberErrorMessage(failure)}
          </Alert>
        ) : (
          <ErrorState message={memberErrorMessage(failure)} requestId={failure.requestId} />
        ))}

      <section
        aria-labelledby="member-details"
        className="flex flex-col gap-4 rounded-lg border border-divider bg-surface p-6 shadow-1"
      >
        <h2 id="member-details" className="text-h3">
          {t`Details`}
        </h2>
        {editing ? (
          <EditMemberForm
            member={member.data}
            roles={roles.data}
            canEditRoles={actions.editRoles}
            onSaved={() => {
              setEditing(false);
              setFailure(undefined);
              notify.success(t`Details saved.`);
            }}
            onFailed={fail}
            onCancel={() => {
              setEditing(false);
            }}
          />
        ) : (
          <>
            <dl className="flex flex-col gap-3">
              <DetailRow label={t`Email`}>{email}</DetailRow>
              <DetailRow label={t`Status`}>
                <MemberStatusPill status={status} />
              </DetailRow>
              <DetailRow label={t`Roles`}>
                {member.data.roles.map((role) => role.name).join(', ')}
              </DetailRow>
              <DetailRow label={t`Job title`}>{jobTitle ?? notSet}</DetailRow>
              <DetailRow label={t`Joined`}>
                {joinedAt !== null && timeZone !== undefined
                  ? t`${formatDate({ iso: joinedAt, timeZone, style: 'medium' })} (${timeZone})`
                  : joinedAt === null
                    ? notSet
                    : ''}
              </DetailRow>
            </dl>
            {canEdit && (
              <div>
                <Button
                  variant={actions.reactivate ? 'secondary' : 'primary'}
                  onClick={() => {
                    setFailure(undefined);
                    setEditing(true);
                  }}
                >
                  {actions.editRoles ? t`Edit` : t`Edit job title`}
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <section
        aria-labelledby="member-access"
        className="flex flex-col gap-4 rounded-lg border border-divider bg-surface p-6 shadow-1"
      >
        <h2 id="member-access" className="text-h3">
          {t`Access`}
        </h2>
        {!mayManage ? (
          <PermissionNote>{t`Only people who manage staff can change this.`}</PermissionNote>
        ) : (
          <>
            {actions.note && (
              <p>
                {notes[actions.note]}
                {actions.note === 'removed' && (
                  <>
                    {' '}
                    <AppLink href="/staff/invitations">{t`Go to Invitations`}</AppLink>
                  </>
                )}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {actions.reactivate && (
                <Button
                  loading={setStatus.isPending}
                  onClick={() => {
                    setAsking('reactivate');
                  }}
                >
                  {t`Reactivate`}
                </Button>
              )}
              {actions.suspend && (
                <Button
                  variant="danger-secondary"
                  loading={setStatus.isPending}
                  onClick={() => {
                    setAsking('suspend');
                  }}
                >
                  {t`Suspend`}
                </Button>
              )}
              {actions.remove && (
                <Button
                  variant="danger-secondary"
                  loading={setStatus.isPending}
                  onClick={() => {
                    setAsking('remove');
                  }}
                >
                  {t`Remove`}
                </Button>
              )}
            </div>
          </>
        )}
      </section>

      {asking && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setAsking(undefined);
          }}
          title={wording[asking].title}
          description={wording[asking].description}
          confirmLabel={wording[asking].confirm}
          destructive={asking !== 'reactivate'}
          onConfirm={() => {
            apply(asking);
          }}
        />
      )}
    </div>
  );
}
