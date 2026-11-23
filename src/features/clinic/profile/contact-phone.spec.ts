import { describe, expect, it } from 'vitest';

import { parseContactPhone } from './contact-phone.ts';

describe('parseContactPhone', () => {
  it.each([
    ['+63 917-123-4567', '+639171234567'],
    ['+63 (917) 123.4567', '+639171234567'],
    ['  +639171234567  ', '+639171234567'],
    ['+1 415 555 0100', '+14155550100'],
  ])('turns %s into %s', (typed, expected) => {
    expect(parseContactPhone(typed)).toEqual({ status: 'valid', phone: expected });
  });

  it('accepts the shortest and the longest number the API accepts (7 and 15 digits)', () => {
    expect(parseContactPhone('+1234567')).toEqual({ status: 'valid', phone: '+1234567' });
    expect(parseContactPhone('+123456789012345')).toEqual({
      status: 'valid',
      phone: '+123456789012345',
    });
  });

  it.each([
    ['a number with no country code', '09171234567'],
    ['a country code that starts with 0', '+0917123456'],
    ['6 digits', '+123456'],
    ['16 digits', '+1234567890123456'],
    ['letters', '+63917abc4567'],
    ['a plus sign in the middle', '+63+9171234567'],
  ])('refuses %s', (_label, typed) => {
    expect(parseContactPhone(typed)).toEqual({ status: 'invalid' });
  });

  it('never adds a country code of its own', () => {
    expect(parseContactPhone('9171234567')).toEqual({ status: 'invalid' });
  });

  it.each(['', '   '])('treats %j as "no phone"', (typed) => {
    expect(parseContactPhone(typed)).toEqual({ status: 'empty' });
  });
});
