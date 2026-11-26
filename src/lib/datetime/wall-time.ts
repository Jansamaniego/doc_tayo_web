import { t } from '@lingui/core/macro';

// A wall-clock time is what a clock on a branch's wall says: "09:00", no date and no time zone, as the
// weekly schedules store it. It is never converted. (Instants go through ./index.ts.)

/** 2024-01-01 was a Monday: a fixed week to take weekday names from. */
const A_MONDAY = Date.UTC(2024, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

/** `09:05` → "9:05 AM"; `24:00`, the end of a day, → "midnight". */
export function formatWallTime(value: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (value === '24:00') return t`midnight`;
  if (!match) throw new RangeError('Expected a time as HH:mm.');
  const [hour, minute] = [Number(match[1]), Number(match[2])] as [number, number];
  const suffix = hour < 12 ? 'AM' : 'PM';
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

/** The name of an ISO weekday: 1 = Monday … 7 = Sunday, as the API counts. */
export function weekdayName(weekday: number): string {
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    throw new RangeError('Expected a weekday from 1 (Monday) to 7 (Sunday).');
  }
  return new Intl.DateTimeFormat('en-PH', { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(A_MONDAY + (weekday - 1) * DAY_MS),
  );
}
