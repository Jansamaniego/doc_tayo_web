import { describe, expect, it } from 'vitest';

import { PASSWORD_HINT, passwordRules } from './passwords.ts';

// The server decides (docs/frontend-integration.md §7): 10 to 128 characters, not a very common
// password, not containing the email address. These rules are hints that tick live.
describe('passwordRules', () => {
  const met = (password: string, email?: string) =>
    passwordRules({ password, ...(email && { email }) }).map((rule) => rule.met);

  it('lists the length rule and the email rule, in plain words', () => {
    const texts = passwordRules({ password: '', email: 'ana@example.com' }).map(
      (rule) => rule.text,
    );
    expect(texts).toEqual(['10 to 128 characters', 'Does not contain your email address']);
  });

  it('starts with nothing ticked (an empty password has met nothing, not even "no email")', () => {
    expect(met('', 'ana@example.com')).toEqual([false, false]);
  });

  it('ticks the length rule from 10 characters up to 128', () => {
    expect(met('123456789', 'a@b.test')[0]).toBe(false);
    expect(met('1234567890', 'a@b.test')[0]).toBe(true);
    expect(met('x'.repeat(128), 'a@b.test')[0]).toBe(true);
    expect(met('x'.repeat(129), 'a@b.test')[0]).toBe(false);
  });

  it('counts what a person sees as one character (an emoji is one, like on the server)', () => {
    expect(met('😀😀😀😀😀😀😀😀😀😀', 'a@b.test')[0]).toBe(true);
    expect(met('😀😀😀😀😀😀😀😀😀', 'a@b.test')[0]).toBe(false);
  });

  it('un-ticks the email rule when the password contains the email address, ignoring case', () => {
    expect(met('my-ana@example.com-pass', 'ana@example.com')[1]).toBe(false);
    expect(met('MY-ANA@EXAMPLE.COM-pass', 'ana@example.com')[1]).toBe(false);
    expect(met('a-different-long-password', 'ana@example.com')[1]).toBe(true);
  });

  it('leaves out the email rule when there is no email yet', () => {
    expect(passwordRules({ password: 'abcdefghijkl' }).map((rule) => rule.text)).toEqual([
      '10 to 128 characters',
    ]);
  });

  it('has a hint about the check only the server can make', () => {
    expect(PASSWORD_HINT()).toBe('We also check that it is not a very common password.');
  });
});
