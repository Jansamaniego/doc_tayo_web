import { t } from '@lingui/core/macro';

import { formatTime, isSameDayInZone } from '@/lib/datetime/index.ts';

import type { Appointment } from './api/appointments.ts';

/** When an appointment is, in the branch's zone: as shown, and in words for a screen reader. */
export function appointmentTime({
  appointment: { kind, startsAt, endsAt },
  timeZone,
}: {
  appointment: Pick<Appointment, 'kind' | 'startsAt' | 'endsAt'>;
  timeZone: string;
}): { shown: string; spoken: string } {
  const start = formatTime({ iso: startsAt, timeZone });
  // A walk-in's end is only an estimate (docs/appointments-integration.md).
  if (kind === 'walk_in') {
    const arrived = t`Arrived ${start}`;
    return { shown: arrived, spoken: arrived };
  }
  const end = formatTime({ iso: endsAt, timeZone });
  if (isSameDayInZone({ first: startsAt, second: endsAt, timeZone })) {
    return { shown: `${start} – ${end}`, spoken: t`${start} to ${end}` };
  }
  return { shown: t`${start} – ${end} (next day)`, spoken: t`${start} to ${end} the next day` };
}
