import { useSession } from '@/api/session/session-store.ts';
import { patientListName } from '@/features/patients/patient-name.ts';
import { AppLink } from '@/lib/app-link.tsx';
import { can } from '@/lib/permissions.ts';

import type { Appointment } from './api/appointments.ts';

function useMay(permission: string): boolean {
  const session = useSession();
  return session.status === 'signed-in' && can(session.permissions, permission);
}

/** The patient's name, a link to their record for those who may open it. */
export function PatientName({ patient }: { patient: Appointment['patient'] }) {
  const name = patientListName(patient);
  return useMay('patients.read') ? (
    <AppLink href={`/patients/${patient.id}`}>{name}</AppLink>
  ) : (
    <>{name}</>
  );
}

export function PractitionerName({ practitioner }: { practitioner: Appointment['practitioner'] }) {
  const { displayName, profileId } = practitioner;
  return useMay('directory.read') ? (
    <AppLink href={`/practitioners/${profileId}`}>{displayName}</AppLink>
  ) : (
    <>{displayName}</>
  );
}
