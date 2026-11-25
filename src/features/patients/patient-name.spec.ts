import { describe, expect, it } from 'vitest';

import { patientFullName, patientListName } from './patient-name.ts';

const name = (over: Partial<Parameters<typeof patientListName>[0]> = {}) =>
  patientListName({
    firstName: 'Pedro',
    middleName: null,
    lastName: 'Bautista',
    suffix: null,
    ...over,
  });

describe('patientListName (lists show the family name first)', () => {
  it('is "Last, First"', () => {
    expect(name()).toBe('Bautista, Pedro');
  });

  it('adds the middle name and the suffix after the first name', () => {
    expect(name({ middleName: 'Reyes', suffix: 'Jr.' })).toBe('Bautista, Pedro Reyes Jr.');
    expect(name({ suffix: 'III' })).toBe('Bautista, Pedro III');
  });

  it('keeps accents and spaces inside names', () => {
    expect(name({ firstName: 'José', lastName: 'Dela Peña' })).toBe('Dela Peña, José');
  });
});

describe('patientFullName (headings and confirmations read naturally)', () => {
  const full = (over: Partial<Parameters<typeof patientFullName>[0]> = {}) =>
    patientFullName({
      firstName: 'Pedro',
      middleName: null,
      lastName: 'Bautista',
      suffix: null,
      ...over,
    });

  it('is "First Last"', () => {
    expect(full()).toBe('Pedro Bautista');
  });

  it('puts the middle name between them and the suffix last', () => {
    expect(full({ middleName: 'Reyes', suffix: 'Jr.' })).toBe('Pedro Reyes Bautista Jr.');
  });
});
