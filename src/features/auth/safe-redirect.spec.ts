import { describe, expect, it } from 'vitest';

import { safeRedirect } from './safe-redirect.ts';

// After signing in we go back to where the person was heading. The address comes from the URL, so it
// must never send them to another site (an open redirect).
describe('safeRedirect', () => {
  it.each(['/', '/patients', '/patients/123?tab=notes#top', '/account/sessions'])(
    'keeps the in-app path %s',
    (path) => {
      expect(safeRedirect(path)).toBe(path);
    },
  );

  it.each([
    ['another site', 'https://evil.example.com/steal'],
    ['a protocol-relative address', '//evil.example.com'],
    ['a backslash trick', '/\\evil.example.com'],
    ['a script', 'javascript:alert(1)'],
    ['a data address', 'data:text/html,hi'],
    ['no leading slash', 'patients'],
    ['whitespace before a double slash', ' //evil.example.com'],
    ['an encoded double slash', '/%2F%2Fevil.example.com'],
    ['empty', ''],
  ])('falls back to home for %s', (_label, value) => {
    expect(safeRedirect(value)).toBe('/');
  });

  it('falls back to home when there is nothing', () => {
    expect(safeRedirect(undefined)).toBe('/');
    expect(safeRedirect(null)).toBe('/');
  });

  it('never sends a signed-in person back to a sign-in page', () => {
    for (const path of [
      '/login',
      '/login?x=1',
      '/forgot-password',
      '/reset-password',
      '/account-setup',
      '/accept-invitation',
    ]) {
      expect(safeRedirect(path)).toBe('/');
    }
  });
});
