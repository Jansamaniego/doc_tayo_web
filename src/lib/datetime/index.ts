import { TZDate } from '@date-fns/tz';

// The ONLY module that converts between UTC (the API) and clinic time (the screen).
// The computer's own time zone must never matter: specs run in New York and in Manila.

export interface ClinicDateTime {
  /** Calendar date, `YYYY-MM-DD`. */
  date: string;
  /** Wall-clock time, 24-hour `HH:mm`. */
  time: string;
}

function assertTimeZone(timeZone: string): void {
  if (!timeZone) throw new RangeError('A time zone is required.');
  // Throws RangeError for an unknown zone.
  new Intl.DateTimeFormat('en-US', { timeZone });
}

const pad = (value: number, length = 2): string => String(value).padStart(length, '0');

/** UTC timestamp from the API -> plain date and time as seen in the clinic's zone. */
export function toClinicDateTime({
  iso,
  timeZone,
}: {
  iso: string;
  timeZone: string;
}): ClinicDateTime {
  assertTimeZone(timeZone);
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) throw new RangeError('Invalid timestamp.');
  const zoned = new TZDate(instant.getTime(), timeZone);
  return {
    date: `${pad(zoned.getFullYear(), 4)}-${pad(zoned.getMonth() + 1)}-${pad(zoned.getDate())}`,
    time: `${pad(zoned.getHours())}:${pad(zoned.getMinutes())}`,
  };
}

/** Today's calendar date (`YYYY-MM-DD`) in the clinic's zone, whatever the computer thinks. */
export function todayInZone({
  timeZone,
  now = new Date(),
}: {
  timeZone: string;
  now?: Date;
}): string {
  return toClinicDateTime({ iso: now.toISOString(), timeZone }).date;
}

/** What the user picked in the clinic's zone -> an ISO UTC timestamp for the API. */
export function fromClinicDateTime({
  date,
  time,
  timeZone,
}: ClinicDateTime & { timeZone: string }): string {
  assertTimeZone(timeZone);
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeParts = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateParts || !timeParts)
    throw new RangeError('Expected a date as YYYY-MM-DD and a time as HH:mm.');
  const [year, month, day] = dateParts.slice(1).map(Number) as [number, number, number];
  const [hour, minute] = timeParts.slice(1).map(Number) as [number, number];
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    throw new RangeError('Date or time out of range.');
  }
  return new Date(
    new TZDate(year, month - 1, day, hour, minute, 0, timeZone).getTime(),
  ).toISOString();
}

const LOCALE = 'en-PH';

export type DateStyle = 'medium' | 'weekday';

/** `Nov 21, 2026` or `Sat, Nov 21, 2026`: month names, never an ambiguous `11/12/2026`. */
export function formatDate({
  iso,
  timeZone,
  style,
}: {
  iso: string;
  timeZone: string;
  style: DateStyle;
}): string {
  assertTimeZone(timeZone);
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(style === 'weekday' && { weekday: 'short' }),
  }).format(new Date(iso));
}

/** `2:30 PM`: 12-hour clock, upper-case AM/PM and a plain space whatever the browser's ICU says. */
export function formatTime({ iso, timeZone }: { iso: string; timeZone: string }): string {
  assertTimeZone(timeZone);
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(new Date(iso))
    .replace(/[\u202f\u00a0]/g, ' ')
    .replace(/\b(am|pm)\b/i, (suffix) => suffix.toUpperCase());
}

export interface TimeZoneOption {
  value: string;
  label: string;
}

let cachedTimeZoneOptions: TimeZoneOption[] | undefined;

/**
 * Every IANA zone the browser knows, as picker options. Built once: the list has about 400 entries
 * and every form that offers a zone (new clinic, clinic profile, branch) uses this one.
 */
export function timeZoneOptions(): TimeZoneOption[] {
  cachedTimeZoneOptions ??= [...new Set([...Intl.supportedValuesOf('timeZone'), 'UTC'])].map(
    (zone) => ({ value: zone, label: zone }),
  );
  return cachedTimeZoneOptions;
}
