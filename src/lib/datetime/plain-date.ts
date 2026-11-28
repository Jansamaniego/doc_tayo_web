// A plain date is a calendar day with no time and no time zone: "2026-11-21", what a person types into
// a date field. Nothing here reads the computer's time zone. (Instants, such as appointment times,
// go through ./index.ts, the only place that converts between UTC and clinic time.)

export interface PlainDateParts {
  year: number;
  month: number;
  day: number;
}

const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

export function daysInMonth({ year, month }: { year: number; month: number }): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Strict `YYYY-MM-DD` that is a real calendar date, or null. */
export function parsePlainDate(value: string): PlainDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])] as [
    number,
    number,
    number,
  ];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth({ year, month }))
    return null;
  return { year, month, day };
}

export function toPlainDate({ year, month, day }: PlainDateParts): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The calendar day `days` after `date` (before it when negative). */
export function addDays({ date, days }: { date: string; days: number }): string {
  const parts = parsePlainDate(date);
  if (!parts) throw new RangeError(`Not a valid date: ${date}`);
  if (!Number.isInteger(days)) throw new RangeError('Expected a whole number of days.');
  // UTC is only a container here (it has no clock changes), so every day is one day long.
  const moved = new Date(0);
  moved.setUTCFullYear(parts.year, parts.month - 1, parts.day + days);
  return toPlainDate({
    year: moved.getUTCFullYear(),
    month: moved.getUTCMonth() + 1,
    day: moved.getUTCDate(),
  });
}

/** The Monday of the week that holds `date`. */
export function startOfWeek(date: string): string {
  const parts = parsePlainDate(date);
  if (!parts) throw new RangeError(`Not a valid date: ${date}`);
  const day = new Date(0);
  day.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  // getUTCDay: 0 is Sunday.
  return addDays({ date, days: -((day.getUTCDay() + 6) % 7) });
}

/**
 * How old someone born on `birthDate` is on `today` (both `YYYY-MM-DD`, in the same calendar): whole
 * months under 2 years, whole years from then on. A 29 February birthday falls on 1 March in a common
 * year. A birth date after today (the API accepts tomorrow) counts as 0 months.
 */
export function ageOn({ birthDate, today }: { birthDate: string; today: string }): {
  unit: 'months' | 'years';
  value: number;
} {
  const born = parsePlainDate(birthDate);
  const now = parsePlainDate(today);
  if (!born || !now) throw new RangeError('Expected dates as YYYY-MM-DD.');
  const months = Math.max(
    0,
    (now.year - born.year) * 12 + (now.month - born.month) - (now.day < born.day ? 1 : 0),
  );
  return months < 24
    ? { unit: 'months', value: months }
    : { unit: 'years', value: Math.floor(months / 12) };
}

export function comparePlainDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0; // fixed-width ISO dates sort as text
}

/** `Nov 21, 2026` or `Sat, Nov 21, 2026`: month written out, never an ambiguous numeric date. */
export function formatPlainDate({
  date,
  style,
}: {
  date: string;
  style: 'medium' | 'weekday';
}): string {
  const parts = parsePlainDate(date);
  if (!parts) throw new RangeError(`Not a valid date: ${date}`);
  // UTC is only a container here, so the day cannot shift with the computer's zone.
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(style === 'weekday' && { weekday: 'short' }),
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)));
}

/** For calendar widgets that want a Date: the local calendar day is only a container. */
export function plainDateToLocalDate(value: string): Date {
  const parts = parsePlainDate(value);
  if (!parts) throw new RangeError(`Not a valid date: ${value}`);
  return new Date(parts.year, parts.month - 1, parts.day);
}

export function localDateToPlainDate(date: Date): string {
  return toPlainDate({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() });
}
