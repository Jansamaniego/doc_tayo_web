import { describe, expect, it } from 'vitest';

import { EMPTY_PATIENT, toChanges, toCreateRequest, toFormValues } from './patient-form-values.ts';

describe('toCreateRequest (what registration sends)', () => {
  it('sends only the names and "unknown" sex for an otherwise empty form', () => {
    expect(toCreateRequest({ ...EMPTY_PATIENT, firstName: 'Ana', lastName: 'Cruz' })).toEqual({
      firstName: 'Ana',
      lastName: 'Cruz',
      sex: 'unknown',
    });
  });

  it('trims text and leaves blank optional fields out', () => {
    expect(
      toCreateRequest({
        ...EMPTY_PATIENT,
        firstName: '  Ana ',
        lastName: ' Cruz',
        middleName: '   ',
        phone: ' 0917 123 4567 ',
        city: '',
        allergies: '  Penicillin\nShellfish  ',
      }),
    ).toEqual({
      firstName: 'Ana',
      lastName: 'Cruz',
      sex: 'unknown',
      phone: '0917 123 4567',
      allergies: 'Penicillin\nShellfish',
    });
  });

  it('sends every filled field, including the sex and the birth date as typed', () => {
    const full = {
      firstName: 'Ana',
      middleName: 'B',
      lastName: 'Cruz',
      suffix: 'Jr.',
      sex: 'female' as const,
      birthDate: '1990-05-01',
      phone: '09171234567',
      email: 'ana@example.com',
      addressLine: '1 Mabini',
      city: 'Taguig',
      province: 'Metro Manila',
      guardianName: 'Carmen',
      guardianPhone: '09181112222',
      allergies: 'None known',
      notes: 'Prefers mornings',
    };
    expect(toCreateRequest(full)).toEqual(full);
  });
});

const record = {
  id: 'p1',
  patientNumber: 'P-000001',
  firstName: 'Ana',
  middleName: null,
  lastName: 'Cruz',
  suffix: null,
  sex: 'female' as const,
  birthDate: '1990-05-01',
  phone: '+639171234567',
  email: null,
  addressLine: null,
  city: 'Pasig',
  province: null,
  guardianName: null,
  guardianPhone: null,
  allergies: null,
  notes: null,
  archivedAt: null,
  archiveReason: null,
  version: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('toFormValues (what the edit form starts with)', () => {
  it('turns "no value" into blank text and keeps the rest', () => {
    expect(toFormValues(record)).toEqual({
      ...EMPTY_PATIENT,
      firstName: 'Ana',
      lastName: 'Cruz',
      sex: 'female',
      birthDate: '1990-05-01',
      phone: '+639171234567',
      city: 'Pasig',
    });
  });
});

describe('toChanges (an edit sends only what changed)', () => {
  const base = toFormValues(record);

  it('is empty when nothing changed, also when only spaces were added', () => {
    expect(toChanges({ base, values: base })).toEqual({});
    expect(toChanges({ base, values: { ...base, city: ' Pasig ', email: '   ' } })).toEqual({});
  });

  it('sends only the changed fields, trimmed', () => {
    expect(
      toChanges({ base, values: { ...base, city: ' Makati ', email: 'ana@example.com' } }),
    ).toEqual({ city: 'Makati', email: 'ana@example.com' });
  });

  it('sends null for an optional field that was emptied', () => {
    expect(toChanges({ base, values: { ...base, city: '', phone: ' ', birthDate: '' } })).toEqual({
      city: null,
      phone: null,
      birthDate: null,
    });
  });

  it('sends a changed name, sex and birth date', () => {
    expect(
      toChanges({
        base,
        values: { ...base, firstName: 'Anna', sex: 'unknown', birthDate: '1990-05-02' },
      }),
    ).toEqual({ firstName: 'Anna', sex: 'unknown', birthDate: '1990-05-02' });
  });
});
