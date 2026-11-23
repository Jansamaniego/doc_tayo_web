import { useLingui } from '@lingui/react/macro';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError } from '@/api/errors.ts';
import { Button } from '@/design-system/components/button.tsx';
import { DataTable } from '@/design-system/components/data-table.tsx';
import { ErrorState } from '@/design-system/components/state-views.tsx';
import { AppButtonLink, AppLink } from '@/lib/app-link.tsx';

import {
  useAdminTenants,
  type AdminTenantListItem,
  type TenantStatus,
} from '../api/admin-tenants.ts';
import { useAdminUsers, type UserStatus } from '../api/admin-users.ts';
import { useServiceReady } from '../api/admin-overview.ts';
import { ClinicStatusPill } from '../clinics/ClinicStatusPill.tsx';
import { CountTile } from './CountTile.tsx';

/** A titled block that fails on its own: its error, with the request id, stays inside it. */
export function Block({
  id,
  title,
  queries,
  children,
}: {
  id: string;
  title: string;
  queries: UseQueryResult[];
  children: ReactNode;
}) {
  const failed = queries.find((query) => query.isError);
  const error = failed ? asApiError(failed.error) : undefined;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id}>{title}</h2>
      {error ? (
        <ErrorState
          message={messageForError(error)}
          requestId={error.requestId}
          onRetry={() => {
            for (const query of queries) if (query.isError) void query.refetch();
          }}
        />
      ) : (
        children
      )}
    </section>
  );
}

/** The sum, or nothing while any part is still loading. */
function total(...counts: (number | undefined)[]): number | undefined {
  let sum = 0;
  for (const count of counts) {
    if (count === undefined) return undefined;
    sum += count;
  }
  return sum;
}

export function ClinicCounts() {
  const { t } = useLingui();
  const byStatus = {
    active: useAdminTenants({ pageSize: 1, status: 'active' }),
    suspended: useAdminTenants({ pageSize: 1, status: 'suspended' }),
    deactivated: useAdminTenants({ pageSize: 1, status: 'deactivated' }),
  };
  const count = (status: TenantStatus) => byStatus[status].data?.meta.totalItems;
  return (
    <Block id="clinic-counts" title={t`Clinics at a glance`} queries={Object.values(byStatus)}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CountTile
          label={t`All clinics`}
          href="/admin/clinics"
          count={total(count('active'), count('suspended'), count('deactivated'))}
        />
        <CountTile label={t`Active`} href="/admin/clinics?status=active" count={count('active')} />
        <CountTile
          label={t`Suspended`}
          href="/admin/clinics?status=suspended"
          count={count('suspended')}
        />
        <CountTile
          label={t`Deactivated`}
          href="/admin/clinics?status=deactivated"
          count={count('deactivated')}
        />
      </div>
    </Block>
  );
}

export function PeopleCounts() {
  const { t } = useLingui();
  const byStatus = {
    pending: useAdminUsers({ pageSize: 1, status: 'pending' }),
    active: useAdminUsers({ pageSize: 1, status: 'active' }),
    deactivated: useAdminUsers({ pageSize: 1, status: 'deactivated' }),
  };
  const count = (status: UserStatus) => byStatus[status].data?.meta.totalItems;
  return (
    <Block id="people-counts" title={t`People`} queries={Object.values(byStatus)}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CountTile
          label={t`All accounts`}
          href="/admin/users"
          count={total(count('pending'), count('active'), count('deactivated'))}
        />
        <CountTile label={t`Active`} href="/admin/users?status=active" count={count('active')} />
        <CountTile
          label={t`Waiting to set a password`}
          href="/admin/users?status=pending"
          count={count('pending')}
        />
        <CountTile
          label={t`Deactivated`}
          href="/admin/users?status=deactivated"
          count={count('deactivated')}
        />
      </div>
    </Block>
  );
}

