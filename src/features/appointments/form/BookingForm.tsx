import { useLingui } from '@lingui/react/macro';
import { useRef, useState } from 'react';

import { messageForError, messageForFieldError } from '@/api/error-messages.ts';
import { asApiError, type ApiError } from '@/api/errors.ts';
import { createIdempotentAction } from '@/api/idempotency.ts';
import { sessionStore, useActiveTenantId } from '@/api/session/session-store.ts';
import { Alert } from '@/design-system/components/alert.tsx';
import { Button } from '@/design-system/components/button.tsx';
import { Checkbox, RadioGroup } from '@/design-system/components/choice-fields.tsx';
import { DateField, TimeField } from '@/design-system/components/date-fields.tsx';
import { SelectField } from '@/design-system/components/select-fields.tsx';
import { ErrorState } from '@/design-system/components/state-views.tsx';
import { TextField } from '@/design-system/components/text-fields.tsx';
import { notify } from '@/design-system/components/toast.tsx';
import {
  FormErrorSummary,
  type SummaryEntry,
} from '@/design-system/patterns/form-error-summary.tsx';
import { branchTimeZone, type Branch } from '@/features/clinic/api/branches.ts';
import { usePatientOfForm } from '@/features/patients/api/patients.ts';
import { patientFullName } from '@/features/patients/patient-name.ts';
import { useDirectory } from '@/features/practitioners/api/directory.ts';
import { useServices } from '@/features/services/api/services.ts';
import { AppButtonLink, AppLink } from '@/lib/app-link.tsx';
import { formatTime, todayInZone } from '@/lib/datetime/index.ts';
import { addDays } from '@/lib/datetime/plain-date.ts';
import { formatDuration } from '@/lib/duration.ts';
import { LeaveGuard } from '@/lib/leave-guard.tsx';
import { SaveFailure, useKeptForClinic, type OpenedClinic } from '@/lib/opened-clinic.tsx';
import { can } from '@/lib/permissions.ts';
import { readPreference } from '@/lib/preferences.ts';

import { useBookAppointment, type Appointment } from '../api/appointments.ts';
import {
  bookingEnd,
  bookingLength,
  bookingProblems,
  DEFAULT_MINUTES,
  MAX_DAYS_AHEAD,
  toBookRequest,
  type BookingField,
  type BookingValues,
} from './appointment-form-values.ts';
import type { BookingPrefill } from './BookAppointmentPage.tsx';
import { FreeHours } from './FreeHours.tsx';
import { PatientPicker, usePatientLabel, type ChosenPatient } from './PatientPicker.tsx';
import { isPractitioner, PractitionerPicker } from './PractitionerPicker.tsx';

/** What the person has entered; what is undefined follows a default until they choose. */
type Draft = Omit<BookingValues, 'branchId' | 'patientId' | 'date'> & {
  /** '' once a chosen branch was refused. */
  branchId: string | undefined;
  date: string | undefined;
};

type Errors = Partial<Record<string, string>>;

