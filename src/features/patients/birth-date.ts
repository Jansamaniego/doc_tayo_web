import { plural } from '@lingui/core/macro';

import { ageOn, formatPlainDate } from '@/lib/datetime/plain-date.ts';

/**
 * `Mar 14, 1985 (41 years)`; months under 2 years. A birth date is a plain calendar date, never run
 * through a time zone; only "today" is the clinic's, and until it is known the date shows alone.
 */
export function birthDateWithAge({
  birthDate,
  today,
}: {
  birthDate: string;
  today: string | undefined;
}): string {
  const date = formatPlainDate({ date: birthDate, style: 'medium' });
  if (today === undefined) return date;
  const { unit, value } = ageOn({ birthDate, today });
  const age =
    unit === 'years'
      ? plural(value, { one: '# year', other: '# years' })
      : plural(value, { one: '# month', other: '# months' });
  return `${date} (${age})`;
}
