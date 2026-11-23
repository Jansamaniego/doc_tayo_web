import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError } from '@/api/errors.ts';
import { Button } from '@/design-system/components/button.tsx';
import { DataTable } from '@/design-system/components/data-table.tsx';
import { Pagination } from '@/design-system/components/pagination.tsx';
import { SelectField } from '@/design-system/components/select-fields.tsx';
import { EmptyState } from '@/design-system/components/state-views.tsx';
import { SearchField } from '@/design-system/components/text-fields.tsx';
import { AppLink } from '@/lib/app-link.tsx';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { useAdminUsers, type AdminUser, type UserStatus } from '../api/admin-users.ts';
import { UserStatusPill } from './UserStatusPill.tsx';

/** What the address keeps: the page, the page size and the status. Never the search text (it may be an email). */
export interface UsersSearch {
  page?: number | undefined;
  pageSize?: number | undefined;
  status?: UserStatus | undefined;
}

const STATUSES: UserStatus[] = ['pending', 'active', 'deactivated'];

export function UsersListPage({
  search,
  onSearchChange,
}: {
  search: UsersSearch;
  onSearchChange: (next: UsersSearch) => void;
}) {
  const { t } = useLingui();
  usePageTitle(t`Users`);
  // The search text stays in memory: it is lost on reload, on purpose.
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const { page, pageSize, status } = search;
  const list = useAdminUsers({ page, pageSize, q, status });

  const withoutPage = (next: UsersSearch): UsersSearch => ({
    ...(next.pageSize !== undefined && { pageSize: next.pageSize }),
    ...(next.status !== undefined && { status: next.status }),
  });
  const filtered = q !== '' || status !== undefined;
  const statusLabel: Record<UserStatus, string> = {
    pending: t`Pending`,
    active: t`Active`,
    deactivated: t`Deactivated`,
  };

  const columns = [
    {
      id: 'name',
      header: t`Name`,
      cell: (row: AdminUser) => <AppLink href={`/admin/users/${row.id}`}>{row.fullName}</AppLink>,
    },
    { id: 'email', header: t`Email`, cell: (row: AdminUser) => row.email },
    {
      id: 'status',
      header: t`Status`,
      cell: (row: AdminUser) => (
        <span className="flex flex-wrap items-center gap-2">
          <UserStatusPill status={row.status} />
          {row.platformRole === 'platform_admin' && (
            <span className="font-semibold">{t`Platform admin`}</span>
          )}
        </span>
      ),
    },
    { id: 'clinics', header: t`Clinics`, cell: (row: AdminUser) => row.membershipCount },
  ];

  const empty = filtered ? (
    <EmptyState
      title={t`No users match your search`}
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
    <EmptyState title={t`No users yet`} />
  );

  return (
    <div className="flex flex-col gap-6">
      <h1>{t`Users`}</h1>

      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1">
          <SearchField
            label={t`Search users`}
            value={text}
            onChange={setText}
            onSearch={(value) => {
              setQ(value.trim());
              onSearchChange(withoutPage(search));
            }}
            {...(list.data && { resultSummary: t`${list.data.meta.totalItems} users found` })}
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
                  status: value === '' ? undefined : (value as UserStatus),
                }),
              );
            }}
          />
        </div>
      </div>

      <DataTable
        caption={t`Users`}
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(row) => row.id}
        loading={list.isPending ? t`Loading users…` : undefined}
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
    </div>
  );
}
