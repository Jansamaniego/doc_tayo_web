import { describe, expect, it } from 'vitest';

import { appointmentTime } from './appointment-time.ts';

const MANILA = 'Asia/Manila';
const at = (startsAt: string, endsAt: string, kind: 'scheduled' | 'walk_in' = 'scheduled') =>
  appointmentTime({ appointment: { kind, startsAt, endsAt }, timeZone: MANILA });

describe('appointmentTime (in the branch’s zone, whatever the computer thinks)', () => {
  it('shows the start and end of a booked time, and says it in words', () => {
    expect(at('2026-12-07T01:00:00.000Z', '2026-12-07T01:30:00.000Z')).toEqual({
      shown: '9:00 AM – 9:30 AM',
      spoken: '9:00 AM to 9:30 AM',
    });
  });

  it('shows a walk-in’s arrival only: its end is an estimate', () => {
    expect(at('2026-12-07T00:45:00.000Z', '2026-12-07T01:15:00.000Z', 'walk_in')).toEqual({
      shown: 'Arrived 8:45 AM',
      spoken: 'Arrived 8:45 AM',
    });
  });

  it('says when the end is on the next day of the branch', () => {
    // 23:30 to 00:30 in Manila, one New York day.
    expect(at('2026-12-07T15:30:00.000Z', '2026-12-07T16:30:00.000Z')).toEqual({
      shown: '11:30 PM – 12:30 AM (next day)',
      spoken: '11:30 PM to 12:30 AM the next day',
    });
  });
});
