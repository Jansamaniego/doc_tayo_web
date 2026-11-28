import { describe, expect, it } from 'vitest';

import {
  addMinutes,
  formatDate,
  formatTime,
  fromClinicDateTime,
  isSameDayInZone,
  timeZoneOptions,
  todayInZone,
  toClinicDateTime,
} from './index.ts';

// These specs run with TZ=America/New_York (vitest.config.ts) and again with TZ=Asia/Manila in CI.
// Every result must be the same: nothing may depend on the computer's time zone.
const MANILA = 'Asia/Manila';

describe('toClinicDateTime', () => {
  it('moves a UTC instant across midnight into Manila time (UTC+8)', () => {
    expect(toClinicDateTime({ iso: '2026-11-20T16:30:00Z', timeZone: MANILA })).toEqual({
      date: '2026-11-21',
      time: '00:30',
    });
  });

  it('does not shift the day just before Manila midnight', () => {
    expect(toClinicDateTime({ iso: '2026-11-20T15:59:00Z', timeZone: MANILA })).toEqual({
      date: '2026-11-20',
      time: '23:59',
    });
    expect(toClinicDateTime({ iso: '2026-11-20T16:00:00Z', timeZone: MANILA })).toEqual({
      date: '2026-11-21',
      time: '00:00',
    });
  });

  it('follows daylight saving in a zone that has it', () => {
    expect(toClinicDateTime({ iso: '2026-03-08T07:30:00Z', timeZone: 'America/New_York' })).toEqual(
      { date: '2026-03-08', time: '03:30' },
    );
  });

  it('rejects an invalid timestamp and an invalid zone', () => {
    expect(() => toClinicDateTime({ iso: 'not-a-date', timeZone: MANILA })).toThrow();
    expect(() =>
      toClinicDateTime({ iso: '2026-11-20T16:30:00Z', timeZone: 'Mars/Base' }),
    ).toThrow();
  });

  it('requires a time zone', () => {
    // @ts-expect-error timeZone is required: the device zone is never a default.
    expect(() => toClinicDateTime({ iso: '2026-11-20T16:30:00Z' })).toThrow();
  });
});

describe('fromClinicDateTime', () => {
  it('turns a picked Manila date and time into the right UTC instant', () => {
    expect(fromClinicDateTime({ date: '2026-11-21', time: '00:30', timeZone: MANILA })).toBe(
      '2026-11-20T16:30:00.000Z',
    );
  });

  it('round-trips with toClinicDateTime', () => {
    const iso = '2026-12-31T20:15:00.000Z';
    const parts = toClinicDateTime({ iso, timeZone: MANILA });
    expect(fromClinicDateTime({ ...parts, timeZone: MANILA })).toBe(iso);
  });

  it('rejects malformed input', () => {
    expect(() =>
      fromClinicDateTime({ date: '21/11/2026', time: '00:30', timeZone: MANILA }),
    ).toThrow();
    expect(() =>
      fromClinicDateTime({ date: '2026-11-21', time: '25:99', timeZone: MANILA }),
    ).toThrow();
  });
});

describe('formatDate / formatTime', () => {
  it('formats dates month-first in clinic time', () => {
    const iso = '2026-11-20T16:30:00Z';
    expect(formatDate({ iso, timeZone: MANILA, style: 'medium' })).toBe('Nov 21, 2026');
    expect(formatDate({ iso, timeZone: MANILA, style: 'weekday' })).toBe('Sat, Nov 21, 2026');
  });

  it('formats time on a 12-hour clock with AM/PM and a plain space', () => {
    expect(formatTime({ iso: '2026-11-20T16:30:00Z', timeZone: MANILA })).toBe('12:30 AM');
    expect(formatTime({ iso: '2026-11-20T06:30:00Z', timeZone: MANILA })).toBe('2:30 PM');
  });

  it('never shows an ambiguous numeric date', () => {
    expect(
      formatDate({ iso: '2026-11-20T06:30:00Z', timeZone: MANILA, style: 'medium' }),
    ).not.toMatch(/^\d+\/\d+\/\d+$/);
  });
});

