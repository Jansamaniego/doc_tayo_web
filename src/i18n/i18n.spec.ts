import { msg } from '@lingui/core/macro';
import { afterEach, describe, expect, it } from 'vitest';

import { i18n } from './index.ts';
import { activateLocale } from './index.ts';

const sample = msg`API reachable`;

afterEach(() => {
  activateLocale('en');
});

describe('i18n', () => {
  it('starts in English, the launch language', () => {
    expect(i18n.locale).toBe('en');
    expect(i18n._(sample)).toBe('API reachable');
  });

  // Lingui's pseudo-locale accents every letter, so a string that was NOT translated through the
  // catalogue (hard-coded text) stands out on screen. It does not lengthen text: the length stress
  // for Filipino-sized strings is added in Phase 2 (plans/01-foundation.md, As Built).
  it('has a pseudo-locale that visibly transforms every translated string', () => {
    activateLocale('pseudo');
    const pseudoText = i18n._(sample);
    expect(pseudoText).not.toBe('API reachable');
    expect(pseudoText).toMatch(/[^ -~]/);
  });

  it('can return to English', () => {
    activateLocale('pseudo');
    activateLocale('en');
    expect(i18n._(sample)).toBe('API reachable');
  });
});
