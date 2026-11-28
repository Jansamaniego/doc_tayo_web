import { useLingui } from '@lingui/react/macro';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError } from '@/api/errors.ts';
import { StatusPill } from '@/design-system/components/badge.tsx';
import { ErrorState, LoadingState } from '@/design-system/components/state-views.tsx';
import { DetailRow } from '@/design-system/patterns/detail-row.tsx';
import { useBranch, useBranchTimeZone, type Branch } from '@/features/clinic/api/branches.ts';
import { useClinicProfile } from '@/features/clinic/api/tenant.ts';
import { formatDate, formatTime, isSameDayInZone, toClinicDateTime } from '@/lib/datetime/index.ts';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { useAppointment, type Appointment } from '../api/appointments.ts';
import { PatientName, PractitionerName } from '../AppointmentPeople.tsx';
import { StatusLabel } from '../StatusLabel.tsx';
import {
  AppointmentNotFound,
  BackToAppointments,
  isAppointmentNotFound,
} from './AppointmentNotFound.tsx';

function Details({
  appointment,
  branch,
  timeZone,
  clinicZone,
}: {
  appointment: Appointment;
  branch: Branch;
  timeZone: string;
  clinicZone: string;
}) {
  const { t } = useLingui();
  const { kind, status, startsAt, endsAt, checkedInAt, cancelledAt, cancelReason } = appointment;
  const time = (iso: string): string => formatTime({ iso, timeZone });
  const moment = (iso: string): string => {
    const day = formatDate({ iso, timeZone, style: 'medium' });
    const at = time(iso);
    return t`${day} at ${at}`;
  };
  const endTime = time(endsAt);
  const end = isSameDayInZone({ first: startsAt, second: endsAt, timeZone })
    ? endTime
    : t`${endTime} (next day)`;
  const cancelledOn = cancelledAt ? moment(cancelledAt) : undefined;
  const day = toClinicDateTime({ iso: startsAt, timeZone }).date;

  return (
    <>
      <BackToAppointments href={`/appointments?branch=${branch.id}&date=${day}`} />
      <h1>{t`Appointment`}</h1>
      {cancelledOn && (
        <p className="font-semibold">{t`Cancelled on ${cancelledOn}: ${cancelReason ?? ''}`}</p>
      )}
      {timeZone !== clinicZone && <p>{t`Times are in ${timeZone}.`}</p>}
      <dl className="flex flex-col gap-3">
        <DetailRow label={t`Status`}>
          <StatusLabel status={status} />
        </DetailRow>
        <DetailRow label={t`Kind`}>
          {kind === 'walk_in' ? (
            <StatusPill status="neutral">{t`Walk-in`}</StatusPill>
          ) : (
            t`Booked time`
          )}
        </DetailRow>
        <DetailRow label={t`Date`}>
          {formatDate({ iso: startsAt, timeZone, style: 'weekday' })}
        </DetailRow>
        <DetailRow label={t`Starts`}>{time(startsAt)}</DetailRow>
        {/* A walk-in's end is only an estimate (docs/appointments-integration.md). */}
        <DetailRow label={t`Ends`}>{kind === 'walk_in' ? t`About ${end}` : end}</DetailRow>
        <DetailRow label={t`Branch`}>{branch.name}</DetailRow>
        <DetailRow label={t`Patient`}>
          {appointment.patient.patientNumber}
          {' · '}
          <PatientName patient={appointment.patient} />
        </DetailRow>
        <DetailRow label={t`Practitioner`}>
          <PractitionerName practitioner={appointment.practitioner} />
        </DetailRow>
        <DetailRow label={t`Service`}>{appointment.service?.name ?? t`No service`}</DetailRow>
        <DetailRow label={t`Purpose of visit`}>{appointment.reason ?? t`Not given`}</DetailRow>
        <DetailRow label={t`Checked in`}>
          {checkedInAt ? moment(checkedInAt) : t`Not checked in`}
        </DetailRow>
      </dl>
    </>
  );
}

/** Waits for the branch: no time is shown until the zone it is in is known. */
function InBranch({ appointment }: { appointment: Appointment }) {
  const { t } = useLingui();
  const branch = useBranch(appointment.branchId);
  const clinic = useClinicProfile();
  const timeZone = useBranchTimeZone(appointment.branchId);
  if (branch.data && clinic.data && timeZone) {
    return (
      <Details
        appointment={appointment}
        branch={branch.data}
        timeZone={timeZone}
        clinicZone={clinic.data.timezone}
      />
    );
  }
  const failed = branch.isError ? branch : clinic.isError ? clinic : undefined;
  if (!failed) return <LoadingState label={t`Loading the appointment…`} />;
  const error = asApiError(failed.error);
  return (
    <ErrorState
      message={messageForError(error)}
      requestId={error.requestId}
      onRetry={() => {
        void failed.refetch();
      }}
    />
  );
}

export function AppointmentPage({ appointmentId }: { appointmentId: string }) {
  const { t } = useLingui();
  // Never a patient's name: tab titles stay in the history of shared computers (Q25).
  usePageTitle(t`Appointment`);
  const appointment = useAppointment(appointmentId);

  if (appointment.isPending) return <LoadingState label={t`Loading the appointment…`} />;
  if (!appointment.data) {
    const error = asApiError(appointment.error);
    if (isAppointmentNotFound(error)) return <AppointmentNotFound />;
    return (
      <ErrorState
        message={messageForError(error)}
        requestId={error.requestId}
        onRetry={() => {
          void appointment.refetch();
        }}
      />
    );
  }
  return (
    <div className="flex max-w-reading flex-col gap-4">
      <InBranch appointment={appointment.data} />
    </div>
  );
}
