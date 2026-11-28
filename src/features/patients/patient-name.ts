import type { components } from '@/api/schema';

type Patient = components['schemas']['PatientResponse'];
/** An appointment carries no middle name or suffix. */
type NameParts = Pick<Patient, 'firstName' | 'lastName'> &
  Partial<Pick<Patient, 'middleName' | 'suffix'>>;

/** "Last, First Middle Suffix": how lists show a person, so a family name is easy to scan for. */
export function patientListName({ firstName, middleName, lastName, suffix }: NameParts): string {
  const given = [firstName, middleName, suffix].filter(Boolean).join(' ');
  return `${lastName}, ${given}`;
}

/** "First Middle Last Suffix": headings and confirmations, which read naturally. */
export function patientFullName({ firstName, middleName, lastName, suffix }: NameParts): string {
  return [firstName, middleName, lastName, suffix].filter(Boolean).join(' ');
}