export function BookingForm({
  prefill,
  onBooked,
  clinic,
  permissions,
  branches,
  clinicZone,
  onBranchRefused,
}: {
  prefill: BookingPrefill;
  onBooked: (appointment: Appointment) => void;
  clinic: OpenedClinic;
  permissions: string[];
  branches: Branch[];
  clinicZone: string;
  onBranchRefused: () => void;
}) {
  const { t } = useLingui();
  const { tenantId } = clinic;
  const book = useBookAppointment();
  const [draft, setDraft] = useState<Draft>(() => ({
    kind: prefill.kind ?? 'scheduled',
    branchId: undefined,
    practitionerId: '',
    serviceId: '',
    date: undefined,
    start: '',
    end: undefined,
    nextDay: false,
    reason: '',
  }));
  const [picked, setPicked] = useState<ChosenPatient>();
  const [errors, setErrors] = useState<Errors>({});
  const [summary, setSummary] = useState<SummaryEntry[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<ApiError>();
  const [sending, setSending] = useState(false);
  const touched = useRef(false);
  const booked = useRef(false);
  /** One idempotency key per booking: kept to retry it, replaced once what is sent changes. */
  const action = useRef<{ sent: string; run: ReturnType<typeof createIdempotentAction> }>(null);

  const update = (changes: Partial<Draft>): void => {
    touched.current = true;
    setDraft((current) => ({ ...current, ...changes }));
  };

  const defaultBranch =
    branches.find((item) => item.id === prefill.branch) ??
    branches.find((item) => item.id === readPreference('lastBranchId')) ??
    branches[0];
  const branch =
    draft.branchId === undefined
      ? defaultBranch
      : branches.find((item) => item.id === draft.branchId);
  const timeZone = branch ? branchTimeZone({ branch, clinicZone }) : clinicZone;
  const today = todayInZone({ timeZone });
  const date = draft.date ?? (prefill.date && prefill.date >= today ? prefill.date : today);

  const prefilled = usePatientOfForm({ patientId: prefill.patient ?? '', tenantId });
  const label = usePatientLabel();
  const patient =
    picked ??
    (prefilled.data ? { id: prefilled.data.id, label: label(prefilled.data) } : undefined);

  const everyone = useDirectory({ practitionersOnly: true });
  const here = useDirectory({
    practitionersOnly: true,
    branchId: branch?.id,
    enabled: branch !== undefined,
  });
  const serviceList = useServices({ pageSize: 100 });
  const practitioners = useKeptForClinic({ data: everyone.data, tenantId }) ?? [];
  const atBranch = useKeptForClinic({ data: here.data, tenantId, key: branch?.id ?? '' }) ?? [];
  const services = useKeptForClinic({ data: serviceList.data?.data, tenantId }) ?? [];
  const service = services.find((item) => item.id === draft.serviceId);
  const profileId = practitioners
    .filter(isPractitioner)
    .find((entry) => entry.membershipId === draft.practitionerId)?.practitioner.profileId;

  const minutes = service?.defaultDurationMinutes ?? DEFAULT_MINUTES;
  const values: BookingValues = {
    ...draft,
    branchId: branch?.id ?? '',
    patientId: patient?.id ?? '',
    date,
  };
  const ending = bookingEnd({ ...values, minutes });
  const length = bookingLength({ values, minutes, timeZone });
  const lengthText = length === undefined ? undefined : formatDuration(length);
  const scheduled = draft.kind === 'scheduled';

  const labels: Record<BookingField, string> = {
    branchId: t`Branch`,
    patientId: t`Patient`,
    practitionerMembershipId: t`Practitioner`,
    serviceId: t`Service`,
    date: t`Date`,
    startsAt: t`Start`,
    endsAt: t`End`,
    reason: t`Purpose of visit`,
  };

  function show(problems: SummaryEntry[]): void {
    setErrors(Object.fromEntries(problems.map(({ name, message }) => [name, message])));
    setSummary(problems);
    setAttempt((count) => count + 1);
  }

  /** Puts the API's field complaints on the fields, and replaces what it refused. */
  function showApiProblems(error: ApiError): void {
    show(
      error.details.map((detail) => {
        const known = Object.hasOwn(labels, detail.field);
        let message = messageForFieldError(detail);
        if (detail.field === 'branchId') {
          message = t`This branch is no longer active.`;
          update({ branchId: '' });
          onBranchRefused();
        } else if (detail.field === 'serviceId') {
          message = t`This service is no longer offered.`;
          update({ serviceId: '' });
          void serviceList.refetch();
        }
        return {
          name: detail.field,
          label: known ? labels[detail.field as BookingField] : t`Something else`,
          message,
        };
      }),
    );
  }

  function refused(error: ApiError): void {
    if (error.code === 'VALIDATION_FAILED' && error.details.length > 0) {
      showApiProblems(error);
      return;
    }
    if (error.code === 'NOT_A_PRACTITIONER') {
      const message = t`This practitioner can no longer be booked.`;
      update({ practitionerId: '' });
      show([{ name: 'practitionerMembershipId', label: labels.practitionerMembershipId, message }]);
      void everyone.refetch();
      void here.refetch();
      return;
    }
    if (error.code === 'NOT_FOUND') {
      onBranchRefused();
      void everyone.refetch();
      void here.refetch();
      void serviceList.refetch();
    }
    setFailure(error);
  }

  async function send(): Promise<void> {
    if (sending) return;
    setFailure(undefined);
    setErrors({});
    setSummary([]);
    const problems = bookingProblems({ values, minutes, timeZone, now: new Date() });
    if (problems.length > 0) {
      show(problems.map(({ field, message }) => ({ name: field, label: labels[field], message })));
      return;
    }
    const body = toBookRequest({ values, minutes, timeZone });
    const sent = JSON.stringify(body);
    if (action.current?.sent !== sent) action.current = { sent, run: createIdempotentAction() };
    setSending(true);
    try {
      const appointment = await action.current.run((idempotencyKey) =>
        book.mutateAsync({ body, tenantId, idempotencyKey }),
      );
      booked.current = true;
      const name = patientFullName(appointment.patient);
      const time = formatTime({ iso: appointment.startsAt, timeZone });
      notify.success(
        appointment.kind === 'walk_in'
          ? t`${name} is checked in.`
          : t`Appointment booked for ${name} at ${time}.`,
      );
      onBooked(appointment);
    } catch (error) {
      refused(asApiError(error));
    } finally {
      setSending(false);
    }
  }

  // In another clinic, switched to in another tab, the form's choices mean nothing: nothing more is
  // read for them, and what fails there is not the form's business.
  const isOpen = useActiveTenantId() === tenantId;
  const readFailure = isOpen
    ? [everyone, here, serviceList].find((query) => query.isError)
    : undefined;
  const back = `/appointments${branch ? `?branch=${branch.id}${scheduled && date ? `&date=${date}` : ''}` : ''}`;

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <FormErrorSummary errors={summary} focusKey={attempt} />
      <RadioGroup
        legend={t`Kind of visit`}
        options={[
          { value: 'scheduled', label: t`Booked time` },
          { value: 'walk_in', label: t`Walk-in (here now)` },
        ]}
        value={draft.kind}
        onChange={(kind) => {
          update({ kind: kind === 'walk_in' ? 'walk_in' : 'scheduled' });
        }}
      />
      <SelectField
        label={labels.branchId}
        name="branchId"
        error={errors.branchId}
        value={branch?.id ?? ''}
        options={branches.map((item) => ({ value: item.id, label: item.name }))}
        {...(!branch && { emptyOption: t`Choose a branch` })}
        onChange={(branchId) => {
          update({ branchId });
        }}
      />
      <PatientPicker
        tenantId={tenantId}
        chosen={patient}
        onChoose={(next) => {
          touched.current = true;
          setPicked(next);
        }}
        error={errors.patientId}
        mayRegister={can(permissions, 'patients.manage')}
      />
      {readFailure?.isError && (
        <ErrorState
          message={messageForError(asApiError(readFailure.error))}
          requestId={asApiError(readFailure.error).requestId}
          onRetry={() => {
            void readFailure.refetch();
          }}
        />
      )}
      <PractitionerPicker
        everyone={practitioners}
        atBranch={new Set(atBranch.map((entry) => entry.membershipId))}
        branchName={branch?.name}
        value={draft.practitionerId}
        onChange={(practitionerId) => {
          update({ practitionerId });
        }}
        error={errors.practitionerMembershipId}
      />
      <SelectField
        label={labels.serviceId}
        name="serviceId"
        error={errors.serviceId}
        value={draft.serviceId}
        options={[
          { value: '', label: t`No service` },
          ...services.map((item) => ({ value: item.id, label: item.name })),
        ]}
        onChange={(serviceId) => {
          update({ serviceId });
        }}
      />
      {scheduled && (
        <>
          <DateField
            legend={labels.date}
            name="date"
            error={errors.date}
            value={date}
            min={today}
            max={addDays({ date: today, days: MAX_DAYS_AHEAD })}
            onChange={(next) => {
              update({ date: next });
            }}
          />
          {branch && timeZone !== clinicZone && <p>{t`Times are in ${timeZone}.`}</p>}
          <TimeField
            legend={labels.startsAt}
            name="startsAt"
            error={errors.startsAt}
            value={draft.start}
            onChange={(start) => {
              update({ start });
            }}
          />
          <TimeField
            legend={labels.endsAt}
            name="endsAt"
            error={errors.endsAt}
            value={ending.end}
            onChange={(end) => {
              update({ end, nextDay: ending.nextDay });
            }}
          />
          {ending.end !== '' && draft.start !== '' && ending.end < draft.start && (
            <Checkbox
              label={t`Ends the next day`}
              checked={ending.nextDay}
              onCheckedChange={(checked) => {
                update({ end: ending.end, nextDay: checked === true });
              }}
            />
          )}
          {lengthText !== undefined && <p>{t`Length: ${lengthText}`}</p>}
          {isOpen && profileId && branch && date !== '' && (
            <FreeHours
              profileId={profileId}
              branchId={branch.id}
              date={date}
              onPick={(start) => {
                update({ start });
              }}
            />
          )}
        </>
      )}
      <TextField
        label={labels.reason}
        name="reason"
        optional
        hint={t`For example follow-up or medical certificate. Not symptoms: every staff member can read this.`}
        error={errors.reason}
        value={draft.reason}
        autoComplete="off"
        onChange={(event) => {
          update({ reason: event.target.value });
        }}
      />
      {failure?.code === 'PATIENT_ARCHIVED' && patient ? (
        <Alert variant="danger">
          <p>{t`This patient record is archived.`}</p>
          <AppLink href={`/patients/${patient.id}`} standalone>
            {t`Open the patient record`}
          </AppLink>
        </Alert>
      ) : failure?.code === 'NOT_FOUND' ? (
        <Alert variant="danger">{t`Something you chose is no longer available.`}</Alert>
      ) : (
        failure && <SaveFailure error={failure} openedIn={clinic} />
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" loading={sending} loadingText={t`Saving…`}>
          {scheduled ? t`Book appointment` : t`Check in walk-in`}
        </Button>
        <AppButtonLink href={back} variant="secondary">
          {t`Cancel`}
        </AppButtonLink>
      </div>
      <LeaveGuard
        shouldBlock={() =>
          touched.current &&
          !booked.current &&
          // A session that ended must always reach the sign-in page.
          sessionStore.get().status === 'signed-in'
        }
      />
    </form>
  );
}
