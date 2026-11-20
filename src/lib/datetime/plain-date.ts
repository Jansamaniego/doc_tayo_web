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
