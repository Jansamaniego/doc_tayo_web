import { describe, expect, it } from 'vitest';

import { formatPeso } from './money.ts';

// Provisional (D-12): the API's money format is not decided; Phase 1 takes integer centavos.
describe('formatPeso', () => {
  it.each([
    [123450, '₱1,234.50'],
    [0, '₱0.00'],
    [5, '₱0.05'],
    [100, '₱1.00'],
    [123456789012, '₱1,234,567,890.12'],
    [-2500, '-₱25.00'],
  ])('formats %i centavos as %s', (centavos, expected) => {
    expect(formatPeso({ centavos })).toBe(expected);
  });

  it('refuses fractional centavos (no floating-point money)', () => {
    expect(() => formatPeso({ centavos: 10.5 })).toThrow();
    expect(() => formatPeso({ centavos: Number.NaN })).toThrow();
  });
});
