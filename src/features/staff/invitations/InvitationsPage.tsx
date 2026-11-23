import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError, type ApiError } from '@/api/errors.ts';
import { useSession } from '@/api/session/session-store.ts';
import { Alert } from '@/design-system/components/alert.tsx';
import { Button } from '@/design-system/components/button.tsx';
import { ConfirmDialog } from '@/design-system/components/confirm-dialog.tsx';
import { DataTable } from '@/design-system/components/data-table.tsx';
import { Pagination } from '@/design-system/components/pagination.tsx';
import { SelectField } from '@/design-system/components/select-fields.tsx';
import { EmptyState, ErrorState } from '@/design-system/components/state-views.tsx';
import { notify } from '@/design-system/components/toast.tsx';
import { PermissionNote } from '@/design-system/patterns/permission.tsx';
import { formatDate } from '@/lib/datetime/index.ts';
import { can } from '@/lib/permissions.ts';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { useClinicTimeZone } from '../api/clinic-time-zone.ts';
import {
  useInvitations,
  useResendInvitation,
  useRevokeInvitation,
  type Invitation,
  type InvitationStatus,
} from '../api/invitations.ts';
import { StaffTabs } from '../StaffTabs.tsx';
import { invitationActions } from './invitation-actions.ts';
import { InvitationStatusPill } from './InvitationStatusPill.tsx';
import { InviteDialog } from './InviteDialog.tsx';

/** What the address keeps: the status (Pending is the default and is left out), the page and its size. */
export interface InvitationsSearch {
  page?: number | undefined;
  pageSize?: number | undefined;
  status?: Exclude<InvitationStatus, 'pending'> | undefined;
}

const STATUSES: InvitationStatus[] = ['pending', 'accepted', 'revoked', 'expired'];

