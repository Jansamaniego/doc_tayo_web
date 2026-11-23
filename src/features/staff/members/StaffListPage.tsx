import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError } from '@/api/errors.ts';
import { useSession } from '@/api/session/session-store.ts';
import { Alert } from '@/design-system/components/alert.tsx';
import { Button } from '@/design-system/components/button.tsx';
import { DataTable } from '@/design-system/components/data-table.tsx';
import { Pagination } from '@/design-system/components/pagination.tsx';
import { SelectField } from '@/design-system/components/select-fields.tsx';
import { EmptyState } from '@/design-system/components/state-views.tsx';
import { SearchField } from '@/design-system/components/text-fields.tsx';
import { AppLink } from '@/lib/app-link.tsx';
import { formatDate } from '@/lib/datetime/index.ts';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { useClinicTimeZone } from '../api/clinic-time-zone.ts';
import { useMembers, type Member, type MemberStatusFilter } from '../api/members.ts';
import { MemberStatusPill } from './MemberStatusPill.tsx';
import { StaffTabs } from '../StaffTabs.tsx';
import { RolesReference } from './RolesReference.tsx';

/**
 * What the address keeps: the page, the page size and the status. Never the search text (it may be
 * an email). `notice` carries "the person you opened is not on your staff" back from the detail page.
 */
export interface StaffSearch {
  page?: number | undefined;
  pageSize?: number | undefined;
  status?: MemberStatusFilter | undefined;
  notice?: 'missing' | undefined;
}

const STATUSES: MemberStatusFilter[] = ['active', 'suspended', 'removed'];
/** The API refuses a longer `q`. */
const MAX_SEARCH_LENGTH = 100;

export function StaffListPage({
  search,
  onSearchChange,
}: {
  search: StaffSearch;
  onSearchChange: (next: StaffSearch) => void;
}) {
  const { t } = useLingui();
  usePageTitle(t`Staff`);
  const session = useSession();
  const ownUserId = session.status === 'signed-in' ? session.user.id : undefined;
  const timeZone = useClinicTimeZone();
  // The search text stays in memory: it is lost on reload, on purpose.
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const { page, pageSize, status, notice } = search;
  const list = useMembers({ page, pageSize, q, status });

  // A new filter or page size starts again at page 1, and the notice has done its job.
  const withoutPage = (next: StaffSearch): StaffSearch => ({
    ...(next.pageSize !== undefined && { pageSize: next.pageSize }),
    ...(next.status !== undefined && { status: next.status }),
  });
  const filtered = q !== '' || status !== undefined;
  const statusLabel: Record<MemberStatusFilter, string> = {
    active: t`Active`,
    suspended: t`Suspended`,
    removed: t`Removed`,
  };

  const columns = [
    {
      id: 'name',
      header: t`Name`,
      cell: (row: Member) => (
        <span className="flex flex-wrap items-center gap-x-2">
          <AppLink href={`/staff/${row.membershipId}`}>{row.fullName}</AppLink>
          {row.userId === ownUserId && <span className="text-ink-secondary">{t`(you)`}</span>}
        </span>
      ),
    },
    { id: 'email', header: t`Email`, cell: (row: Member) => row.email },
    {
      id: 'roles',
      header: t`Roles`,
      cell: (row: Member) => row.roles.map((role) => role.name).join(', '),
    },
    { id: 'jobTitle', header: t`Job title`, cell: (row: Member) => row.jobTitle ?? '' },
    {
      id: 'status',
      header: t`Status`,
      cell: (row: Member) => <MemberStatusPill status={row.status} />,
    },
    {
      id: 'joined',
      header: t`Joined`,
      cell: (row: Member) =>
        row.joinedAt !== null && timeZone !== undefined
          ? formatDate({ iso: row.joinedAt, timeZone, style: 'medium' })
          : '',
    },
  ];

  const empty = filtered ? (
    <EmptyState
      title={t`No staff match your search`}
      description={t`Check the spelling, or try another word.`}
      action={
        <Button
          variant="secondary"
          onClick={() => {
            setText('');
            setQ('');
            onSearchChange({});
          }}
        >
          {t`Clear search`}
        </Button>
      }
    />
  ) : (
    <EmptyState title={t`No staff yet`} />
  );

  return (
    <div className="flex flex-col gap-6">
      <h1>{t`Staff`}</h1>
      <StaffTabs current="staff" />

      {notice === 'missing' && (
        <Alert
          variant="warning"
          onDismiss={() => {
            onSearchChange(withoutPage(search));
          }}
        >
          {t`This person is not on your staff.`}
        </Alert>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1">
          <SearchField
            label={t`Search staff`}
            value={text}
            onChange={setText}
            onSearch={(value) => {
              setQ(value.trim().slice(0, MAX_SEARCH_LENGTH));
              onSearchChange(withoutPage(search));
            }}
            {...(list.data && { resultSummary: t`${list.data.meta.totalItems} people found` })}
          />
        </div>
        <div className="md:w-64">
          <SelectField
            label={t`Status`}
            value={status ?? ''}
            options={[
              { value: '', label: t`All` },
              ...STATUSES.map((value) => ({ value, label: statusLabel[value] })),
            ]}
            onChange={(value) => {
              onSearchChange(
                withoutPage({
                  ...search,
                  status: value === '' ? undefined : (value as MemberStatusFilter),
                }),
              );
            }}
          />
        </div>
      </div>

      <DataTable
        caption={t`Staff`}
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(row) => row.membershipId}
        loading={list.isPending ? t`Loading staff…` : undefined}
        empty={empty}
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
            onSearchChange(withoutPage({ ...search, pageSize: size }));
          }}
        />
      )}

      <RolesReference />
    </div>
  );
}
