import { describe, expect, it } from 'vitest';

import { formatDuration } from './duration.ts';

describe('formatDuration (a service length in words)', () => {
  it.each([
    [1, '1 minute'],
    [5, '5 minutes'],
    [15, '15 minutes'],
    [59, '59 minutes'],
    [60, '1 hour'],
    [61, '1 hour 1 minute'],
    [90, '1 hour 30 minutes'],
    [120, '2 hours'],
    [125, '2 hours 5 minutes'],
    [480, '8 hours'],
  ])('says %i minutes as "%s"', (minutes, text) => {
    expect(formatDuration(minutes)).toBe(text);
  });

  it.each([0, -30, 30.5, Number.NaN])('refuses %s', (minutes) => {
    expect(() => formatDuration(minutes)).toThrow(RangeError);
  });
});
