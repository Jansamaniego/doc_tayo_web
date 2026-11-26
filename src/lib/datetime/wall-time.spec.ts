import { describe, expect, it } from 'vitest';

import { formatWallTime, weekdayName } from './wall-time.ts';

describe('formatWallTime (a branch’s wall-clock time: no date, no time zone)', () => {
  it.each([
    ['00:00', '12:00 AM'],
    ['09:05', '9:05 AM'],
    ['12:00', '12:00 PM'],
    ['13:30', '1:30 PM'],
    ['23:59', '11:59 PM'],
    ['24:00', 'midnight'],
  ])('shows %s as %s', (value, shown) => {
    expect(formatWallTime(value)).toBe(shown);
  });

  it.each(['25:00', '24:01', '9:5', '09:60', '', '09:00:00', 'noon'])('refuses %j', (value) => {
    expect(() => formatWallTime(value)).toThrow(RangeError);
  });
});

describe('weekdayName (1 = Monday … 7 = Sunday, as the API counts)', () => {
  it('names each day', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(weekdayName)).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
  });

  it.each([0, 8, 1.5, -1])('refuses %d', (weekday) => {
    expect(() => weekdayName(weekday)).toThrow(RangeError);
  });
});
