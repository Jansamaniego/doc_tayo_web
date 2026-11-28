import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError } from '@/api/errors.ts';
import { Alert } from '@/design-system/components/alert.tsx';
import { StatusPill } from '@/design-system/components/badge.tsx';
import { Button } from '@/design-system/components/button.tsx';
import { DataTable } from '@/design-system/components/data-table.tsx';
import { EmptyState } from '@/design-system/components/state-views.tsx';
import { patientFullName } from '@/features/patients/patient-name.ts';
import { AppLink } from '@/lib/app-link.tsx';

import { useDayAppointments, type Appointment, type DayFilters } from '../api/appointments.ts';
import { appointmentTime } from '../appointment-time.ts';
import { PatientName, PractitionerName } from '../AppointmentPeople.tsx';
import { StatusLabel } from '../StatusLabel.tsx';

/** The appointments of the chosen day, as filtered. */
export function DayList({
  filters,
  timeZone,
  filterNames,
  onShowAll,
}: {
  filters: DayFilters;
  timeZone: string;
  /** What narrows the list, for an empty one; none when everything is shown. */
  filterNames: string[];
  onShowAll: () => void;
}) {
  const { t } = useLingui();
  const day = useDayAppointments(filters);

  const columns = [
    {
      id: 'time',
      header: t`Time`,
      cell: (row: Appointment) => {
        const { shown, spoken } = appointmentTime({ appointment: row, timeZone });
        return (
          <AppLink href={`/appointments/${row.id}`}>
            <span aria-hidden="true">{shown}</span>
            <span className="sr-only">{`${spoken}, ${patientFullName(row.patient)}`}</span>
          </AppLink>
        );
      },
    },
    {
      id: 'patient',
      header: t`Patient`,
      cell: (row: Appointment) => (
        <span className="flex flex-col">
          <PatientName patient={row.patient} />
          <span className="text-small text-ink-muted">{row.patient.patientNumber}</span>
        </span>
      ),
    },
    {
      id: 'practitioner',
      header: t`Practitioner`,
      cell: (row: Appointment) => <PractitionerName practitioner={row.practitioner} />,
    },
    {
      id: 'service',
      header: t`Service`,
      cell: (row: Appointment) => row.service?.name ?? t`No service`,
    },
    {
      id: 'reason',
      header: t`Purpose of visit`,
      cell: (row: Appointment) => row.reason ?? t`Not given`,
    },
    {
      id: 'status',
      header: t`Status`,
      cell: (row: Appointment) => (
        <span className="flex flex-wrap gap-2">
          <StatusLabel status={row.status} />
          {row.kind === 'walk_in' && <StatusPill status="neutral">{t`Walk-in`}</StatusPill>}
        </span>
      ),
    },
  ];

  const filterList = filterNames.join(', ');
  const empty =
    filterNames.length === 0 ? (
      <EmptyState title={t`No appointments on this day`} />
    ) : (
      <EmptyState
        title={t`No appointments on this day`}
        description={t`Showing: ${filterList}.`}
        action={
          <Button variant="secondary" onClick={onShowAll}>
            {t`Show all`}
          </Button>
        }
      />
    );
  const retry = (): void => {
    void day.refetch();
  };
  const failure = day.isError ? asApiError(day.error) : undefined;

  return (
    <div className="flex flex-col gap-3">
      <p role="status" className="sr-only">
        {day.data &&
          plural(day.data.length, {
            one: '# appointment found',
            other: '# appointments found',
          })}
      </p>
      {/* A list already read stays on screen: a failed refresh must not blank the front desk. */}
      {failure && day.data && (
        <Alert
          variant="warning"
          action={
            <Button variant="secondary" onClick={retry}>
              {t`Try again`}
            </Button>
          }
        >
          {t`We could not refresh this list. It may be out of date.`}
        </Alert>
      )}
      <DataTable
        caption={t`Appointments`}
        columns={columns}
        rows={day.data ?? []}
        rowKey={(row) => row.id}
        loading={day.isPending ? t`Loading appointments…` : undefined}
        empty={empty}
        error={
          failure && !day.data
            ? { message: messageForError(failure), requestId: failure.requestId, onRetry: retry }
            : undefined
        }
      />
    </div>
  );
}
