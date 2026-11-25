import type { components } from '@/api/schema';

type NameParts = Pick<
  components['schemas']['PatientResponse'],
  'firstName' | 'middleName' | 'lastName' | 'suffix'
>;

/** "Last, First Middle Suffix": how lists show a person, so a family name is easy to scan for. */
export function patientListName({ firstName, middleName, lastName, suffix }: NameParts): string {
  const given = [firstName, middleName, suffix].filter(Boolean).join(' ');
  return `${lastName}, ${given}`;
}

/** "First Middle Last Suffix": headings and confirmations, which read naturally. */
export function patientFullName({ firstName, middleName, lastName, suffix }: NameParts): string {
  return [firstName, middleName, lastName, suffix].filter(Boolean).join(' ');
}
