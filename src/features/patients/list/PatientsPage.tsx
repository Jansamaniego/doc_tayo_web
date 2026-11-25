import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError } from '@/api/errors.ts';
import { useSession } from '@/api/session/session-store.ts';
import { StatusPill } from '@/design-system/components/badge.tsx';
import { Button } from '@/design-system/components/button.tsx';
import { Checkbox } from '@/design-system/components/choice-fields.tsx';
import { DataTable } from '@/design-system/components/data-table.tsx';
import { Pagination } from '@/design-system/components/pagination.tsx';
import { EmptyState } from '@/design-system/components/state-views.tsx';
import { SearchField } from '@/design-system/components/text-fields.tsx';
import { useClinicTimeZone } from '@/features/staff/api/clinic-time-zone.ts';
import { todayInZone } from '@/lib/datetime/index.ts';
import { AppButtonLink, AppLink } from '@/lib/app-link.tsx';
import { can } from '@/lib/permissions.ts';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { usePatients, type Patient } from '../api/patients.ts';
import { birthDateWithAge } from '../birth-date.ts';
import { patientListName } from '../patient-name.ts';
import { displayPhone } from '../phone-display.ts';

/** What the address keeps. Never the search text: it is personal data. */
export interface PatientsSearch {
  page?: number | undefined;
  pageSize?: number | undefined;
  includeArchived?: true | undefined;
}

/** The API refuses a longer `q`. */
const MAX_SEARCH_LENGTH = 100;

export function PatientsPage({
  search,
  onSearchChange,
}: {
  search: PatientsSearch;
  onSearchChange: (next: PatientsSearch) => void;
}) {
  const { t } = useLingui();
  usePageTitle(t`Patients`);
  const timeZone = useClinicTimeZone();
  const today = timeZone ? todayInZone({ timeZone }) : undefined;
  // The search text stays in memory: it is lost on reload, on purpose.
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const { page, pageSize, includeArchived } = search;
  const list = usePatients({ q, includeArchived, page, pageSize });
  const session = useSession();
  const mayManage = session.status === 'signed-in' && can(session.permissions, 'patients.manage');
  const register = mayManage && (
    <AppButtonLink href="/patients/new">{t`Register a patient`}</AppButtonLink>
  );

  // A new search or filter starts again at page 1.
  const withoutPage = (next: PatientsSearch): PatientsSearch => ({
    ...(next.pageSize !== undefined && { pageSize: next.pageSize }),
    ...(next.includeArchived && { includeArchived: true }),
  });

  const columns = [
    {
      id: 'name',
      header: t`Name`,
      cell: (row: Patient) => (
        <AppLink href={`/patients/${row.id}`}>{patientListName(row)}</AppLink>
      ),
    },
    { id: 'number', header: t`Patient number`, cell: (row: Patient) => row.patientNumber },
    {
      id: 'born',
      header: t`Birth date`,
      cell: (row: Patient) =>
        row.birthDate === null
          ? t`Not recorded`
          : birthDateWithAge({ birthDate: row.birthDate, today }),
    },
    {
      id: 'phone',
      header: t`Phone`,
      cell: (row: Patient) => (row.phone ? displayPhone(row.phone) : ''),
    },
    ...(includeArchived
      ? [
          {
            id: 'status',
            header: t`Status`,
            cell: (row: Patient) =>
              row.archivedAt ? (
                <StatusPill status="neutral">{t`Archived`}</StatusPill>
              ) : (
                <StatusPill status="success">{t`Active`}</StatusPill>
              ),
          },
        ]
      : []),
  ];

  const empty =
    q === '' ? (
      <EmptyState title={t`No patients yet`} action={register} />
    ) : (
      <EmptyState
        title={t`No patient matches your search`}
        description={t`Check the spelling, or try the patient number or phone number.`}
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setText('');
                setQ('');
                onSearchChange(withoutPage(search));
              }}
            >
              {t`Clear search`}
            </Button>
            {register}
          </div>
        }
      />
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1>{t`Patients`}</h1>
        {register}
      </div>

      <div className="flex flex-col gap-3">
        <SearchField
          label={t`Search by name, patient number or phone`}
          value={text}
          onChange={setText}
          onSearch={(value) => {
            setQ(value.trim().slice(0, MAX_SEARCH_LENGTH));
            onSearchChange(withoutPage(search));
          }}
          {...(list.data && {
            resultSummary: plural(list.data.meta.totalItems, {
              one: '# patient found',
              other: '# patients found',
            }),
          })}
        />
        <Checkbox
          label={t`Show archived`}
          checked={includeArchived === true}
          onCheckedChange={(checked) => {
            onSearchChange(
              withoutPage({ ...search, includeArchived: checked === true ? true : undefined }),
            );
          }}
        />
      </div>

      <DataTable
        caption={t`Patients`}
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(row) => row.id}
        loading={list.isPending ? t`Loading patients…` : undefined}
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
