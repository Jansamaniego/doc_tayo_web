import { describe, expect, it } from 'vitest';

// Guard: the date specs are only a trap for local-time bugs if the runner is NOT in Manila.
// CI sets TEST_TZ=Asia/Manila for a second pass (vitest.config.ts).
describe('test runner time zone', () => {
  const expected = process.env.TEST_TZ ?? 'America/New_York';

  it('uses the configured zone', () => {
    expect(process.env.TZ).toBe(expected);
    const offsetMinutes = new Date('2026-11-20T12:00:00Z').getTimezoneOffset();
    expect(offsetMinutes).toBe(expected === 'Asia/Manila' ? -480 : 300);
  });

  it('is not Manila unless the second CI pass asked for it', () => {
    if (!process.env.TEST_TZ) {
      expect(process.env.TZ).not.toBe('Asia/Manila');
    }
  });
});