export function InvitationsPage({
  search,
  onSearchChange,
}: {
  search: InvitationsSearch;
  onSearchChange: (next: InvitationsSearch) => void;
}) {
  const { t } = useLingui();
  usePageTitle(t`Invitations`);
  const session = useSession();
  const timeZone = useClinicTimeZone();
  const { page, pageSize } = search;
  const status: InvitationStatus = search.status ?? 'pending';
  const list = useInvitations({ status, page, pageSize });
  const resend = useResendInvitation();
  const revoke = useRevokeInvitation();
  const [inviting, setInviting] = useState(false);
  const [revoking, setRevoking] = useState<Invitation | undefined>();
  const [failure, setFailure] = useState<ApiError | undefined>();

  const mayInvite = session.status === 'signed-in' && can(session.permissions, 'members.invite');
  const statusLabel: Record<InvitationStatus, string> = {
    pending: t`Pending`,
    accepted: t`Accepted`,
    revoked: t`Revoked`,
    expired: t`Expired`,
  };
  const showPending = (): void => {
    onSearchChange({});
  };

  function fail(error: ApiError): void {
    setFailure(error);
  }

  function sendAgain(invitation: Invitation): void {
    setFailure(undefined);
    resend.mutate(invitation.id, {
      onSuccess: () => {
        notify.success(t`A new link was sent. The old link no longer works.`);
      },
      onError: (error) => {
        fail(asApiError(error));
      },
    });
  }

  function cancel(invitation: Invitation): void {
    setFailure(undefined);
    revoke.mutate(invitation.id, {
      onSuccess: () => {
        notify.success(t`The invitation to ${invitation.email} was revoked.`);
      },
      onError: (error) => {
        fail(asApiError(error));
      },
    });
  }

  const columns = [
    { id: 'email', header: t`Email`, cell: (row: Invitation) => row.email },
    { id: 'role', header: t`Role`, cell: (row: Invitation) => row.role.name },
    { id: 'invitedBy', header: t`Invited by`, cell: (row: Invitation) => row.invitedBy.fullName },
    {
      id: 'sent',
      header: t`Sent`,
      cell: (row: Invitation) =>
        timeZone ? formatDate({ iso: row.createdAt, timeZone, style: 'medium' }) : '',
    },
    {
      id: 'expires',
      header: t`Expires`,
      cell: (row: Invitation) =>
        timeZone ? formatDate({ iso: row.expiresAt, timeZone, style: 'medium' }) : '',
    },
    {
      id: 'status',
      header: t`Status`,
      cell: (row: Invitation) => <InvitationStatusPill status={row.status} />,
    },
  ];

  const emptyTitle: Record<InvitationStatus, string> = {
    pending: t`No pending invitations`,
    accepted: t`No accepted invitations`,
    revoked: t`No revoked invitations`,
    expired: t`No expired invitations`,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1>{t`Invitations`}</h1>
        {mayInvite && (
          <Button
            onClick={() => {
              setFailure(undefined);
              setInviting(true);
            }}
          >
            {t`Invite someone`}
          </Button>
        )}
      </div>
      <StaffTabs current="invitations" />

      {failure &&
        (failure.code === 'CONFLICT' || failure.code === 'NOT_FOUND' ? (
          <Alert
            variant="warning"
            onDismiss={() => {
              setFailure(undefined);
            }}
          >
            {failure.code === 'CONFLICT'
              ? t`This invitation was already accepted or revoked.`
              : t`This invitation is no longer in your clinic.`}
          </Alert>
        ) : (
          <ErrorState message={messageForError(failure)} requestId={failure.requestId} />
        ))}
      {!mayInvite && (
        <PermissionNote>
          {t`Only people who can invite staff can send, resend or revoke invitations.`}
        </PermissionNote>
      )}

      <div className="md:w-64">
        <SelectField
          label={t`Status`}
          value={status}
          options={STATUSES.map((value) => ({ value, label: statusLabel[value] }))}
          onChange={(value) => {
            const next = value as InvitationStatus;
            onSearchChange({
              ...(pageSize !== undefined && { pageSize }),
              ...(next !== 'pending' && { status: next }),
            });
          }}
        />
      </div>

      <DataTable
        caption={t`Invitations`}
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(row) => row.id}
        loading={list.isPending ? t`Loading invitations…` : undefined}
        empty={<EmptyState title={emptyTitle[status]} />}
        error={
          list.isError
            ? {
                message: messageForError(asApiError(list.error)),
                requestId: asApiError(list.error).requestId,
                onRetry: () => {
                  void list.refetch();
                },
              }
            : undefined
        }
        rowActions={
          mayInvite
            ? (row) => {
                const actions = invitationActions(row.status);
                return (
                  <>
                    {actions.resend && (
                      <Button
                        variant="secondary"
                        aria-label={t`Resend invitation to ${row.email}`}
                        loading={resend.isPending && resend.variables === row.id}
                        onClick={() => {
                          sendAgain(row);
                        }}
                      >
                        {t`Resend`}
                      </Button>
                    )}
                    {actions.revoke && (
                      <Button
                        variant="danger-secondary"
                        aria-label={t`Revoke invitation to ${row.email}`}
                        onClick={() => {
                          setRevoking(row);
                        }}
                      >
                        {t`Revoke`}
                      </Button>
                    )}
                  </>
                );
              }
            : undefined
        }
      />
      {timeZone && (
        <p className="text-small text-ink-secondary">{t`Dates are shown in ${timeZone}.`}</p>
      )}
      {list.data && (
        <Pagination
          meta={list.data.meta}
          onPageChange={(next) => {
            onSearchChange({ ...search, page: next });
          }}
          onPageSizeChange={(size) => {
            onSearchChange({ ...(search.status && { status: search.status }), pageSize: size });
          }}
        />
      )}

      {inviting && (
        <InviteDialog
          onClose={() => {
            setInviting(false);
          }}
          onInvited={(email) => {
            setInviting(false);
            notify.success(t`Invitation sent to ${email}.`);
            showPending();
          }}
          onShowOpen={() => {
            setInviting(false);
            showPending();
          }}
        />
      )}
      {revoking && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setRevoking(undefined);
          }}
          title={t`Revoke the invitation to ${revoking.email}?`}
          description={t`The link in their email will stop working. You can invite them again later.`}
          confirmLabel={t`Revoke`}
          onConfirm={() => {
            cancel(revoking);
          }}
        />
      )}
    </div>
  );
}
