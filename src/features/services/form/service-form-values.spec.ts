import { describe, expect, it } from 'vitest';

import type { Service } from '../api/services.ts';
import {
  checkService,
  EMPTY_SERVICE,
  toChanges,
  toFormValues,
  toNewService,
  type ServiceValues,
} from './service-form-values.ts';

const values = (over: Partial<ServiceValues> = {}): ServiceValues => ({
  ...EMPTY_SERVICE,
  name: 'Follow-up',
  ...over,
});
const fixed = (price: number | null) => values({ priceKind: 'fixed', price });
const service = (over: Partial<Service> = {}): Service => ({
  id: 's1',
  name: 'Follow-up',
  description: 'A second visit.',
  defaultDurationMinutes: 15,
  price: '300.00',
  currency: 'PHP',
  isActive: true,
  createdAt: '2026-11-27T00:00:00.000Z',
  updatedAt: '2026-11-27T00:00:00.000Z',
  ...over,
});
const fieldsWithProblems = (input: ServiceValues) =>
  checkService(input).map((problem) => problem.name);

describe('what adding a service sends', () => {
  it('starts at 30 minutes with no fixed price', () => {
    expect(EMPTY_SERVICE.defaultDurationMinutes).toBe('30');
    expect(EMPTY_SERVICE.priceKind).toBe('none');
  });

  it.each([
    [fixed(50000), '500.00'],
    [fixed(5), '0.05'],
    [values({ priceKind: 'free' }), '0.00'],
    [values({ priceKind: 'none' }), null],
  ])('sends the price as text (%#)', (input, price) => {
    expect(toNewService(input).price).toBe(price);
  });

  it('never sends an amount typed before Free or No fixed price was chosen', () => {
    expect(toNewService(values({ priceKind: 'free', price: 50000 })).price).toBe('0.00');
    expect(toNewService(values({ priceKind: 'none', price: 50000 })).price).toBeNull();
  });

  it('trims text, sends no description as null and the duration as a number', () => {
    expect(
      toNewService(
        values({ name: '  Dressing ', description: '   ', defaultDurationMinutes: ' 20 ' }),
      ),
    ).toEqual({ name: 'Dressing', description: null, defaultDurationMinutes: 20, price: null });
  });
});

describe('what is checked before sending', () => {
  it('accepts a plain service', () => {
    expect(checkService(values())).toEqual([]);
  });

  it('needs a name of at most 120 characters', () => {
    expect(fieldsWithProblems(values({ name: '  ' }))).toEqual(['name']);
    expect(fieldsWithProblems(values({ name: 'x'.repeat(120) }))).toEqual([]);
    expect(fieldsWithProblems(values({ name: 'x'.repeat(121) }))).toEqual(['name']);
  });

  it('allows a description of at most 500 characters', () => {
    expect(fieldsWithProblems(values({ description: 'x'.repeat(500) }))).toEqual([]);
    expect(fieldsWithProblems(values({ description: 'x'.repeat(501) }))).toEqual(['description']);
  });

  it.each(['5', '480', ' 30 '])('accepts %s minutes', (defaultDurationMinutes) => {
    expect(checkService(values({ defaultDurationMinutes }))).toEqual([]);
  });

  it.each(['', '4', '481', '30.5', '-30', '1e2', 'thirty'])(
    'refuses "%s" as a number of minutes',
    (defaultDurationMinutes) => {
      expect(checkService(values({ defaultDurationMinutes }))).toEqual([
        {
          name: 'defaultDurationMinutes',
          message: 'Enter a whole number of minutes from 5 to 480.',
        },
      ]);
    },
  );

  it('accepts a fixed price from ₱0.01 to ₱9,999,999,999.99', () => {
    expect(checkService(fixed(1))).toEqual([]);
    expect(checkService(fixed(999_999_999_999))).toEqual([]);
  });

  it.each([
    [null, 'Enter an amount, for example 1,250.50.'],
    [0, 'Choose Free for a service without charge.'],
    [1_000_000_000_000, 'Enter at most ₱9,999,999,999.99.'],
  ])('refuses the fixed price %s', (price, message) => {
    expect(checkService(fixed(price))).toEqual([{ name: 'price', message }]);
  });

  it('does not look at the amount when there is no fixed price', () => {
    expect(checkService(values({ priceKind: 'free', price: null }))).toEqual([]);
    expect(checkService(values({ priceKind: 'none', price: 0 }))).toEqual([]);
  });

  it('lists every problem at once', () => {
    expect(
      fieldsWithProblems(
        values({ name: '', defaultDurationMinutes: '1', priceKind: 'fixed', price: null }),
      ),
    ).toEqual(['name', 'defaultDurationMinutes', 'price']);
  });
});

describe('editing a service', () => {
  it.each([
    ['300.00', 'fixed', 30000],
    ['0.00', 'free', null],
    [null, 'none', null],
  ] as const)('fills the form from the price %s', (price, priceKind, amount) => {
    expect(toFormValues(service({ price }))).toMatchObject({ priceKind, price: amount });
  });

  it('fills an empty description as no text', () => {
    expect(toFormValues(service({ description: null })).description).toBe('');
  });

  const base = toFormValues(service());
  const changed = (over: Partial<ServiceValues>) =>
    toChanges({ base, values: { ...base, ...over } });

  it('sends nothing when nothing differs, whatever the spacing', () => {
    expect(changed({})).toEqual({});
    expect(changed({ name: ' Follow-up ', defaultDurationMinutes: '015' })).toEqual({});
  });

  it('sends only what differs', () => {
    expect(changed({ name: 'Review' })).toEqual({ name: 'Review' });
    expect(changed({ defaultDurationMinutes: '20' })).toEqual({ defaultDurationMinutes: 20 });
    expect(changed({ price: 35050 })).toEqual({ price: '350.50' });
  });

  it('clears the description or the price with null', () => {
    expect(changed({ description: ' ' })).toEqual({ description: null });
    expect(changed({ priceKind: 'none' })).toEqual({ price: null });
    expect(changed({ priceKind: 'free' })).toEqual({ price: '0.00' });
  });
});
