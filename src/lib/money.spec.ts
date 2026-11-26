import { describe, expect, it } from 'vitest';

import { centavosFromApi, centavosToApi, formatPeso } from './money.ts';

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

// The API speaks money as a decimal string (docs/api-conventions.md "Money"); the app counts centavos.
const AMOUNTS: [string, number][] = [
  ['0.00', 0],
  ['0.05', 5],
  ['500.00', 50000],
  ['1234.50', 123450],
  // Large enough that multiplying a float by 100 would be tempting to get wrong.
  ['1.15', 115],
  ['9999999999.99', 999999999999],
];

describe('centavosFromApi', () => {
  it.each(AMOUNTS)('reads "%s" as %i centavos', (text, centavos) => {
    expect(centavosFromApi(text)).toBe(centavos);
  });

  it.each([
    '1e3',
    '-1.00',
    '1.005',
    '1,000.00',
    '',
    ' 5',
    '5.00 ',
    '5',
    '5.0',
    '.50',
    '₱5.00',
    'NaN',
    '99999999999999999.00',
  ])('refuses "%s"', (text) => {
    expect(() => centavosFromApi(text)).toThrow(RangeError);
  });
});

describe('centavosToApi', () => {
  it.each(AMOUNTS)('writes "%s" for %i centavos', (text, centavos) => {
    expect(centavosToApi(centavos)).toBe(text);
  });

  it.each([-1, 10.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'refuses %s',
    (centavos) => {
      expect(() => centavosToApi(centavos)).toThrow(RangeError);
    },
  );

  it('never changes a value on a round trip', () => {
    for (let centavos = 0; centavos <= 100_000; centavos += 1) {
      expect(centavosFromApi(centavosToApi(centavos))).toBe(centavos);
    }
  });
});
