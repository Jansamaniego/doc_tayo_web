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
import { AppButtonLink, AppLink } from '@/lib/app-link.tsx';
import { formatDate } from '@/lib/datetime/index.ts';
import { usePageTitle } from '@/lib/use-page-title.ts';

import {
  useAdminTenants,
  type AdminTenantListItem,
  type TenantStatus,
} from '../api/admin-tenants.ts';
import { ClinicStatusPill } from './ClinicStatusPill.tsx';

/** What the address keeps: the page, the page size and the status. Never the search text (it may be an email). */
export interface ClinicsSearch {
  page?: number | undefined;
  pageSize?: number | undefined;
  status?: TenantStatus | undefined;
}

const STATUSES: TenantStatus[] = ['active', 'suspended', 'deactivated'];

export function ClinicsListPage({
  search,
  onSearchChange,
}: {
  search: ClinicsSearch;
  onSearchChange: (next: ClinicsSearch) => void;
}) {
  const { t } = useLingui();
  usePageTitle(t`Clinics`);
  // The search text stays in memory: it is lost on reload, on purpose.
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const { page, pageSize, status } = search;
  const list = useAdminTenants({ page, pageSize, q, status });

  const withoutPage = (next: ClinicsSearch): ClinicsSearch => ({
    ...(next.pageSize !== undefined && { pageSize: next.pageSize }),
    ...(next.status !== undefined && { status: next.status }),
  });
  const filtered = q !== '' || status !== undefined;

  const columns = [
    {
      id: 'name',
      header: t`Clinic`,
      cell: (row: AdminTenantListItem) => (
        <AppLink href={`/admin/clinics/${row.id}`}>{row.name}</AppLink>
      ),
    },
    { id: 'slug', header: t`Web address name`, cell: (row: AdminTenantListItem) => row.slug },
    {
      id: 'status',
      header: t`Status`,
      cell: (row: AdminTenantListItem) => <ClinicStatusPill status={row.status} />,
    },
    { id: 'timezone', header: t`Time zone`, cell: (row: AdminTenantListItem) => row.timezone },
    {
      id: 'members',
      header: t`Active members`,
      cell: (row: AdminTenantListItem) => row.memberCount,
    },
    {
      id: 'created',
      header: t`Created`,
      // In the clinic's own time zone, which is always in the response.
      cell: (row: AdminTenantListItem) =>
        formatDate({ iso: row.createdAt, timeZone: row.timezone, style: 'medium' }),
    },
  ];

  const empty = filtered ? (
    <EmptyState
      title={t`No clinics match your search`}
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
    <EmptyState
      title={t`No clinics yet`}
      description={t`Create the first clinic to get started.`}
      action={<AppButtonLink href="/admin/clinics/new">{t`New clinic`}</AppButtonLink>}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>{t`Clinics`}</h1>
        <AppButtonLink href="/admin/clinics/new">{t`New clinic`}</AppButtonLink>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1">
          <SearchField
            label={t`Search clinics`}
            value={text}
            onChange={setText}
            onSearch={(value) => {
              setQ(value.trim());
              onSearchChange(withoutPage(search));
            }}
            {...(list.data && {
              resultSummary: t`${list.data.meta.totalItems} clinics found`,
            })}
          />
        </div>
        <div className="md:w-64">
          <SelectField
            label={t`Status`}
            value={status ?? ''}
            options={[
              { value: '', label: t`All` },
              ...STATUSES.map((value) => ({
                value,
                label: { active: t`Active`, suspended: t`Suspended`, deactivated: t`Deactivated` }[
                  value
                ],
              })),
            ]}
            onChange={(value) => {
              onSearchChange(
                withoutPage({
                  ...search,
                  status: value === '' ? undefined : (value as TenantStatus),
                }),
              );
            }}
          />
        </div>
      </div>

      <DataTable
        caption={t`Clinics`}
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(row) => row.id}
        loading={list.isPending ? t`Loading clinics…` : undefined}
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