export function NeedsAttention() {
  const { t } = useLingui();
  const suspended = useAdminTenants({ pageSize: 5, status: 'suspended' });
  const pending = useAdminUsers({ pageSize: 5, status: 'pending' });
  return (
    <Block id="needs-attention" title={t`Needs attention`} queries={[suspended, pending]}>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border border-divider bg-surface p-5">
          <h3 className="text-h3">{t`Suspended clinics`}</h3>
          {suspended.data?.data.length === 0 && <p>{t`No clinics are suspended.`}</p>}
          <ul className="flex flex-col gap-2">
            {suspended.data?.data.map((clinic) => (
              <li key={clinic.id}>
                <AppLink href={`/admin/clinics/${clinic.id}`}>{clinic.name}</AppLink>
              </li>
            ))}
          </ul>
          <AppLink
            href="/admin/clinics?status=suspended"
            standalone
            aria-label={t`View all suspended clinics`}
          >
            {t`View all`}
          </AppLink>
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-divider bg-surface p-5">
          <h3 className="text-h3">{t`Accounts waiting to set a password`}</h3>
          {pending.data?.data.length === 0 && <p>{t`Nobody is waiting.`}</p>}
          <ul className="flex flex-col gap-2">
            {pending.data?.data.map((account) => (
              <li key={account.id} className="flex flex-col">
                <AppLink href={`/admin/users/${account.id}`}>{account.fullName}</AppLink>
                <span className="text-ink-secondary">{account.email}</span>
              </li>
            ))}
          </ul>
          <AppLink
            href="/admin/users?status=pending"
            standalone
            aria-label={t`View all waiting accounts`}
          >
            {t`View all`}
          </AppLink>
        </div>
      </div>
    </Block>
  );
}

export function ClinicsPreview() {
  const { t } = useLingui();
  const list = useAdminTenants({ pageSize: 10 });
  const rows = list.data?.data ?? [];
  const totalItems = list.data?.meta.totalItems ?? 0;
  const columns = [
    {
      id: 'name',
      header: t`Clinic`,
      cell: (row: AdminTenantListItem) => (
        <AppLink href={`/admin/clinics/${row.id}`}>{row.name}</AppLink>
      ),
    },
    {
      id: 'status',
      header: t`Status`,
      cell: (row: AdminTenantListItem) => <ClinicStatusPill status={row.status} />,
    },
    {
      id: 'members',
      header: t`Active members`,
      cell: (row: AdminTenantListItem) => row.memberCount,
    },
    { id: 'timezone', header: t`Time zone`, cell: (row: AdminTenantListItem) => row.timezone },
  ];
  return (
    <Block id="clinics-preview" title={t`All clinics`} queries={[list]}>
      <DataTable
        caption={t`Clinics`}
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={list.isPending ? t`Loading clinics…` : undefined}
        empty={<p>{t`No clinics yet.`}</p>}
      />
      {totalItems > rows.length && (
        <p className="text-ink-secondary">{t`Showing ${rows.length} of ${totalItems} clinics`}</p>
      )}
      <div>
        <AppButtonLink href="/admin/clinics" variant="secondary">
          {t`View all clinics`}
        </AppButtonLink>
      </div>
    </Block>
  );
}

export function SystemStatus() {
  const { t } = useLingui();
  const ready = useServiceReady();
  return (
    <section aria-labelledby="system-status" className="flex flex-col gap-3">
      <h2 id="system-status">{t`System status`}</h2>
      <div className="flex flex-wrap items-center gap-4">
        <p role="status" className="text-body-lg font-semibold">
          {ready.isPending
            ? t`Checking…`
            : ready.isError
              ? t`The service is not ready right now`
              : t`The service is ready`}
        </p>
        <Button
          variant="secondary"
          loading={ready.isFetching}
          loadingText={t`Checking…`}
          onClick={() => {
            void ready.refetch();
          }}
        >
          {t`Check again`}
        </Button>
      </div>
    </section>
  );
}