describe('timeZoneOptions', () => {
  it('offers the zones a clinic may use, each as its own label, including Manila and UTC', () => {
    const options = timeZoneOptions();
    expect(options).toContainEqual({ value: 'Asia/Manila', label: 'Asia/Manila' });
    expect(options).toContainEqual({ value: 'UTC', label: 'UTC' });
    expect(options.every((option) => option.value === option.label)).toBe(true);
  });

  it('lists every zone once, and every zone is one the formatting code accepts', () => {
    const values = timeZoneOptions().map((option) => option.value);
    expect(new Set(values).size).toBe(values.length);
    for (const zone of values) {
      expect(() =>
        formatDate({ iso: '2026-01-01T00:00:00Z', timeZone: zone, style: 'medium' }),
      ).not.toThrow();
    }
  });
});

describe('todayInZone', () => {
  const now = new Date('2026-03-01T23:30:00.000Z');

  it('is the date it is in that zone right now, not on this computer', () => {
    expect(todayInZone({ timeZone: 'Asia/Manila', now })).toBe('2026-03-02');
    expect(todayInZone({ timeZone: 'America/New_York', now })).toBe('2026-03-01');
    expect(todayInZone({ timeZone: 'UTC', now })).toBe('2026-03-01');
  });

  it('refuses an unknown or empty zone', () => {
    expect(() => todayInZone({ timeZone: 'Nowhere/City', now })).toThrow(RangeError);
    expect(() => todayInZone({ timeZone: '', now })).toThrow(RangeError);
  });

  it('uses the current time by default', () => {
    expect(todayInZone({ timeZone: 'Asia/Manila' })).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('addMinutes (an instant, so no time zone is involved)', () => {
  it.each([
    ['2026-12-07T01:00:00.000Z', 30, '2026-12-07T01:30:00.000Z'],
    ['2026-12-07T01:00:00.000Z', 480, '2026-12-07T09:00:00.000Z'],
    // Across midnight UTC, and across midnight in Manila (16:00 UTC).
    ['2026-12-07T23:45:00.000Z', 30, '2026-12-08T00:15:00.000Z'],
    ['2026-12-07T15:45:00.000Z', 30, '2026-12-07T16:15:00.000Z'],
    // The night New York changes its clocks: minutes stay minutes.
    ['2026-03-08T06:45:00.000Z', 30, '2026-03-08T07:15:00.000Z'],
    ['2026-12-07T09:00:00+08:00', 15, '2026-12-07T01:15:00.000Z'],
  ])('%s plus %i minutes is %s', (iso, minutes, expected) => {
    expect(addMinutes({ iso, minutes })).toBe(expected);
  });

  it('refuses an invalid timestamp and part of a minute', () => {
    expect(() => addMinutes({ iso: 'soon', minutes: 5 })).toThrow(RangeError);
    expect(() => addMinutes({ iso: '2026-12-07T01:00:00.000Z', minutes: 0.5 })).toThrow(RangeError);
  });
});

describe('isSameDayInZone', () => {
  it('compares the calendar day of the zone, not of the computer', () => {
    // 15:59 and 16:00 UTC are either side of Manila midnight (the same New York day).
    expect(
      isSameDayInZone({
        first: '2026-12-07T15:59:00.000Z',
        second: '2026-12-07T16:00:00.000Z',
        timeZone: MANILA,
      }),
    ).toBe(false);
    // 23:00 UTC and the next day's 01:00 UTC are one Manila day (two New York days).
    expect(
      isSameDayInZone({
        first: '2026-12-06T23:00:00.000Z',
        second: '2026-12-07T15:30:00.000Z',
        timeZone: MANILA,
      }),
    ).toBe(true);
  });

  it('needs a time zone', () => {
    expect(() =>
      isSameDayInZone({
        first: '2026-12-07T01:00:00.000Z',
        second: '2026-12-07T01:00:00.000Z',
        timeZone: '',
      }),
    ).toThrow(RangeError);
  });
});

describe('fromClinicDateTime (whole minutes, as the API requires)', () => {
  it('sends no seconds or milliseconds', () => {
    expect(fromClinicDateTime({ date: '2026-12-07', time: '09:05', timeZone: MANILA })).toBe(
      '2026-12-07T01:05:00.000Z',
    );
  });
});
