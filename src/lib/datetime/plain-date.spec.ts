import { describe, expect, it } from 'vitest';

import {
  ageOn,
  comparePlainDates,
  daysInMonth,
  formatPlainDate,
  localDateToPlainDate,
  parsePlainDate,
  plainDateToLocalDate,
  toPlainDate,
} from './plain-date.ts';

// A plain date is a calendar day with no time and no time zone ("2026-11-21"): what a person types
// into a date field. These specs run in New York and in Manila: nothing may depend on either.
describe('parsePlainDate', () => {
  it('parses a real calendar date', () => {
    expect(parsePlainDate('2026-11-21')).toEqual({ year: 2026, month: 11, day: 21 });
  });

  it('knows leap years', () => {
    expect(parsePlainDate('2024-02-29')).not.toBeNull();
    expect(parsePlainDate('2026-02-29')).toBeNull();
    expect(parsePlainDate('1900-02-29')).toBeNull();
    expect(parsePlainDate('2000-02-29')).not.toBeNull();
  });

  it.each([
    '',
    '2026-2-3',
    '21/11/2026',
    '2026-13-01',
    '2026-00-10',
    '2026-04-31',
    '2026-11-00',
    'abcd-ef-gh',
    '2026-11-21T00:00',
  ])('rejects "%s"', (value) => {
    expect(parsePlainDate(value)).toBeNull();
  });
});

describe('toPlainDate / daysInMonth', () => {
  it('pads to YYYY-MM-DD', () => {
    expect(toPlainDate({ year: 2026, month: 3, day: 8 })).toBe('2026-03-08');
    expect(toPlainDate({ year: 987, month: 1, day: 2 })).toBe('0987-01-02');
  });

  it('counts the days of a month', () => {
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28);
    expect(daysInMonth({ year: 2024, month: 2 })).toBe(29);
    expect(daysInMonth({ year: 2026, month: 12 })).toBe(31);
    expect(daysInMonth({ year: 2026, month: 4 })).toBe(30);
  });
});

describe('comparePlainDates', () => {
  it('orders by calendar day', () => {
    expect(comparePlainDates('2026-01-01', '2026-01-02')).toBeLessThan(0);
    expect(comparePlainDates('2026-12-31', '2026-01-02')).toBeGreaterThan(0);
    expect(comparePlainDates('2026-05-05', '2026-05-05')).toBe(0);
  });
});

describe('formatPlainDate', () => {
  it('writes the month out, never an ambiguous number', () => {
    expect(formatPlainDate({ date: '2026-11-21', style: 'medium' })).toBe('Nov 21, 2026');
    expect(formatPlainDate({ date: '2026-11-21', style: 'weekday' })).toBe('Sat, Nov 21, 2026');
  });

  it('shows the same day whatever the computer time zone (edge: the first and last day of a year)', () => {
    expect(formatPlainDate({ date: '2026-01-01', style: 'medium' })).toBe('Jan 1, 2026');
    expect(formatPlainDate({ date: '2026-12-31', style: 'medium' })).toBe('Dec 31, 2026');
  });

  it('rejects an invalid date', () => {
    expect(() => formatPlainDate({ date: '2026-02-30', style: 'medium' })).toThrow();
  });
});

describe('plainDateToLocalDate / localDateToPlainDate (for the calendar widget)', () => {
  it.each(['2026-03-08', '2026-11-01', '2026-01-01', '2026-12-31', '2024-02-29', '2026-03-29'])(
    'round-trips %s without shifting the day (daylight-saving edges included)',
    (value) => {
      expect(localDateToPlainDate(plainDateToLocalDate(value))).toBe(value);
    },
  );

  it('uses the local calendar day as a container, never a UTC conversion', () => {
    const date = plainDateToLocalDate('2026-11-21');
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 10, 21]);
  });
});

describe('ageOn (from plain dates only: no time zone is involved)', () => {
  const age = (birthDate: string, today: string) => ageOn({ birthDate, today });

  it('counts years from 2 years old, changing on the birthday', () => {
    expect(age('1985-03-14', '2026-03-13')).toEqual({ unit: 'years', value: 40 });
    expect(age('1985-03-14', '2026-03-14')).toEqual({ unit: 'years', value: 41 });
    expect(age('1985-03-14', '2026-03-15')).toEqual({ unit: 'years', value: 41 });
  });

  it('counts months under 2 years, changing on the day of the month', () => {
    expect(age('2026-01-15', '2026-01-15')).toEqual({ unit: 'months', value: 0 });
    expect(age('2026-01-15', '2026-02-14')).toEqual({ unit: 'months', value: 0 });
    expect(age('2026-01-15', '2026-02-15')).toEqual({ unit: 'months', value: 1 });
    expect(age('2025-01-15', '2027-01-14')).toEqual({ unit: 'months', value: 23 });
    expect(age('2025-01-15', '2027-01-15')).toEqual({ unit: 'years', value: 2 });
  });

  it('gives a person born on 29 February their birthday on 1 March in a common year', () => {
    expect(age('2020-02-29', '2025-02-28')).toEqual({ unit: 'years', value: 4 });
    expect(age('2020-02-29', '2025-03-01')).toEqual({ unit: 'years', value: 5 });
    expect(age('2020-02-29', '2024-02-29')).toEqual({ unit: 'years', value: 4 });
  });

  it('is 0 months for a birth date after today (the API accepts tomorrow)', () => {
    expect(age('2026-01-16', '2026-01-15')).toEqual({ unit: 'months', value: 0 });
  });

  it.each(['', '2020-02-30', '15/01/2020'])('refuses %j as a date', (bad) => {
    expect(() => age(bad, '2026-01-15')).toThrow(RangeError);
    expect(() => age('2020-01-15', bad)).toThrow(RangeError);
  });
});
