import { describe, expect, it } from 'vitest';

import { isValidSlug, suggestSlug } from './slug.ts';

describe('suggestSlug', () => {
  it.each([
    ['Bayview Clinic', 'bayview-clinic'],
    ['  Bayview   Clinic  ', 'bayview-clinic'],
    ['Peña Family Clinic', 'pena-family-clinic'],
    ['St. Luke’s (Quezon City)', 'st-luke-s-quezon-city'],
    ['---A--B---', 'a-b'],
    ['Klinika ng Bayan 2', 'klinika-ng-bayan-2'],
    ['', ''],
    ['!!!', ''],
  ])('turns %j into %j', (name, slug) => {
    expect(suggestSlug(name)).toBe(slug);
  });

  it('stops at 60 characters without leaving a hyphen at the end', () => {
    const slug = suggestSlug(`${'a'.repeat(58)} b${'c'.repeat(10)}`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
    expect(isValidSlug(slug)).toBe(true);
  });
});

describe('isValidSlug (the API: lower-case letters and digits in groups separated by single hyphens, at most 60)', () => {
  it.each(['bayview-clinic', 'a', 'clinic2', 'a-1-b'])('accepts %j', (slug) => {
    expect(isValidSlug(slug)).toBe(true);
  });

  it.each(['', 'Bayview', '-a', 'a-', 'a--b', 'a b', 'a_b', 'peña', 'a'.repeat(61)])(
    'rejects %j',
    (slug) => {
      expect(isValidSlug(slug)).toBe(false);
    },
  );

  it('accepts exactly 60 characters', () => {
    expect(isValidSlug('a'.repeat(60))).toBe(true);
  });
});
