import { describe, expect, it } from 'vitest';

import {
  bookingEnd,
  bookingLength,
  bookingProblems,
  toBookRequest,
  type BookingValues,
} from './appointment-form-values.ts';

const MANILA = 'Asia/Manila';
/** 00:30 on 7 December in Manila, still 6 December in New York (the runner). */
const NOW = new Date('2026-12-06T16:30:00.000Z');

const values = (over: Partial<BookingValues> = {}): BookingValues => ({
  kind: 'scheduled',
  branchId: 'b1',
  patientId: 'p1',
  practitionerId: 'm1',
  serviceId: 's1',
  date: '2026-12-07',
  start: '09:00',
  end: undefined,
  nextDay: false,
  reason: 'Follow-up',
  ...over,
});
const problems = (over: Partial<BookingValues> = {}, minutes = 30) =>
  bookingProblems({ values: values(over), minutes, timeZone: MANILA, now: NOW }).map(
    ({ field, message }) => `${field}: ${message}`,
  );

describe('bookingEnd (proposed from the service until it is typed)', () => {
  it.each([
    ['09:00', 15, { end: '09:15', nextDay: false }],
    ['09:45', 30, { end: '10:15', nextDay: false }],
    ['23:45', 30, { end: '00:15', nextDay: true }],
    ['23:30', 30, { end: '00:00', nextDay: true }],
    ['09:00', 480, { end: '17:00', nextDay: false }],
    ['', 30, { end: '', nextDay: false }],
  ])('proposes the end of %s plus %i minutes', (start, minutes, expected) => {
    expect(bookingEnd({ start, end: undefined, nextDay: false, minutes })).toEqual(expected);
  });

  it('keeps an end that was typed, whatever the service says', () => {
    expect(bookingEnd({ start: '09:00', end: '09:40', nextDay: false, minutes: 15 })).toEqual({
      end: '09:40',
      nextDay: false,
    });
    expect(bookingEnd({ start: '09:00', end: '', nextDay: false, minutes: 15 })).toEqual({
      end: '',
      nextDay: false,
    });
  });

  it('means the next day only when the typed end is before the start and that was said', () => {
    expect(bookingEnd({ start: '23:00', end: '00:30', nextDay: true, minutes: 30 }).nextDay).toBe(
      true,
    );
    expect(bookingEnd({ start: '09:00', end: '10:00', nextDay: true, minutes: 30 }).nextDay).toBe(
      false,
    );
  });
});

describe('toBookRequest', () => {
  it('builds the instants from the date and times of the branch’s zone', () => {
    expect(toBookRequest({ values: values(), minutes: 15, timeZone: MANILA })).toEqual({
      kind: 'scheduled',
      branchId: 'b1',
      patientId: 'p1',
      practitionerMembershipId: 'm1',
      serviceId: 's1',
      startsAt: '2026-12-07T01:00:00.000Z',
      endsAt: '2026-12-07T01:15:00.000Z',
      reason: 'Follow-up',
    });
  });

  it('puts an end after midnight on the next day', () => {
    const request = toBookRequest({
      values: values({ start: '23:30', end: '00:30', nextDay: true }),
      minutes: 30,
      timeZone: MANILA,
    });
    expect(request.startsAt).toBe('2026-12-07T15:30:00.000Z');
    expect(request.endsAt).toBe('2026-12-07T16:30:00.000Z');
  });

  it('sends no times for a walk-in', () => {
    const request = toBookRequest({
      values: values({ kind: 'walk_in' }),
      minutes: 30,
      timeZone: MANILA,
    });
    expect(request).toEqual({
      kind: 'walk_in',
      branchId: 'b1',
      patientId: 'p1',
      practitionerMembershipId: 'm1',
      serviceId: 's1',
      reason: 'Follow-up',
    });
  });

  it('sends no service and a blank purpose as null, and trims the purpose', () => {
    const blank = toBookRequest({
      values: values({ serviceId: '', reason: '   ' }),
      minutes: 30,
      timeZone: MANILA,
    });
    expect(blank.serviceId).toBeNull();
    expect(blank.reason).toBeNull();
    const padded = toBookRequest({
      values: values({ reason: '  Check-up ' }),
      minutes: 30,
      timeZone: MANILA,
    });
    expect(padded.reason).toBe('Check-up');
  });
});

describe('bookingProblems (what the API would refuse is not sent)', () => {
  it('has none for a complete booking', () => {
    expect(problems()).toEqual([]);
  });

  it('requires a branch, a patient and a practitioner', () => {
    expect(problems({ branchId: '', patientId: '', practitionerId: '' })).toEqual([
      'branchId: Choose the branch.',
      'patientId: Choose the patient.',
      'practitionerMembershipId: Choose the practitioner.',
    ]);
  });

  it('requires the date, start and end of a booked time', () => {
    expect(problems({ date: '', start: '', end: '' })).toEqual([
      'date: Enter the date.',
      'startsAt: Enter the start time.',
      'endsAt: Enter the end time.',
    ]);
  });

  it('asks a walk-in for no times', () => {
    expect(problems({ kind: 'walk_in', date: '', start: '', end: '' })).toEqual([]);
  });

  it.each([
    ['08:55', false],
    ['09:00', false],
    ['08:00', false],
  ])('refuses an end of %s for a 9:00 start unless it is the next day', (end, nextDay) => {
    expect(problems({ end, nextDay })).toEqual(['endsAt: The end must be after the start.']);
  });

  it('allows 8 hours and refuses 8 hours 5 minutes', () => {
    expect(problems({ end: '17:00' })).toEqual([]);
    expect(problems({ end: '17:05' })).toEqual([
      'endsAt: An appointment can be at most 8 hours long.',
    ]);
    expect(problems({ start: '20:00', end: '04:00', nextDay: true })).toEqual([]);
    expect(problems({ start: '20:00', end: '04:05', nextDay: true })).toEqual([
      'endsAt: An appointment can be at most 8 hours long.',
    ]);
  });

  it('refuses an end that has passed in the branch’s zone', () => {
    // It is 00:30 on 7 December there.
    expect(problems({ start: '00:00', end: '00:25' })).toEqual([
      'endsAt: This time has already passed.',
    ]);
    expect(problems({ start: '00:00', end: '00:35' })).toEqual([]);
    expect(problems({ date: '2026-12-06' })).toEqual(['endsAt: This time has already passed.']);
  });

  it('allows a start 366 days ahead and refuses 367', () => {
    // 366 days after 7 December 2026 is 8 December 2027.
    expect(problems({ date: '2027-12-08', start: '00:00' })).toEqual([]);
    expect(problems({ date: '2027-12-09', start: '00:00' })).toEqual([
      'startsAt: Book at most 366 days ahead.',
    ]);
  });

  it('allows a purpose of 200 characters and refuses 201', () => {
    expect(problems({ reason: 'x'.repeat(200) })).toEqual([]);
    expect(problems({ reason: ` ${'x'.repeat(200)} ` })).toEqual([]);
    expect(problems({ reason: 'x'.repeat(201) })).toEqual([
      'reason: This can have at most 200 characters.',
    ]);
  });
});

describe('bookingLength', () => {
  it('is the minutes between start and end, or none while they make no sense', () => {
    const length = (over: Partial<BookingValues>) =>
      bookingLength({ values: values(over), minutes: 30, timeZone: MANILA });
    expect(length({})).toBe(30);
    expect(length({ start: '23:30', end: '01:00', nextDay: true })).toBe(90);
    expect(length({ end: '08:00' })).toBeUndefined();
    expect(length({ start: '' })).toBeUndefined();
    expect(length({ date: '' })).toBeUndefined();
  });
});
