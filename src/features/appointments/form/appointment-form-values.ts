import { t } from '@lingui/core/macro';

import { fromClinicDateTime, todayInZone } from '@/lib/datetime/index.ts';
import { addDays } from '@/lib/datetime/plain-date.ts';

import type { Booking } from '../api/appointments.ts';

/** What the booking form holds. */
export interface BookingValues {
  kind: Booking['kind'];
  branchId: string;
  patientId: string;
  /** The practitioner's membership id: what the API books. */
  practitionerId: string;
  /** '' for no service. */
  serviceId: string;
  /** `YYYY-MM-DD` in the branch's zone, or '' while incomplete. */
  date: string;
  /** `HH:mm`, or '' while incomplete. */
  start: string;
  /** Undefined until it is typed: it then follows the service's usual length. */
  end: string | undefined;
  /** A typed end before the start is meant for the following day. */
  nextDay: boolean;
  reason: string;
}

/** The length proposed without a service (docs/appointments-integration.md). */
export const DEFAULT_MINUTES = 30;
export const MAX_REASON_LENGTH = 200;
const MAX_MINUTES = 8 * 60;
export const MAX_DAYS_AHEAD = 366;

const MINUTES_A_DAY = 24 * 60;
const pad = (value: number): string => String(value).padStart(2, '0');

/** The end as the form has it: typed, or the start plus the usual length. */
export function bookingEnd({
  start,
  end,
  nextDay,
  minutes,
}: Pick<BookingValues, 'start' | 'end' | 'nextDay'> & { minutes: number }): {
  end: string;
  nextDay: boolean;
} {
  if (end !== undefined) {
    return { end, nextDay: nextDay && end !== '' && start !== '' && end < start };
  }
  if (start === '') return { end: '', nextDay: false };
  const [hour, minute] = start.split(':').map(Number) as [number, number];
  const total = hour * 60 + minute + minutes;
  const wrapped = total % MINUTES_A_DAY;
  return {
    end: `${pad(Math.floor(wrapped / 60))}:${pad(wrapped % 60)}`,
    nextDay: total >= MINUTES_A_DAY,
  };
}

interface Timed {
  values: BookingValues;
  /** The chosen service's usual length, or `DEFAULT_MINUTES`. */
  minutes: number;
  timeZone: string;
}

/** The start and end as instants, each undefined while it cannot be known. */
function instants({ values, minutes, timeZone }: Timed) {
  const { date, start } = values;
  const { end, nextDay } = bookingEnd({ ...values, minutes });
  const at = ({ day, time }: { day: string; time: string }): string | undefined =>
    day !== '' && time !== '' ? fromClinicDateTime({ date: day, time, timeZone }) : undefined;
  return {
    startsAt: at({ day: date, time: start }),
    endsAt: at({ day: date !== '' && nextDay ? addDays({ date, days: 1 }) : date, time: end }),
    end,
  };
}

const minutesBetween = (first: string, second: string): number =>
  (Date.parse(second) - Date.parse(first)) / 60_000;

/** How long the appointment would be, in minutes, or undefined while that makes no sense. */
export function bookingLength(timed: Timed): number | undefined {
  const { startsAt, endsAt } = instants(timed);
  if (!startsAt || !endsAt) return undefined;
  const length = minutesBetween(startsAt, endsAt);
  return length > 0 ? length : undefined;
}

export type BookingField =
  | 'branchId'
  | 'patientId'
  | 'practitionerMembershipId'
  | 'serviceId'
  | 'date'
  | 'startsAt'
  | 'endsAt'
  | 'reason';

export interface BookingProblem {
  /** The API's name for the field, so its complaints and ours land in the same place. */
  field: BookingField;
  message: string;
}

function timeProblems(timed: Timed & { now: Date }): BookingProblem[] {
  const { values, now, timeZone } = timed;
  const { startsAt, endsAt, end } = instants(timed);
  const problems: BookingProblem[] = [];
  const add = (field: BookingField, message: string): void => {
    problems.push({ field, message });
  };
  if (values.date === '') add('date', t`Enter the date.`);
  if (values.start === '') add('startsAt', t`Enter the start time.`);
  if (end === '') add('endsAt', t`Enter the end time.`);
  if (!startsAt || !endsAt) return problems;
  const length = minutesBetween(startsAt, endsAt);
  const latest = addDays({ date: todayInZone({ timeZone, now }), days: MAX_DAYS_AHEAD });
  if (values.date > latest || Date.parse(startsAt) - now.getTime() > MAX_DAYS_AHEAD * 86_400_000) {
    add('startsAt', t`Book at most ${MAX_DAYS_AHEAD} days ahead.`);
  }
  if (length <= 0) add('endsAt', t`The end must be after the start.`);
  else if (length > MAX_MINUTES) add('endsAt', t`An appointment can be at most 8 hours long.`);
  else if (Date.parse(endsAt) <= now.getTime()) add('endsAt', t`This time has already passed.`);
  return problems;
}

/** What the API would refuse, found before sending, in the order of the form. */
export function bookingProblems(timed: Timed & { now: Date }): BookingProblem[] {
  const { values } = timed;
  const problems: BookingProblem[] = [];
  if (values.branchId === '') problems.push({ field: 'branchId', message: t`Choose the branch.` });
  if (values.patientId === '') {
    problems.push({ field: 'patientId', message: t`Choose the patient.` });
  }
  if (values.practitionerId === '') {
    problems.push({ field: 'practitionerMembershipId', message: t`Choose the practitioner.` });
  }
  if (values.kind === 'scheduled') problems.push(...timeProblems(timed));
  if (values.reason.trim().length > MAX_REASON_LENGTH) {
    problems.push({
      field: 'reason',
      message: t`This can have at most ${MAX_REASON_LENGTH} characters.`,
    });
  }
  return problems;
}

/** The request for a form without problems. A walk-in sends no times: it starts now. */
export function toBookRequest(timed: Timed): Booking {
  const { values } = timed;
  const { startsAt, endsAt } = values.kind === 'scheduled' ? instants(timed) : {};
  return {
    kind: values.kind,
    branchId: values.branchId,
    patientId: values.patientId,
    practitionerMembershipId: values.practitionerId,
    serviceId: values.serviceId || null,
    ...(startsAt && endsAt && { startsAt, endsAt }),
    reason: values.reason.trim() || null,
  };
}
