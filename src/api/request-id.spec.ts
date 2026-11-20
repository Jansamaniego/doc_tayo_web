import { describe, expect, it } from 'vitest';

import { newRequestId } from './request-id.ts';

// The API honours a client X-Request-Id only if it is a canonical UUID.
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newRequestId', () => {
  it('returns a canonical, lowercase UUID version 7', () => {
    expect(newRequestId()).toMatch(UUID_V7);
  });

  it('is unique across many calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newRequestId()));
    expect(ids.size).toBe(1000);
  });

  it('sorts by time', () => {
    const earlier = newRequestId({ now: Date.UTC(2026, 0, 1) });
    const later = newRequestId({ now: Date.UTC(2026, 0, 2) });
    expect(earlier < later).toBe(true);
  });
});
