import { useLingui } from '@lingui/react/macro';
import { useEffect } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError } from '@/api/errors.ts';
import { useSession } from '@/api/session/session-store.ts';
import { StatusPill } from '@/design-system/components/badge.tsx';
import { Checkbox } from '@/design-system/components/choice-fields.tsx';
import { DataTable } from '@/design-system/components/data-table.tsx';
import { Pagination } from '@/design-system/components/pagination.tsx';
import { EmptyState } from '@/design-system/components/state-views.tsx';
import { ClinicTabs } from '@/features/clinic/ClinicTabs.tsx';
import { AppButtonLink, AppLink } from '@/lib/app-link.tsx';
import { can } from '@/lib/permissions.ts';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { useServices, type Service } from '../api/services.ts';
import { formatDuration } from '../duration.ts';
import { ServicePrice } from '../ServicePrice.tsx';

/** What the address keeps: the page, its size and whether inactive services are shown. */
export interface ServicesSearch {
  page?: number | undefined;
  pageSize?: number | undefined;
  inactive?: 1 | undefined;
}

export function ServicesPage({
  search,
  onSearchChange,
  onPageGone,
}: {
  search: ServicesSearch;
  onSearchChange: (next: ServicesSearch) => void;
  /** The address names a page past the end: go to the last one, without a step Back would repeat. */
  onPageGone: (lastPage: number) => void;
}) {
  const { t } = useLingui();
  usePageTitle(t`Services and prices`);
  const session = useSession();
  const mayManage = session.status === 'signed-in' && can(session.permissions, 'services.manage');
  const { page, pageSize, inactive } = search;
  // Inactive services are for the people who can bring them back (P8-8), whatever the address says.
  const showInactive = mayManage && inactive === 1;
  const list = useServices({ page, pageSize, includeInactive: showInactive });

  const totalPages = list.data?.meta.totalPages ?? 0;
  const pastTheEnd =
    !list.isPlaceholderData && totalPages > 0 && page !== undefined && page > totalPages;
  useEffect(() => {
    if (pastTheEnd) onPageGone(totalPages);
  }, [pastTheEnd, totalPages, onPageGone]);

  // A new filter or page size starts again at page 1.
  const withoutPage = (next: ServicesSearch): ServicesSearch => ({
    ...(next.pageSize !== undefined && { pageSize: next.pageSize }),
    ...(next.inactive !== undefined && { inactive: next.inactive }),
  });

  const add = mayManage && (
    <AppButtonLink href="/clinic/services/new">{t`Add a service`}</AppButtonLink>
  );

  const columns = [
    {
      id: 'name',
      header: t`Service`,
      cell: (row: Service) => (
        <div className="flex flex-col">
          <AppLink href={`/clinic/services/${row.id}`}>{row.name}</AppLink>
          {row.description !== null && (
            <span className="text-small font-normal break-words text-ink-muted">
              {row.description}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'duration',
      header: t`Usual length`,
      cell: (row: Service) => formatDuration(row.defaultDurationMinutes),
    },
    {
      id: 'price',
      header: t`Price`,
      cell: (row: Service) => <ServicePrice price={row.price} />,
    },
    ...(mayManage
      ? [
          {
            id: 'status',
            header: t`Status`,
            cell: (row: Service) =>
              row.isActive ? (
                <StatusPill status="success">{t`Active`}</StatusPill>
              ) : (
                <StatusPill status="neutral">{t`Inactive`}</StatusPill>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>{t`Services and prices`}</h1>
        {add}
      </div>
      <ClinicTabs current="services" />
      <p className="text-ink-secondary">{t`Prices the front desk quotes. Patients pay at the desk.`}</p>

      {mayManage && (
        <Checkbox
          label={t`Show inactive services`}
          checked={showInactive}
          onCheckedChange={(checked) => {
            onSearchChange(withoutPage({ ...search, inactive: checked === true ? 1 : undefined }));
          }}
        />
      )}

      <DataTable
        caption={t`Services`}
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(row) => row.id}
        loading={list.isPending || pastTheEnd ? t`Loading services…` : undefined}
        empty={<EmptyState title={t`No services yet`} action={add} />}
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
      {list.data && !pastTheEnd && (
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
