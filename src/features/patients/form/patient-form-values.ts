import type { NewPatient, Patient, PatientChanges } from '../api/patients.ts';

/** What the patient form holds: text as typed, except the sex choice. */
export interface PatientValues {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  sex: NonNullable<NewPatient['sex']>;
  /** `YYYY-MM-DD`, or '' for none. */
  birthDate: string;
  phone: string;
  email: string;
  addressLine: string;
  city: string;
  province: string;
  guardianName: string;
  guardianPhone: string;
  allergies: string;
  notes: string;
}

export const EMPTY_PATIENT: PatientValues = {
  firstName: '',
  middleName: '',
  lastName: '',
  suffix: '',
  sex: 'unknown',
  birthDate: '',
  phone: '',
  email: '',
  addressLine: '',
  city: '',
  province: '',
  guardianName: '',
  guardianPhone: '',
  allergies: '',
  notes: '',
};

/** The longest the API accepts for each text field (docs/openapi.json). */
export const MAX_LENGTHS = {
  firstName: 80,
  middleName: 80,
  lastName: 80,
  suffix: 20,
  email: 254,
  addressLine: 200,
  city: 120,
  province: 120,
  guardianName: 160,
  allergies: 2000,
  notes: 2000,
} as const;

/** The request that registers a patient: trimmed, with blank optional fields left out. */
export function toCreateRequest(values: PatientValues): NewPatient {
  const { firstName, lastName, sex, ...optional } = values;
  const filled = Object.fromEntries(
    Object.entries(optional)
      .map(([name, value]) => [name, value.trim()])
      .filter(([, value]) => value !== ''),
  ) as Partial<NewPatient>;
  return { ...filled, firstName: firstName.trim(), lastName: lastName.trim(), sex };
}

export const PATIENT_FIELDS = Object.keys(EMPTY_PATIENT) as (keyof PatientValues)[];

/** What the edit form starts with: the record, with "no value" as blank text. */
export function toFormValues(patient: Patient): PatientValues {
  return Object.fromEntries(
    PATIENT_FIELDS.map((name) => [name, patient[name] ?? '']),
  ) as unknown as PatientValues;
}

/**
 * What an edit sends besides the version: only the fields that differ from the record the form is
 * based on, trimmed; an emptied optional field is `null`. (The form refuses an emptied name.)
 */
export function toChanges({
  base,
  values,
}: {
  base: PatientValues;
  values: PatientValues;
}): PatientChanges {
  return Object.fromEntries(
    PATIENT_FIELDS.filter((name) => values[name].trim() !== base[name].trim()).map((name) => [
      name,
      values[name].trim() || null,
    ]),
  );
}
