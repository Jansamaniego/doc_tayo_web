import { useLingui } from '@lingui/react/macro';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError } from '@/api/errors.ts';
import { useSession } from '@/api/session/session-store.ts';
import { Alert } from '@/design-system/components/alert.tsx';
import { DataTable } from '@/design-system/components/data-table.tsx';
import { Pagination } from '@/design-system/components/pagination.tsx';
import { SelectField } from '@/design-system/components/select-fields.tsx';
import { EmptyState } from '@/design-system/components/state-views.tsx';
import { AppButtonLink, AppLink } from '@/lib/app-link.tsx';
import { can } from '@/lib/permissions.ts';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { useBranches, type Branch, type BranchStatusFilter } from '../api/branches.ts';
import { useClinicProfile } from '../api/tenant.ts';
import { ClinicTabs } from '../ClinicTabs.tsx';
import { BranchStatusPill } from './BranchStatusPill.tsx';

/**
 * What the address keeps: the page, the page size and the filter (Active is the default and is left
 * out). `notice` carries "the branch you opened is not in your clinic" back from the branch page.
 */
export interface BranchesSearch {
  page?: number | undefined;
  pageSize?: number | undefined;
  status?: BranchStatusFilter | undefined;
  notice?: 'missing' | undefined;
}

export function BranchesPage({
  search,
  onSearchChange,
}: {
  search: BranchesSearch;
  onSearchChange: (next: BranchesSearch) => void;
}) {
  const { t } = useLingui();
  usePageTitle(t`Branches`);
  const session = useSession();
  const mayManage = session.status === 'signed-in' && can(session.permissions, 'branches.manage');
  const clinicTimeZone = useClinicProfile().data?.timezone;
  const { page, pageSize, status, notice } = search;
  const list = useBranches({ page, pageSize, status });

  // A new filter or page size starts again at page 1, and the notice has done its job.
  const withoutPage = (next: BranchesSearch): BranchesSearch => ({
    ...(next.pageSize !== undefined && { pageSize: next.pageSize }),
    ...(next.status !== undefined && { status: next.status }),
  });

  const columns = [
    {
      id: 'name',
      header: t`Name`,
      cell: (row: Branch) => <AppLink href={`/clinic/branches/${row.id}`}>{row.name}</AppLink>,
    },
    {
      id: 'place',
      header: t`City and province`,
      cell: (row: Branch) => [row.city, row.province].filter(Boolean).join(', '),
    },
    {
      id: 'timezone',
      header: t`Time zone`,
      cell: (row: Branch) =>
        row.timezone ?? (clinicTimeZone ? t`Clinic's (${clinicTimeZone})` : t`Clinic's time zone`),
    },
    {
      id: 'status',
      header: t`Status`,
      cell: (row: Branch) => <BranchStatusPill isActive={row.isActive} />,
    },
  ];

  const empty =
    status === 'inactive' ? (
      <EmptyState title={t`No inactive branches`} />
    ) : status === 'all' ? (
      <EmptyState title={t`No branches yet`} />
    ) : (
      <EmptyState title={t`No active branches`} />
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>{t`Clinic`}</h1>
        {mayManage && <AppButtonLink href="/clinic/branches/new">{t`Add branch`}</AppButtonLink>}
      </div>
      <ClinicTabs current="branches" />

      {notice === 'missing' && (
        <Alert
          variant="warning"
          onDismiss={() => {
            onSearchChange(withoutPage(search));
          }}
        >
          {t`This branch is not in your clinic.`}
        </Alert>
      )}

      <div className="md:w-64">
        <SelectField
          label={t`Show`}
          value={status ?? 'active'}
          options={[
            { value: 'active', label: t`Active` },
            { value: 'inactive', label: t`Inactive` },
            { value: 'all', label: t`All` },
          ]}
          onChange={(value) => {
            onSearchChange(
              withoutPage({
                ...search,
                status: value === 'active' ? undefined : (value as BranchStatusFilter),
              }),
            );
          }}
        />
      </div>

      <DataTable
        caption={t`Branches`}
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(row) => row.id}
        loading={list.isPending ? t`Loading branches…` : undefined}
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
