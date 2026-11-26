import { describe, expect, it } from 'vitest';

import {
  EMPTY_PRACTITIONER,
  toChanges,
  toFormValues,
  toNewProfile,
} from './practitioner-form-values.ts';

const profile = {
  id: 'pr1',
  membershipId: 'm1',
  displayName: 'Dr. Ana Cruz, MD',
  specialization: 'Pediatrics',
  prcLicenseNumber: null,
  ptrNumber: 'PTR-1',
  isActive: true,
  schedule: [],
};

describe('toNewProfile (what adding a practitioner sends)', () => {
  it('sends the member and the name, trimmed, and leaves blank optional fields out', () => {
    expect(
      toNewProfile({
        membershipId: 'm1',
        values: { ...EMPTY_PRACTITIONER, displayName: '  Dr. Ana ', specialization: '   ' },
      }),
    ).toEqual({ membershipId: 'm1', displayName: 'Dr. Ana' });
  });

  it('sends every filled field', () => {
    const values = {
      displayName: 'Dr. Ana',
      specialization: 'Pediatrics',
      prcLicenseNumber: '123',
      ptrNumber: 'P-9',
    };
    expect(toNewProfile({ membershipId: 'm1', values })).toEqual({
      membershipId: 'm1',
      ...values,
    });
  });
});

describe('toFormValues / toChanges (an edit sends only what changed)', () => {
  const base = toFormValues(profile);

  it('starts with "no value" as blank text', () => {
    expect(base).toEqual({
      displayName: 'Dr. Ana Cruz, MD',
      specialization: 'Pediatrics',
      prcLicenseNumber: '',
      ptrNumber: 'PTR-1',
    });
  });

  it('is empty when nothing changed, also when only spaces were added', () => {
    expect(toChanges({ base, values: { ...base, specialization: ' Pediatrics ' } })).toEqual({});
  });

  it('sends changed fields trimmed, and null for an emptied optional one', () => {
    expect(
      toChanges({
        base,
        values: { ...base, displayName: ' Dr. Ana, MD ', ptrNumber: ' ', prcLicenseNumber: '7' },
      }),
    ).toEqual({ displayName: 'Dr. Ana, MD', ptrNumber: null, prcLicenseNumber: '7' });
  });
});
