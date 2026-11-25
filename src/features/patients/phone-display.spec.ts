import { describe, expect, it } from 'vitest';

import { displayPhone } from './phone-display.ts';

describe('displayPhone (the API stores +E.164)', () => {
  it('groups a Philippine mobile number for reading aloud', () => {
    expect(displayPhone('+639171234567')).toBe('+63 917 123 4567');
  });

  it.each([
    '+63281234567', // a Philippine landline: not the mobile shape
    '+6391712345', // too short
    '+14155552671',
    '+442071838750',
  ])('shows %s as stored', (phone) => {
    expect(displayPhone(phone)).toBe(phone);
  });
});
