import type { NewPractitioner, Practitioner, PractitionerChanges } from '../api/practitioners.ts';

/** The profile fields as typed. The person is chosen apart: it cannot be changed afterwards. */
export interface PractitionerValues {
  displayName: string;
  specialization: string;
  prcLicenseNumber: string;
  ptrNumber: string;
}

export const EMPTY_PRACTITIONER: PractitionerValues = {
  displayName: '',
  specialization: '',
  prcLicenseNumber: '',
  ptrNumber: '',
};

/** The longest the API accepts for each field (docs/openapi.json). */
export const MAX_LENGTHS: Record<keyof PractitionerValues, number> = {
  displayName: 160,
  specialization: 120,
  prcLicenseNumber: 40,
  ptrNumber: 40,
};

const FIELDS = Object.keys(EMPTY_PRACTITIONER) as (keyof PractitionerValues)[];

export function toFormValues(profile: Practitioner): PractitionerValues {
  return Object.fromEntries(
    FIELDS.map((name) => [name, profile[name] ?? '']),
  ) as unknown as PractitionerValues;
}

/** What adding a practitioner sends: trimmed, with blank optional fields left out. */
export function toNewProfile({
  membershipId,
  values,
}: {
  membershipId: string;
  values: PractitionerValues;
}): NewPractitioner {
  const filled = Object.fromEntries(
    FIELDS.map((name) => [name, values[name].trim()]).filter(([, value]) => value !== ''),
  ) as unknown as PractitionerValues;
  return { ...filled, membershipId };
}

/** What an edit sends: only what differs, trimmed; an emptied optional field is `null`. */
export function toChanges({
  base,
  values,
}: {
  base: PractitionerValues;
  values: PractitionerValues;
}): PractitionerChanges {
  return Object.fromEntries(
    FIELDS.filter((name) => values[name].trim() !== base[name].trim()).map((name) => [
      name,
      values[name].trim() || null,
    ]),
  );
}
