import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError } from '@/api/errors.ts';
import { useSession } from '@/api/session/session-store.ts';
import { StatusPill } from '@/design-system/components/badge.tsx';
import { Button } from '@/design-system/components/button.tsx';
import { DataTable } from '@/design-system/components/data-table.tsx';
import { Pagination } from '@/design-system/components/pagination.tsx';
import { SelectField } from '@/design-system/components/select-fields.tsx';
import { EmptyState } from '@/design-system/components/state-views.tsx';
import { useBranches } from '@/features/clinic/api/branches.ts';
import { AppButtonLink, AppLink } from '@/lib/app-link.tsx';
import { can } from '@/lib/permissions.ts';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { useDirectory, type DirectoryEntry } from '../api/directory.ts';

/** What the address keeps: the page, its size and the chosen branch. */
export interface PractitionersSearch {
  page?: number | undefined;
  pageSize?: number | undefined;
  /** Only practitioners with hours at this branch. */
  branch?: string | undefined;
}

const DEFAULT_PAGE_SIZE = 20;
/** The most the API gives at once: more branches than this is not a clinic this app serves. */
const ALL_BRANCHES = 100;

type Listed = DirectoryEntry & { practitioner: NonNullable<DirectoryEntry['practitioner']> };

export function PractitionersPage({
  search,
  onSearchChange,
}: {
  search: PractitionersSearch;
  onSearchChange: (next: PractitionersSearch) => void;
}) {
  const { t } = useLingui();
  usePageTitle(t`Practitioners`);
  const session = useSession();
  const mayManage =
    session.status === 'signed-in' && can(session.permissions, 'practitioners.manage');
  const { page = 1, pageSize = DEFAULT_PAGE_SIZE, branch } = search;
  const branches = useBranches({ pageSize: ALL_BRANCHES });
  const add = mayManage && (
    <AppButtonLink href="/practitioners/new">{t`Add a practitioner`}</AppButtonLink>
  );
  const directory = useDirectory({ branchId: branch });

  // Inactive practitioners are for the people who can bring them back (P7-4).
  const listed = (directory.data ?? []).filter(
    (entry): entry is Listed =>
      entry.practitioner !== null && (mayManage || entry.practitioner.isActive),
  );
  // The directory is read whole, so the pages are cut here.
  const totalPages = Math.ceil(listed.length / pageSize);
  const current = Math.min(page, Math.max(totalPages, 1));
  const rows = listed.slice((current - 1) * pageSize, current * pageSize);

  const keptSize = pageSize === DEFAULT_PAGE_SIZE ? {} : { pageSize };
  const chooseBranch = (branchId: string): void => {
    onSearchChange({ ...keptSize, ...(branchId !== '' && { branch: branchId }) });
  };

  const columns = [
    {
      id: 'name',
      header: t`Name`,
      cell: (row: Listed) => (
        <AppLink href={`/practitioners/${row.practitioner.profileId}`}>
          {row.practitioner.displayName}
        </AppLink>
      ),
    },
    {
      id: 'specialization',
      header: t`Specialization`,
      cell: (row: Listed) => row.practitioner.specialization ?? t`Not recorded`,
    },
    {
      id: 'person',
      header: t`Staff member`,
      cell: (row: Listed) => [row.fullName, row.jobTitle].filter(Boolean).join(' · '),
    },
    ...(mayManage
      ? [
          {
            id: 'status',
            header: t`Status`,
            cell: (row: Listed) =>
              row.practitioner.isActive ? (
                <StatusPill status="success">{t`Active`}</StatusPill>
              ) : (
                <StatusPill status="neutral">{t`Inactive`}</StatusPill>
              ),
          },
        ]
      : []),
  ];

  const empty = branch ? (
    <EmptyState
      title={t`No practitioner works at this branch`}
      action={
        <Button
          variant="secondary"
          onClick={() => {
            chooseBranch('');
          }}
        >
          {t`Show all branches`}
        </Button>
      }
    />
  ) : (
    <EmptyState title={t`No practitioners yet`} action={add} />
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1>{t`Practitioners`}</h1>
        {add}
      </div>

      <div className="md:w-80">
        <SelectField
          label={t`Branch`}
          value={branch ?? ''}
          options={[
            { value: '', label: t`All branches` },
            ...(branches.data?.data ?? []).map((item) => ({ value: item.id, label: item.name })),
          ]}
          onChange={chooseBranch}
        />
      </div>
      <p role="status" className="sr-only">
        {directory.data &&
          plural(listed.length, {
            one: '# practitioner found',
            other: '# practitioners found',
          })}
      </p>

      <DataTable
        caption={t`Practitioners`}
        columns={columns}
        rows={rows}
        rowKey={(row) => row.membershipId}
        loading={directory.isPending ? t`Loading practitioners…` : undefined}
        empty={empty}
        error={
          directory.isError
            ? {
                message: messageForError(asApiError(directory.error)),
                requestId: asApiError(directory.error).requestId,
                onRetry: () => {
                  void directory.refetch();
                },
              }
            : undefined
        }
      />
      {directory.data && (
        <Pagination
          meta={{ page: current, pageSize, totalItems: listed.length, totalPages }}
          onPageChange={(next) => {
            onSearchChange({ ...search, page: next });
          }}
          onPageSizeChange={(size) => {
            onSearchChange({ ...(branch && { branch }), pageSize: size });
          }}
        />
      )}
    </div>
  );
}
